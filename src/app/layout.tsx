import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import PwaRegister from '@/components/PwaRegister'

export const metadata: Metadata = {
  title: 'GAEC Les Petites Herbes',
  description: 'Gestion des semis — microgreens, fleurs comestibles, PPAM',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Petites Herbes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1B5E20',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full flex flex-col bg-gray-50">
        <PwaRegister />
        <main className="flex-1 max-w-2xl mx-auto w-full pb-2">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
