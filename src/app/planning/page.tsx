'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithCache, queueMutation, loadCache } from '@/lib/offline'
import { format, startOfWeek, addDays, isToday, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'

type Tache = {
  id: string; titre: string; type: string
  frequence: string | null; date_echeance: string | null
  priorite: string; actif: boolean
  zone: { nom: string } | null
  completions: { date_completion: string }[]
}
type BL = {
  id: string; numero: string; date_livraison: string; statut: string
  client: { nom: string; telephone: string | null } | null
}

const JOURS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']

const STATUT_LABEL: Record<string, string> = {
  brouillon: 'Brouillon', envoye: 'Envoyé', livre: 'Livré', facture: 'Facturé',
}
const STATUT_COLOR: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-500',
  envoye:    'bg-blue-100 text-blue-700',
  livre:     'bg-green-100 text-green-700',
  facture:   'bg-purple-100 text-purple-700',
}

function tachePourJour(t: Tache, dateStr: string): boolean {
  if (t.type === 'ponctuelle') return t.date_echeance === dateStr
  if (!t.frequence) return false
  const freq = t.frequence.toLowerCase()
  if (freq === 'quotidien') return true
  const d = new Date(dateStr + 'T12:00:00')
  return freq.split(',').map(s => s.trim()).includes(JOURS_FR[d.getDay()])
}

function tacheCompletePourJour(t: Tache, dateStr: string): boolean {
  return t.completions.some(c => c.date_completion === dateStr)
}

function prioriteDot(p: string) {
  if (p === 'haute') return 'bg-red-400'
  if (p === 'basse') return 'bg-gray-300'
  return 'bg-amber-400'
}

