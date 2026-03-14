'use client'
// src/components/ui/index.tsx — small shared UI primitives

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

// ── Toast
let toastTimer: ReturnType<typeof setTimeout>
let _setToast: ((msg: string) => void) | null = null

export function showToast(msg: string) {
  _setToast?.(msg)
}

export function Toast() {
  const [msg, setMsg] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    _setToast = (m: string) => {
      setMsg(m)
      setVisible(true)
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => setVisible(false), 2400)
    }
  }, [])

  return (
    <div className={cn(
      'fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-full text-sm font-medium z-[200] transition-all duration-200 whitespace-nowrap pointer-events-none',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
    )}>
      {msg}
    </div>
  )
}

// ── Spinner
export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={cn('animate-spin text-green-600', className)} width={size} height={size}
      viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

// ── TinPlaceholder
export function TinPlaceholder({ label, hint, className }: {
  label?: string; hint?: string; className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-1.5 w-full h-full', className)}>
      <div className="relative w-12 h-14">
        <div className="absolute -top-1.5 left-1.5 right-1.5 h-2 bg-gray-300 rounded-t" />
        <div className="w-full h-full bg-gray-200 rounded-t-md rounded-b-[10px]" />
        <div className="absolute -bottom-1 left-1.5 right-1.5 h-1.5 bg-gray-300 rounded-b" />
      </div>
      {label && <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-center max-w-[90%] truncate">{label}</p>}
      {hint  && <p className="text-[9px] text-gray-300">{hint}</p>}
    </div>
  )
}

// ── Badge
export function Badge({ children, variant = 'gray', className = '' }: {
  children: React.ReactNode
  variant?: 'green' | 'amber' | 'red' | 'gray' | 'donate'
  className?: string
}) {
  const variants = {
    green:  'bg-green-50 text-green-700 border border-green-100',
    amber:  'bg-amber-50 text-amber-600 border border-amber-200',
    red:    'bg-red-50 text-red-700 border border-red-200',
    gray:   'bg-gray-50 text-gray-500 border border-gray-100',
    donate: 'bg-green-600 text-white',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', variants[variant], className)}>
      {children}
    </span>
  )
}

// ── StarRating
export function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const stars = [1,2,3,4,5]
  const cls = size === 'md' ? 'text-base' : 'text-xs'
  return (
    <span className={cn('tracking-[-1px] text-amber-400', cls)}>
      {stars.map(s => s <= Math.round(rating) ? '★' : '☆').join('')}
    </span>
  )
}

// ── SectionHeader
export function SectionHeader({ title, action, subtitle }: {
  title: string; action?: React.ReactNode; subtitle?: string
}) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <div>
        <h2 className="font-display text-xl font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ── InfoBox
export function InfoBox({ icon, title, body, variant = 'green' }: {
  icon: string; title: string; body: string; variant?: 'green' | 'amber'
}) {
  const cls = variant === 'green'
    ? 'bg-green-50 border-green-100 text-green-700'
    : 'bg-amber-50 border-amber-200 text-amber-700'
  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-lg border', cls)}>
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div>
        <p className="text-xs font-bold mb-0.5">{title}</p>
        <p className="text-xs leading-relaxed opacity-80">{body}</p>
      </div>
    </div>
  )
}
