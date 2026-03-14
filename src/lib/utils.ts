// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

export function formatPounds(pounds: number): string {
  return `£${pounds.toFixed(2)}`
}

export function poundsToPence(pounds: number): number {
  return Math.round(pounds * 100)
}

export function penceToPounds(pence: number): number {
  return pence / 100
}

/** 1.5% platform fee, returned in pounds */
export function calcSellerFee(price: number): number {
  return parseFloat((price * 0.015).toFixed(2))
}

/** 0.5% donation fee, minimum £1.00, returned in pounds */
export function calcDonationFee(listedValue: number): number {
  const pct = listedValue * 0.005
  return Math.max(1.00, parseFloat(pct.toFixed(2)))
}

/** Seller's net payout after 1.5% fee */
export function calcSellerPayout(price: number): number {
  return parseFloat((price - calcSellerFee(price)).toFixed(2))
}

/** Percentage saving vs retail */
export function calcSaving(price: number, retail: number): number {
  if (!retail || retail <= 0) return 0
  return Math.round(((retail - price) / retail) * 100)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function formatBestBefore(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    month: 'short', year: 'numeric',
  })
}

export function isExpiringSoon(dateStr: string): boolean {
  const date = new Date(dateStr)
  const thirtyDays = new Date()
  thirtyDays.setDate(thirtyDays.getDate() + 30)
  return date < thirtyDays
}

export function isPastBestBefore(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str
}

export function getInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? '?'
}

/** Format a UK postcode to uppercase with space */
export function formatPostcode(raw: string): string {
  const clean = raw.replace(/\s/g, '').toUpperCase()
  if (clean.length >= 5) {
    return clean.slice(0, -3) + ' ' + clean.slice(-3)
  }
  return clean
}
