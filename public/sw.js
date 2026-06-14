const CACHE = 'petites-herbes-v3'

// Assets statiques à mettre en cache à l'installation
const SHELL = [
  '/',
  '/semis',
  '/terrain',
  '/commandes',
  '/stock',
  '/couts',
  '/parametres',
  '/manifest.json',
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

  // Ne pas intercepter : API Supabase (géré par IndexedDB dans l'app),
  // POST/PUT/DELETE, et les ressources cross-origin non-essentielles
  if (e.request.method !== 'GET') return
  if (url.hostname.includes('supabase.co')) return
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    // Fonts : cache-first (immutable)
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        })
      })
    )
    return
  }

  // App shell + pages Next.js : réseau en priorité, cache en secours
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache les réponses 2xx
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(async () => {
        const cached = await caches.match(e.request)
        // Si on n'a pas la page exacte, retourner la page d'accueil (app shell)
        return cached || caches.match('/') || new Response(
          '<h1>Hors ligne</h1><p>Cette page n\'est pas disponible sans réseau.</p>',
          { headers: { 'Content-Type': 'text/html' } }
        )
      })
  )
})
