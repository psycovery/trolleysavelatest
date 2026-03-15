'use client'
// src/components/modals/BuyNowModal.tsx
import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Listing } from '@/types'
import { formatPounds, calcSellerFee } from '@/lib/utils'
import { Spinner, showToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { ShoppingBag, Lock, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface Props {
  listing: Listing | null
  onClose: () => void
}

function PaymentForm({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [loading, setLoading]   = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError]       = useState('')

  const price = listing.asking_price ?? 0
  const fee   = calcSellerFee(price)

  async function handlePurchase(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError('')

    try {
      // Step 1 — create payment intent at asking price
      const res = await fetch('/api/buy-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listing.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Step 2 — confirm card payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        data.clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
          },
        }
      )

      if (stripeError) throw new Error(stripeError.message)
      if (paymentIntent?.status !== 'requires_capture' && paymentIntent?.status !== 'succeeded') {
        throw new Error('Payment not confirmed. Please try again.')
      }

      // Step 3 — capture payment and complete sale
      const confirmRes = await fetch('/api/buy-now/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: data.paymentIntentId,
          listing_id: listing.id,
        }),
      })
      const confirmData = await confirmRes.json()
      if (!confirmRes.ok) throw new Error(confirmData.error)

      setComplete(true)
    } catch (err: any) {
      setError(err.message ?? 'Payment failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (complete) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="font-display text-xl font-bold mb-2">Purchase complete! 🎉</h3>
        <p className="text-sm text-gray-500 mb-2">
          You've bought <strong>{listing.title}</strong> for <strong>{formatPounds(price)}</strong>.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          The seller has been notified and will arrange delivery or collection with you shortly.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn btn-outline flex-1 justify-center py-3">
            Back to listings
          </button>
          <button onClick={() => { onClose(); router.push('/buyer?tab=history') }}
            className="btn btn-primary flex-1 justify-center py-3">
            View my purchases
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Test card: 4242 4242 4242 4242 · Any future date · Any CVC
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handlePurchase} className="space-y-4">

      {/* Order summary */}
      <div className="bg-gray-50 border border-gray-100 rounded-[14px] p-4">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Order summary</p>
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-gray-600 truncate pr-4">{listing.title}</span>
          <span className="font-semibold flex-shrink-0">{formatPounds(price)}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mb-3">
          <span>Seller receives (after 1.5% fee)</span>
          <span>{formatPounds(price - fee)}</span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex justify-between">
          <span className="font-semibold">Total charged</span>
          <span className="font-display text-xl font-bold text-green-700">{formatPounds(price)}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">No buyer fees · Payment held in escrow until dispatch</p>
      </div>

      {/* Card input */}
      <div>
        <label className="label mb-2">Card details</label>
        <div className="border border-gray-200 rounded-lg p-3 bg-white focus-within:border-green-600 transition-colors">
          <CardElement options={{
            style: {
              base: {
                fontSize: '14px',
                color: '#1a1a1a',
                fontFamily: 'system-ui, sans-serif',
                '::placeholder': { color: '#9ca3af' },
              },
            },
            hidePostalCode: true,
          }} />
        </div>
        {error && (
          <p className="text-xs text-red-600 mt-1.5 bg-red-50 border border-red-100 rounded-lg p-2">
            {error}
          </p>
        )}
      </div>

      {/* Security note */}
      <div className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-lg p-3">
        <Lock className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-green-700 leading-relaxed">
          Payment is held securely by Stripe until the seller confirms dispatch.
          Your money is protected if the item isn't sent.
        </p>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="btn btn-outline flex-1 justify-center py-3">
          Cancel
        </button>
        <button type="submit" disabled={loading || !stripe}
          className="btn btn-primary flex-1 justify-center py-3 font-semibold">
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner size={16} className="text-white" /> Processing…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" /> Pay {formatPounds(price)}
            </span>
          )}
        </button>
      </div>

      <p className="text-center text-xs text-gray-400">
        Test card: 4242 4242 4242 4242 · Any future date · Any CVC
      </p>
    </form>
  )
}

export function BuyNowModal({ listing, onClose }: Props) {
  if (!listing) return null

  return (
    <div className={cn('modal-overlay', listing && 'open')}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="w-9 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Buy now</h3>
            <p className="text-xs text-gray-500">Pay asking price · No waiting for seller</p>
          </div>
        </div>

        <Elements stripe={stripePromise}>
          <PaymentForm listing={listing} onClose={onClose} />
        </Elements>
      </div>
    </div>
  )
}
