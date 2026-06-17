const CACHE = 'petites-herbes-v4'

const SHELL = [
  '/',
  '/semis',
  '/terrain',
  '/commandes',
  '/commandes/nouveau',
  '/historique',
  '/planning',
  '/stock',
  '/couts',
  '/parametres',
  '/manifest.json',
  '/favicon.ico',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  if (e.request.method !== 'GET') return

  // ── Supabase Storage (photos publiques) : cache-first ──
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/v1/object/public/')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        }).catch(() => new Response('', { status: 404 }))
      })
    )
    return
  }

  // ── Toute autre requête Supabase (API, auth, realtime) : passer sans intercepter ──
  if (url.hostname.includes('supabase.co')) return

  // ── Next.js chunks statiques (/_next/static/) : cache-first (immutable, hachés) ──
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        }).catch(() => new Response('', { status: 503 }))
      })
    )
    return
  }

  // ── Google Fonts : cache-first ──
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        })
      })
    )
    return
  }

  // ── Pages app + assets divers : réseau en priorité, cache en secours ──
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(async () => {
        const cached = await caches.match(e.request)
        if (cached) return cached
        if (e.request.mode === 'navigate') {
          return caches.match('/') || new Response(
            '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Hors ligne</title></head>' +
            '<body style="font-family:sans-serif;text-align:center;padding:40px">' +
            '<h1>📵 Hors ligne</h1>' +
            '<p>Ouvre d\'abord l\'application en ligne pour activer le mode hors-ligne.</p>' +
            '<button onclick="location.reload()">Réessayer</button></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          )
        }
        return new Response('', { status: 503 })
      })
  )
})
