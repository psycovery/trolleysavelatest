# TrolleySave — Setup Guide

## What's in this project

A full Next.js 14 app with:
- **Supabase** for database, auth, real-time notifications, and file storage
- **Stripe Connect** for marketplace payments, escrow, and seller payouts
- **Tailwind CSS** with TrolleySave's design tokens

---

## Prerequisites

- Node.js 18+
- A Supabase account (free): https://supabase.com
- A Stripe account (free): https://stripe.com
- A Vercel account (free): https://vercel.com

---

## Step 1 — Install dependencies

```bash
npm install
```

---

## Step 2 — Set up Supabase

### 2a. Create a project

1. Go to https://supabase.com/dashboard
2. Click **New project**
3. Choose a name (e.g. `trolleysave`), region (Europe West), and database password
4. Wait ~2 minutes for provisioning

### 2b. Run the database schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Open `supabase/migrations/001_initial_schema.sql` from this project
3. Paste the entire contents and click **Run**
4. This creates all tables, RLS policies, triggers, and storage buckets

### 2c. Enable Auth providers

1. Go to **Authentication → Providers**
2. Enable **Google** — you'll need a Google OAuth client ID/secret from https://console.cloud.google.com
3. Enable **Apple** (optional) — requires Apple Developer account
4. Set **Site URL** to `http://localhost:3000` (change to production URL later)
5. Add `http://localhost:3000/auth/callback` to **Redirect URLs**

### 2d. Get your API keys

1. Go to **Settings → API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (**keep this secret**)

---

## Step 3 — Set up Stripe

### 3a. Get API keys

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy:
   - **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** → `STRIPE_SECRET_KEY`

### 3b. Enable Connect

1. Go to **Connect → Settings**
2. Enable **Express accounts** for the UK
3. Set branding (logo, colours) — sellers will see this during bank onboarding

### 3c. Set up webhooks (local dev)

Install the Stripe CLI: https://stripe.com/docs/stripe-cli

```bash
# In a separate terminal — keep this running
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the **webhook signing secret** it gives you → `STRIPE_WEBHOOK_SECRET`

### 3d. Webhooks for production (Vercel)

1. Go to **Developers → Webhooks → Add endpoint**
2. URL: `https://your-domain.vercel.app/api/stripe/webhook`
3. Events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `account.updated`
   - `transfer.created`
4. Copy the signing secret → `STRIPE_WEBHOOK_SECRET` in Vercel env vars

---

## Step 4 — Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in all values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=TrolleySave
```

---

## Step 5 — Run locally

```bash
npm run dev
```

Visit http://localhost:3000

---

## Step 6 — Deploy to Vercel

### 6a. Push to GitHub

```bash
git init
git add .
git commit -m "Initial TrolleySave app"
git remote add origin https://github.com/your-username/trolleysave.git
git push -u origin main
```

### 6b. Import to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Framework: **Next.js** (auto-detected)
4. Add all environment variables from `.env.local`
   - Change `NEXT_PUBLIC_APP_URL` to your Vercel URL
5. Click **Deploy**

### 6c. Update Supabase redirect URLs

In Supabase → Authentication → URL Configuration:
- Add your Vercel URL to **Redirect URLs**: `https://your-app.vercel.app/auth/callback`

### 6d. Update Stripe webhook

Add your production Vercel URL as a webhook endpoint in Stripe (see Step 3d).

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                    # Home page
│   ├── auth/
│   │   ├── login/page.tsx          # Login
│   │   ├── register/page.tsx       # Registration
│   │   └── callback/route.ts       # OAuth callback
│   ├── listing/[id]/page.tsx       # Listing detail
│   ├── seller/page.tsx             # Seller dashboard
│   ├── buyer/page.tsx              # Buyer profile + wishlist
│   ├── admin/page.tsx              # Admin dashboard
│   └── api/
│       ├── listings/route.ts       # Listings CRUD
│       ├── offers/route.ts         # Create offer
│       ├── offers/[id]/route.ts    # Accept/decline offer
│       ├── donations/route.ts      # Claim donation (£1 min fee)
│       ├── reviews/route.ts        # Submit review
│       ├── match-wishlists/route.ts # Wishlist matching
│       └── stripe/
│           ├── webhook/route.ts    # Stripe webhook handler
│           └── connect/route.ts    # Seller onboarding
├── components/
│   ├── layout/                     # Header, Footer, BottomNav
│   ├── listings/                   # ListingCard, ListingsGrid
│   ├── modals/                     # OfferModal, SellModal, ClaimModal
│   └── ui/                         # Toast, Badge, Spinner, etc.
├── lib/
│   ├── supabase/client.ts          # Browser Supabase client
│   ├── supabase/server.ts          # Server Supabase client + admin client
│   ├── stripe.ts                   # Stripe helpers + fee calculations
│   └── utils.ts                    # Shared utilities
├── types/index.ts                  # TypeScript types for all entities
└── middleware.ts                   # Auth session refresh + route protection
supabase/
└── migrations/
    └── 001_initial_schema.sql      # Full DB schema, RLS, triggers, storage
```

---

## Key business rules (implemented)

| Rule | Where |
|------|-------|
| 1.5% seller fee on all sales | `src/lib/stripe.ts` → `calcPlatformFee()` |
| 0.5% donation claim fee, minimum £1.00 | `src/lib/utils.ts` → `calcDonationFee()` |
| £1.50/week sponsorship | `src/lib/stripe.ts` → `createSponsorshipCharge()` |
| Donation reservation expires in 30 mins | `supabase/migrations/001_initial_schema.sql` |
| Escrow — payment held until dispatch confirmed | `src/app/api/offers/route.ts` → `capture_method: 'manual'` |
| First-come-first-served donations | `src/app/api/donations/route.ts` checks for active claims |
| Seller rating auto-updates on review | DB trigger `on_review_change` |
| RLS — users only see their own data | Supabase RLS policies in migration |

---

## Stripe test cards

Use these in development (Stripe test mode):

| Card | Number | Use for |
|------|--------|---------|
| Visa | `4242 4242 4242 4242` | Successful payment |
| Auth required | `4000 0025 0000 3155` | 3D Secure |
| Declined | `4000 0000 0000 9995` | Test decline |
| Insufficient funds | `4000 0000 0000 9995` | Test failure |

Any future date for expiry, any 3 digits for CVC.

---

## Next steps after launch

1. **Barcode lookup** — integrate Open Food Facts API (`https://world.openfoodfacts.org/api/v0/product/{barcode}.json`)
2. **Supermarket prices** — integrate Trolley.co.uk API for live price comparison
3. **Push notifications** — use Supabase real-time + browser push API
4. **Royal Mail** — integrate Click & Drop API for seller postage labels
5. **Email notifications** — add Resend (`npm install resend`) for offer accepted/declined emails
6. **Image upload** — add Supabase Storage upload in the SellModal (use `supabase.storage.from('listing-images').upload()`)
7. **OFSI sanctions screening** — integrate before processing any payments (required from May 2025)
