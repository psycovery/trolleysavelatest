'use client'
// src/components/modals/SellModal.tsx
import { useState, useRef } from 'react'
import Image from 'next/image'
import { calcSellerFee, calcSellerPayout, calcDonationFee, formatPounds } from '@/lib/utils'
import { Spinner } from '@/components/ui'
import { showToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Camera, X, AlertCircle } from 'lucide-react'
import { CardSetupModal } from './CardSetupModal'

const CATEGORIES = [
  { label: 'Beans & pulses', value: 'beans' },
  { label: 'Tomatoes & sauce', value: 'tomatoes' },
  { label: 'Soups', value: 'soups' },
  { label: 'Fish', value: 'fish' },
  { label: 'Fruit', value: 'fruit' },
  { label: 'Vegetables', value: 'vegetables' },
  { label: 'Ready meals', value: 'ready-meals' },
  { label: 'Condiments', value: 'condiments' },
]

const COMMON_WEIGHTS = [200, 300, 400, 410, 425, 500, 560, 800]

interface Props { open: boolean; onClose: (created?: boolean) => void }

export function SellModal({ open, onClose }: Props) {
  const supabase = createClient()
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [type, setType]             = useState<'sell' | 'donate'>('sell')
  const [title, setTitle]           = useState('')
  const [quantity, setQuantity]     = useState('1')
  const [bestBefore, setBestBefore] = useState('')
  const [price, setPrice]           = useState('')
  const [postcode, setPostcode]     = useState('')
  const [category, setCategory]     = useState('')
  const [delivery, setDelivery]     = useState('both')
  const [weightGrams, setWeightGrams] = useState('')
  const [expiresAt, setExpiresAt]   = useState('')
  const [conditionOk, setConditionOk] = useState(false)
  const [sponsored, setSponsored]   = useState(false)
  const [loading, setLoading]       = useState(false)

  // Payment / sponsorship state
  const [paymentMethod, setPaymentMethod] = useState<any>(null)
  const [cardModalOpen, setCardModalOpen] = useState(false)
  const [checkingCard, setCheckingCard] = useState(false)

  // Image state
  const [imageFile, setImageFile]     = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const priceNum = parseFloat(price) || 0
  const isDonate = type === 'donate'
  const fee      = isDonate ? calcDonationFee(priceNum) : calcSellerFee(priceNum)
  const payout   = isDonate ? 0 : calcSellerPayout(priceNum)

  async function checkPaymentMethod() {
    setCheckingCard(true)
    const res = await fetch('/api/stripe/payment-method')
    const { paymentMethod: pm } = await res.json()
    setPaymentMethod(pm)
    setCheckingCard(false)
    return pm
  }

  async function handleSponsorToggle() {
    if (!sponsored) {
      const pm = await checkPaymentMethod()
      if (!pm) {
        setCardModalOpen(true)
        return
      }
    }
    setSponsored(!sponsored)
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showToast('⚠️ Image must be under 5MB')
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  async function uploadImage(userId: string, listingId: string): Promise<string | null> {
    if (!imageFile) return null
    setUploadingImage(true)
    const ext = imageFile.name.split('.').pop()
    const path = `${userId}/${listingId}.${ext}`
    const { error } = await supabase.storage
      .from('listing-images')
      .upload(path, imageFile, { upsert: true })
    if (error) {
      showToast(`⚠️ Image upload failed: ${error.message}`)
      setUploadingImage(false)
      return null
    }
    const { data: { publicUrl } } = supabase.storage
      .from('listing-images')
      .getPublicUrl(path)
    setUploadingImage(false)
    return publicUrl
  }

  async function submit() {
    if (!title.trim())    { showToast('⚠️ Enter a product name'); return }
    if (!bestBefore)      { showToast('⚠️ Enter a best before date'); return }
    if (!priceNum)        { showToast('⚠️ Enter a ' + (isDonate ? 'listed value' : 'price')); return }
    if (!postcode.trim()) { showToast('⚠️ Enter your postcode'); return }
    if (!category)        { showToast('⚠️ Choose a category'); return }
    if (!conditionOk)     { showToast('⚠️ Please confirm the condition'); return }

    const dateStr = bestBefore.length === 7 ? bestBefore + '-01' : bestBefore

    setLoading(true)
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          quantity: parseInt(quantity) || 1,
          best_before: dateStr,
          asking_price: isDonate ? null : priceNum,
          is_donation: isDonate,
          category,
          delivery_method: delivery,
          postcode: postcode.trim().toUpperCase(),
          is_sponsored: sponsored,
          weight_grams: weightGrams ? parseInt(weightGrams) : null,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Charge sponsorship fee if sponsored
      if (sponsored && data.data?.id) {
        const sponsorRes = await fetch('/api/stripe/sponsorship', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: data.data.id }),
        })
        const sponsorData = await sponsorRes.json()
        if (!sponsorRes.ok) {
          // Listing created but payment failed — unpublish it
          await supabase.from('listings').update({ status: 'paused' }).eq('id', data.data.id)
          throw new Error(`Sponsorship payment failed: ${sponsorData.error}. Listing saved as draft.`)
        }
      }

      // Upload image if selected
      if (imageFile && data.data?.id) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const imageUrl = await uploadImage(user.id, data.data.id)
          if (imageUrl) {
            await supabase.from('listings')
              .update({ image_url: imageUrl })
              .eq('id', data.data.id)
          }
        }
      }

      onClose(true)
      if (isDonate) showToast('💚 Donation listing published! First to claim gets it.')
      else if (sponsored) showToast('⚡ Listing published & sponsored for £1.50/wk!')
      else showToast('🎉 Listing published for free!')

      // Reset form
      setTitle(''); setQuantity('1'); setBestBefore(''); setPrice('')
      setPostcode(''); setCategory(''); setConditionOk(false); setSponsored(false)
      setWeightGrams(''); setExpiresAt(''); setType('sell')
      removeImage()
    } catch (err: any) {
      showToast(`❌ ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <div className={cn('modal-overlay', open && 'open')} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="w-9 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h3 className="font-display text-xl font-bold mb-3">List a tin</h3>

        {/* Sell / Donate toggle */}
        <div className="flex bg-gray-100 rounded-full p-1 gap-1 mb-4">
          <button onClick={() => setType('sell')}
            className={cn('flex-1 py-2 rounded-full text-sm font-semibold transition-all',
              type === 'sell' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            )}>💰 Sell</button>
          <button onClick={() => setType('donate')}
            className={cn('flex-1 py-2 rounded-full text-sm font-semibold transition-all',
              type === 'donate' ? 'bg-green-600 text-white' : 'text-gray-500'
            )}>🆓 Donate free</button>
        </div>

        {/* Context box */}
        {type === 'sell' ? (
          <div className="bg-green-50 border border-green-100 rounded-lg p-3 mb-4 flex gap-2.5">
            <span className="text-base flex-shrink-0">🎯</span>
            <div>
              <p className="text-xs font-bold text-green-700 mb-0.5">Buyers are waiting</p>
              <p className="text-xs text-gray-500">We take just <strong>1.5%</strong> when it sells.</p>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-100 rounded-lg p-3 mb-4 flex gap-2.5">
            <span className="text-base flex-shrink-0">💚</span>
            <div>
              <p className="text-xs font-bold text-green-700 mb-0.5">Making a difference</p>
              <p className="text-xs text-gray-500">Buyer pays <strong>0.5% fee (min £1)</strong>. First to claim gets it.</p>
            </div>
          </div>
        )}

        {/* Image upload */}
        <div className="mb-4">
          <label className="label">Photo <span className="normal-case font-normal tracking-normal text-gray-400">— optional but recommended</span></label>
          {imagePreview ? (
            <div className="relative w-full h-40 rounded-[10px] overflow-hidden bg-gray-50 border border-gray-100">
              <Image src={imagePreview} alt="Preview" fill className="object-cover" />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => imageInputRef.current?.click()}
              className="w-full h-24 border-2 border-dashed border-gray-200 rounded-[10px] flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors"
            >
              <Camera className="w-6 h-6" />
              <span className="text-xs font-medium">Tap to add photo · JPG, PNG, WebP · Max 5MB</span>
            </button>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleImageSelect}
          />
        </div>

        {/* Form fields */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="label">Product name &amp; brand</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="input" placeholder="e.g. Heinz Baked Beans" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantity (tins)</label>
              <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
                min="1" className="input" placeholder="1" />
            </div>
            <div>
              <label className="label">Best before</label>
              <input
                type="date"
                value={bestBefore}
                onChange={e => setBestBefore(e.target.value)}
                className="input"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{isDonate ? 'Listed value (£)' : 'Asking price (£)'}</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                step="0.10" min="0.10" className="input" placeholder="0.00" />
            </div>
            <div>
              <label className="label">Your postcode</label>
              <input value={postcode} onChange={e => setPostcode(e.target.value.toUpperCase())}
                className="input" placeholder="ST1 4AB" maxLength={8} />
            </div>
          </div>

          {/* Weight field */}
          <div>
            <label className="label">Weight <span className="normal-case font-normal tracking-normal text-gray-400">— optional</span></label>
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[120px]">
                <input
                  type="number"
                  value={weightGrams}
                  onChange={e => setWeightGrams(e.target.value)}
                  className="input pr-10"
                  placeholder="e.g. 400"
                  min="1"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">g</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {COMMON_WEIGHTS.map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeightGrams(String(w))}
                    className={cn(
                      'px-2 py-1 rounded-md text-xs font-medium border transition-colors',
                      weightGrams === String(w)
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-gray-100 text-gray-500 hover:border-green-400'
                    )}
                  >
                    {w}g
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="input cursor-pointer">
                <option value="">Choose…</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Delivery</label>
              <select value={delivery} onChange={e => setDelivery(e.target.value)} className="input cursor-pointer">
                <option value="both">Post or collect</option>
                <option value="collect">Collect only</option>
                <option value="post">Post only</option>
              </select>
            </div>
          </div>

          {/* Optional expiry */}
          <div>
            <label className="label">
              Listing expires <span className="normal-case font-normal tracking-normal text-gray-400">— optional</span>
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="input"
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
            />
            <p className="text-xs text-gray-400 mt-1">Leave blank to keep listed until sold</p>
          </div>

          {/* Payout preview */}
          {priceNum > 0 && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-500">{isDonate ? 'Listed value' : 'Asking price'}</span>
                <span className="font-semibold">{formatPounds(priceNum)}</span>
              </div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-500">{isDonate ? 'Buyer pays (0.5%, min £1)' : 'TrolleySave fee (1.5%)'}</span>
                <span className="text-gray-400">{isDonate ? formatPounds(fee) : `−${formatPounds(fee)}`}</span>
              </div>
              <div className="border-t border-green-100 pt-2 flex justify-between">
                <span className="text-sm font-semibold text-green-800">You receive</span>
                <span className="font-display text-lg font-bold text-green-700">{formatPounds(payout)}</span>
              </div>
            </div>
          )}

          {/* Condition checkbox */}
          <label className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg p-3 cursor-pointer">
            <input type="checkbox" checked={conditionOk} onChange={e => setConditionOk(e.target.checked)}
              className="accent-green-600 w-4 h-4 flex-shrink-0" />
            <span className="text-sm text-gray-700">I confirm these tins are sealed, undamaged, and in-date</span>
          </label>

          {/* Sponsorship (sell mode only) */}
          {!isDonate && (
            <div className={cn('border rounded-lg overflow-hidden transition-colors', sponsored ? 'border-amber-200' : 'border-gray-100')}>
              <label className="flex items-center gap-3 p-3 cursor-pointer" onClick={handleSponsorToggle}>
                <input type="checkbox" checked={sponsored} onChange={() => {}} className="accent-amber-400 w-4 h-4 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold">Sponsor this listing</span>
                    <span className="badge badge-amber text-[10px]">SPONSORED</span>
                  </div>
                  <p className="text-xs text-gray-500">Top of search results · <strong className="text-amber-600">£1.50 / week</strong></p>
                </div>
                <span className="font-display text-lg font-bold text-amber-500 flex-shrink-0">£1.50</span>
              </label>
              {sponsored && (
                <div className="px-3 pb-3 bg-amber-50 border-t border-amber-100 pt-2 text-xs text-amber-700 space-y-1">
                  <p>⚡ Pinned to top of search for 7 days</p>
                  <p>🏷️ Bold Sponsored badge on your listing</p>
                  {paymentMethod ? (
                    <div className="flex items-center justify-between mt-1 bg-white/60 rounded p-2">
                      <span>💳 {paymentMethod.brand?.toUpperCase()} ending {paymentMethod.last4}</span>
                      <button onClick={e => { e.preventDefault(); setCardModalOpen(true) }}
                        className="text-amber-600 underline text-[10px]">Change</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-600 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>No card saved — add one to sponsor</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={() => onClose()} className="btn btn-outline flex-1 justify-center py-3">Cancel</button>
          <button onClick={submit} disabled={loading || uploadingImage} className="btn btn-primary flex-1 justify-center py-3 font-semibold">
            {loading || uploadingImage ? <Spinner size={18} className="text-white" /> :
              sponsored ? '⚡ List + Sponsor — £1.50/wk' :
              isDonate ? '🆓 Donate for free' : 'List for free'}
          </button>
        </div>
      </div>
    </div>

    <CardSetupModal
      open={cardModalOpen}
      onClose={() => setCardModalOpen(false)}
      onSuccess={() => {
        setCardModalOpen(false)
        checkPaymentMethod().then(() => setSponsored(true))
      }}
    />
  </>
  )
}
