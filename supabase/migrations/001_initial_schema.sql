-- supabase/migrations/001_initial_schema.sql
-- Run via: supabase db push  OR  paste into Supabase SQL editor

-- ═══════════════════════════════════════
-- EXTENSIONS
-- ═══════════════════════════════════════
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";  -- for fuzzy text search

-- ═══════════════════════════════════════
-- PROFILES (extends auth.users)
-- ═══════════════════════════════════════
create table public.profiles (
  id                  uuid references auth.users(id) on delete cascade primary key,
  full_name           text not null,
  postcode            text not null,
  stripe_account_id   text unique,
  stripe_customer_id  text unique,
  stripe_verified     boolean not null default false,
  aml_status          text not null default 'clear' check (aml_status in ('clear','review','flagged')),
  rating              numeric(3,2),
  sales_count         integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, postcode)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'postcode', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ═══════════════════════════════════════
-- LISTINGS
-- ═══════════════════════════════════════
create table public.listings (
  id               uuid primary key default gen_random_uuid(),
  seller_id        uuid not null references public.profiles(id) on delete cascade,
  title            text not null,
  brand            text,
  barcode          text,
  quantity         integer not null default 1,
  best_before      date not null,
  asking_price     numeric(10,2),          -- null for donations
  is_donation      boolean not null default false,
  category         text not null,
  delivery_method  text not null default 'both' check (delivery_method in ('post','collect','both')),
  postcode         text not null,
  status           text not null default 'active'
                   check (status in ('active','sold','paused','donated','expired')),
  is_sponsored     boolean not null default false,
  sponsored_until  timestamptz,
  image_url        text,
  allergens        text,
  description      text,
  view_count       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Either a price or a donation, never both
  constraint price_or_donation check (
    (is_donation = true and asking_price is null) or
    (is_donation = false and asking_price is not null and asking_price > 0)
  )
);

create index idx_listings_status      on public.listings(status);
create index idx_listings_seller      on public.listings(seller_id);
create index idx_listings_category    on public.listings(category);
create index idx_listings_donation    on public.listings(is_donation) where is_donation = true;
create index idx_listings_sponsored   on public.listings(is_sponsored, sponsored_until) where is_sponsored = true;
create index idx_listings_title_trgm  on public.listings using gin (title gin_trgm_ops);
create index idx_listings_brand_trgm  on public.listings using gin (brand gin_trgm_ops);

-- ═══════════════════════════════════════
-- OFFERS
-- ═══════════════════════════════════════
create table public.offers (
  id                       uuid primary key default gen_random_uuid(),
  listing_id               uuid not null references public.listings(id) on delete cascade,
  buyer_id                 uuid not null references public.profiles(id) on delete cascade,
  amount                   numeric(10,2) not null check (amount > 0),
  status                   text not null default 'pending'
                           check (status in ('pending','accepted','declined','countered','expired')),
  stripe_payment_intent_id text,
  message                  text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_offers_listing on public.offers(listing_id);
create index idx_offers_buyer   on public.offers(buyer_id);
create index idx_offers_status  on public.offers(status);

-- ═══════════════════════════════════════
-- DONATION CLAIMS
-- ═══════════════════════════════════════
create table public.donation_claims (
  id                       uuid primary key default gen_random_uuid(),
  listing_id               uuid not null references public.listings(id) on delete cascade,
  buyer_id                 uuid not null references public.profiles(id) on delete cascade,
  platform_fee             numeric(10,2) not null check (platform_fee >= 1.00),
  delivery_method          text not null check (delivery_method in ('post','collect')),
  status                   text not null default 'claimed'
                           check (status in ('claimed','confirmed','expired')),
  message                  text,
  stripe_payment_intent_id text,
  claimed_at               timestamptz not null default now(),
  expires_at               timestamptz not null default now() + interval '30 minutes'
);

create index idx_claims_listing on public.donation_claims(listing_id);
create index idx_claims_buyer   on public.donation_claims(buyer_id);
create index idx_claims_status  on public.donation_claims(status);

-- ═══════════════════════════════════════
-- WISHLISTS
-- ═══════════════════════════════════════
create table public.wishlists (
  id               uuid primary key default gen_random_uuid(),
  buyer_id         uuid not null references public.profiles(id) on delete cascade,
  product_name     text not null,
  match_type       text not null default 'exact' check (match_type in ('exact','brand','category')),
  location_radius  integer not null default 10,   -- miles
  created_at       timestamptz not null default now()
);

create index idx_wishlists_buyer on public.wishlists(buyer_id);

-- ═══════════════════════════════════════
-- WISHLIST MATCHES (notifications)
-- ═══════════════════════════════════════
create table public.wishlist_matches (
  id           uuid primary key default gen_random_uuid(),
  wishlist_id  uuid not null references public.wishlists(id) on delete cascade,
  listing_id   uuid not null references public.listings(id) on delete cascade,
  buyer_id     uuid not null references public.profiles(id) on delete cascade,
  notified_at  timestamptz not null default now(),
  seen         boolean not null default false,
  unique (wishlist_id, listing_id)
);

create index idx_matches_buyer   on public.wishlist_matches(buyer_id);
create index idx_matches_seen    on public.wishlist_matches(buyer_id, seen) where seen = false;

-- ═══════════════════════════════════════
-- REVIEWS
-- ═══════════════════════════════════════
create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.profiles(id) on delete cascade,
  buyer_id     uuid not null references public.profiles(id) on delete cascade,
  listing_id   uuid not null references public.listings(id) on delete cascade,
  rating       integer not null check (rating between 1 and 5),
  review_text  text,
  created_at   timestamptz not null default now(),
  unique (buyer_id, listing_id)   -- one review per purchase
);

