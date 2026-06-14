'use client'
import { useEffect, useState, useCallback } from 'react'

async function checkRealConnectivity(): Promise<boolean> {
  try {
    await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(3000) })
    return true
  } catch {
    return false
  }
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)

  const verify = useCallback(async () => {
    // navigator.onLine est peu fiable (faux négatifs sur Opera GX, VPN, etc.)
    // On fait une vraie requête pour confirmer
    if (navigator.onLine) {
      setIsOnline(true)
    } else {
      const real = await checkRealConnectivity()
      setIsOnline(real)
    }
  }, [])

  useEffect(() => {
    verify()
    window.addEventListener('online', verify)
    window.addEventListener('offline', verify)
    return () => {
      window.removeEventListener('online', verify)
      window.removeEventListener('offline', verify)
    }
  }, [verify])

  return isOnline
}
