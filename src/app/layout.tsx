import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import PwaRegister from '@/components/PwaRegister'
import ApercuChef from '@/components/ApercuChef'
import OfflineBanner from '@/components/OfflineBanner'

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-cream">
        <PwaRegister />
        <OfflineBanner />
        <main className="flex-1 max-w-2xl mx-auto w-full pb-2">
          {children}
        </main>
        <ApercuChef />
        <BottomNav />
      </body>
    </html>
  )
}
