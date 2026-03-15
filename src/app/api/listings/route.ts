// src/app/api/listings/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/listings — fetch listings with filters
export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const category     = searchParams.get('category')
  const search       = searchParams.get('q')
  const isDonation   = searchParams.get('donation') === 'true'
  const sortField    = searchParams.get('sort') ?? 'created_at'
  const sortDir      = searchParams.get('dir') ?? 'desc'
  const limit        = parseInt(searchParams.get('limit') ?? '48')

  let query = supabase
    .from('listings')
    .select('*, seller:profiles(id,full_name,rating,sales_count,postcode)')
    .eq('status', 'active')
    .order(sortField, { ascending: sortDir === 'asc' })
    .limit(limit)

  if (isDonation) query = query.eq('is_donation', true)
  else if (category) query = query.eq('category', category)

  if (search) {
    query = query.or(`title.ilike.%${search}%,brand.ilike.%${search}%,category.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/listings — create a new listing
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const {
    title, quantity, best_before, asking_price, is_donation,
    category, delivery_method, postcode, is_sponsored,
    allergens, description, barcode, brand,
  } = body

  // Basic validation
  if (!title?.trim())   return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (!best_before)     return NextResponse.json({ error: 'Best before date is required' }, { status: 400 })
  if (!category)        return NextResponse.json({ error: 'Category is required' }, { status: 400 })
  if (!postcode?.trim()) return NextResponse.json({ error: 'Postcode is required' }, { status: 400 })
  if (!is_donation && (!asking_price || asking_price <= 0))
    return NextResponse.json({ error: 'Asking price required for non-donation listings' }, { status: 400 })

  const { data, error } = await supabase.from('listings').insert({
    seller_id: user.id,
    title: title.trim(),
    brand: brand?.trim() || null,
    barcode: barcode?.trim() || null,
    quantity: parseInt(quantity) || 1,
    best_before: best_before.length === 7 ? `${best_before}-01` : best_before,
    asking_price: is_donation ? null : parseFloat(asking_price),
    is_donation: !!is_donation,
    category,
    delivery_method: delivery_method ?? 'both',
    postcode: postcode.trim().toUpperCase(),
    is_sponsored: !!is_sponsored,
    sponsored_until: is_sponsored ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
    allergens: allergens?.trim() || null,
    description: description?.trim() || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger wishlist matching in background (fire and forget)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/match-wishlists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listing: data }),
  }).catch(() => {}) // non-blocking

  return NextResponse.json({ data }, { status: 201 })
}
