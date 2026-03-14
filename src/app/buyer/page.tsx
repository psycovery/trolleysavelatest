'use client'
// src/app/buyer/page.tsx
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { OfferModal } from '@/components/modals/OfferModal'
import { Toast, showToast, Spinner, StarRating, Badge, SectionHeader } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { formatPounds, formatDate, formatBestBefore, calcDonationFee } from '@/lib/utils'
import type { Listing, Offer, WishlistItem, WishlistMatch, Transaction } from '@/types'
import { cn } from '@/lib/utils'
import { Plus, X } from 'lucide-react'

type Tab = 'saved' | 'wishlist' | 'offers' | 'history'

export default function BuyerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [tab, setTab]                 = useState<Tab>((searchParams.get('tab') as Tab) ?? 'saved')
  const [user, setUser]               = useState<any>(null)
  const [profile, setProfile]         = useState<any>(null)
  const [saved, setSaved]             = useState<Listing[]>([])
  const [wishlist, setWishlist]       = useState<WishlistItem[]>([])
  const [matches, setMatches]         = useState<WishlistMatch[]>([])
  const [offers, setOffers]           = useState<Offer[]>([])
  const [history, setHistory]         = useState<Transaction[]>([])
  const [unseenCount, setUnseenCount] = useState(0)
  const [loading, setLoading]         = useState(true)
  const [offerListing, setOfferListing] = useState<Listing | null>(null)

  // Wishlist modal state
  const [wishlistOpen, setWishlistOpen]           = useState(false)
  const [wishlistProduct, setWishlistProduct]     = useState('')
  const [wishlistMatchType, setWishlistMatchType] = useState<'exact'|'brand'|'category'>('exact')

  // Review modal state
  const [reviewOpen, setReviewOpen]       = useState(false)
  const [reviewTransaction, setReviewTransaction] = useState<Transaction | null>(null)
  const [reviewStars, setReviewStars]     = useState(0)
  const [reviewText, setReviewText]       = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push('/auth/login?redirectTo=/buyer'); return }
      setUser(u)

      const [{ data: p }, { data: s }, { data: w }, { data: m }, { data: o }, { data: h }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', u.id).single(),
        supabase.from('saved_listings').select('listing:listings(*, seller:profiles(full_name,rating,postcode))')
          .eq('user_id', u.id).order('created_at', { ascending: false }),
        supabase.from('wishlists').select('*').eq('buyer_id', u.id).order('created_at', { ascending: false }),
        supabase.from('wishlist_matches').select('*, listing:listings(*, seller:profiles(full_name,rating,postcode)), wishlist:wishlists(product_name,match_type)')
          .eq('buyer_id', u.id).order('notified_at', { ascending: false }),
        supabase.from('offers').select('*, listing:listings(*, seller:profiles(full_name,rating,postcode))')
          .eq('buyer_id', u.id).order('created_at', { ascending: false }),
        supabase.from('transactions').select('*, seller:profiles(full_name)')
          .eq('buyer_id', u.id).order('created_at', { ascending: false }),
      ])

      setProfile(p)
      setSaved((s ?? []).map((r: any) => r.listing).filter(Boolean))
      setWishlist(w ?? [])
      setMatches(m ?? [])
      setOffers(o ?? [])
      setHistory(h ?? [])
      setUnseenCount((m ?? []).filter((x: any) => !x.seen).length)
      setLoading(false)
    }
    load()
  }, [])

  // Mark matches as seen when viewing wishlist tab
  useEffect(() => {
    if (tab === 'wishlist' && unseenCount > 0 && user) {
      supabase.from('wishlist_matches').update({ seen: true }).eq('buyer_id', user.id).eq('seen', false)
      setUnseenCount(0)
    }
  }, [tab, user])

  async function removeSaved(listingId: string) {
    await supabase.from('saved_listings').delete().eq('user_id', user.id).eq('listing_id', listingId)
    setSaved(prev => prev.filter(l => l.id !== listingId))
    showToast('Removed from saved')
  }

  async function removeWishlist(wishlistId: string) {
    await supabase.from('wishlists').delete().eq('id', wishlistId)
    setWishlist(prev => prev.filter(w => w.id !== wishlistId))
    showToast('🗑️ Removed from wishlist')
  }

  async function addWishlistItem() {
    if (!wishlistProduct.trim()) { showToast('⚠️ Enter what you\'re looking for'); return }
    const { data, error } = await supabase.from('wishlists').insert({
      buyer_id: user.id,
      product_name: wishlistProduct.trim(),
      match_type: wishlistMatchType,
      location_radius: 10,
    }).select().single()
    if (error) { showToast(`❌ ${error.message}`); return }
    setWishlist(prev => [data, ...prev])
    setWishlistOpen(false)
    setWishlistProduct('')
    showToast('🎯 Added to wishlist — we\'ll notify you when a match appears')
  }

  async function submitReview() {
    if (!reviewTransaction || reviewStars === 0) return
    setReviewLoading(true)
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seller_id: reviewTransaction.seller_id,
        listing_id: null, // attach via transaction
        transaction_id: reviewTransaction.id,
        rating: reviewStars,
        review_text: reviewText.trim() || null,
      }),
    })
    const data = await res.json()
    setReviewLoading(false)
    if (!res.ok) { showToast(`❌ ${data.error}`); return }
    setReviewOpen(false)
    setReviewStars(0); setReviewText('')
    showToast('⭐ Review submitted — thank you!')
  }

  const totalSaved = history.reduce((s, t) => s + (t.gross_amount - t.net_payout), 0)

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={32} /></div>

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24">

        {/* Profile header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-400 rounded-[14px] p-6 text-white mb-6 flex items-center gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-full bg-white/25 flex items-center justify-center font-display text-3xl font-bold text-amber-700 flex-shrink-0">
            {profile?.full_name?.charAt(0)}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold">{profile?.full_name}</h1>
            <p className="text-sm opacity-85">{profile?.postcode} · Buyer since {formatDate(profile?.created_at ?? '')}</p>
            <div className="flex gap-5 mt-2 text-sm flex-wrap">
              <span>💰 {formatPounds(totalSaved)} saved vs retail</span>
              <span>{history.length} purchases</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white border border-gray-100 rounded-[14px] p-1 gap-1 mb-6">
          {([
            { id: 'saved',    label: '❤️ Saved' },
            { id: 'wishlist', label: '🎯 Wishlist', badge: unseenCount },
            { id: 'offers',   label: '🤝 Offers' },
            { id: 'history',  label: '📦 History' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex-1 py-2 px-1 rounded-[10px] text-xs font-semibold transition-all relative',
                tab === t.id ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-gray-700'
              )}>
              {t.label}
              {(t as any).badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 border border-white" />
              )}
            </button>
          ))}
        </div>

        {/* Saved tab */}
        {tab === 'saved' && (
          <div>
            <SectionHeader title="Saved items" subtitle={`${saved.length} items`} />
            {saved.length === 0 ? (
              <div className="text-center py-12 bg-white border border-gray-100 rounded-[14px]">
                <p className="text-3xl mb-2">❤️</p>
                <p className="font-semibold text-gray-700">Nothing saved yet</p>
                <p className="text-sm text-gray-400 mt-1">Tap the heart on any listing to save it</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {saved.map(l => (
                  <div key={l.id} className="bg-white border border-gray-100 rounded-[14px] overflow-hidden">
                    <div className="h-28 bg-gray-50 flex items-center justify-center relative">
                      <div className="text-center">
                        <div className="w-10 h-12 bg-gray-200 rounded-t-md rounded-b-lg mx-auto mb-1" />
                        <p className="text-[9px] text-gray-400 uppercase tracking-wide truncate max-w-[90%]">{l.title}</p>
                      </div>
                      <button onClick={() => removeSaved(l.id)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-amber-400">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="p-2.5">
                      <p className="font-semibold text-xs truncate mb-1">{l.title}</p>
                      <div className="flex justify-between items-center">
                        <p className="font-display font-bold text-green-700">{formatPounds(l.asking_price ?? 0)}</p>
                        <button onClick={() => setOfferListing(l)} className="btn btn-sm btn-amber text-[10px] px-2 py-1">Offer</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Wishlist tab */}
        {tab === 'wishlist' && (
          <div>
            {unseenCount > 0 && (
              <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-[14px] p-4 mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl flex-shrink-0">🔔</div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-white">{unseenCount} wishlist {unseenCount === 1 ? 'match' : 'matches'} found!</p>
                  <p className="text-xs text-white/80">Sellers have listed tins you're looking for.</p>
                </div>
              </div>
            )}

            <SectionHeader title="My wishlist" action={
              <button onClick={() => setWishlistOpen(true)} className="btn btn-primary btn-sm flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add tin
              </button>
            } />

            {wishlist.length === 0 ? (
              <div className="text-center py-12 bg-white border border-gray-100 rounded-[14px]">
                <p className="text-3xl mb-2">🎯</p>
                <p className="font-semibold text-gray-700">Your wishlist is empty</p>
                <p className="text-sm text-gray-400 mt-1 mb-4">Tell us what tins you want and we'll notify you when they're listed</p>
                <button onClick={() => setWishlistOpen(true)} className="btn btn-primary">+ Add first tin</button>
              </div>
            ) : (
              <div className="space-y-3">
                {wishlist.map(w => {
                  const itemMatches = matches.filter(m => m.wishlist_id === w.id)
                  const hasMatch = itemMatches.length > 0
                  return (
                    <div key={w.id} className={cn('bg-white rounded-[14px] overflow-hidden border', hasMatch ? 'border-green-400' : 'border-gray-100')}>
                      <div className="p-3 flex items-center gap-3">
                        <div className="text-2xl">🥫</div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{w.product_name}</p>
                          <p className="text-xs text-gray-500">
                            {w.match_type === 'exact' ? 'Exact product' : w.match_type === 'brand' ? 'Brand match' : 'Category match'}
                          </p>
                          <Badge variant={w.match_type === 'exact' ? 'green' : w.match_type === 'brand' ? 'amber' : 'gray'} className="mt-1">
                            {w.match_type === 'exact' ? 'Exact match' : w.match_type === 'brand' ? 'Brand match' : 'Category match'}
                          </Badge>
                        </div>
                        <button onClick={() => removeWishlist(w.id)} className="text-gray-300 hover:text-gray-500 transition-colors">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      {hasMatch ? itemMatches.map(m => (
                        <div key={m.id} className="px-3 pb-3 bg-green-50 border-t border-green-100 flex items-center gap-3">
                          <div className="text-xl">🎯</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-green-700">Match found · {(m.listing as any)?.seller?.full_name}</p>
                            <p className="text-xs text-gray-500 truncate">{(m.listing as any)?.title} · BB {formatBestBefore((m.listing as any)?.best_before ?? '')}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <p className="font-display font-bold text-green-700">{formatPounds((m.listing as any)?.asking_price ?? 0)}</p>
                            <button onClick={() => setOfferListing((m.listing as any))} className="btn btn-amber btn-sm">Make offer</button>
                          </div>
                        </div>
                      )) : (
                        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                          ⏳ No match yet — we'll notify you when a seller lists this
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Offers tab */}
        {tab === 'offers' && (
          <div>
            <SectionHeader title="My offers" />
            {offers.length === 0 ? (
              <div className="text-center py-12 bg-white border border-gray-100 rounded-[14px]">
                <p className="text-3xl mb-2">🤝</p>
                <p className="font-semibold text-gray-700">No active offers</p>
                <p className="text-sm text-gray-400 mt-1">Browse listings and make an offer</p>
              </div>
            ) : (
              <div className="space-y-3">
                {offers.map(o => (
                  <div key={o.id} className="bg-white border border-amber-200 rounded-[14px] p-4 flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{(o.listing as any)?.title}</p>
                      <p className="text-xs text-gray-400">Sent {formatDate(o.created_at)} · {(o.listing as any)?.seller?.full_name}</p>
                    </div>
                    <Badge variant={o.status === 'pending' ? 'amber' : o.status === 'accepted' ? 'green' : 'red'}>
                      {o.status === 'pending' ? '⏳ Awaiting seller' : o.status === 'accepted' ? '✓ Accepted' : '✗ Declined'}
                    </Badge>
                    <p className="font-display text-xl font-bold text-amber-500">{formatPounds(o.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History tab */}
        {tab === 'history' && (
          <div>
            <SectionHeader title="Purchase history" />
            {history.length === 0 ? (
              <div className="text-center py-12 bg-white border border-gray-100 rounded-[14px]">
                <p className="text-3xl mb-2">📦</p>
                <p className="font-semibold text-gray-700">No purchases yet</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-[14px] overflow-hidden">
                {history.map((t, i) => (
                  <div key={t.id} className={cn('p-4 flex items-center justify-between gap-4 flex-wrap', i > 0 && 'border-t border-gray-100')}>
                    <div>
                      <p className="font-semibold text-sm">{(t.seller as any)?.full_name}</p>
                      <p className="text-xs text-gray-400">{formatDate(t.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-display font-bold text-green-700">{formatPounds(t.gross_amount)}</p>
                      <button
                        onClick={() => { setReviewTransaction(t); setReviewOpen(true) }}
                        className="btn btn-sm btn-amber"
                      >
                        ⭐ Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />

      {/* Offer modal */}
      <OfferModal listing={offerListing} onClose={() => setOfferListing(null)} />

      {/* Wishlist add modal */}
      {wishlistOpen && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setWishlistOpen(false)}>
          <div className="modal">
            <div className="w-9 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="font-display text-xl font-bold mb-1">Add to wishlist</h3>
            <p className="text-sm text-gray-500 mb-4">We'll notify you in-app when a seller lists a match.</p>
            <div className="mb-4">
              <label className="label">What tin are you after?</label>
              <input value={wishlistProduct} onChange={e => setWishlistProduct(e.target.value)}
                placeholder="e.g. Heinz Baked Beans, any tomatoes, tuna…"
                className="input" autoFocus />
            </div>
            <div className="mb-4">
              <label className="label mb-2">Match precision</label>
              <div className="space-y-2">
                {([
                  { value: 'exact',    label: 'Exact product',  desc: 'Same product, any quantity' },
                  { value: 'brand',    label: 'Brand match',    desc: 'Any product from that brand' },
                  { value: 'category', label: 'Category match', desc: 'Any tin in that category' },
                ] as const).map(opt => (
                  <label key={opt.value}
                    className={cn('flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                      wishlistMatchType === opt.value ? 'border-green-600 bg-green-50' : 'border-gray-100'
                    )}>
                    <input type="radio" name="match-type" value={opt.value}
                      checked={wishlistMatchType === opt.value}
                      onChange={() => setWishlistMatchType(opt.value)}
                      className="accent-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-3 mb-5">
              <span className="text-base flex-shrink-0">🔔</span>
              <p className="text-xs text-gray-500 leading-relaxed">In-app notification only — no emails or texts.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setWishlistOpen(false)} className="btn btn-outline flex-1 justify-center py-3">Cancel</button>
              <button onClick={addWishlistItem} className="btn btn-primary flex-1 justify-center py-3">🎯 Add to wishlist</button>
            </div>
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewOpen && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setReviewOpen(false)}>
          <div className="modal">
            <div className="w-9 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="font-display text-xl font-bold mb-1">Rate your purchase</h3>
            <p className="text-sm text-gray-500 mb-4">
              How was your experience with {(reviewTransaction?.seller as any)?.full_name}?
            </p>
            <div className="mb-4">
              <label className="label">Your rating</label>
              <div className="flex gap-2 mt-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setReviewStars(n)}
                    className={cn('text-4xl transition-colors', n <= reviewStars ? 'text-amber-400' : 'text-gray-200')}>
                    ★
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1 h-4">
                {reviewStars > 0 && ['','Poor','Below average','Average','Good','Excellent'][reviewStars]}
              </p>
            </div>
            <div className="mb-4">
              <label className="label">Written review <span className="normal-case font-normal tracking-normal text-gray-400">— optional</span></label>
              <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
                placeholder="Condition of tins, communication, how collection or postage went…"
                className="input resize-none min-h-[90px] leading-relaxed" maxLength={500} />
              <p className="text-xs text-gray-400 mt-1 text-right">{reviewText.length} / 500</p>
            </div>
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg p-3 mb-5">
              <span className="text-green-600">✓</span>
              <p className="text-xs text-green-700">Verified purchase · Only buyers who completed a transaction can review</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setReviewOpen(false)} className="btn btn-outline flex-1 justify-center py-3">Cancel</button>
              <button onClick={submitReview} disabled={reviewStars === 0 || reviewLoading}
                className="btn btn-primary flex-1 justify-center py-3 disabled:opacity-50">
                {reviewLoading ? <Spinner size={18} className="text-white" /> : 'Submit review'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast />
    </>
  )
}
