'use client'
// src/app/product-checker/page.tsx
import { useState, useRef } from 'react'
import Image from 'next/image'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Toast, showToast, Spinner } from '@/components/ui'
import { Barcode, Search, X, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

interface NutrimentEntry {
  value: number
  unit: string
}

interface OpenFoodFactsProduct {
  product_name: string
  brands: string
  image_url: string
  image_front_url: string
  quantity: string
  packaging: string
  categories: string
  ingredients_text: string
  allergens_tags: string[]
  nutriments: {
    energy_kcal_100g?: number
    fat_100g?: number
    'saturated-fat_100g'?: number
    carbohydrates_100g?: number
    sugars_100g?: number
    fiber_100g?: number
    proteins_100g?: number
    salt_100g?: number
    sodium_100g?: number
  }
  nutriscore_grade?: string
  nova_group?: number
  ecoscore_grade?: string
  stores?: string
  countries?: string
  labels?: string
  code: string
}

const NUTRISCORE_COLOUR: Record<string, string> = {
  a: 'bg-green-500',
  b: 'bg-lime-400',
  c: 'bg-yellow-400',
  d: 'bg-orange-400',
  e: 'bg-red-500',
}

const NOVA_LABEL: Record<number, { label: string; colour: string }> = {
  1: { label: 'Unprocessed', colour: 'text-green-700 bg-green-50' },
  2: { label: 'Culinary ingredient', colour: 'text-lime-700 bg-lime-50' },
  3: { label: 'Processed', colour: 'text-yellow-700 bg-yellow-50' },
  4: { label: 'Ultra-processed', colour: 'text-red-700 bg-red-50' },
}

export default function ProductCheckerPage() {
  const [barcode, setBarcode]         = useState('')
  const [loading, setLoading]         = useState(false)
  const [product, setProduct]         = useState<OpenFoodFactsProduct | null>(null)
  const [notFound, setNotFound]       = useState(false)
  const [showNutrition, setShowNutrition] = useState(false)
  const [showIngredients, setShowIngredients] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function lookup(code?: string) {
    const query = (code ?? barcode).trim().replace(/\s/g, '')
    if (!query) { showToast('⚠️ Enter a barcode number'); return }

    setLoading(true)
    setProduct(null)
    setNotFound(false)
    setShowNutrition(false)
    setShowIngredients(false)

    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${query}?fields=product_name,brands,image_url,image_front_url,quantity,packaging,categories,ingredients_text,allergens_tags,nutriments,nutriscore_grade,nova_group,ecoscore_grade,stores,countries,labels,code`,
        { headers: { 'User-Agent': 'TrolleySave/1.0 (contact@trolleysave.com)' } }
      )
      const data = await res.json()

      if (data.status === 1 && data.product) {
        setProduct({ ...data.product, code: query })
      } else {
        setNotFound(true)
      }
    } catch {
      showToast('❌ Failed to fetch product data. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setBarcode('')
    setProduct(null)
    setNotFound(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') lookup()
  }

  const allergens = product?.allergens_tags
    ?.map(tag => tag.replace('en:', '').replace(/-/g, ' '))
    .map(a => a.charAt(0).toUpperCase() + a.slice(1)) ?? []

  const n = product?.nutriments

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
              <Barcode className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold">Product Checker</h1>
          </div>
          <p className="text-sm text-gray-500 ml-13">
            Enter a barcode to get product details, ingredients, allergens and nutrition info.
            Powered by <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer"
              className="text-green-700 underline">Open Food Facts</a>.
          </p>
        </div>

        {/* Search bar */}
        <div className="bg-white border border-gray-100 rounded-[14px] p-4 mb-6">
          <label className="label mb-2">Barcode number</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                ref={inputRef}
                type="number"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 5000295130389"
                className="input pl-9 pr-9"
                autoFocus
              />
              {barcode && (
                <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button onClick={() => lookup()} disabled={loading}
              className="btn btn-primary px-5 flex items-center gap-2">
              {loading ? <Spinner size={16} className="text-white" /> : <Search className="w-4 h-4" />}
              {loading ? 'Searching…' : 'Look up'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            💡 The barcode is the number printed below the stripes on the tin — usually 8 or 13 digits
          </p>
        </div>

        {/* Not found */}
        {notFound && (
          <div className="bg-gray-50 border border-gray-100 rounded-[14px] p-6 text-center">
            <p className="text-3xl mb-2">🔍</p>
            <p className="font-semibold text-gray-700">Product not found</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              Barcode <strong>{barcode}</strong> isn't in the Open Food Facts database yet.
            </p>
            <a href={`https://world.openfoodfacts.org/product/${barcode}`}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-outline btn-sm inline-flex items-center gap-1.5">
              Add it to Open Food Facts <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Product result */}
        {product && (
          <div className="space-y-4">

            {/* Main card */}
            <div className="bg-white border border-gray-100 rounded-[14px] overflow-hidden">
              <div className="flex gap-4 p-5">
                {/* Image */}
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0 flex items-center justify-center">
                  {(product.image_front_url || product.image_url) ? (
                    <Image
                      src={product.image_front_url || product.image_url}
                      alt={product.product_name}
                      width={96}
                      height={96}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-3xl">🥫</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-display text-lg font-bold leading-tight mb-0.5">
                    {product.product_name || 'Unknown product'}
                  </p>
                  {product.brands && (
                    <p className="text-sm text-gray-500 mb-1">{product.brands}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {product.quantity && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {product.quantity}
                      </span>
                    )}
                    {product.nutriscore_grade && (
                      <span className={`text-xs text-white px-2 py-0.5 rounded-full font-bold uppercase ${NUTRISCORE_COLOUR[product.nutriscore_grade] ?? 'bg-gray-400'}`}>
                        Nutri-Score {product.nutriscore_grade.toUpperCase()}
                      </span>
                    )}
                    {product.nova_group && NOVA_LABEL[product.nova_group] && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${NOVA_LABEL[product.nova_group].colour}`}>
                        NOVA {product.nova_group} · {NOVA_LABEL[product.nova_group].label}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Barcode */}
              <div className="px-5 pb-4">
                <p className="text-xs text-gray-400">Barcode: <span className="font-mono">{product.code}</span></p>
              </div>
            </div>

            {/* Allergens */}
            {allergens.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-[14px] p-4">
                <p className="font-semibold text-sm text-amber-800 mb-2">⚠️ Allergens</p>
                <div className="flex flex-wrap gap-2">
                  {allergens.map(a => (
                    <span key={a} className="text-xs bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded-lg font-medium">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Packaging / stores */}
            {(product.packaging || product.stores) && (
              <div className="bg-white border border-gray-100 rounded-[14px] p-4 grid grid-cols-2 gap-4">
                {product.packaging && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Packaging</p>
                    <p className="text-sm font-medium text-gray-700">{product.packaging.split(',')[0]}</p>
                  </div>
                )}
                {product.stores && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Sold at</p>
                    <p className="text-sm font-medium text-gray-700">{product.stores.split(',').slice(0, 3).join(', ')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Ingredients collapsible */}
            {product.ingredients_text && (
              <div className="bg-white border border-gray-100 rounded-[14px] overflow-hidden">
                <button
                  onClick={() => setShowIngredients(!showIngredients)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="font-semibold text-sm">Ingredients</span>
                  {showIngredients ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {showIngredients && (
                  <div className="px-4 pb-4 border-t border-gray-50">
                    <p className="text-sm text-gray-600 leading-relaxed mt-3">
                      {product.ingredients_text}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Nutrition collapsible */}
            {n && Object.keys(n).length > 0 && (
              <div className="bg-white border border-gray-100 rounded-[14px] overflow-hidden">
                <button
                  onClick={() => setShowNutrition(!showNutrition)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="font-semibold text-sm">Nutrition per 100g</span>
                  {showNutrition ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {showNutrition && (
                  <div className="border-t border-gray-50">
                    {[
                      ['Energy', n.energy_kcal_100g != null ? `${n.energy_kcal_100g} kcal` : null],
                      ['Fat', n.fat_100g != null ? `${n.fat_100g}g` : null],
                      ['of which saturates', n['saturated-fat_100g'] != null ? `${n['saturated-fat_100g']}g` : null],
                      ['Carbohydrates', n.carbohydrates_100g != null ? `${n.carbohydrates_100g}g` : null],
                      ['of which sugars', n.sugars_100g != null ? `${n.sugars_100g}g` : null],
                      ['Fibre', n.fiber_100g != null ? `${n.fiber_100g}g` : null],
                      ['Protein', n.proteins_100g != null ? `${n.proteins_100g}g` : null],
                      ['Salt', n.salt_100g != null ? `${n.salt_100g}g` : null],
                    ].filter(([, v]) => v != null).map(([label, value], i) => (
                      <div key={String(label)} className={`flex justify-between px-4 py-2.5 text-sm ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${String(label).startsWith('of') ? 'pl-8 text-gray-400' : 'font-medium'}`}>
                        <span>{label}</span>
                        <span className="font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Open Food Facts link */}
            <a href={`https://world.openfoodfacts.org/product/${product.code}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-green-700 transition-colors py-2">
              View full product page on Open Food Facts <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

      </main>
      <Footer />
      <Toast />
    </>
  )
}
