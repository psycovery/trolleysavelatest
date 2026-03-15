// src/app/api/donations/route.ts
import { createClient } from '@/lib/supabase/server'
import { createDonationClaimIntent } from '@/lib/stripe'
import { calcDonationFee, poundsToPence } from '@/lib/utils'
import { NextResponse } from 'next/server'

// POST /api/donations — buyer claims a free item
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { listing_id, delivery_method, message } = await request.json()
  if (!listing_id || !delivery_method)
    return NextResponse.json({ error: 'listing_id and delivery_method are required' }, { status: 400 })

  // Fetch listing
  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listing_id)
    .eq('status', 'active')
    .eq('is_donation', true)
    .single()

  if (!listing) return NextResponse.json({ error: 'Donation listing not found or no longer available' }, { status: 404 })
  if (listing.seller_id === user.id) return NextResponse.json({ error: 'Cannot claim your own donation' }, { status: 400 })

  // Check no active claim already exists
  const { data: existingClaim } = await supabase
    .from('donation_claims')
    .select('id')
    .eq('listing_id', listing_id)
    .eq('status', 'claimed')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (existingClaim) return NextResponse.json({ error: 'This item is currently reserved by another buyer. Try again in 30 minutes.' }, { status: 409 })

  // Calculate fee — 0.5% of listed value, minimum £1.00
  const listedValuePence = poundsToPence(listing.asking_price ?? 0)
  const feePounds = calcDonationFee(listing.asking_price ?? 0)
  const feePence  = poundsToPence(feePounds)

  // Create Stripe payment intent for platform fee
  const paymentIntent = await createDonationClaimIntent({
    listedValuePence,
    metadata: {
      type: 'donation_claim',
      listing_id,
      buyer_id: user.id,
      listed_value: (listing.asking_price ?? 0).toString(),
    },
  })

  // Save claim
  const { data: claim, error } = await supabase.from('donation_claims').insert({
    listing_id,
    buyer_id: user.id,
    platform_fee: feePounds,
    delivery_method,
    message: message?.trim() || null,
    stripe_payment_intent_id: paymentIntent.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: claim,
    clientSecret: paymentIntent.client_secret,
    fee: feePounds,
  }, { status: 201 })
}
