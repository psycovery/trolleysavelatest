// src/app/api/offers/route.ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createOfferPaymentIntent, cancelPaymentIntent, capturePaymentIntent } from '@/lib/stripe'
import { NextResponse } from 'next/server'
import { poundsToPence } from '@/lib/utils'

// POST /api/offers — buyer creates an offer
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { listing_id, amount, message } = await request.json()
  if (!listing_id || !amount || amount <= 0)
    return NextResponse.json({ error: 'listing_id and amount are required' }, { status: 400 })

  // Fetch listing + seller
  const { data: listing } = await supabase
    .from('listings')
    .select('*, seller:profiles(stripe_account_id, stripe_verified)')
    .eq('id', listing_id)
    .eq('status', 'active')
    .single()

  if (!listing) return NextResponse.json({ error: 'Listing not found or no longer active' }, { status: 404 })
  if (listing.is_donation) return NextResponse.json({ error: 'Use /api/donations for free items' }, { status: 400 })
  if (listing.seller_id === user.id) return NextResponse.json({ error: 'Cannot offer on your own listing' }, { status: 400 })

  const seller = listing.seller as any
  if (!seller?.stripe_verified || !seller?.stripe_account_id)
    return NextResponse.json({ error: 'Seller payment account not yet verified' }, { status: 422 })

  // Create Stripe payment intent (held, not charged yet)
  const amountPence = poundsToPence(parseFloat(amount))
  const paymentIntent = await createOfferPaymentIntent({
    amountPence,
    sellerStripeAccountId: seller.stripe_account_id,
    metadata: { listing_id, buyer_id: user.id, offer_amount: amount.toString() },
  })

  // Save offer to DB
  const { data: offer, error } = await supabase.from('offers').insert({
    listing_id,
    buyer_id: user.id,
    amount: parseFloat(amount),
    stripe_payment_intent_id: paymentIntent.id,
    message: message?.trim() || null,
  }).select().single()

  if (error) {
    await cancelPaymentIntent(paymentIntent.id).catch(() => {})
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: offer,
    clientSecret: paymentIntent.client_secret,
  }, { status: 201 })
}
