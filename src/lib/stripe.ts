// src/lib/stripe.ts — server-side Stripe helpers
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

// ── Fee calculations
export const PLATFORM_FEE_BPS = 150       // 1.5%
export const DONATION_MIN_FEE_PENCE = 100 // £1.00 minimum

/** Returns platform fee in pence for a standard sale */
export function calcPlatformFee(amountPence: number): number {
  return Math.round(amountPence * PLATFORM_FEE_BPS / 10000)
}

/** Returns donation claim fee in pence (0.5%, minimum £1.00) */
export function calcDonationFee(listedValuePence: number): number {
  const pct = Math.round(listedValuePence * 50 / 10000) // 0.5%
  return Math.max(DONATION_MIN_FEE_PENCE, pct)
}

// ── Create Stripe Connect Express account for a new seller (individual)
export async function createConnectAccount(email: string) {
  return stripe.accounts.create({
    type: 'express',
    country: 'GB',
    email,
    business_type: 'individual',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    settings: {
      payouts: {
        schedule: { interval: 'manual' },
      },
    },
  })
}

// ── Generate onboarding link for seller to complete bank/identity verification
export async function createOnboardingLink(accountId: string, origin: string) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/seller?stripe=refresh`,
    return_url:  `${origin}/seller?stripe=success`,
    type: 'account_onboarding',
  })
}

// ── Create a payment intent for a buyer offer (held in escrow until accepted)
export async function createOfferPaymentIntent({
  amountPence,
  sellerStripeAccountId,
  metadata,
}: {
  amountPence: number
  sellerStripeAccountId: string
  metadata: Record<string, string>
}) {
  const applicationFee = calcPlatformFee(amountPence)
  return stripe.paymentIntents.create({
    amount: amountPence,
    currency: 'gbp',
    capture_method: 'manual',
    application_fee_amount: applicationFee,
    transfer_data: { destination: sellerStripeAccountId },
    metadata,
  })
}

// ── Capture a held payment intent (called when seller accepts offer)
export async function capturePaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.capture(paymentIntentId)
}

// ── Cancel a held payment intent (called when offer declined or expired)
export async function cancelPaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.cancel(paymentIntentId)
}

// ── Create a donation claim payment intent (fee to TrolleySave only)
export async function createDonationClaimIntent({
  listedValuePence,
  metadata,
}: {
  listedValuePence: number
  metadata: Record<string, string>
}) {
  const fee = calcDonationFee(listedValuePence)
  return stripe.paymentIntents.create({
    amount: fee,
    currency: 'gbp',
    metadata,
  })
}

// ── Create a weekly sponsorship charge (£1.50)
export async function createSponsorshipCharge(customerId: string, listingId: string) {
  return stripe.paymentIntents.create({
    amount: 150,
    currency: 'gbp',
    customer: customerId,
    metadata: { type: 'sponsorship', listing_id: listingId },
    confirm: true,
    off_session: true,
  })
}
