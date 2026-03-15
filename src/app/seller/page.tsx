'use client'
// src/app/seller/page.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SellModal } from '@/components/modals/SellModal'
import { Toast, showToast, Spinner, StarRating, Badge, SectionHeader } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { formatPounds, formatDate } from '@/lib/utils'
import type { Profile, Listing, Offer, Transaction, Review } from '@/types'

export default function SellerPage() {
  const supabase = createClient()
  const router = useRouter()

  const [profile, setProfile]           = useState<Profile | null>(null)
  const [listings, setListings]         = useState<Listing[]>([])
  const [offers, setOffers]             = useState<Offer[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [reviews, setReviews]           = useState<Review[]>([])
  const [sellOpen, setSellOpen]         = useState(false)
  const [loading, setLoading]           = useState(true)

  // Nickname editing
  const [editingNickname, setEditingNickname] = useState(false)
  const [nicknameInput, setNicknameInput]     = useState('')
  const [savingNickname, setSavingNickname]   = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('stripe') === 'success') showToast('✅ Bank account connected!')
      if (params.get('stripe') === 'refresh')  showToast('⚠️ Please complete bank account setup')
    }
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login?redirectTo=/seller'); return }

      const listingIds = (await supabase.from('listings').select('id').eq('seller_id', user.id)).data?.map(l => l.id) ?? []

      const [{ data: p }, { data: l }, { data: o }, { data: t }, { data: r }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('listings').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
        supabase.from('offers')
          .select('*, listing:listings(title,asking_price), buyer:profiles(full_name,postcode)')
          .in('listing_id', listingIds.length > 0 ? listingIds : ['none'])
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase.from('transactions')
          .select('*, buyer:profiles(full_name)')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('reviews')
          .select('*, buyer:profiles(full_name), listing:listings(title)')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      setProfile(p)
      setNicknameInput(p?.nickname ?? '')
      setListings(l ?? [])
      setOffers(o ?? [])
      setTransactions(t ?? [])
      setReviews(r ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function saveNickname() {
    if (!nicknameInput.trim()) { showToast('⚠️ Enter a nickname'); return }
    if (nicknameInput.trim().length < 2) { showToast('⚠️ Nickname must be at least 2 characters'); return }
    if (nicknameInput.trim().length > 30) { showToast('⚠️ Nickname must be 30 characters or less'); return }

    setSavingNickname(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('profiles')
      .update({ nickname: nicknameInput.trim() })
      .eq('id', user!.id)

    if (error) {
      showToast(`❌ ${error.message}`)
    } else {
      setProfile(prev => prev ? { ...prev, nickname: nicknameInput.trim() } : prev)
      setEditingNickname(false)
      showToast('✅ Nickname updated! This will show on your listings.')
    }
    setSavingNickname(false)
  }

  async function handleOffer(offerId: string, action: 'accept' | 'decline') {
    const res = await fetch(`/api/offers/${offerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (!res.ok) { showToast(`❌ ${data.error}`); return }
    showToast(action === 'accept' ? '✅ Offer accepted!' : '❌ Offer declined')
    setOffers(prev => prev.filter(o => o.id !== offerId))
  }

  async function connectStripe() {
    const res = await fetch('/api/stripe/connect', { method: 'POST' })
    const { url, error } = await res.json()
    if (error) { showToast(`❌ ${error}`); return }
    window.location.href = url
  }

  const totalEarned    = transactions.filter(t => t.payout_status === 'paid').reduce((s, t) => s + t.net_payout, 0)
  const awaitingPayout = transactions.filter(t => t.payout_status === 'pending').reduce((s, t) => s + t.net_payout, 0)
  const activeListings = listings.filter(l => l.status === 'active').length
  const displayName    = profile?.nickname || profile?.full_name?.split(' ')[0] || 'Seller'

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={32} /></div>

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24">

        {/* Profile header */}
        <div className="bg-gradient-to-r from-green-800 to-green-600 rounded-[14px] p-6 text-white mb-6 flex items-center gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center font-display text-3xl font-bold flex-shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-xl font-bold">{displayName}</h1>
              {profile?.nickname && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full opacity-80">
                  {profile.full_name}
                </span>
              )}
            </div>
            <p className="text-sm opacity-80">{profile?.postcode} · Member since {formatDate(profile?.created_at ?? '')}</p>
            <div className="flex gap-4 mt-2 text-sm flex-wrap">
              <span>★ {profile?.rating?.toFixed(1) ?? 'New'}</span>
              <span>{profile?.sales_count} sales</span>
              {!profile?.stripe_verified && (
                <button onClick={connectStripe}
                  className="bg-amber-400 text-amber-700 px-3 py-0.5 rounded-full text-xs font-bold">
                  ⚠️ Set up payouts
                </button>
              )}
            </div>
          </div>
          <button onClick={() => setSellOpen(true)} className="btn btn-amber">+ New listing</button>
        </div>

        {/* Nickname section */}
        <div className="bg-white border border-gray-100 rounded-[14px] p-5 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <h2 className="font-display text-lg font-bold mb-1">Your public nickname</h2>
              <p className="text-sm text-gray-500 mb-3">
                This is shown on your listings instead of your real name. Keep it friendly and memorable.
              </p>
              {!editingNickname ? (
                <div className="flex items-center gap-3">
                  <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 flex-1 max-w-xs">
                    {profile?.nickname ? (
                      <p className="font-semibold text-gray-900">{profile.nickname}</p>
                    ) : (
                      <p className="text-gray-400 italic">No nickname set — showing first name</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setEditingNickname(true); setNicknameInput(profile?.nickname ?? '') }}
                    className="btn btn-outline btn-sm"
                  >
                    {profile?.nickname ? 'Change' : 'Add nickname'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    value={nicknameInput}
                    onChange={e => setNicknameInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveNickname()}
                    placeholder="e.g. TinHunter99, BargainBob, SurplusSam"
                    maxLength={30}
                    autoFocus
                    className="input flex-1 max-w-xs"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveNickname} disabled={savingNickname}
                      className="btn btn-primary btn-sm">
                      {savingNickname ? <Spinner size={14} className="text-white" /> : 'Save'}
                    </button>
                    <button onClick={() => setEditingNickname(false)} className="btn btn-outline btn-sm">
                      Cancel
                    </button>
                  </div>
                  <p className="w-full text-xs text-gray-400">{nicknameInput.length}/30 characters</p>
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 bg-green-50 border border-green-100 rounded-lg p-3">
            <span className="flex-shrink-0 text-green-600">🔒</span>
            <p className="text-xs text-green-700 leading-relaxed">
              Your real name <strong>{profile?.full_name}</strong> is never shown publicly.
              Only your nickname appears on listings, offers, and reviews.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total earned',    value: formatPounds(totalEarned),    color: 'text-green-700' },
            { label: 'Active listings', value: activeListings,               color: 'text-amber-500' },
            { label: 'Pending offers',  value: offers.length,                color: 'text-green-700' },
            { label: 'Awaiting payout', value: formatPounds(awaitingPayout), color: 'text-green-700' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-[14px] p-4 text-center">
              <p className={`font-display text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Pending offers */}
        {offers.length > 0 && (
          <div className="mb-8">
            <SectionHeader title="Pending offers" />
            <div className="space-y-3">
              {offers.map(offer => (
                <div key={offer.id} className="bg-white border border-amber-200 rounded-[14px] p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{(offer.listing as any)?.title}</p>
                    <p className="text-xs text-gray-400">
                      From {(offer.buyer as any)?.full_name} · {formatDate(offer.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-bold text-amber-500">{formatPounds(offer.amount)}</p>
                    <p className="text-xs text-gray-400">asking {formatPounds((offer.listing as any)?.asking_price ?? 0)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleOffer(offer.id, 'accept')} className="btn btn-primary btn-sm">Accept</button>
                    <button onClick={() => handleOffer(offer.id, 'decline')} className="btn btn-outline btn-sm">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My listings */}
        <div className="mb-8">
          <SectionHeader title="My listings" action={
            <button onClick={() => setSellOpen(true)} className="btn btn-primary btn-sm">+ New</button>
          } />
          {listings.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-100 rounded-[14px]">
              <p className="text-3xl mb-2">📦</p>
              <p className="font-semibold text-gray-700">No listings yet</p>
              <p className="text-sm text-gray-400 mt-1 mb-4">List your first tin for free</p>
              <button onClick={() => setSellOpen(true)} className="btn btn-primary">+ List a tin</button>
            </div>
          ) : (
            <div className="space-y-2">
              {listings.map(l => (
                <div key={l.id} className="bg-white border border-gray-100 rounded-[14px] p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{l.title}</p>
                    <p className="text-xs text-gray-400">
                      {(l as any).view_count ?? 0} views · {formatDate(l.created_at)}
                    </p>
                  </div>
                  {l.is_donation ? (
                    <Badge variant="donate">🆓 Free</Badge>
                  ) : (
                    <span className="font-display font-bold text-green-700">{formatPounds(l.asking_price!)}</span>
                  )}
                  <Badge variant={l.status === 'active' ? 'green' : l.status === 'sold' ? 'gray' : 'amber'}>
                    {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                  </Badge>
                  {l.is_sponsored && <Badge variant="amber">⚡ Sponsored</Badge>}
                  <div className="flex gap-2 flex-shrink-0">
                    <a href={`/listing/${l.id}`} target="_blank"
                      className="btn btn-outline btn-sm text-xs">View</a>
                    {l.status === 'active' && (
                      <button onClick={async () => {
                        await supabase.from('listings').update({ status: 'paused' }).eq('id', l.id)
                        setListings(prev => prev.map(x => x.id === l.id ? {...x, status: 'paused' as any} : x))
                        showToast('⏸️ Listing paused')
                      }} className="btn btn-sm bg-gray-100 text-gray-600 text-xs border-none">Pause</button>
                    )}
                    {l.status === 'paused' && (
                      <button onClick={async () => {
                        await supabase.from('listings').update({ status: 'active' }).eq('id', l.id)
                        setListings(prev => prev.map(x => x.id === l.id ? {...x, status: 'active' as any} : x))
                        showToast('▶️ Listing reactivated')
                      }} className="btn btn-sm bg-green-50 text-green-700 text-xs border-none">Activate</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reviews */}
        {reviews.length > 0 && (
          <div className="mb-8">
            <SectionHeader
              title="Reviews"
              subtitle={`${profile?.rating?.toFixed(1) ?? 0} average · ${reviews.length} reviews`}
            />
            <div className="bg-white border border-gray-100 rounded-[14px] overflow-hidden">
              {reviews.map((r, i) => (
                <div key={r.id} className={`p-4 flex gap-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {(r.buyer as any)?.full_name?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="font-semibold text-sm">{(r.buyer as any)?.full_name}</span>
                        <span className="text-xs text-gray-400 ml-2">{formatDate(r.created_at)}</span>
                      </div>
                      <StarRating rating={r.rating} />
                    </div>
                    {r.review_text && (
                      <p className="text-sm text-gray-500 leading-relaxed">{r.review_text}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payout history */}
        {transactions.length > 0 && (
          <div className="mb-8">
            <SectionHeader title="Payout history" />
            <div className="bg-white border border-gray-100 rounded-[14px] overflow-hidden">
              {transactions.map((t, i) => (
                <div key={t.id} className={`px-4 py-3 flex justify-between items-center ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                  <div>
                    <p className="text-sm font-medium text-gray-700">{formatDate(t.created_at)}</p>
                    <p className="text-xs text-gray-400">Fee: {formatPounds(t.platform_fee)} (1.5%)</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-green-700">{formatPounds(t.net_payout)}</p>
                    <Badge variant={t.payout_status === 'paid' ? 'green' : t.payout_status === 'failed' ? 'red' : 'amber'}>
                      {t.payout_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
      <Footer />
      <SellModal open={sellOpen} onClose={(created?: boolean) => { setSellOpen(false); if (created) window.location.reload() }} />
      <Toast />
    </>
  )
}
