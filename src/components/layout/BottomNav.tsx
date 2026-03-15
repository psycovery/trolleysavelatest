'use client'
// src/components/layout/BottomNav.tsx
import Link from 'next/link'
import { Home, Search, Heart, User, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BottomNav({ onSell }: { onSell: () => void }) {
  // usePathname removed — active state handled by CSS :active instead
  const navItems = [
    { href: '/',        icon: Home,   label: 'Home'    },
    { href: '/listing', icon: Search, label: 'Browse'  },
    null,
    { href: '/buyer',   icon: Heart,  label: 'Saved'   },
    { href: '/seller',  icon: User,   label: 'Profile' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 md:hidden pb-safe">
      <div className="flex justify-around items-end">
        {navItems.map((item, i) => {
          if (!item) return (
            <button key="sell" onClick={onSell} className="flex flex-col items-center gap-1 pb-2 -mt-3">
              <div className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center shadow-lg shadow-green-600/40">
                <Plus className="w-7 h-7 text-white" />
              </div>
              <span className="text-[10px] font-medium text-gray-400">Sell</span>
            </button>
          )
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className={cn('flex flex-col items-center gap-1 px-4 py-2 text-[10px] font-medium text-gray-400 hover:text-green-700 transition-colors')}>
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
