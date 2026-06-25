'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export const ALL_NAV_TABS = [
  { href: '/',            icon: '🏠', label: 'Accueil',   locked: true  },
  { href: '/semis',       icon: '🌱', label: 'Semis',     locked: false },
  { href: '/commandes',   icon: '🛒', label: 'Commandes', locked: false },
  { href: '/planning',    icon: '✅', label: 'Tâches',    locked: false },
  { href: '/terrain',     icon: '🌿', label: 'Terrain',   locked: false },
  { href: '/parametres',  icon: '⚙️',  label: 'Réglages',  locked: true  },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [nbNouvelles, setNbNouvelles] = useState(0)
  const [visibleHrefs, setVisibleHrefs] = useState<string[] | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('nav_visible_tabs')
    setVisibleHrefs(stored ? JSON.parse(stored) as string[] : ALL_NAV_TABS.map(t => t.href))
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nav_visible_tabs' && e.newValue)
        setVisibleHrefs(JSON.parse(e.newValue) as string[])
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

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
  }, [])

  if (estBoutique) return null

  const tabs = visibleHrefs
    ? ALL_NAV_TABS.filter(t => visibleHrefs.includes(t.href))
    : ALL_NAV_TABS

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
