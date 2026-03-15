// src/app/api/stripe/payment-method/route.ts
// Returns the seller's saved payment method details
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ paymentMethod: null })
  }

  // Get default payment method
  const paymentMethods = await stripe.paymentMethods.list({
    customer: profile.stripe_customer_id,
    type: 'card',
    limit: 1,
  })

  const pm = paymentMethods.data[0] ?? null
  return NextResponse.json({
    paymentMethod: pm ? {
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
    } : null,
  })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { paymentMethodId } = await request.json()
  await stripe.paymentMethods.detach(paymentMethodId)
  return NextResponse.json({ success: true })
}
