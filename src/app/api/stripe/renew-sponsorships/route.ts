// src/app/api/stripe/renew-sponsorships/route.ts
// Called by Vercel cron daily — renews or expires sponsored listings
import { createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Verify this is called by Vercel cron (not a public request)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Find all sponsored listings that have expired
  const { data: expiredListings } = await supabase
    .from('listings')
    .select('id, seller_id, title')
    .eq('is_sponsored', true)
    .eq('status', 'active')
    .lt('sponsored_until', new Date().toISOString())

  if (!expiredListings?.length) {
    return NextResponse.json({ renewed: 0, expired: 0 })
  }

  let renewed = 0
  let expired = 0

  for (const listing of expiredListings) {
    // Get seller's payment method
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', listing.seller_id)
      .single()

    if (!profile?.stripe_customer_id) {
      // No customer — expire sponsorship
      await supabase.from('listings').update({
        is_sponsored: false,
        sponsored_fee_failed: true,
      }).eq('id', listing.id)
      expired++
      continue
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: profile.stripe_customer_id,
      type: 'card',
      limit: 1,
    })

    if (!paymentMethods.data.length) {
      await supabase.from('listings').update({
        is_sponsored: false,
        sponsored_fee_failed: true,
      }).eq('id', listing.id)
      expired++
      continue
    }

    try {
      const pi = await stripe.paymentIntents.create({
        amount: 150,
        currency: 'gbp',
        customer: profile.stripe_customer_id,
        payment_method: paymentMethods.data[0].id,
        confirm: true,
        off_session: true,
        description: `TrolleySave sponsorship renewal — ${listing.title}`,
        metadata: { type: 'sponsorship_renewal', listing_id: listing.id },
      })

      if (pi.status === 'succeeded') {
        await supabase.from('listings').update({
          sponsored_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          sponsored_fee_failed: false,
        }).eq('id', listing.id)
        renewed++
      } else {
        await supabase.from('listings').update({
          is_sponsored: false,
          sponsored_fee_failed: true,
        }).eq('id', listing.id)
        expired++
      }
    } catch {
      await supabase.from('listings').update({
        is_sponsored: false,
        sponsored_fee_failed: true,
      }).eq('id', listing.id)
      expired++
    }
  }

  return NextResponse.json({ renewed, expired })
}
