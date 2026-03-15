'use client'
// src/components/modals/CardSetupModal.tsx
import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Spinner, showToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { CreditCard, X } from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function CardForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError('')

    // Get SetupIntent client secret from our API
    const res = await fetch('/api/stripe/setup', { method: 'POST' })
    const { clientSecret, error: apiError } = await res.json()

    if (apiError) {
      setError(apiError)
      setLoading(false)
      return
    }

    // Confirm card setup
    const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement)!,
      },
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Card setup failed')
      setLoading(false)
      return
    }

    showToast('✅ Card saved successfully!')
    setLoading(false)
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          <p className="text-xs text-red-600 mt-1.5">{error}</p>
        )}
      </div>

      <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 flex gap-2">
        <span className="text-base flex-shrink-0">🔒</span>
        <p className="text-xs text-gray-500 leading-relaxed">
          Your card details are handled securely by Stripe and never stored on TrolleySave servers.
          This card will be charged <strong>£1.50/week</strong> per sponsored listing.
        </p>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="btn btn-outline flex-1 justify-center py-3">
          Cancel
        </button>
        <button type="submit" disabled={loading || !stripe}
          className="btn btn-primary flex-1 justify-center py-3 font-semibold">
          {loading ? <Spinner size={18} className="text-white" /> : '💳 Save card'}
        </button>
      </div>

      {/* Test mode hint */}
      <p className="text-center text-xs text-gray-400">
        Test card: 4242 4242 4242 4242 · Any future date · Any CVC
      </p>
    </form>
  )
}

export function CardSetupModal({ open, onClose, onSuccess }: Props) {
  return (
    <div className={cn('modal-overlay', open && 'open')}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="w-9 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Add payment card</h3>
            <p className="text-xs text-gray-500">Required for sponsored listings</p>
          </div>
        </div>

        <Elements stripe={stripePromise}>
          <CardForm onClose={onClose} onSuccess={onSuccess} />
        </Elements>
      </div>
    </div>
  )
}
