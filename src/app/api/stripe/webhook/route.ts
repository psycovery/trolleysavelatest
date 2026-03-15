// src/app/api/stripe/webhook/route.ts
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.text()
  const sig  = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      const { type, listing_id, buyer_id } = pi.metadata

      if (type === 'donation_claim') {
        await supabase.from('donation_claims')
          .update({ status: 'confirmed' })
          .eq('stripe_payment_intent_id', pi.id)

        await supabase.from('listings')
          .update({ status: 'donated' })
          .eq('id', listing_id)

        const { data: claim } = await supabase
          .from('donation_claims')
          .select('id')
          .eq('stripe_payment_intent_id', pi.id)
          .single()

        if (claim) {
          await supabase.from('transactions').insert({
            donation_claim_id: claim.id,
            seller_id: null,
            buyer_id,
            gross_amount: pi.amount / 100,
            platform_fee: pi.amount / 100,
            net_payout: 0,
            payout_status: 'paid',
          })
        }
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent
      await supabase.from('donation_claims')
        .update({ status: 'expired' })
        .eq('stripe_payment_intent_id', pi.id)
        .eq('status', 'claimed')
      break
    }

    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      const verified = account.charges_enabled && account.payouts_enabled
      await supabase.from('profiles')
        .update({ stripe_verified: verified })
        .eq('stripe_account_id', account.id)
      break
    }

    case 'transfer.created': {
      const transfer = event.data.object as Stripe.Transfer
      await supabase.from('transactions')
        .update({ payout_status: 'paid', stripe_transfer_id: transfer.id })
        .eq('stripe_transfer_id', null)
        .eq('payout_status', 'pending')
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
