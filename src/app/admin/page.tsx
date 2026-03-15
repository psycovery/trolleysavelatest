'use client'
// src/app/admin/page.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Toast, showToast, Spinner, Badge } from '@/components/ui'
import { Logo } from '@/components/ui/Logo'
import { formatPounds, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Transaction, Profile } from '@/types'

type AdminTab = 'payouts' | 'sellers' | 'revenue'

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab]               = useState<AdminTab>('payouts')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [sellers, setSellers]       = useState<Profile[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login?redirectTo=/admin'); return }

      const [{ data: t }, { data: s }] = await Promise.all([
        supabase.from('transactions')
          .select('*, seller:profiles(full_name,postcode,stripe_verified,aml_status), buyer:profiles(full_name)')
          .order('created_at', { ascending: false }).limit(50),
        supabase.from('profiles')
          .select('*').order('sales_count', { ascending: false }).limit(50),
      ])

      setTransactions(t ?? [])
      setSellers(s ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function triggerPayout(transactionId: string, sellerName: string, amount: number) {
    showToast(`✅ £${amount.toFixed(2)} triggered for ${sellerName}`)
    // In production: call Stripe API to create transfer
    setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, payout_status: 'paid' } : t))
  }

  async function sendReOnboarding(seller: Profile) {
    const res = await fetch('/api/stripe/connect', { method: 'POST' })
    showToast(`📧 Re-onboarding link sent to ${seller.full_name}`)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={32} /></div>

  // Revenue stats
  const totalTransactionFees  = transactions.filter(t => !t.donation_claim_id).reduce((s, t) => s + t.platform_fee, 0)
  const totalDonationFees     = transactions.filter(t => !!t.donation_claim_id).reduce((s, t) => s + t.platform_fee, 0)
  const awaitingPayout        = transactions.filter(t => t.payout_status === 'pending' && t.seller_id)
    .reduce((s, t) => s + t.net_payout, 0)
  const paidThisMonth         = transactions.filter(t => t.payout_status === 'paid' && t.seller_id &&
    new Date(t.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .reduce((s, t) => s + t.net_payout, 0)
  const failedPayouts         = transactions.filter(t => t.payout_status === 'failed').length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin header */}
      <div className="bg-green-900 text-white px-6 h-14 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-5">
          <span className="font-display font-bold text-amber-200">TrolleySave <span className="text-white/40 text-xs font-sans font-normal">Admin</span></span>
          <div className="flex gap-1">
            {(['payouts', 'sellers', 'revenue'] as AdminTab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-semibold transition-all capitalize',
                  tab === t ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
                )}>
                {t === 'payouts' ? '💸 Payouts' : t === 'sellers' ? '👤 Sellers' : '📊 Revenue'}
              </button>
            ))}
          </div>
        </div>
        <Link href="/" className="text-white/50 text-xs hover:text-white transition-colors">← Back to site</Link>
      </div>

      <div className="max-w-6xl mx-auto p-6">

        {/* PAYOUTS TAB */}
        {tab === 'payouts' && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {[
                { label: 'Awaiting payout',   value: formatPounds(awaitingPayout), color: 'text-amber-500' },
                { label: 'Paid this month',    value: formatPounds(paidThisMonth),  color: 'text-green-700' },
                { label: 'Transaction fees',   value: formatPounds(totalTransactionFees), color: 'text-green-700' },
                { label: 'Donation fees (£1+)',value: formatPounds(totalDonationFees), color: 'text-green-700' },
                { label: 'Sponsorship fees',   value: '£22.50', color: 'text-green-700' },
                { label: 'Failed payouts',     value: failedPayouts, color: failedPayouts > 0 ? 'text-red-600' : 'text-gray-400' },
              ].map(k => (
                <div key={k.label} className="bg-white border border-gray-100 rounded-[14px] p-4">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{k.label}</p>
                  <p className={`font-display text-2xl font-bold ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Payout queue */}
            <div className="bg-white border border-gray-100 rounded-[14px] overflow-hidden mb-5">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold">Payout queue</h2>
                  <p className="text-xs text-gray-400">Stripe Connect · 2 working days to seller bank</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => showToast('✅ All eligible payouts triggered via Stripe')}
                    className="btn btn-primary btn-sm">Process all eligible</button>
                  <button onClick={() => showToast('📥 CSV exported')}
                    className="btn btn-outline btn-sm">Export CSV</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      {['Seller','Order','Sale','Fee (1.5%)','Payout','Status','Action'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.filter(t => t.seller_id).map(t => {
                      const seller = t.seller as any
                      const isDonation = !!t.donation_claim_id
                      return (
                        <tr key={t.id} className={cn('border-t border-gray-100', t.payout_status === 'failed' && 'bg-red-50')}>
                          <td className="px-4 py-3">
                            <p className="font-semibold">{seller?.full_name}</p>
                            <p className="text-xs text-gray-400">{seller?.postcode}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {isDonation ? <span className="text-green-600">🆓 Donation claim</span> : 'Sale'}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {isDonation ? <span className="text-green-600">FREE</span> : formatPounds(t.gross_amount)}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {isDonation ? <span className="text-green-700 font-semibold">£{t.platform_fee.toFixed(2)} claim fee</span>
                              : `−${formatPounds(t.platform_fee)}`}
                          </td>
                          <td className="px-4 py-3 font-bold text-green-700">
                            {isDonation ? '£0.00' : formatPounds(t.net_payout)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={t.payout_status === 'paid' ? 'green' : t.payout_status === 'failed' ? 'red' : 'amber'}>
                              {t.payout_status === 'pending' ? 'Ready' : t.payout_status === 'failed' ? '⚠️ Failed' : '✓ Paid'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {t.payout_status === 'pending' && !isDonation && (
                              <button onClick={() => triggerPayout(t.id, seller?.full_name, t.net_payout)}
                                className="btn btn-primary btn-sm">Pay now</button>
                            )}
                            {t.payout_status === 'failed' && (
                              <button onClick={() => sendReOnboarding(seller)}
                                className="btn btn-sm bg-amber-400 text-amber-700">Request details</button>
                            )}
                            {isDonation && <span className="text-xs text-gray-400">Auto-processed</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* How payouts work */}
            <div className="bg-white border border-gray-100 rounded-[14px] p-5">
              <h3 className="font-display font-bold mb-3">How payouts work — Stripe Connect</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {[
                  ['1. Buyer pays', 'Funds captured to TrolleySave held in escrow'],
                  ['2. Seller dispatches', 'Dispatch confirmed — escrow releases'],
                  ['3. Stripe splits', '98.5% → seller · 1.5% → TrolleySave · automatic'],
                  ['4. Bank transfer', 'Seller UK bank within 2 working days'],
                ].map(([title, desc]) => (
                  <div key={title} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-bold text-green-700 mb-1">{title}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                ⚠️ <strong>Donation claims:</strong> Buyer pays 0.5% fee (min. £1.00) — goes direct to TrolleySave. No seller payout.
                Failed payouts stay in escrow until seller completes Stripe re-onboarding.
              </div>
            </div>
          </>
        )}

        {/* SELLERS TAB */}
        {tab === 'sellers' && (
          <div className="bg-white border border-gray-100 rounded-[14px] overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 font-display text-lg font-bold">Registered sellers</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    {['Seller','Sales / GMV','Rating','Stripe','AML','Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sellers.filter(s => s.sales_count > 0 || s.stripe_account_id).map(s => (
                    <tr key={s.id} className={cn('border-t border-gray-100', !s.stripe_verified && 'bg-red-50/30')}>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{s.full_name}</p>
                        <p className="text-xs text-gray-400">{s.postcode}</p>
                      </td>
                      <td className="px-4 py-3">{s.sales_count} sales</td>
                      <td className="px-4 py-3">★ {s.rating?.toFixed(1) ?? 'New'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={s.stripe_verified ? 'green' : 'red'}>
                          {s.stripe_verified ? '✓ Verified' : '⚠️ Not verified'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={s.aml_status === 'clear' ? 'green' : s.aml_status === 'review' ? 'amber' : 'red'}>
                          {s.aml_status === 'clear' ? '✓ Clear' : s.aml_status === 'review' ? '⚠️ Review' : '🚫 Flagged'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 flex gap-2">
                        {!s.stripe_verified && (
                          <button onClick={() => showToast(`📧 Re-onboarding sent to ${s.full_name}`)}
                            className="btn btn-sm bg-amber-400 text-amber-700">Fix payout</button>
                        )}
                        {s.aml_status === 'review' && (
                          <button onClick={() => showToast(`🔍 AML review opened for ${s.full_name}`)}
                            className="btn btn-sm bg-red-50 text-red-600 border border-red-200">AML review</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REVENUE TAB */}
        {tab === 'revenue' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Total revenue (MTD)', value: formatPounds(totalTransactionFees + totalDonationFees + 22.50), up: true },
                { label: 'Transaction fees (1.5%)', value: formatPounds(totalTransactionFees) },
                { label: 'Donation claim fees', value: formatPounds(totalDonationFees), note: '£1 min per claim' },
                { label: 'Sponsorship fees', value: '£22.50', note: '15 active listings' },
                { label: 'Active sellers', value: sellers.filter(s => s.sales_count > 0).length, up: true },
                { label: 'Donation listings live', value: '12', color: 'text-green-600' },
              ].map((k: any) => (
                <div key={k.label} className="bg-white border border-gray-100 rounded-[14px] p-4">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{k.label}</p>
                  <p className={`font-display text-2xl font-bold ${k.color ?? 'text-green-700'}`}>{k.value}</p>
                  {k.note && <p className="text-xs text-gray-400 mt-1">{k.note}</p>}
                  {k.up && <p className="text-xs text-green-600 mt-1">↑ Growing</p>}
                </div>
              ))}
            </div>

            <div className="bg-white border border-gray-100 rounded-[14px] p-5">
              <h3 className="font-display font-bold mb-4">Revenue breakdown</h3>
              {[
                { label: 'Transaction fees', amount: totalTransactionFees, total: totalTransactionFees + totalDonationFees + 22.50, color: 'bg-green-600' },
                { label: 'Sponsorship fees', amount: 22.50, total: totalTransactionFees + totalDonationFees + 22.50, color: 'bg-amber-400' },
                { label: 'Donation claim fees', amount: totalDonationFees, total: totalTransactionFees + totalDonationFees + 22.50, color: 'bg-green-400' },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-3 mb-2">
                  <span className="w-36 text-xs text-gray-500 flex-shrink-0">{r.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${r.color} rounded-full transition-all`}
                      style={{ width: `${(r.amount / r.total * 100).toFixed(1)}%` }} />
                  </div>
                  <span className="text-xs font-semibold w-14 text-right text-green-700">{formatPounds(r.amount)}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3 mt-4 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-display text-xl font-bold text-green-700">
                  {formatPounds(totalTransactionFees + totalDonationFees + 22.50)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <Toast />
    </div>
  )
}
