// src/lib/stripe.ts — server-side Stripe helpers
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export const PLATFORM_FEE_BPS = 150
export const DONATION_MIN_FEE_PENCE = 100

export function calcPlatformFee(amountPence: number): number {
  return Math.round(amountPence * PLATFORM_FEE_BPS / 10000)
}

export function calcDonationFee(listedValuePence: number): number {
  const pct = Math.round(listedValuePence * 50 / 10000)
  return Math.max(DONATION_MIN_FEE_PENCE, pct)
}

export async function createConnectAccount(email: string, fullName?: string) {
  const nameParts = fullName?.trim().split(' ') ?? []
  const firstName = nameParts[0] ?? ''
  const lastName  = nameParts.slice(1).join(' ') ?? ''

  return stripe.accounts.create({
    type: 'express',
    country: 'GB',
    email,
    business_type: 'individual',
    individual: {
      email,
      ...(firstName && { first_name: firstName }),
      ...(lastName  && { last_name:  lastName  }),
    },
    capabilities: {
      card_payments: { requested: true },
      transfers:     { requested: true },
    },
    settings: {
      payouts: { schedule: { interval: 'manual' } },
    },
  })
}

export async function createOnboardingLink(accountId: string, origin: string) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/seller?stripe=refresh`,
    return_url:  `${origin}/seller?stripe=success`,
    type: 'account_onboarding',
  })
}

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

export async function capturePaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.capture(paymentIntentId)
}

export async function cancelPaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.cancel(paymentIntentId)
}

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
