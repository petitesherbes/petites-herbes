'use client'
import { useEffect, useState, useCallback } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getPendingCount, syncQueue } from '@/lib/offline'

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: number } | null>(null)

  const refreshPending = useCallback(async () => {
    const n = await getPendingCount()
    setPending(n)
  }, [])

  // Actualiser le compteur régulièrement
  useEffect(() => {
    refreshPending()
    const interval = setInterval(refreshPending, 5000)
    return () => clearInterval(interval)
  }, [refreshPending])

  // Sync automatique au retour du réseau
  useEffect(() => {
    if (!isOnline) return
    async function autoSync() {
      const n = await getPendingCount()
      if (n === 0) return
      setSyncing(true)
      const result = await syncQueue()
      setSyncing(false)
      setSyncResult(result)
      await refreshPending()
      setTimeout(() => setSyncResult(null), 4000)
    }
    autoSync()
  }, [isOnline, refreshPending])

  // Sync manuelle
  async function syncManuel() {
    setSyncing(true)
    const result = await syncQueue()
    setSyncing(false)
    setSyncResult(result)
    await refreshPending()
    setTimeout(() => setSyncResult(null), 4000)
  }

  // Rien à afficher si online et pas de pending et pas de résultat
  if (isOnline && pending === 0 && !syncResult) return null

  if (isOnline && syncResult) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white text-xs px-4 py-2 flex items-center justify-center gap-2">
        <span>&#x2705;</span>
        <span>
          {syncResult.synced} enregistrement{syncResult.synced > 1 ? 's' : ''} synchronisé{syncResult.synced > 1 ? 's' : ''}
          {syncResult.errors > 0 ? ` · ${syncResult.errors} erreur${syncResult.errors > 1 ? 's' : ''}` : ''}
        </span>
      </div>
    )
  }

  if (isOnline && pending > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-xs px-4 py-2 flex items-center justify-between gap-2">
        <span>&#x23F3; {pending} action{pending > 1 ? 's' : ''} en attente de sync</span>
        <button
          onClick={syncManuel}
          disabled={syncing}
          className="bg-white text-amber-700 font-bold px-3 py-1 rounded-full text-xs disabled:opacity-60">
          {syncing ? 'Sync...' : '&#x21BA; Synchroniser'}
        </button>
      </div>
    )
  }

  // Hors ligne
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gray-800 text-white text-xs px-4 py-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
        <span>Hors r&eacute;seau &mdash; donn&eacute;es en lecture seule (cache local)</span>
      </div>
      {pending > 0 && (
        <span className="bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
          {pending} en attente
        </span>
      )}
    </div>
  )
}
