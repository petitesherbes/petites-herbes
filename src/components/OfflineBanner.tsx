'use client'
import { useEffect, useState, useCallback } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getPendingCount, syncQueue, syncPhotos } from '@/lib/offline'

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)

  const refreshPending = useCallback(async () => {
    const n = await getPendingCount()
    setPending(n)
  }, [])

  useEffect(() => {
    refreshPending()
    const interval = setInterval(refreshPending, 5000)
    return () => clearInterval(interval)
  }, [refreshPending])

  useEffect(() => {
    if (!isOnline) return
    async function autoSync() {
      const n = await getPendingCount()
      if (n === 0) return
      setSyncing(true)
      await Promise.all([syncQueue(), syncPhotos()])
      setSyncing(false)
      setSyncDone(true)
      await refreshPending()
      setTimeout(() => setSyncDone(false), 3000)
    }
    autoSync()
  }, [isOnline, refreshPending])

  async function syncManuel() {
    setSyncing(true)
    await Promise.all([syncQueue(), syncPhotos()])
    setSyncing(false)
    setSyncDone(true)
    await refreshPending()
    setTimeout(() => setSyncDone(false), 3000)
  }

  // En ligne, rien en attente, pas de confirmation → invisible
  if (isOnline && pending === 0 && !syncDone) return null

  // Confirmation sync réussie : petit badge vert discret
  if (isOnline && syncDone) {
    return (
      <div className="fixed bottom-20 right-3 z-50 bg-green-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
        &#x2705; Sync&eacute;
      </div>
    )
  }

  // En ligne avec actions en attente
  if (isOnline && pending > 0) {
    return (
      <div className="fixed bottom-20 right-3 z-50 flex items-center gap-2 bg-amber-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
        <span>{pending} en attente</span>
        <button onClick={syncManuel} disabled={syncing}
          className="underline font-bold disabled:opacity-60">
          {syncing ? '...' : 'Sync'}
        </button>
      </div>
    )
  }

  // Hors ligne : petite puce rouge en bas à droite
  return (
    <div className="fixed bottom-20 right-3 z-50 flex items-center gap-1.5 bg-gray-700/90 text-white text-xs px-2.5 py-1 rounded-full shadow-lg">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
      <span>Hors ligne</span>
      {pending > 0 && <span className="font-bold">· {pending}</span>}
    </div>
  )
}
