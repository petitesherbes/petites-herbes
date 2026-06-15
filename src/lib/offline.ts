/**
 * Cache IndexedDB + queue de mutations pour mode hors-ligne.
 * - saveCache / loadCache : lecture/écriture du cache local
 * - queueMutation : enregistre une écriture différée
 * - syncQueue : rejoue les mutations en attente quand le réseau revient
 * - fetchWithCache : wrapper pour appels Supabase avec fallback cache
 */

import { supabase } from '@/lib/supabase'

const DB_NAME = 'petites-herbes-v1'
const DB_VERSION = 2

type MutationRecord = {
  id?: number
  table: string
  method: 'insert' | 'update' | 'delete' | 'upsert'
  payload: unknown
  matchCol?: string
  matchVal?: string
  onConflict?: string
  ts: number
}

type PhotoQueueRecord = {
  id?: number
  entreeId: string
  fileName: string
  mimeType: string
  data: ArrayBuffer
  ts: number
}

// ─── Ouverture IDB ────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('photo_queue')) {
        db.createObjectStore('photo_queue', { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ─── Cache des données ────────────────────────────────────────────────────────

export async function saveCache(key: string, data: unknown): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite')
      tx.objectStore('cache').put({ key, data, ts: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* silencieux */ }
}

export async function loadCache<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB()
    return new Promise<T | null>((resolve) => {
      const tx = db.transaction('cache', 'readonly')
      const req = tx.objectStore('cache').get(key)
      req.onsuccess = () => resolve((req.result?.data as T) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

// ─── Queue de mutations ───────────────────────────────────────────────────────

export async function queueMutation(m: Omit<MutationRecord, 'id' | 'ts'>): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite')
      tx.objectStore('queue').add({ ...m, ts: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* silencieux */ }
}

export async function getPendingCount(): Promise<number> {
  try {
    const db = await openDB()
    const [mutations, photos] = await Promise.all([
      new Promise<number>((resolve) => {
        const tx = db.transaction('queue', 'readonly')
        const req = tx.objectStore('queue').count()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(0)
      }),
      new Promise<number>((resolve) => {
        const tx = db.transaction('photo_queue', 'readonly')
        const req = tx.objectStore('photo_queue').count()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(0)
      }),
    ])
    return mutations + photos
  } catch {
    return 0
  }
}

export async function syncQueue(): Promise<{ synced: number; errors: number }> {
  let synced = 0
  let errors = 0
  try {
    const db = await openDB()
    const items: MutationRecord[] = await new Promise((resolve) => {
      const tx = db.transaction('queue', 'readonly')
      const req = tx.objectStore('queue').getAll()
      req.onsuccess = () => resolve(req.result as MutationRecord[])
      req.onerror = () => resolve([])
    })

    for (const item of items) {
      try {
        if (item.method === 'insert') {
          // payload peut être un objet ou un tableau (batch insert)
          const { error } = await supabase.from(item.table).insert(item.payload as Record<string, unknown> | Record<string, unknown>[])
          if (error) throw error
        } else if (item.method === 'update' && item.matchCol && item.matchVal) {
          const { error } = await supabase.from(item.table).update(item.payload as Record<string, unknown>).eq(item.matchCol, item.matchVal)
          if (error) throw error
        } else if (item.method === 'delete' && item.matchCol && item.matchVal) {
          const { error } = await supabase.from(item.table).delete().eq(item.matchCol, item.matchVal)
          if (error) throw error
        } else if (item.method === 'upsert') {
          const opts = item.onConflict ? { onConflict: item.onConflict } : undefined
          const { error } = await supabase.from(item.table).upsert(item.payload as Record<string, unknown> | Record<string, unknown>[], opts)
          if (error) throw error
        }
        await new Promise<void>((resolve) => {
          const tx = db.transaction('queue', 'readwrite')
          tx.objectStore('queue').delete(item.id!)
          tx.oncomplete = () => resolve()
        })
        synced++
      } catch {
        errors++
      }
    }
  } catch { /* silencieux */ }
  return { synced, errors }
}

// ─── Wrapper fetch + cache ────────────────────────────────────────────────────

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T[] | null>
): Promise<{ data: T[]; fromCache: boolean }> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

  if (!isOnline) {
    const cached = await loadCache<T[]>(key)
    return { data: cached ?? [], fromCache: true }
  }

  try {
    const data = await fetcher()
    if (data && data.length > 0) {
      await saveCache(key, data)
      return { data, fromCache: false }
    }
    // Réseau OK mais aucune donnée → tenter cache
    const cached = await loadCache<T[]>(key)
    return { data: cached ?? data ?? [], fromCache: false }
  } catch {
    const cached = await loadCache<T[]>(key)
    return { data: cached ?? [], fromCache: true }
  }
}

// ─── Queue de photos hors-ligne ───────────────────────────────────────────────

export async function queuePhoto(entreeId: string, file: File): Promise<string> {
  const data = await file.arrayBuffer()
  const fileName = `${Date.now()}.${file.name.split('.').pop() || 'jpg'}`
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('photo_queue', 'readwrite')
      tx.objectStore('photo_queue').add({ entreeId, fileName, mimeType: file.type || 'image/jpeg', data, ts: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* silencieux */ }
  return URL.createObjectURL(new Blob([data], { type: file.type }))
}

export async function syncPhotos(): Promise<{ synced: number; errors: number }> {
  let synced = 0
  let errors = 0
  try {
    const db = await openDB()
    const items: PhotoQueueRecord[] = await new Promise((resolve) => {
      const tx = db.transaction('photo_queue', 'readonly')
      const req = tx.objectStore('photo_queue').getAll()
      req.onsuccess = () => resolve(req.result as PhotoQueueRecord[])
      req.onerror = () => resolve([])
    })
    for (const item of items) {
      try {
        const file = new File([item.data], item.fileName, { type: item.mimeType })
        const { data: up } = await supabase.storage
          .from('cahier-photos')
          .upload(`${item.entreeId}/${item.fileName}`, file, { upsert: false })
        if (!up) throw new Error('Upload échoué')
        const { data: urlData } = supabase.storage.from('cahier-photos').getPublicUrl(up.path)
        await supabase.from('cahier_photos').insert({ entree_id: item.entreeId, url: urlData.publicUrl })
        await new Promise<void>((resolve) => {
          const tx = db.transaction('photo_queue', 'readwrite')
          tx.objectStore('photo_queue').delete(item.id!)
          tx.oncomplete = () => resolve()
        })
        synced++
      } catch {
        errors++
      }
    }
  } catch { /* silencieux */ }
  return { synced, errors }
}

// ─── Pré-chargement au démarrage ─────────────────────────────────────────────

export async function precacheAll(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.onLine) return

  const tables = [
    'especes',
    'semis',
    'zones',
    'clients',
    'taches_catalogue',
    'parametres_production',
    'contenants',
  ]

  await Promise.allSettled(
    tables.map(async (table) => {
      const { data } = await supabase.from(table).select('*').limit(500)
      if (data) await saveCache(table, data)
    })
  )

  // Semis avec lignes (plus lourd, séparément)
  const { data: semis } = await supabase
    .from('semis')
    .select('*, semis_lignes(*, espece:especes(*))')
    .order('date_semis', { ascending: false })
    .limit(30)
  if (semis) await saveCache('semis_complets', semis)

  // Cahier culture récent
  const { data: cahier } = await supabase
    .from('cahier_culture')
    .select('*, zone:zones(nom), espece:especes(nom)')
    .order('date_entree', { ascending: false })
    .limit(100)
  if (cahier) await saveCache('cahier_culture', cahier)

  // Commandes récentes
  const il_y_a_3_mois = new Date()
  il_y_a_3_mois.setMonth(il_y_a_3_mois.getMonth() - 3)
  const { data: commandes } = await supabase
    .from('bons_livraison')
    .select('*, client:clients(nom, telephone), bl_lignes(*)')
    .gte('created_at', il_y_a_3_mois.toISOString())
    .order('created_at', { ascending: false })
    .limit(50)
  if (commandes) await saveCache('commandes', commandes)
}
