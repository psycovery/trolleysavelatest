// src/app/api/reviews/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { seller_id, listing_id, transaction_id, rating, review_text } = await request.json()

  if (!seller_id || !rating || rating < 1 || rating > 5)
    return NextResponse.json({ error: 'seller_id and rating (1–5) are required' }, { status: 400 })

  // Verify buyer actually purchased from this seller
  if (transaction_id) {
    const { data: tx } = await supabase.from('transactions')
      .select('id').eq('id', transaction_id).eq('buyer_id', user.id).single()
    if (!tx) return NextResponse.json({ error: 'No matching purchase found' }, { status: 403 })
  }

  const { data, error } = await supabase.from('reviews').insert({
    seller_id,
    buyer_id: user.id,
    listing_id: listing_id ?? null,
    rating,
    review_text: review_text?.trim() || null,
  }).select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'You have already reviewed this purchase' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
