'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/',           icon: '🏠', label: 'Rappels' },
  { href: '/semis',      icon: '🌱', label: 'Semis' },
  { href: '/historique', icon: '📋', label: 'Historique' },
  { href: '/stock',      icon: '📦', label: 'Stock' },
  { href: '/couts',      icon: '💶', label: 'Coûts' },
  { href: '/parametres', icon: '⚙️', label: 'Params' },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-2xl mx-auto flex">
        {tabs.map(tab => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
          return (
            <Link key={tab.href} href={tab.href}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors select-none
                ${active
                  ? 'text-green-800'
                  : 'text-gray-400 hover:text-gray-600'}`}>
              <span className={`text-xl leading-none transition-transform ${active ? 'scale-110' : ''}`}>
                {tab.icon}
              </span>
              <span className={`text-[10px] font-medium ${active ? 'text-green-800' : ''}`}>
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
