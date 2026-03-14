'use client'
// src/components/listings/ListingCard.tsx
import Link from 'next/link'
import Image from 'next/image'
import { Heart } from 'lucide-react'
import { Listing } from '@/types'
import { formatPounds, calcSaving, formatBestBefore, isExpiringSoon } from '@/lib/utils'
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
  const isDonation = listing.is_donation
  const isSponsored = listing.is_sponsored
  const expiringSoon = isExpiringSoon(listing.best_before)

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
            <div className="flex items-center gap-1 mb-2">
              <StarRating rating={listing.seller.rating ?? 0} />
              <span className="text-xs text-gray-500">
                {listing.seller.rating?.toFixed(1)} · {listing.seller.full_name.split(' ')[0]}
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
