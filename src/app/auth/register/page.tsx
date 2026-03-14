'use client'
// src/app/auth/register/page.tsx
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatPostcode } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'
import { Spinner } from '@/components/ui'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [postcode, setPostcode] = useState('')
  const [password, setPassword] = useState('')
  const [termsOk, setTermsOk] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!termsOk) { setError('Please accept the Terms of Service to continue.'); return }
    setLoading(true); setError('')

    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          postcode: formatPostcode(postcode),
        },
      },
    })

    if (error) { setError(error.message); setLoading(false); return }
    router.push('/?welcome=1')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/"><Logo size="lg" /></Link>
          <p className="text-xs tracking-widest uppercase text-gray-400 mt-1">Food Exchange · UK</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-[14px] p-6">
          <form onSubmit={handleRegister} className="space-y-3">
            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First name</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="Jane" className="input" required />
              </div>
              <div>
                <label className="label">Last name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  placeholder="Smith" className="input" required />
              </div>
            </div>

            <div>
              <label className="label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.co.uk" className="input" required />
            </div>

            <div>
              <label className="label">Postcode</label>
              <input value={postcode} onChange={e => setPostcode(e.target.value.toUpperCase())}
                placeholder="ST1 4AB" className="input" maxLength={8} required />
            </div>

            <div>
              <label className="label">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters" className="input" minLength={8} required />
            </div>

            <label className="flex items-start gap-3 bg-gray-50 rounded-lg p-3 cursor-pointer">
              <input type="checkbox" checked={termsOk} onChange={e => setTermsOk(e.target.checked)}
                className="accent-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-gray-500 leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" className="text-green-700 hover:underline">Terms</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-green-700 hover:underline">Privacy Policy</Link>.
                UK residents only.
              </span>
            </label>

            <button type="submit" disabled={loading}
              className="btn btn-primary w-full justify-center py-3 rounded-lg text-base">
              {loading ? <Spinner size={18} className="text-white" /> : "Create account — it's free"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-green-700 font-medium hover:underline">Log in</Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-3">SSL encrypted · ICO registered · UK GDPR compliant</p>
      </div>
    </div>
  )
}
