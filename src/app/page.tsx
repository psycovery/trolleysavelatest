'use client'
// src/app/page.tsx
import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { BottomNav } from '@/components/layout/BottomNav'
import { ListingsGrid } from '@/components/listings/ListingsGrid'
import { OfferModal } from '@/components/modals/OfferModal'
import { SellModal } from '@/components/modals/SellModal'
import { ClaimModal } from '@/components/modals/ClaimModal'
import { Toast } from '@/components/ui'
import { Listing } from '@/types'

export default function HomePage() {
  const [offerListing, setOfferListing] = useState<Listing | null>(null)
  const [claimListing, setClaimListing] = useState<Listing | null>(null)
  const [sellOpen, setSellOpen] = useState(false)

  return (
    <>
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-green-800 via-green-700 to-green-600 text-white py-12 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(239,159,39,0.18),transparent_65%)]" />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-70 text-amber-200 mb-3">
            Why pay supermarket prices?
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-black leading-tight mb-3">
            Supermarkets hate this.<br />
            <em className="not-italic text-amber-200">Your wallet will love it.</em>
          </h1>
          <p className="text-base opacity-90 mb-6 leading-relaxed">
            Buy and sell surplus tinned food. Make an offer, save money, cut waste.
          </p>
          <div className="flex justify-center gap-6 flex-wrap">
            {[['2,840','Active listings'],['£4.20','Avg. saving'],['12k','Tins saved']].map(([v, l]) => (
              <div key={l} className="text-center">
                <p className="font-display text-2xl font-bold text-amber-200">{v}</p>
                <p className="text-xs uppercase tracking-wide opacity-60">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Listings with categories, search, grid */}
      <main className="flex-1">
        <ListingsGrid
          onOffer={setOfferListing}
          onClaim={setClaimListing}
        />
      </main>

      <Footer />
      <BottomNav onSell={() => setSellOpen(true)} />

      {/* Modals */}
      <OfferModal listing={offerListing} onClose={() => setOfferListing(null)} />
      <SellModal open={sellOpen} onClose={() => setSellOpen(false)} />
      <ClaimModal listing={claimListing} onClose={() => setClaimListing(null)} />
      <Toast />
    </>
  )
}
