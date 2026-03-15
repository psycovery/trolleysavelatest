'use client'
// src/components/layout/Header.tsx
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ShoppingBasket, Bell, Heart, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'

export function Header() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Listen for auth changes (login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Subscribe to unread wishlist matches
  useEffect(() => {
    if (!user) return
    supabase
      .from('wishlist_matches')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', user.id)
      .eq('seen', false)
      .then(({ count }) => setNotifCount(count ?? 0))

    const channel = supabase
      .channel('wishlist-notifs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'wishlist_matches',
        filter: `buyer_id=eq.${user.id}`,
      }, () => setNotifCount(n => n + 1))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    window.location.href = '/'
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) router.push(`/?q=${encodeURIComponent(search.trim())}`)
  }

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">

        <Link href="/" className="flex-shrink-0"><Logo /></Link>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md mx-auto hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tins, brands, categories… UK only 🇬🇧"
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm outline-none focus:border-green-600 focus:bg-white transition-colors"
            />
          </div>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">

          <Link href="/basket" className="icon-btn relative" title="Basket">
            <ShoppingBasket className="w-5 h-5" />
          </Link>

          {user && (
            <Link href="/buyer?tab=wishlist" className="icon-btn relative" title="Notifications">
              <Bell className="w-5 h-5" />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
                  {notifCount}
                </span>
              )}
            </Link>
          )}

          <Link href="/buyer" className="icon-btn hidden sm:flex" title="Saved">
            <Heart className="w-5 h-5" />
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              <Link href="/seller" className="btn btn-outline btn-sm hidden sm:flex">
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="btn btn-sm hidden sm:flex bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full px-3 py-1.5 text-xs font-medium border-none"
              >
                Log out
              </button>
            </div>
          ) : (
            <Link href="/auth/login" className="btn btn-outline btn-sm hidden sm:flex">
              Log in
            </Link>
          )}

          <button
            onClick={() => router.push(user ? '/?sell=1' : '/auth/login')}
            className="btn btn-primary btn-sm"
          >
            + List item
          </button>

        </div>
      </div>
    </header>
  )
}
