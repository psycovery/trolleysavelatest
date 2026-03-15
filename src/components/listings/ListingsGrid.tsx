'use client'
// src/components/listings/ListingsGrid.tsx
import { useState, useEffect, useCallback } from 'react'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Listing } from '@/types'
import { ListingCard } from './ListingCard'
import { Spinner, showToast } from '@/components/ui'

const CATEGORIES = [
  { label: 'All listings',      value: '' },
  { label: '🆓 Free to claim', value: 'donation' },
  { label: '🥫 Beans & pulses', value: 'beans' },
  { label: '🍅 Tomatoes & sauce', value: 'tomatoes' },
  { label: '🥣 Soups',          value: 'soups' },
  { label: '🐟 Fish',           value: 'fish' },
  { label: '🥝 Fruit',          value: 'fruit' },
  { label: '🥕 Vegetables',     value: 'vegetables' },
  { label: '🍲 Ready meals',    value: 'ready-meals' },
  { label: '🧴 Condiments',     value: 'condiments' },
]

const SORT_OPTIONS = [
  { label: 'Most recent',      value: 'created_at:desc' },
  { label: 'Price: low→high',  value: 'asking_price:asc' },
  { label: 'Price: high→low',  value: 'asking_price:desc' },
  { label: 'Seller rating',    value: 'rating:desc' },
  { label: 'Expiry soonest',   value: 'best_before:asc' },
]

interface Props {
  onOffer: (listing: Listing) => void
  onClaim: (listing: Listing) => void
}

export function ListingsGrid({ onOffer, onClaim }: Props) {
  const supabase = createClient()

  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading]   = useState(true)
  const [category, setCategory] = useState('')
  const [sort, setSort]         = useState('created_at:desc')
  const [search, setSearch]     = useState('')
  const [saved, setSaved]       = useState<Set<string>>(new Set())

  // Read initial search query from URL without useSearchParams
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const q = params.get('q')
      if (q) setSearch(q)
    }
  }, [])

  const fetchListings = useCallback(async () => {
    setLoading(true)
    const [sortField, sortDir] = sort.split(':')

    let query = supabase
      .from('listings')
      .select('*, seller:profiles(id,full_name,rating,sales_count,postcode)')
      .eq('status', 'active')
      .order(sortField, { ascending: sortDir === 'asc' })
      .limit(48)

    if (category === 'donation') {
      query = query.eq('is_donation', true)
    } else if (category) {
      query = query.eq('category', category)
    }

    if (search.trim()) {
      query = query.or(
        `title.ilike.%${search}%,brand.ilike.%${search}%,category.ilike.%${search}%`
      )
    }

    const { data, error } = await query
    if (!error && data) setListings(data as Listing[])
    setLoading(false)
  }, [category, sort, search])

  useEffect(() => { fetchListings() }, [fetchListings])

  async function toggleSave(listing: Listing) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { showToast('Log in to save listings'); return }

    const newSaved = new Set(saved)
    if (newSaved.has(listing.id)) {
      await supabase.from('saved_listings').delete()
        .eq('user_id', user.id).eq('listing_id', listing.id)
      newSaved.delete(listing.id)
      showToast('Removed from saved')
    } else {
      await supabase.from('saved_listings').insert({ user_id: user.id, listing_id: listing.id })
      newSaved.add(listing.id)
      showToast('❤️ Saved!')
    }
    setSaved(newSaved)
  }

  const sponsoredListings = listings.filter(l => l.is_sponsored && !l.is_donation)
  const regularListings   = listings.filter(l => !l.is_donation && !l.is_sponsored)
  const donationListings  = listings.filter(l => l.is_donation)

  return (
    <div>
      {/* Category pills */}
      <nav className="bg-white border-b border-gray-100 px-4 overflow-x-auto scrollbar-none">
        <div className="max-w-6xl mx-auto flex gap-2 py-3 min-w-max">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-4 py-1.5 rounded-full border text-sm font-medium transition-all whitespace-nowrap
                ${category === cat.value
                  ? 'border-green-600 bg-green-50 text-green-700'
                  : 'border-gray-100 bg-white text-gray-700 hover:border-green-400'
                }
                ${cat.value === 'donation' ? 'border-green-200 text-green-700' : ''}
              `}
            >
              {cat.value === '' && (
                <span className="w-2 h-2 rounded-full bg-green-600 inline-block mr-1.5" />
              )}
              {cat.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Search + sort */}
        <div className="bg-white border border-gray-100 rounded-[14px] p-3 mb-5 flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search brands, products…"
              className="w-full pl-9 py-2 border border-gray-100 rounded-lg text-sm outline-none focus:border-green-600 transition-colors"
            />
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-lg text-sm outline-none bg-white text-gray-700 cursor-pointer"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <p className="text-sm text-gray-400 mb-3">
          {loading ? 'Loading…' : `${listings.length} listing${listings.length !== 1 ? 's' : ''}`}
          {search && ` matching "${search}"`}
        </p>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🥫</p>
            <p className="font-semibold">No listings found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        ) : (
          <>
            {/* Sponsored */}
            {sponsoredListings.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sponsored</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {sponsoredListings.map(l => (
                    <ListingCard
                      key={l.id} listing={l}
                      onOffer={onOffer}
                      onSave={toggleSave}
                      isSaved={saved.has(l.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Main grid */}
            {regularListings.length > 0 && (
              <div className="mb-8">
                {sponsoredListings.length > 0 && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">All listings</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {regularListings.map(l => (
                    <ListingCard
                      key={l.id} listing={l}
                      onOffer={onOffer}
                      onSave={toggleSave}
                      isSaved={saved.has(l.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Free to claim */}
            {donationListings.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-display text-xl font-bold text-gray-900">Free to claim</span>
                  <span className="px-2 py-0.5 bg-green-600 text-white rounded-full text-xs font-bold">🆓 DONATE</span>
                  <span className="text-sm text-gray-400 flex-1">Sellers giving away surplus — yours free, you cover any postage</span>
                </div>
                <div className="bg-gradient-to-r from-green-50 to-[#F2FBF6] border border-green-200 rounded-[14px] p-3 mb-4 flex gap-3">
                  <span className="text-lg flex-shrink-0">💚</span>
                  <p className="text-xs text-green-800 leading-relaxed">
                    <strong>How it works:</strong> Items are completely free — first to claim gets them.
                    You pay a <strong>0.5% platform fee (minimum £1)</strong> on the item's listed value,
                    plus any postage if you choose Royal Mail.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {donationListings.map(l => (
                    <ListingCard
                      key={l.id} listing={l}
                      onClaim={onClaim}
                      onSave={toggleSave}
                      isSaved={saved.has(l.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
