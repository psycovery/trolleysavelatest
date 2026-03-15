'use client'
// src/app/listing/[id]/page.tsx
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { OfferModal } from '@/components/modals/OfferModal'
import { ClaimModal } from '@/components/modals/ClaimModal'
import { Toast, showToast, Spinner, StarRating, Badge, TinPlaceholder } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { formatPounds, formatBestBefore } from '@/lib/utils'
import type { Listing } from '@/types'
import { ArrowLeft, MessageCircle } from 'lucide-react'

export default function ListingDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [listing, setListing]     = useState<Listing | null>(null)
  const [loading, setLoading]     = useState(true)
  const [offerOpen, setOfferOpen] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)

  useEffect(() => {
    async function load() {
      if (!id) return

      // Use maybeSingle() instead of single() — won't throw if not found
      const { data, error } = await supabase
        .from('listings')
        .select('*, seller:profiles!listings_seller_id_fkey(id,full_name,nickname,avatar_url,rating,sales_count,postcode,created_at)')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        console.error('Listing fetch error:', error)
      }

      // If not found via active RLS, try fetching without status filter
      // (handles case where seller views their own paused listing)
      if (!data) {
        const { data: ownListing } = await supabase
          .from('listings')
          .select('*, seller:profiles!listings_seller_id_fkey(id,full_name,nickname,avatar_url,rating,sales_count,postcode,created_at)')
          .eq('id', id)
          .maybeSingle()
        setListing(ownListing as Listing)
      } else {
        setListing(data as Listing)
      }

      setLoading(false)

      if (data) {
        supabase.from('listings')
          .update({ view_count: (data.view_count ?? 0) + 1 })
          .eq('id', data.id)
      }
    }
    load()
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size={32} />
    </div>
  )

  if (!listing) return (
    <>
      <Header />
      <div className="text-center py-24 text-gray-400">
        <p className="text-4xl mb-3">🥫</p>
        <p className="font-semibold text-gray-700">Listing not found</p>
        <p className="text-sm mt-1 mb-5">It may have been sold or removed</p>
        <button onClick={() => router.push('/')} className="btn btn-primary">Browse listings</button>
      </div>
      <Footer />
    </>
  )

  const seller = listing.seller as any

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push('/') }}
          className="flex items-center gap-2 text-gray-500 text-sm mb-5 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to listings
        </button>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Image + seller */}
          <div>
            <div className={`relative h-72 rounded-[14px] overflow-hidden mb-4 flex items-center justify-center border border-gray-100 ${listing.is_donation ? 'bg-[#E8F8F0]' : 'bg-gray-50'}`}>
              {listing.image_url ? (
                <Image src={listing.image_url} alt={listing.title} fill className="object-cover" />
              ) : (
                <TinPlaceholder
                  label={listing.title}
                  hint={listing.is_donation ? 'Free to claim' : 'Photo not yet uploaded'}
                  className={`scale-150 ${listing.is_donation ? '[&_div]:bg-[#9FE1CB]' : ''}`}
                />
              )}
              {listing.is_donation && (
                <div className="absolute top-3 left-3">
                  <Badge variant="donate">🆓 Free to claim</Badge>
                </div>
              )}
            </div>

            {seller && (
              <div className="bg-white border border-gray-100 rounded-[14px] p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {seller.full_name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{seller.nickname || seller.full_name.split(' ')[0]}</p>
                  <p className="text-xs text-gray-400">{seller.postcode}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StarRating rating={seller.rating ?? 0} size="md" />
                    <span className="text-sm text-gray-500">
                      {seller.rating?.toFixed(1) ?? 'New'} ({seller.sales_count} sales)
                    </span>
                  </div>
                </div>
                <button onClick={() => showToast('💬 Message feature coming soon')}
                  className="btn btn-outline btn-sm flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5" /> Message
                </button>
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
              {listing.category.replace('-', ' ')}
            </p>
            <h1 className="font-display text-3xl font-bold mb-3 leading-tight">{listing.title}</h1>

            {listing.is_donation ? (
              <div className="flex items-baseline gap-3 mb-5">
                <span className="font-display text-4xl font-bold text-green-600">FREE</span>
                <span className="text-sm text-gray-400">
                  Listed value: {formatPounds(listing.asking_price ?? 0)}
                </span>
              </div>
            ) : (
              <div className="mb-5">
                <span className="font-display text-4xl font-bold text-green-700">
                  {formatPounds(listing.asking_price!)}
                </span>
              </div>
            )}

            {!listing.is_donation && (
              <div className="bg-white border border-gray-100 rounded-[14px] p-4 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Supermarket prices today</p>
                  <p className="text-[10px] text-gray-400">via Trolley.co.uk</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  {[
                    ['🔵 Tesco', '£1.00'],
                    ["🟠 Sainsbury's", '£1.05'],
                    ['🟢 Asda', '£0.98'],
                    ['🔴 Waitrose', '£1.10'],
                  ].map(([store, price]) => (
                    <div key={store} className="flex justify-between items-center bg-gray-50 rounded px-3 py-1.5">
                      <span className="text-sm text-gray-700">{store}</span>
                      <span className="text-sm font-semibold">{price}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-green-600 rounded-lg px-4 py-2.5 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-white/75">TrolleySave price</p>
                    <p className="text-xs font-semibold text-amber-200">Best value ✓</p>
                  </div>
                  <span className="font-display text-2xl font-bold text-white">
                    {formatPounds(listing.asking_price!)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                ['Best before', formatBestBefore(listing.best_before)],
                ['Condition', 'Sealed, unused'],
                ['Location', listing.postcode],
                ['Delivery', listing.delivery_method === 'both'
                  ? 'Post or collect'
                  : listing.delivery_method === 'post'
                  ? 'Royal Mail only'
                  : 'Collect only'],
                ...((listing as any).weight_grams ? [['Weight', `${(listing as any).weight_grams}g`]] : []),
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{label}</p>
                  <p className="font-semibold text-sm">{value}</p>
                </div>
              ))}
            </div>

            {listing.allergens && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
                <span className="text-base flex-shrink-0">⚠️</span>
                <p className="text-xs text-amber-700">
                  <strong>Allergens:</strong> {listing.allergens}. See tin label for full ingredients.
                </p>
              </div>
            )}

            {listing.is_donation ? (
              <button onClick={() => setClaimOpen(true)}
                className="btn btn-primary w-full justify-center py-4 text-base rounded-lg bg-green-600">
                🆓 Claim for free
              </button>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setOfferOpen(true)}
                  className="btn btn-amber flex-1 justify-center py-4 text-base rounded-lg font-bold">
                  Make an offer
                </button>
                <button onClick={() => setOfferOpen(true)}
                  className="btn btn-primary flex-1 justify-center py-4 text-base rounded-lg font-bold">
                  Buy now — {formatPounds(listing.asking_price!)}
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400 text-center mt-2">
              {listing.is_donation
                ? '0.5% claim fee (min. £1) · Plus any postage'
                : 'No buyer fees · Secure via Stripe · UK only'}
            </p>
          </div>
        </div>
      </main>

      <Footer />
      <OfferModal listing={offerOpen ? listing : null} onClose={() => setOfferOpen(false)} />
      <ClaimModal listing={claimOpen ? listing : null} onClose={() => setClaimOpen(false)} />
      <Toast />
    </>
  )
}
