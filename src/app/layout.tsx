// src/app/layout.tsx
import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: { default: 'TrolleySave', template: '%s | TrolleySave' },
  description: 'Buy and sell surplus tinned food. Make an offer, save money, cut waste. UK only.',
  keywords: ['tinned food', 'food exchange', 'surplus food', 'UK marketplace', 'save money'],
  openGraph: {
    title: 'TrolleySave — Why pay supermarket prices?',
    description: 'UK peer-to-peer marketplace for surplus tinned food.',
    url: 'https://trolleysave.co.uk',
    siteName: 'TrolleySave',
    locale: 'en_GB',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="font-body bg-gray-50 text-gray-900 min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  )
}
