'use client'
import { useEffect } from 'react'

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').then(reg => {
      // Vérifie une nouvelle version à chaque ouverture
      reg.update()

      // Quand une nouvelle version est prête, recharge automatiquement
      reg.addEventListener('updatefound', () => {
        const nouveau = reg.installing
        if (!nouveau) return
        nouveau.addEventListener('statechange', () => {
          if (nouveau.state === 'installed' && navigator.serviceWorker.controller) {
            // Une nouvelle version a pris le relais → on recharge la page
            window.location.reload()
          }
        })
      })
    }).catch(console.error)

    // Si le service worker change de contrôleur, on recharge une seule fois
    let dejaRecharge = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (dejaRecharge) return
      dejaRecharge = true
      window.location.reload()
    })
  }, [])

  return null
}
