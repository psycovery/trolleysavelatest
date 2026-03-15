// src/app/api/stripe/connect/route.ts
import { createClient } from '@/lib/supabase/server'
import { createConnectAccount, createOnboardingLink } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://trolleysave98.vercel.app'

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_account_id, stripe_verified, full_name')
    .eq('id', user.id)
    .single()

  let accountId = profile?.stripe_account_id

  if (!accountId) {
    const account = await createConnectAccount(user.email!, profile?.full_name)
    accountId = account.id
    await supabase
      .from('profiles')
      .update({ stripe_account_id: accountId })
      .eq('id', user.id)
  }

  const link = await createOnboardingLink(accountId, origin)
  return NextResponse.json({ url: link.url })
}
