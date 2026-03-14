// src/app/api/match-wishlists/route.ts
// Called after a new listing is created — finds matching wishlists and creates notifications
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Listing } from '@/types'

export async function POST(request: Request) {
  const { listing }: { listing: Listing } = await request.json()
  if (!listing) return NextResponse.json({ error: 'listing required' }, { status: 400 })

  const supabase = createAdminClient()

  // Find wishlists that could match
  const { data: wishlists } = await supabase
    .from('wishlists')
    .select('*')
    .neq('buyer_id', listing.seller_id) // don't notify the seller

  if (!wishlists?.length) return NextResponse.json({ matched: 0 })

  const titleLower    = listing.title.toLowerCase()
  const brandLower    = (listing.brand ?? '').toLowerCase()
  const categoryLower = listing.category.toLowerCase()

  const matches = wishlists.filter(w => {
    const term = w.product_name.toLowerCase()
    if (w.match_type === 'exact')    return titleLower.includes(term) || term.includes(titleLower.split(' ')[0])
    if (w.match_type === 'brand')    return brandLower.includes(term) || term.includes(brandLower.split(' ')[0])
    if (w.match_type === 'category') return categoryLower.includes(term) || term.includes(categoryLower)
    return false
  })

  if (!matches.length) return NextResponse.json({ matched: 0 })

  // Insert match records (triggers real-time notification to buyers)
  const { error } = await supabase.from('wishlist_matches').insert(
    matches.map(w => ({
      wishlist_id: w.id,
      listing_id:  listing.id,
      buyer_id:    w.buyer_id,
    }))
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ matched: matches.length })
}
