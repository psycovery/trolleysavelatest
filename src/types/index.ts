// src/types/index.ts — TrolleySave shared types

export type Profile = {
  id: string
  full_name: string
  nickname: string | null
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
  best_before: string
  asking_price: number | null
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
  listing?: Listing
  buyer?: Profile
}

export type DonationClaim = {
  id: string
  listing_id: string
  buyer_id: string
  platform_fee: number
  delivery_method: DeliveryMethod
  status: 'claimed' | 'confirmed' | 'expired'
  message: string | null
  claimed_at: string
  expires_at: string
  listing?: Listing
}

export type MatchType = 'exact' | 'brand' | 'category'

export type WishlistItem = {
  id: string
  buyer_id: string
  product_name: string
  match_type: MatchType
  location_radius: number
  created_at:
