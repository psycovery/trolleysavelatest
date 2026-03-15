'use client'
// src/app/basket/page.tsx
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ShoppingBasket } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function BasketPage() {
  const router = useRouter()

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-16 pb-24 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <ShoppingBasket className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">Your basket</h1>
        <p className="text-gray-500 mb-6">
          TrolleySave works differently to a normal shop — you browse listings and make
          offers or buy directly on each individual tin or bundle. There's no basket to fill.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button onClick={() => router.push('/')}
            className="btn btn-primary">
            Browse listings
          </button>
          <button onClick={() => router.push('/buyer')}
            className="btn btn-outline">
            My purchases
          </button>
        </div>
      </main>
      <Footer />
    </>
  )
}
