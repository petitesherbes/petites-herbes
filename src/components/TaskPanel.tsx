'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithCache, queueMutation } from '@/lib/offline'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Tache = {
  id: string; titre: string; description: string | null
  type: string; frequence: string | null; date_echeance: string | null
  priorite: string; actif: boolean
  completions?: { date_completion: string }[]
}

const PRIORITE_COLOR: Record<string, string> = {
  haute:  'bg-red-100 text-red-700',
  moyenne:'bg-amber-100 text-amber-700',
  basse:  'bg-gray-100 text-gray-500',
}

export default function TaskPanel() {
  const pathname = usePathname()
  const [ouvert, setOuvert]     = useState(false)
  const [taches, setTaches]     = useState<Tache[]>([])
  const [chargé, setChargé]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [nbRestantes, setNbRestantes] = useState(0)

  // Masquer sur la boutique client
  if (pathname?.startsWith('/commander')) return null

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const jourFr   = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'][new Date().getDay()]

  const tachesDuJour = taches.filter(t => {
    if (t.type === 'ponctuelle') return t.date_echeance === todayStr
    if (!t.frequence) return false
    const freq = t.frequence.toLowerCase()
    if (freq === 'quotidien') return true
    return freq.split(',').map((s: string) => s.trim()).includes(jourFr)
  })

  const estFaite = (t: Tache) => t.completions?.some(c => c.date_completion === todayStr) ?? false
  const restantes = tachesDuJour.filter(t => !estFaite(t))

  useEffect(() => {
    const nb = restantes.length
    setNbRestantes(nb)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taches])

  const charger = useCallback(async () => {
    if (chargé) return
    setChargé(true)
    const { data } = await fetchWithCache('taches', async () => {
      const { data } = await supabase
        .from('taches')
        .select('id, titre, description, type, frequence, date_echeance, priorite, actif, completions:taches_completions(date_completion)')
        .eq('actif', true)
      return data
    })
    if (data) setTaches(data as unknown as Tache[])
  }, [chargé])

  async function cocher(t: Tache) {
    if (estFaite(t)) return
    const payload = { tache_id: t.id, date_completion: todayStr }
    setTaches(prev => prev.map(x => x.id === t.id
      ? { ...x, completions: [...(x.completions || []), { date_completion: todayStr }] }
      : x
    ))
    if (!navigator.onLine) {
      await queueMutation({ table: 'taches_completions', method: 'insert', payload })
    } else {
      await supabase.from('taches_completions').insert(payload)
    }
  }

  // ─── Form ajout rapide ────────────────────────────────────────────────────────
  const [formOuvert, setFormOuvert] = useState(false)
  const [titre, setTitre]           = useState('')
  const [priorite, setPriorite]     = useState('moyenne')

  async function ajouterTache() {
    if (!titre.trim()) return
    setSaving(true)
    const payload = {
      titre: titre.trim(), priorite,
      type: 'ponctuelle', date_echeance: todayStr,
      actif: true,
    }
    if (!navigator.onLine) {
      await queueMutation({ table: 'taches', method: 'insert', payload })
      setTaches(prev => [...prev, { ...payload, id: `tmp-${Date.now()}`, description: null, frequence: null, completions: [] }])
    } else {
      const { data } = await supabase.from('taches').insert(payload).select().single()
      if (data) setTaches(prev => [...prev, data as Tache])
    }
    setTitre(''); setFormOuvert(false); setSaving(false)
  }

  return (
    <>
      {/* FAB — bouton flottant */}
      <button
        onClick={() => { setOuvert(true); charger() }}
        className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-green-700 shadow-lg flex items-center justify-center active:scale-90 transition-transform"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <span className="text-white text-xl leading-none">✅</span>
        {nbRestantes > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
            {nbRestantes > 9 ? '9+' : nbRestantes}
          </span>
        )}
      </button>

      {/* Drawer */}
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setOuvert(false)}>
          <div
            className="bg-white w-full max-w-2xl mx-auto rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900 text-base">
                  ✅ Tâches du jour
                </h2>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">
                  {format(new Date(), 'EEEE d MMMM', { locale: fr })}
                  {restantes.length > 0
                    ? ` · ${restantes.length} restante${restantes.length > 1 ? 's' : ''}`
                    : ' · Tout est fait 🎉'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFormOuvert(f => !f)}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-green-100 text-green-700 text-xl font-bold">
                  +
                </button>
                <button onClick={() => setOuvert(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xl font-bold">
                  ✕
                </button>
              </div>
            </div>

            {/* Form ajout rapide */}
            {formOuvert && (
              <div className="px-4 py-3 border-b border-gray-100 bg-green-50 space-y-2">
                <input
                  value={titre} onChange={e => setTitre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && ajouterTache()}
                  autoFocus placeholder="Nom de la tâche..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 bg-white" />
                <div className="flex gap-2">
                  {(['haute','moyenne','basse'] as const).map(p => (
                    <button key={p} onClick={() => setPriorite(p)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
                        ${priorite === p ? PRIORITE_COLOR[p] + ' border-current' : 'bg-white text-gray-400 border-gray-200'}`}>
                      {p === 'haute' ? '🔴 Haute' : p === 'moyenne' ? '🟡 Moyenne' : '⚪ Basse'}
                    </button>
                  ))}
                  <button onClick={ajouterTache} disabled={saving || !titre.trim()}
                    className="ml-auto px-4 py-1.5 bg-green-700 text-white rounded-full text-xs font-bold disabled:opacity-40">
                    {saving ? '…' : 'Ajouter'}
                  </button>
                </div>
              </div>
            )}

            {/* Liste tâches */}
            <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
              {tachesDuJour.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <div className="text-4xl mb-2">🌿</div>
                  <p className="text-sm">Aucune tâche prévue aujourd&apos;hui</p>
                </div>
              )}
              {/* Non-faites en premier */}
              {[...restantes, ...tachesDuJour.filter(t => estFaite(t))].map(t => {
                const fait = estFaite(t)
                return (
                  <button key={t.id} onClick={() => !fait && cocher(t)}
                    className={`w-full text-left px-4 py-3.5 flex items-start gap-3 active:bg-gray-50 transition-colors ${fait ? 'opacity-50' : ''}`}>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors
                      ${fait ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                      {fait && <span className="text-white text-[10px] font-bold">✓</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${fait ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {t.titre}
                      </div>
                      {t.description && !fait && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</div>
                      )}
                    </div>
                    {!fait && (
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORITE_COLOR[t.priorite] || PRIORITE_COLOR.moyenne}`}>
                        {t.priorite}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100">
              <Link href="/terrain"
                onClick={() => { setOuvert(false); if (typeof window !== 'undefined') localStorage.setItem('terrain_init_tab', 'agenda') }}
                className="block w-full text-center text-sm font-semibold text-green-700 py-2 rounded-xl bg-green-50 active:bg-green-100">
                Voir tout l&apos;agenda →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
