'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const tabs = [
  { href: '/',            icon: '🏠', label: 'Accueil' },
  { href: '/semis',       icon: '🌱', label: 'Semis' },
  { href: '/commandes',   icon: '🛒', label: 'Commandes' },
  { href: '/planning',    icon: '📅', label: 'Planning' },
  { href: '/terrain',     icon: '🌿', label: 'Terrain' },
  { href: '/stock',       icon: '🌾', label: 'Stock' },
  { href: '/parametres',  icon: '⚙️',  label: 'Réglages' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [nbNouvelles, setNbNouvelles] = useState(0)

  // Pages client (boutique) : pas de navigation admin
  const estBoutique = pathname.startsWith('/commander')

  useEffect(() => {
    let actif = true
    async function compter() {
      const il_y_a_48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('bons_livraison')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', il_y_a_48h)
      if (actif) setNbNouvelles(count || 0)
    }
    compter()
    const interval = setInterval(compter, 5 * 60 * 1000)
    return () => { actif = false; clearInterval(interval) }
  }, [pathname])

  if (estBoutique) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-2xl mx-auto flex">
        {tabs.map(tab => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
          const showBadge = tab.href === '/commandes' && nbNouvelles > 0
          return (
            <Link key={tab.href} href={tab.href}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors select-none relative
                ${active
                  ? 'text-green-800'
                  : 'text-gray-400 hover:text-gray-600'}`}>
              <span className={`relative text-xl leading-none transition-transform ${active ? 'scale-110' : ''}`}>
                {tab.icon}
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center leading-none">
                    {nbNouvelles > 9 ? '9+' : nbNouvelles}
                  </span>
                )}
              </span>
              <span className={`text-[9px] font-medium ${active ? 'text-green-800' : ''}`}>
                {tab.label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-green-700 rounded-t-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
