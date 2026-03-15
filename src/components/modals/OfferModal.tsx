'use client'
// src/components/modals/OfferModal.tsx
import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Listing } from '@/types'
import { formatPounds, calcSellerFee, calcSellerPayout } from '@/lib/utils'
import { Spinner } from '@/components/ui'
import { showToast } from '@/components/ui'
import { cn } from '@/lib/utils'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Step = 'offer' | 'payment'
type PayMethod = 'card' | 'apple' | 'google'

interface Props {
  listing: Listing | null
  onClose: () => void
}

export function OfferModal({ listing, onClose }: Props) {
  const [step, setStep] = useState<Step>('offer')
  const [offerAmount, setOfferAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PayMethod>('card')
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [postcode, setPostcode] = useState('')
  const [loading, setLoading] = useState(false)

  if (!listing) return null

  const price = listing.asking_price ?? 0
  const amount = parseFloat(offerAmount) || 0

  function formatCardNumber(v: string) {
    return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
  }
  function formatExpiry(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 4)
    return d.length >= 3 ? d.slice(0, 2) + ' / ' + d.slice(2) : d
  }

  async function submitOffer() {
    if (amount <= 0) { showToast('⚠️ Please enter a valid amount'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listing!.id, amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Confirm payment with Stripe
      const stripe = await stripePromise
      if (!stripe) throw new Error('Stripe not loaded')
      const { error } = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: { token: 'tok_visa' }, // Replace with real Elements in production
          billing_details: { name: cardName, address: { postal_code: postcode } },
        },
      })
      if (error) throw new Error(error.message)

      showToast(`✅ Offer of ${formatPounds(amount)} sent — awaiting seller`)
      onClose()
    } catch (err: any) {
      showToast(`❌ ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const open = !!listing
  return (
    <div className={cn('modal-overlay', open && 'open')} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="w-9 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        {step === 'offer' ? (
          <>
            <h3 className="font-display text-xl font-bold mb-1">Make an offer</h3>
            <p className="text-sm text-gray-500 mb-4">The seller will accept, decline, or counter.</p>

            {/* Price context */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Asking price</p>
                <p className="font-display text-xl font-bold">{formatPounds(price)}</p>
              </div>
            </div>

            {/* Offer input */}
            <div className="flex items-center gap-2 border-2 border-green-600 rounded-lg px-4 mb-3">
              <span className="font-display text-2xl font-bold text-green-600">£</span>
              <input
                type="number" value={offerAmount} onChange={e => setOfferAmount(e.target.value)}
                placeholder="0.00" step="0.10" min="0.10"
                className="flex-1 py-3 outline-none font-display text-2xl font-bold text-green-700 bg-transparent"
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-400 text-center mb-5">
              💡 Offers within 20% of asking price are usually accepted
            </p>

            <div className="flex gap-2">
              <button onClick={onClose} className="btn btn-outline flex-1 justify-center py-3">Cancel</button>
              <button
                onClick={() => { if (amount > 0) setStep('payment') }}
                className="btn btn-amber flex-1 justify-center py-3 font-semibold"
              >
                Continue to payment →
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Back + progress */}
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setStep('offer')} className="text-sm text-gray-400 flex items-center gap-1">← Back</button>
              <div className="flex-1 flex gap-1">
                <div className="flex-1 h-1 rounded bg-green-600" />
                <div className="flex-1 h-1 rounded bg-green-600" />
              </div>
            </div>

            <h3 className="font-display text-xl font-bold mb-1">Pay securely</h3>
            <p className="text-sm text-gray-500 mb-4">
              Your offer of <strong className="text-green-700">{formatPounds(amount)}</strong> for {listing.title}.
              Payment only taken if seller accepts.
            </p>

            {/* Fee transparency */}
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                A <strong className="text-gray-700">1.5% seller fee</strong> is deducted from the seller's payout.
                You pay exactly <strong>{formatPounds(amount)}</strong> — no buyer fees.
              </p>
              <span className="text-lg flex-shrink-0">👍</span>
            </div>

            {/* Payment method tabs */}
            <div className="flex gap-2 mb-4">
              {(['card', 'apple', 'google'] as PayMethod[]).map(m => (
                <button key={m} onClick={() => setPayMethod(m)}
                  className={cn('flex-1 py-2 rounded-lg border text-xs font-semibold transition-all',
                    payMethod === m ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-100 text-gray-500'
                  )}>
                  {m === 'card' ? '💳 Card' : m === 'apple' ? '🍎 Apple Pay' : 'G Pay'}
                </button>
              ))}
            </div>

            {payMethod === 'card' && (
              <div className="space-y-3 mb-4">
                <div>
                  <label className="label">Card number</label>
                  <input value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="1234 5678 9012 3456" className="input" maxLength={19} inputMode="numeric" />
                </div>
                <div>
                  <label className="label">Name on card</label>
                  <input value={cardName} onChange={e => setCardName(e.target.value)}
                    placeholder="J. Smith" className="input" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Expiry</label>
                    <input value={expiry} onChange={e => setExpiry(formatExpiry(e.target.value))}
                      placeholder="MM / YY" className="input" maxLength={7} inputMode="numeric" />
                  </div>
                  <div>
                    <label className="label">CVC</label>
                    <input value={cvc} onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123" className="input" maxLength={4} inputMode="numeric" />
                  </div>
                  <div>
                    <label className="label">Postcode</label>
                    <input value={postcode} onChange={e => setPostcode(e.target.value.toUpperCase())}
                      placeholder="ST1 4AB" className="input" maxLength={8} />
                  </div>
                </div>
              </div>
            )}

            {(payMethod === 'apple' || payMethod === 'google') && (
              <div className="py-4">
                <button onClick={submitOffer}
                  className={cn('w-full py-3 rounded-full text-white font-semibold text-base',
                    payMethod === 'apple' ? 'bg-black' : 'bg-[#4285F4]'
                  )}>
                  {payMethod === 'apple' ? '🍎 Pay with Apple Pay' : 'G Pay with Google Pay'}
                </button>
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mb-4">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              256-bit SSL · Powered by Stripe
            </div>

            {payMethod === 'card' && (
              <>
                <button onClick={submitOffer} disabled={loading}
                  className="btn btn-primary w-full justify-center py-3.5 text-base rounded-lg mb-2">
                  {loading ? <Spinner size={18} className="text-white" /> : `Pay ${formatPounds(amount)} — send offer`}
                </button>
                <p className="text-xs text-gray-400 text-center">Card won't be charged until seller accepts</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
