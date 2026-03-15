'use client'
// src/components/listings/ListingCard.tsx
import Link from 'next/link'
import Image from 'next/image'
import { Heart, Clock } from 'lucide-react'
import { Listing } from '@/types'
import { formatPounds, calcSaving, formatBestBefore, isExpiringSoon, timeRemaining, expiryUrgency } from '@/lib/utils'
import { Badge, StarRating, TinPlaceholder } from '@/components/ui'
import { cn } from '@/lib/utils'

interface ListingCardProps {
  listing: Listing
  onOffer?: (listing: Listing) => void
  onClaim?: (listing: Listing) => void
  onSave?: (listing: Listing) => void
  isSaved?: boolean
}

export function ListingCard({ listing, onOffer, onClaim, onSave, isSaved = false }: ListingCardProps) {
  const isDonation  = listing.is_donation
  const isSponsored = listing.is_sponsored
  const expiringSoon = isExpiringSoon(listing.best_before)

  // Listing expiry countdown
  const expiresIn = timeRemaining((listing as any).expires_at)
  const urgency   = expiryUrgency((listing as any).expires_at)

  const sellerDisplay = (listing.seller as any)?.nickname
    || listing.seller?.full_name?.split(' ')[0]
    || ''

  return (
    <div className={cn(
      'listing-card group',
      isDonation && 'listing-card-donate',
      isSponsored && 'border-amber-200 bg-gradient-to-b from-amber-50 to-white',
    )}>
      <Link href={`/listing/${listing.id}`} className="block">
        {/* Image */}
        <div className={cn(
          'relative h-36 flex items-center justify-center overflow-hidden',
          isDonation ? 'bg-[#E8F8F0]' : isSponsored ? 'bg-amber-50' : 'bg-gray-50'
        )}>
          {listing.image_url ? (
            <Image src={listing.image_url} alt={listing.title} fill className="object-cover" />
          ) : (
            <TinPlaceholder
              label={listing.title}
              hint={isDonation ? 'Free to claim' : 'No photo yet'}
              className={isDonation ? '[&_div]:bg-[#9FE1CB]' : ''}
            />
          )}

          {/* Badge top-left */}
          {isDonation && (
            <span className="absolute top-2 left-2"><Badge variant="donate">🆓 Free</Badge></span>
          )}
          {isSponsored && !isDonation && (
            <span className="absolute top-2 left-2"><Badge variant="amber">⚡ Sponsored</Badge></span>
          )}
          {!isDonation && !isSponsored && expiringSoon && (
            <span className="absolute top-2 left-2"><Badge variant="red">Ends soon</Badge></span>
          )}

          {/* Listing expiry countdown — bottom of image */}
          {expiresIn && (
            <div className={cn(
              'absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 py-1 text-[10px] font-bold',
              urgency === 'critical' ? 'bg-red-500/90 text-white' :
              urgency === 'warning'  ? 'bg-amber-400/90 text-amber-900' :
              'bg-gray-800/70 text-white'
            )}>
              <Clock className="w-2.5 h-2.5" />
              {expiresIn}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={e => { e.preventDefault(); onSave?.(listing) }}
            className={cn(
              'absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center transition-all',
              isSaved ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'
            )}
          >
            <Heart className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Body */}
        <div className="p-3">
          <p className="font-semibold text-sm text-gray-900 truncate mb-1">{listing.title}</p>

          {isDonation && (
            <p className="text-xs font-semibold text-green-700 mb-1">
              Listed value: {formatPounds(listing.asking_price ?? 0)} · Claim fee: £1.00
            </p>
          )}

          <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
            <span>{listing.postcode}</span>
            <span>·</span>
            <span>BB: {formatBestBefore(listing.best_before)}</span>
          </div>

          {listing.seller && (
            <div className="flex items-center gap-2 mb-2">
              {/* Seller avatar */}
              <div className="w-5 h-5 rounded-full overflow-hidden bg-green-600 flex-shrink-0 flex items-center justify-center">
                {(listing.seller as any).avatar_url ? (
                  <Image
                    src={(listing.seller as any).avatar_url}
                    alt={sellerDisplay}
                    width={20}
                    height={20}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-[8px]">
                    {sellerDisplay.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <StarRating rating={listing.seller.rating ?? 0} />
              <span className="text-xs text-gray-500">
                {listing.seller.rating?.toFixed(1)} · {sellerDisplay}
              </span>
            </div>
          )}

          {/* Price row */}
          <div className="flex items-center justify-between">
            {isDonation ? (
              <div>
                <p className="font-display text-xl font-bold text-green-600">FREE</p>
                <p className="text-[10px] text-gray-400">£1 claim fee + any postage</p>
              </div>
            ) : (
              <div>
                <p className="font-display text-xl font-bold text-green-700">
                  {formatPounds(listing.asking_price!)}
                </p>
              </div>
            )}

            {isDonation ? (
              <button
                onClick={e => { e.preventDefault(); onClaim?.(listing) }}
                className="btn btn-sm bg-green-600 text-white hover:bg-green-700 rounded-full text-xs font-bold"
              >
                Claim
              </button>
            ) : (
              <button
                onClick={e => { e.preventDefault(); onOffer?.(listing) }}
                className="btn btn-sm btn-amber"
              >
                Offer
              </button>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}