export default function PlanningPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [onglet, setOnglet] = useState<'taches' | 'livraisons'>('taches')
  const [taches, setTaches] = useState<Tache[]>([])
  const [bls, setBls] = useState<BL[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const lundi = addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7)
  const jours = Array.from({ length: 7 }, (_, i) => addDays(lundi, i))
  const debutSem = format(lundi, 'yyyy-MM-dd')
  const finSem   = format(addDays(lundi, 6), 'yyyy-MM-dd')

  useEffect(() => { charger() }, [weekOffset])

  async function charger() {
    setLoading(true)
    const [tResult, blsCaches] = await Promise.all([
      fetchWithCache('taches', async () => {
        const { data } = await supabase.from('taches')
          .select('*, completions:taches_completions(date_completion), zone:zones(nom)')
          .eq('actif', true)
        return data
      }),
      loadCache<BL[]>('commandes'),
    ])
    if (tResult.data.length) setTaches(tResult.data as unknown as Tache[])

    // BLs : en ligne on filtre côté serveur, hors ligne on filtre le cache
    if (navigator.onLine) {
      const { data: b } = await supabase.from('bons_livraison')
        .select('id, numero, date_livraison, statut, client:clients(nom, telephone)')
        .gte('date_livraison', debutSem)
        .lte('date_livraison', finSem)
        .order('date_livraison')
      if (b) setBls(b as unknown as BL[])
    } else if (blsCaches) {
      const filtres = blsCaches.filter(
        b => b.date_livraison >= debutSem && b.date_livraison <= finSem
      )
      setBls(filtres as unknown as BL[])
    }
    setLoading(false)
  }

  async function cocherTache(tacheId: string, dateStr: string, estFaite: boolean) {
    if (estFaite) {
      if (!navigator.onLine) {
        await queueMutation({ table: 'taches_completions', method: 'delete', payload: {}, matchCol: 'tache_id', matchVal: tacheId })
      } else {
        await supabase.from('taches_completions').delete()
          .eq('tache_id', tacheId).eq('date_completion', dateStr)
      }
    } else {
      const payload = { tache_id: tacheId, date_completion: dateStr }
      if (!navigator.onLine) {
        await queueMutation({ table: 'taches_completions', method: 'upsert', payload, onConflict: 'tache_id,date_completion' })
      } else {
        await supabase.from('taches_completions').upsert(payload, { onConflict: 'tache_id,date_completion' })
      }
    }
    charger()
  }

  const totalTachesAuj = (() => {
    const todayStr = format(today, 'yyyy-MM-dd')
    const t = taches.filter(t => tachePourJour(t, todayStr))
    const restantes = t.filter(t => !tacheCompletePourJour(t, todayStr))
    return { total: t.length, restantes: restantes.length }
  })()

  const blsTotal = bls.length
  const blsARealiser = bls.filter(b => b.statut === 'brouillon' || b.statut === 'envoye').length

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-green-900 px-4 pt-6 pb-4">
        <div className="text-green-400 text-xs font-semibold uppercase tracking-widest">Planning semaine</div>
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-white text-xl font-bold">
            Sem. du {format(lundi, 'd MMM', { locale: fr })}
          </h1>
          <div className="flex gap-1.5">
            <button onClick={() => setWeekOffset(o => o - 1)}
              className="w-8 h-8 flex items-center justify-center bg-green-800 text-white rounded-lg text-sm">←</button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)}
                className="px-2 h-8 bg-green-700 text-white rounded-lg text-xs font-semibold">Auj.</button>
            )}
            <button onClick={() => setWeekOffset(o => o + 1)}
              className="w-8 h-8 flex items-center justify-center bg-green-800 text-white rounded-lg text-sm">→</button>
          </div>
        </div>
        <div className="flex gap-3 mt-2 text-xs text-green-300">
          <span>✅ {totalTachesAuj.restantes} tâche{totalTachesAuj.restantes > 1 ? 's' : ''} restante{totalTachesAuj.restantes > 1 ? 's' : ''} auj.</span>
          <span>🚚 {blsARealiser}/{blsTotal} BL à traiter cette sem.</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        <button onClick={() => setOnglet('taches')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5
            ${onglet === 'taches' ? 'text-green-800 border-b-2 border-green-700' : 'text-gray-400'}`}>
          ✅ Tâches
        </button>
        <button onClick={() => setOnglet('livraisons')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5
            ${onglet === 'livraisons' ? 'text-green-800 border-b-2 border-green-700' : 'text-gray-400'}`}>
          🚚 Livraisons
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Chargement...</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {jours.map(jour => {
            const dateStr = format(jour, 'yyyy-MM-dd')
            const auj = isToday(jour)
            const labelJour = format(jour, 'EEEE d MMM', { locale: fr })

            let contenu: React.ReactNode

            if (onglet === 'taches') {
              const tachesJour = taches.filter(t => tachePourJour(t, dateStr))
              contenu = tachesJour.length === 0 ? (
                <p className="text-xs text-gray-300 italic">Aucune tâche</p>
              ) : (
                <div className="space-y-2">
                  {tachesJour.map(t => {
                    const fait = tacheCompletePourJour(t, dateStr)
                    return (
                      <div key={t.id} className={`flex items-start gap-2.5 ${fait ? 'opacity-40' : ''}`}>
                        <button
                          onClick={() => cocherTache(t.id, dateStr, fait)}
                          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-[9px] font-bold
                            ${fait ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 bg-white'}`}>
                          {fait && '✓'}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${fait ? 'line-through text-gray-400' : 'text-gray-800'} flex items-center gap-1.5`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${prioriteDot(t.priorite)}`} />
                            {t.titre}
                            {t.type === 'recurrente' && <span className="text-[9px] text-green-600 bg-green-50 px-1 py-0.5 rounded">🔁</span>}
                          </div>
                          {t.zone && (
                            <div className="text-xs text-gray-400 mt-0.5">📍 {(t.zone as {nom:string}).nom}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            } else {
              const blsJour = bls.filter(b => b.date_livraison === dateStr)
              contenu = (
                <div className="space-y-1.5">
                  {blsJour.length === 0 ? (
                    <p className="text-xs text-gray-300 italic">Aucune livraison prévue</p>
                  ) : blsJour.map(b => {
                    const clientData = b.client as { nom: string; telephone: string | null } | null
                    const phone = clientData?.telephone?.replace(/\D/g, '')
                    const waNum = phone?.startsWith('0') ? '33' + phone.slice(1) : phone
                    return (
                      <div key={b.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                        <Link href={`/commandes/${b.id}`}
                          className="flex items-center gap-3 px-3 py-2.5 active:bg-gray-50">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-800 truncate">
                              {clientData?.nom || 'Client inconnu'}
                            </div>
                            <div className="text-xs text-gray-400">BL {b.numero}</div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLOR[b.statut] || 'bg-gray-100 text-gray-500'}`}>
                            {STATUT_LABEL[b.statut] || b.statut}
                          </span>
                          <span className="text-gray-300 text-sm">›</span>
                        </Link>
                        {waNum && (
                          <a
                            href={`https://wa.me/${waNum}?text=${encodeURIComponent(`Bonjour ! Votre livraison Les Petites Herbes est prête — BL n°${b.numero}. 🌿`)}`}
                            target="_blank" rel="noopener noreferrer"
                            className="block text-center bg-[#25D366] text-white text-xs font-semibold py-1.5">
                            💬 WhatsApp
                          </a>
                        )}
                      </div>
                    )
                  })}
                  {auj && (
                    <Link href="/commandes/nouveau"
                      className="block text-center text-xs text-green-700 border border-dashed border-green-300 rounded-lg py-2 font-semibold">
                      + Nouveau BL aujourd'hui
                    </Link>
                  )}
                </div>
              )
            }

            return (
              <div key={dateStr} className={`px-4 py-3 ${auj ? 'bg-green-50 border-l-4 border-green-600' : ''}`}>
                <div className={`text-xs font-bold uppercase tracking-wide mb-2 capitalize flex items-center gap-1.5
                  ${auj ? 'text-green-700' : 'text-gray-400'}`}>
                  {auj && <span className="w-1.5 h-1.5 rounded-full bg-green-600 inline-block" />}
                  {labelJour}
                </div>
                {contenu}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
