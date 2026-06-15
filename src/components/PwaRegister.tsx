'use client'
import { useEffect } from 'react'
import { precacheAll, syncQueue, syncPhotos } from '@/lib/offline'

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.update()

      reg.addEventListener('updatefound', () => {
        const nouveau = reg.installing
        if (!nouveau) return
        nouveau.addEventListener('statechange', () => {
          if (nouveau.state === 'installed' && navigator.serviceWorker.controller) {
            window.location.reload()
          }
        })
      })
    }).catch(console.error)

    let dejaRecharge = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (dejaRecharge) return
      dejaRecharge = true
      window.location.reload()
    })

    // Pré-cache les données au démarrage (en arrière-plan, sans bloquer)
    if (navigator.onLine) {
      setTimeout(() => precacheAll(), 2000)
    }

    // Sync la queue quand le réseau revient
    window.addEventListener('online', async () => {
      await Promise.all([syncQueue(), syncPhotos()])
      setTimeout(() => precacheAll(), 1000)
    })
  }, [])

  return null
}
