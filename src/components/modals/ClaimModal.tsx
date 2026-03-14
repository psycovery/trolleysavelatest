'use client'
// src/components/modals/ClaimModal.tsx
import { useState } from 'react'
import { Listing } from '@/types'
import { calcDonationFee, formatPounds } from '@/lib/utils'
import { Spinner } from '@/components/ui'
import { showToast } from '@/components/ui'
import { cn } from '@/lib/utils'

interface Props { listing: Listing | null; onClose: () => void }

export function ClaimModal({ listing, onClose }: Props) {
  const [delivery, setDelivery] = useState<'collect' | 'post'>('collect')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  if (!listing) return null

  const listedValue = listing.asking_price ?? 0
  const fee = calcDonationFee(listedValue)
  const canPost    = listing.delivery_method === 'post' || listing.delivery_method === 'both'
  const canCollect = listing.delivery_method === 'collect' || listing.delivery_method === 'both'

  async function submitClaim() {
    setLoading(true)
    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listing!.id,
          delivery_method: delivery,
          message: message.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onClose()
      showToast(`🎉 Claimed! ${listing!.title} reserved for 30 mins · Fee ${formatPounds(fee)} charged`)
    } catch (err: any) {
      showToast(`❌ ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('modal-overlay', !!listing && 'open')} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="w-9 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <div className="flex items-center gap-2 mb-3">
          <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-bold">🆓 Free to claim</span>
          <span className="text-xs text-gray-400">First come, first served</span>
        </div>

        <h3 className="font-display text-xl font-bold mb-3">{listing.title}</h3>

        {/* Seller info */}
        {listing.seller && (
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {listing.seller.full_name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-sm">{listing.seller.full_name.split(' ')[0]}</p>
              <p className="text-xs text-gray-400">{listing.postcode} · ★ {listing.seller.rating?.toFixed(1) ?? 'New'}</p>
            </div>
          </div>
        )}

        {/* Fee breakdown */}
        <div className="bg-green-50 border border-green-100 rounded-lg p-3 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What you pay</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Item cost</span>
              <span className="font-bold text-green-600">FREE</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Listed value: {formatPounds(listedValue)}</span>
              <span className="text-gray-400">waived by seller</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">TrolleySave fee (0.5%, min. £1)</span>
              <span className="font-semibold text-gray-700">{formatPounds(fee)}</span>
            </div>
          </div>
          <div className="border-t border-green-100 mt-3 pt-3 flex justify-between items-center">
            <span className="font-bold text-sm">You pay today</span>
            <span className="font-display text-2xl font-bold text-green-700">{formatPounds(fee)}</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Plus postage if you choose Royal Mail delivery</p>
        </div>

        {/* Delivery options */}
        <div className="mb-4">
          <p className="label mb-2">How would you like to receive it?</p>
          <div className="space-y-2">
            {canCollect && (
              <label className={cn('flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                delivery === 'collect' ? 'border-green-600 bg-green-50' : 'border-gray-100'
              )}>
                <input type="radio" name="claim-delivery" value="collect" checked={delivery === 'collect'}
                  onChange={() => setDelivery('collect')} className="accent-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">🤝 Collect from seller</p>
                  <p className="text-xs text-gray-500">Arrange a time via messages · {listing.postcode} · Free</p>
                </div>
              </label>
            )}
            {canPost && (
              <label className={cn('flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                delivery === 'post' ? 'border-green-600 bg-green-50' : 'border-gray-100'
              )}>
                <input type="radio" name="claim-delivery" value="post" checked={delivery === 'post'}
                  onChange={() => setDelivery('post')} className="accent-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">📬 Royal Mail</p>
                  <p className="text-xs text-gray-500">You cover postage · Seller will weigh and quote · Tracked</p>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Optional message */}
        <div className="mb-4">
          <label className="label">Message to seller <span className="normal-case tracking-normal font-normal text-gray-400">— optional</span></label>
          <textarea value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Introduce yourself and suggest a convenient time to collect…"
            className="input resize-none min-h-[70px] leading-relaxed" />
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
          <span className="flex-shrink-0">⚡</span>
          <p className="text-xs text-amber-700 leading-relaxed">
            First come, first served — submitting your claim reserves this item for <strong>30 minutes</strong>.
            If not confirmed, it becomes available again.
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="btn btn-outline flex-1 justify-center py-3">Cancel</button>
          <button onClick={submitClaim} disabled={loading}
            className="btn btn-primary flex-1 justify-center py-3 font-semibold bg-green-600">
            {loading ? <Spinner size={18} className="text-white" /> : '🆓 Claim for free'}
          </button>
        </div>
      </div>
    </div>
  )
}