create index idx_reviews_seller on public.reviews(seller_id);

-- Auto-update seller rating average
create or replace function public.update_seller_rating()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles
  set rating = (
    select round(avg(rating)::numeric, 2)
    from public.reviews
    where seller_id = coalesce(new.seller_id, old.seller_id)
  )
  where id = coalesce(new.seller_id, old.seller_id);
  return new;
end;
$$;

create trigger on_review_change
  after insert or update or delete on public.reviews
  for each row execute procedure public.update_seller_rating();

-- ═══════════════════════════════════════
-- TRANSACTIONS
-- ═══════════════════════════════════════
create table public.transactions (
  id                   uuid primary key default gen_random_uuid(),
  offer_id             uuid references public.offers(id),
  donation_claim_id    uuid references public.donation_claims(id),
  seller_id            uuid references public.profiles(id),
  buyer_id             uuid not null references public.profiles(id),
  gross_amount         numeric(10,2) not null,
  platform_fee         numeric(10,2) not null,
  net_payout           numeric(10,2) not null,
  stripe_transfer_id   text,
  payout_status        text not null default 'pending'
                       check (payout_status in ('pending','paid','failed')),
  created_at           timestamptz not null default now(),

  check (offer_id is not null or donation_claim_id is not null)
);

create index idx_transactions_seller on public.transactions(seller_id);
create index idx_transactions_status on public.transactions(payout_status);

-- ═══════════════════════════════════════
-- SAVED LISTINGS
-- ═══════════════════════════════════════
create table public.saved_listings (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ═══════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════

-- profiles: users see all, edit own
alter table public.profiles enable row level security;
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- listings: anyone can view active, seller edits own
alter table public.listings enable row level security;
create policy "listings_select_active" on public.listings for select using (status = 'active');
create policy "listings_select_own"    on public.listings for select using (auth.uid() = seller_id);
create policy "listings_insert"        on public.listings for insert with check (auth.uid() = seller_id);
create policy "listings_update"        on public.listings for update using (auth.uid() = seller_id);

-- offers: buyer sees own, seller sees offers on their listings
alter table public.offers enable row level security;
create policy "offers_select_buyer"  on public.offers for select using (auth.uid() = buyer_id);
create policy "offers_select_seller" on public.offers for select using (
  auth.uid() = (select seller_id from public.listings where id = listing_id)
);
create policy "offers_insert"  on public.offers for insert with check (auth.uid() = buyer_id);
create policy "offers_update"  on public.offers for update using (
  auth.uid() = buyer_id or
  auth.uid() = (select seller_id from public.listings where id = listing_id)
);

-- donation claims: buyer sees own
alter table public.donation_claims enable row level security;
create policy "claims_select" on public.donation_claims for select using (auth.uid() = buyer_id);
create policy "claims_insert" on public.donation_claims for insert with check (auth.uid() = buyer_id);

-- wishlists: buyer sees and manages own
alter table public.wishlists enable row level security;
create policy "wishlists_all" on public.wishlists using (auth.uid() = buyer_id);

-- wishlist_matches: buyer sees own
alter table public.wishlist_matches enable row level security;
create policy "matches_select" on public.wishlist_matches for select using (auth.uid() = buyer_id);

-- reviews: all can read, only buyer who purchased can create
alter table public.reviews enable row level security;
create policy "reviews_select" on public.reviews for select using (true);
create policy "reviews_insert" on public.reviews for insert with check (auth.uid() = buyer_id);

-- saved_listings: user sees own
alter table public.saved_listings enable row level security;
create policy "saved_all" on public.saved_listings using (auth.uid() = user_id);

-- transactions: seller and buyer see own
alter table public.transactions enable row level security;
create policy "transactions_select" on public.transactions for select using (
  auth.uid() = seller_id or auth.uid() = buyer_id
);

-- ═══════════════════════════════════════
-- STORAGE BUCKETS
-- ═══════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict do nothing;

create policy "listing_images_select" on storage.objects
  for select using (bucket_id = 'listing-images');

create policy "listing_images_insert" on storage.objects
  for insert with check (
    bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "listing_images_delete" on storage.objects
  for delete using (
    bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]
  );
