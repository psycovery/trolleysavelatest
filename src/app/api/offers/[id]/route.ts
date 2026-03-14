// src/app/api/offers/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { capturePaymentIntent, cancelPaymentIntent, calcPlatformFee } from '@/lib/stripe'
import { NextResponse } from 'next/server'
import { poundsToPence, penceToPounds } from '@/lib/utils'

// PATCH /api/offers/[id] — seller accepts or declines
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { action } = await request.json() // 'accept' | 'decline'
  if (!['accept', 'decline'].includes(action))
    return NextResponse.json({ error: 'action must be accept or decline' }, { status: 400 })

  // Fetch offer + listing
  const { data: offer } = await supabase
    .from('offers')
    .select('*, listing:listings(seller_id, title)')
    .eq('id', params.id)
    .eq('status', 'pending')
    .single()

  if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
  if ((offer.listing as any).seller_id !== user.id)
    return NextResponse.json({ error: 'Only the seller can respond to offers' }, { status: 403 })

  if (action === 'decline') {
    // Cancel payment intent and update offer
    if (offer.stripe_payment_intent_id)
      await cancelPaymentIntent(offer.stripe_payment_intent_id).catch(() => {})

    await supabase.from('offers').update({ status: 'declined' }).eq('id', offer.id)
    return NextResponse.json({ data: { status: 'declined' } })
  }

  // Accept — capture payment
  if (!offer.stripe_payment_intent_id)
    return NextResponse.json({ error: 'No payment intent found' }, { status: 422 })

  const captured = await capturePaymentIntent(offer.stripe_payment_intent_id)
  const amountPence = captured.amount_received
  const feePence = calcPlatformFee(amountPence)
  const netPence = amountPence - feePence

  // Update offer + listing status
  await supabase.from('offers').update({ status: 'accepted' }).eq('id', offer.id)
  await supabase.from('listings').update({ status: 'sold' }).eq('id', offer.listing_id)

  // Record transaction
  await supabase.from('transactions').insert({
    offer_id: offer.id,
    seller_id: user.id,
    buyer_id: offer.buyer_id,
    gross_amount: penceToPounds(amountPence),
    platform_fee: penceToPounds(feePence),
    net_payout: penceToPounds(netPence),
    stripe_transfer_id: (captured as any).transfer_data?.destination ?? null,
    payout_status: 'pending',
  })

  // Increment seller sales count
  await supabase.rpc('increment_sales_count', { seller_id: user.id })

  return NextResponse.json({ data: { status: 'accepted', net_payout: penceToPounds(netPence) } })
}
