// src/app/api/stripe/sponsorship/route.ts
// Charges £1.50 sponsorship fee and marks listing as sponsored
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { listingId } = await request.json()
  if (!listingId) return NextResponse.json({ error: 'listingId required' }, { status: 400 })

  // Get seller profile with customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No payment method saved. Please add a card first.' }, { status: 422 })
  }

  // Get default payment method
  const paymentMethods = await stripe.paymentMethods.list({
    customer: profile.stripe_customer_id,
    type: 'card',
    limit: 1,
  })

  if (!paymentMethods.data.length) {
    return NextResponse.json({ error: 'No card on file. Please add a payment method first.' }, { status: 422 })
  }

  const paymentMethodId = paymentMethods.data[0].id

  // Charge £1.50
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 150, // £1.50 in pence
      currency: 'gbp',
      customer: profile.stripe_customer_id,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      description: `TrolleySave sponsorship fee — listing ${listingId}`,
      metadata: {
        type: 'sponsorship',
        listing_id: listingId,
        user_id: user.id,
      },
    })

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment did not succeed. Please check your card.' }, { status: 402 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Card charge failed' }, { status: 402 })
  }

  // Mark listing as sponsored
  const sponsoredUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('listings')
    .update({
      is_sponsored: true,
      sponsored_until: sponsoredUntil,
      sponsored_fee_failed: false,
    })
    .eq('id', listingId)
    .eq('seller_id', user.id)

  return NextResponse.json({ success: true, sponsoredUntil })
}
