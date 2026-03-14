'use client'
// src/components/layout/Footer.tsx
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export function Footer() {
  return (
    <footer className="mt-auto bg-green-900 text-white/70 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-wrap gap-6 justify-between items-start">
        <div>
          <Logo size="md" />
          <p className="text-sm mt-2 text-white/50">Why pay supermarket prices?</p>
        </div>
        <div className="flex gap-5 flex-wrap text-sm">
          {['About','How it works','Safety','Terms','Privacy','Cookie policy','Contact'].map(l => (
            <Link key={l} href="#" className="text-white/60 hover:text-white transition-colors">{l}</Link>
          ))}
          <Link href="/admin" className="text-white/30 text-xs hover:text-white/50 transition-colors">Admin</Link>
        </div>
        <p className="w-full text-xs text-white/40">
          © 2026 TrolleySave Ltd · Registered in England &amp; Wales · Free to list · 1.5% seller fee · £1 min. donation claim fee · UK only 🇬🇧 · Reducing food waste, one tin at a time 🌿
        </p>
      </div>
    </footer>
  )
}
