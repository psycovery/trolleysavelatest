// src/app/api/stripe/connect/route.ts
import { createClient } from '@/lib/supabase/server'
import { createConnectAccount, createOnboardingLink } from '@/lib/stripe'
import { NextResponse } from 'next/server'

// POST /api/stripe/connect — create or re-onboard a seller's Stripe Connect account
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const origin = process.env.NEXT_PUBLIC_APP_URL!

  // Fetch seller profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_account_id, stripe_verified')
    .eq('id', user.id)
    .single()

  let accountId = profile?.stripe_account_id

  // Create account if not yet started
  if (!accountId) {
    const account = await createConnectAccount(user.email!)
    accountId = account.id
    await supabase.from('profiles').update({ stripe_account_id: accountId }).eq('id', user.id)
  }

  // Generate onboarding link
  const link = await createOnboardingLink(accountId, origin)
  return NextResponse.json({ url: link.url })
}
