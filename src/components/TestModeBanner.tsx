'use client'
import { useEffect, useState } from 'react'
import { loadTestMode, saveTestMode } from '@/lib/testMode'

export default function TestModeBanner() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    setActive(loadTestMode())
    const handler = () => setActive(loadTestMode())
    window.addEventListener('test-mode-changed', handler)
    return () => window.removeEventListener('test-mode-changed', handler)
  }, [])

  if (!active) return null

  return (
    <div className="sticky top-0 z-50 bg-orange-500 text-white text-xs font-semibold flex items-center justify-between px-4 py-2">
      <span>🧪 MODE TEST ACTIF — aucune donnée réelle modifiée</span>
      <button
        onClick={() => saveTestMode(false)}
        className="underline opacity-80 hover:opacity-100">
        Désactiver
      </button>
    </div>
  )
}
