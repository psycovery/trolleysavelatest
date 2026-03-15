// src/app/api/buy-now/confirm/route.ts
// Called after Stripe card confirmation — captures payment and completes sale
import { createClient } from '@/lib/supabase/server'
import { capturePaymentIntent, calcPlatformFee } from '@/lib/stripe'
import { NextResponse } from 'next/server'
import { poundsToPence, penceToPounds } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { paymentIntentId, listing_id } = await request.json()
  if (!paymentIntentId || !listing_id)
    return NextResponse.json({ error: 'paymentIntentId and listing_id required' }, { status: 400 })

  // Verify listing still active
  const { data: listing } = await supabase
    .from('listings')
    .select('asking_price, seller_id, title')
    .eq('id', listing_id)
    .eq('status', 'active')
    .single()

  if (!listing)
    return NextResponse.json({ error: 'Listing no longer available' }, { status: 404 })

  // Capture payment immediately
  const captured = await capturePaymentIntent(paymentIntentId)
  const amountPence = captured.amount_received
  const feePence = calcPlatformFee(amountPence)
  const netPence = amountPence - feePence

  // Create offer record (accepted) and mark listing sold
  const { data: offer } = await supabase.from('offers').insert({
    listing_id,
    buyer_id: user.id,
    amount: penceToPounds(amountPence),
    status: 'accepted',
    stripe_payment_intent_id: paymentIntentId,
  }).select().single()

  await supabase.from('listings')
    .update({ status: 'sold' })
    .eq('id', listing_id)

  // Record transaction
  if (offer) {
    await supabase.from('transactions').insert({
      offer_id: offer.id,
      seller_id: listing.seller_id,
      buyer_id: user.id,
      gross_amount: penceToPounds(amountPence),
      platform_fee: penceToPounds(feePence),
      net_payout: penceToPounds(netPence),
      payout_status: 'pending',
    })
  }

  return NextResponse.json({ success: true, message: 'Purchase complete!' })
}
