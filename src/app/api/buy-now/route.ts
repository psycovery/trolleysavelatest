// src/app/api/buy-now/route.ts
// Buyer pays asking price immediately — no seller approval needed
import { createClient } from '@/lib/supabase/server'
import { createOfferPaymentIntent, capturePaymentIntent, calcPlatformFee } from '@/lib/stripe'
import { NextResponse } from 'next/server'
import { poundsToPence, penceToPounds } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { listing_id } = await request.json()
  if (!listing_id) return NextResponse.json({ error: 'listing_id required' }, { status: 400 })

  // Fetch listing + seller
  const { data: listing } = await supabase
    .from('listings')
    .select('*, seller:profiles(stripe_account_id, stripe_verified)')
    .eq('id', listing_id)
    .eq('status', 'active')
    .single()

  if (!listing)
    return NextResponse.json({ error: 'Listing not found or no longer active' }, { status: 404 })
  if (listing.is_donation)
    return NextResponse.json({ error: 'Use /api/donations for free items' }, { status: 400 })
  if (listing.seller_id === user.id)
    return NextResponse.json({ error: 'Cannot buy your own listing' }, { status: 400 })
  if (!listing.asking_price || listing.asking_price <= 0)
    return NextResponse.json({ error: 'Listing has no asking price' }, { status: 422 })

  const seller = listing.seller as any
  if (!seller?.stripe_verified || !seller?.stripe_account_id)
    return NextResponse.json({ error: 'Seller payment account not yet verified' }, { status: 422 })

  const amountPence = poundsToPence(listing.asking_price)

  // Create payment intent at full asking price
  const paymentIntent = await createOfferPaymentIntent({
    amountPence,
    sellerStripeAccountId: seller.stripe_account_id,
    metadata: {
      listing_id,
      buyer_id: user.id,
      type: 'buy_now',
      amount: listing.asking_price.toString(),
    },
  })

  // Return client secret — frontend confirms card, then we capture
  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: listing.asking_price,
    listingTitle: listing.title,
  })
}
