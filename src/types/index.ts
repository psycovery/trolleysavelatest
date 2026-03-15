// src/types/index.ts — TrolleySave shared types

export type Profile = {
  id: string
  full_name: string
  postcode: string
  stripe_account_id: string | null
  stripe_verified: boolean
  aml_status: 'clear' | 'review' | 'flagged'
  rating: number | null
  sales_count: number
  created_at: string
}

export type ListingStatus = 'active' | 'sold' | 'paused' | 'donated' | 'expired'
export type DeliveryMethod = 'post' | 'collect' | 'both'

export type Listing = {
  id: string
  seller_id: string
  title: string
  view_count: number
  brand: string | null
  barcode: string | null
  quantity: number
  best_before: string         // ISO date YYYY-MM-DD
  asking_price: number | null // null = donation
  is_donation: boolean
  category: string
  delivery_method: DeliveryMethod
  postcode: string
  status: ListingStatus
  is_sponsored: boolean
  sponsored_until: string | null
  image_url: string | null
  allergens: string | null
  description: string | null
  created_at: string
  // Joined
  seller?: Profile
}

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'countered' | 'expired'

export type Offer = {
  id: string
  listing_id: string
  buyer_id: string
  amount: number
  status: OfferStatus
  stripe_payment_intent_id: string | null
  created_at: string
  // Joined
  listing?: Listing
  buyer?: Profile
}

export type DonationClaim = {
  id: string
  listing_id: string
  buyer_id: string
  platform_fee: number        // min £1.00
  delivery_method: DeliveryMethod
  status: 'claimed' | 'confirmed' | 'expired'
  message: string | null
  claimed_at: string
  expires_at: string
  // Joined
  listing?: Listing
}

export type MatchType = 'exact' | 'brand' | 'category'

export type WishlistItem = {
  id: string
  buyer_id: string
  product_name: string
  match_type: MatchType
  location_radius: number     // miles
  created_at: string
}

export type WishlistMatch = {
  id: string
  wishlist_id: string
  listing_id: string
  buyer_id: string
  notified_at: string
  seen: boolean
  // Joined
  listing?: Listing
  wishlist?: WishlistItem
}

export type Review = {
  id: string
  seller_id: string
  buyer_id: string
  listing_id: string
  rating: number              // 1–5
  review_text: string | null
  created_at: string
  // Joined
  buyer?: Profile
  listing?: Listing
}

export type PayoutStatus = 'pending' | 'paid' | 'failed'

export type Transaction = {
  id: string
  offer_id: string | null
  donation_claim_id: string | null
  seller_id: string | null
  buyer_id: string
  gross_amount: number
  platform_fee: number
  net_payout: number
  stripe_transfer_id: string | null
  payout_status: PayoutStatus
  created_at: string
  // Joined
  seller?: Profile
  buyer?: Profile
}

export type BasketItem = {
  id: string
  listing_id: string
  listing: Listing
  quantity: number
}

// API response shapes
export type ApiSuccess<T> = { data: T; error: null }
export type ApiError     = { data: null; error: string }
export type ApiResponse<T> = ApiSuccess<T> | ApiError

// Stripe Connect onboarding
export type StripeConnectStatus = 'not_started' | 'pending' | 'verified' | 'failed'
