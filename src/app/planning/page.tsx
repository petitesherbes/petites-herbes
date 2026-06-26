'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithCache, queueMutation } from '@/lib/offline'
import { format, addDays, startOfWeek, isToday, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

type Tache = {
  id: string; titre: string; type: string
  frequence: string | null; date_echeance: string | null
  priorite: string; actif: boolean; duree_minutes: number | null
  completions: { date_completion: string }[]
  temps: { id: string; minutes: number; date: string; auteur: string }[]
}

type VueTaches = 'aujourdhui' | 'semaine' | 'toutes' | 'bilan'

const JOURS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']

const PRIO_STYLE: Record<string, string> = {
  haute:   'bg-red-100 text-red-700',
  moyenne: 'bg-amber-100 text-amber-700',
  basse:   'bg-gray-100 text-gray-500',
}

function tacheEstCeJour(t: Tache, dateStr: string, todayStr: string): boolean {
  if (t.type === 'ponctuelle') {
    if (!t.date_echeance || t.date_echeance > todayStr) return false
    if (dateStr !== todayStr) return t.date_echeance === dateStr
    return !t.completions.some(c => c.date_completion < todayStr)
  }
  if (!t.frequence) return false
  const freq = t.frequence.toLowerCase()
  if (freq === 'quotidien') return true
  const d = new Date(dateStr + 'T12:00:00')
  return freq.split(',').map(s => s.trim()).includes(JOURS_FR[d.getDay()])
}

function tacheSemaineJour(t: Tache, dateStr: string): boolean {
  if (t.type === 'ponctuelle') return t.date_echeance === dateStr
  if (!t.frequence) return false
  const freq = t.frequence.toLowerCase()
  if (freq === 'quotidien') return true
  const d = new Date(dateStr + 'T12:00:00')
  return freq.split(',').map(s => s.trim()).includes(JOURS_FR[d.getDay()])
}

function reportee(t: Tache, todayStr: string): boolean {
  return t.type === 'ponctuelle' && !!t.date_echeance && t.date_echeance < todayStr
}

function minsJour(t: Tache, dateStr: string): number {
  return (t.temps ?? []).filter(x => x.date === dateStr).reduce((s, x) => s + x.minutes, 0)
}

function fmtMins(mins: number): string {
  if (mins <= 0) return ''
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2,'0')}`
}

export default function TachesPage() {
  const [vue, setVue]           = useState<VueTaches>('aujourdhui')
  const [taches, setTaches]     = useState<Tache[]>([])
  const [loading, setLoading]   = useState(true)

  // Aujourd'hui
  const [sheetId, setSheetId]           = useState<string | null>(null)
  const [savingTemps, setSavingTemps]   = useState(false)
  const [bilanOuvert, setBilanOuvert]   = useState(false)
  const [notesJour, setNotesJour]       = useState('')
  const [copie, setCopie]               = useState(false)
  const [ajoutOuvert, setAjoutOuvert]   = useState(false)
  const [nouvTitre, setNouvTitre]       = useState('')
  const [nouvPriorite, setNouvPriorite] = useState('moyenne')
  const [savingAjout, setSavingAjout]   = useState(false)

  // Semaine
  const [weekOffset, setWeekOffset] = useState(0)

  // Toutes
  const [filtreType, setFiltreType]   = useState<'toutes' | 'recurrente' | 'ponctuelle'>('toutes')
  const [editSheetId, setEditSheetId] = useState<string | null>(null)
  const [editTitre, setEditTitre]     = useState('')
  const [editPriorite, setEditPriorite] = useState('moyenne')
  const [editFrequence, setEditFrequence] = useState('')
  const [editDuree, setEditDuree]     = useState('')
  const [savingEdit, setSavingEdit]   = useState(false)

  // Bilan
  const [bilanWeekOffset, setBilanWeekOffset] = useState(0)

  // Auteur log temps
  const [auteurTemps, setAuteurTemps] = useState<string>(
    typeof window !== 'undefined' ? localStorage.getItem('taches_auteur') || 'Antoine' : 'Antoine'
  )

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => { charger() }, [])

  async function charger() {
    const { data } = await fetchWithCache('taches', async () => {
      const { data } = await supabase.from('taches')
        .select('id,titre,type,frequence,date_echeance,priorite,actif,duree_minutes,completions:taches_completions(date_completion),temps:taches_temps(id,minutes,date,auteur)')
        .eq('actif', true)
      return data
    })
    if (data.length) setTaches(data as unknown as Tache[])
    setLoading(false)
  }

  async function cocherTache(tache: Tache, dateStr = todayStr) {
    const faite = tache.completions.some(c => c.date_completion === dateStr)
    if (faite) {
      if (!navigator.onLine) {
        await queueMutation({ table: 'taches_completions', method: 'delete', payload: {}, matchCol: 'tache_id', matchVal: tache.id })
      } else {
        await supabase.from('taches_completions').delete().eq('tache_id', tache.id).eq('date_completion', dateStr)
      }
      setTaches(prev => prev.map(t => t.id === tache.id
        ? { ...t, completions: t.completions.filter(c => c.date_completion !== dateStr) } : t))
    } else {
      const payload = { tache_id: tache.id, date_completion: dateStr }
      if (!navigator.onLine) {
        await queueMutation({ table: 'taches_completions', method: 'upsert', payload, onConflict: 'tache_id,date_completion' })
      } else {
        await supabase.from('taches_completions').upsert(payload, { onConflict: 'tache_id,date_completion' })
      }
      setTaches(prev => prev.map(t => t.id === tache.id
        ? { ...t, completions: [...t.completions, { date_completion: dateStr }] } : t))
    }
  }

  async function logguerTemps(tacheId: string, minutes: number) {
    setSavingTemps(true)
    const payload = { tache_id: tacheId, date: todayStr, auteur: auteurTemps, minutes }
    if (!navigator.onLine) {
      await queueMutation({ table: 'taches_temps', method: 'insert', payload })
    } else {
      await supabase.from('taches_temps').insert(payload)
    }
    setTaches(prev => prev.map(t => t.id === tacheId
      ? { ...t, temps: [...(t.temps ?? []), { id: `tmp-${Date.now()}`, minutes, date: todayStr, auteur: auteurTemps }] }
      : t))
    setSavingTemps(false)
  }

  async function supprimerTemps(entryId: string, tacheId: string) {
    if (entryId.startsWith('tmp-')) return
    await supabase.from('taches_temps').delete().eq('id', entryId)
    setTaches(prev => prev.map(t => t.id === tacheId
      ? { ...t, temps: (t.temps ?? []).filter(x => x.id !== entryId) }
      : t))
  }

  async function ajouterTache() {
    if (!nouvTitre.trim()) return
    setSavingAjout(true)
    const payload = { titre: nouvTitre.trim(), priorite: nouvPriorite, type: 'ponctuelle', date_echeance: todayStr, actif: true }
    if (!navigator.onLine) {
      await queueMutation({ table: 'taches', method: 'insert', payload })
      setTaches(prev => [...prev, { ...payload, id: `tmp-${Date.now()}`, frequence: null, duree_minutes: null, completions: [], temps: [] }])
    } else {
      const { data } = await supabase.from('taches').insert(payload).select('id,titre,type,frequence,date_echeance,priorite,actif,duree_minutes').single()
      if (data) setTaches(prev => [...prev, { ...(data as unknown as Tache), completions: [], temps: [] }])
    }
    setNouvTitre(''); setAjoutOuvert(false); setSavingAjout(false)
  }

  function ouvrirEdit(t: Tache) {
    setEditSheetId(t.id)
    setEditTitre(t.titre)
    setEditPriorite(t.priorite)
    setEditFrequence(t.frequence ?? '')
    setEditDuree(t.duree_minutes ? String(t.duree_minutes) : '')
  }

  async function sauvegarderEdit() {
    if (!editSheetId || !editTitre.trim()) return
    setSavingEdit(true)
    const payload: Record<string, unknown> = {
      titre: editTitre.trim(),
      priorite: editPriorite,
      duree_minutes: editDuree ? Number(editDuree) : null,
    }
    const t = taches.find(x => x.id === editSheetId)
    if (t?.type === 'recurrente') payload.frequence = editFrequence || null
    await supabase.from('taches').update(payload).eq('id', editSheetId)
    setTaches(prev => prev.map(x => x.id === editSheetId ? { ...x, ...payload } as Tache : x))
    setSavingEdit(false); setEditSheetId(null)
  }

  async function archiverTache(id: string) {
    await supabase.from('taches').update({ actif: false }).eq('id', id)
    setTaches(prev => prev.filter(t => t.id !== id))
    setEditSheetId(null)
  }

  // ── Dérivés ──────────────────────────────────────────────────────────────────

  const tachesAuj = taches
    .filter(t => tacheEstCeJour(t, todayStr, todayStr))
    .sort((a, b) => {
      const dA = a.completions.some(c => c.date_completion === todayStr) ? 100 : 0
      const dB = b.completions.some(c => c.date_completion === todayStr) ? 100 : 0
      const rA = reportee(a, todayStr) ? 0 : 10
      const rB = reportee(b, todayStr) ? 0 : 10
      const pA = a.priorite === 'haute' ? 0 : a.priorite === 'normale' ? 1 : 2
      const pB = b.priorite === 'haute' ? 0 : b.priorite === 'normale' ? 1 : 2
      return (dA + rA + pA) - (dB + rB + pB)
    })

  const nbFaites    = tachesAuj.filter(t => t.completions.some(c => c.date_completion === todayStr)).length
  const nbRestantes = tachesAuj.length - nbFaites
  const totalMinsAuj = taches.flatMap(t => t.temps ?? []).filter(x => x.date === todayStr).reduce((s, x) => s + x.minutes, 0)

  const sheetTache  = sheetId ? taches.find(t => t.id === sheetId) ?? null : null
  const editTache   = editSheetId ? taches.find(t => t.id === editSheetId) ?? null : null

  function genererBilan(): string {
    const faites    = tachesAuj.filter(t => t.completions.some(c => c.date_completion === todayStr))
    const nonFaites = tachesAuj.filter(t => !t.completions.some(c => c.date_completion === todayStr))
    const label = format(new Date(), "d MMMM yyyy", { locale: fr })
    let txt = `📋 Bilan du ${label}\n\n`
    if (faites.length > 0) {
      txt += `✅ Réalisées (${faites.length}) :\n`
      faites.forEach(t => {
        const m = minsJour(t, todayStr)
        txt += `• ${t.titre}${m > 0 ? ` — ${fmtMins(m)}` : ''}\n`
      })
    }
    if (nonFaites.length > 0) {
      txt += `\n⚠ Reportées (${nonFaites.length}) :\n`
      nonFaites.forEach(t => { txt += `• ${t.titre}\n` })
    }
    if (totalMinsAuj > 0) txt += `\n⏱ Total : ${fmtMins(totalMinsAuj)}`
    return txt
  }

  async function copierBilan() {
    const texte = genererBilan() + (notesJour ? `\n\nNotes : ${notesJour}` : '')
    await navigator.clipboard.writeText(texte)
    setCopie(true); setTimeout(() => setCopie(false), 2000)
  }

  // ── Render Aujourd'hui ────────────────────────────────────────────────────────

  function renderAujoundhui() {
    return (
      <div className="pb-36">
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
          <div className="text-sm text-amber-800">
            <span className="font-bold">{nbRestantes}</span> restante{nbRestantes > 1 ? 's' : ''}
            {totalMinsAuj > 0 && <span className="ml-3 text-amber-600">⏱ {fmtMins(totalMinsAuj)} loggées</span>}
          </div>
          <button onClick={() => setAjoutOuvert(true)}
            className="text-xs bg-amber-600 text-white font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform">
            + Tâche
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {tachesAuj.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🌿</div>
              <p className="text-sm font-medium">Aucune tâche pour aujourd&apos;hui</p>
              <button onClick={() => setAjoutOuvert(true)} className="mt-4 text-green-700 text-sm font-semibold underline">
                + Ajouter une tâche
              </button>
            </div>
          )}
          {tachesAuj.map(t => {
            const faite = t.completions.some(c => c.date_completion === todayStr)
            const rep   = reportee(t, todayStr)
            const mins  = minsJour(t, todayStr)
            return (
              <div key={t.id} className={`flex items-center gap-3 px-4 py-3.5 ${faite ? 'bg-gray-50/70' : ''}`}>
                <button onClick={() => cocherTache(t)} className="shrink-0">
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-colors
                    ${faite ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 bg-white'}`}>
                    {faite ? '✓' : ''}
                  </span>
                </button>
                <button onClick={() => setSheetId(t.id)} className="flex-1 flex items-center gap-2 text-left min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${faite ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {t.titre}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {rep && !faite && (
                        <span className="text-[10px] font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">⚠ reportée</span>
                      )}
                      {t.type === 'recurrente' && (
                        <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">🔁</span>
                      )}
                      {mins > 0 && (
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-semibold">⏱ {fmtMins(mins)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIO_STYLE[t.priorite] ?? PRIO_STYLE.moyenne}`}>
                      {t.priorite}
                    </span>
                    <span className="text-gray-300 text-sm">›</span>
                  </div>
                </button>
              </div>
            )
          })}
        </div>

        {tachesAuj.length > 0 && (
          <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 px-4 py-3 z-20 bg-gradient-to-t from-white via-white/90 to-transparent pt-6">
            <button onClick={() => setBilanOuvert(true)}
              className="w-full max-w-2xl mx-auto block bg-green-800 text-white font-bold py-4 rounded-2xl shadow-xl active:scale-95 transition-transform text-sm">
              📋 Clôturer la journée
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Render Semaine ────────────────────────────────────────────────────────────

  function renderSemaine() {
    const lundi = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7)
    const jours = Array.from({ length: 7 }, (_, i) => addDays(lundi, i))
    return (
      <div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-[49px] z-10">
          <button onClick={() => setWeekOffset(o => o - 1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 text-lg">←</button>
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-700">Sem. du {format(lundi, 'd MMM', { locale: fr })}</div>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-[10px] text-green-700 underline">Aujourd&apos;hui</button>
            )}
          </div>
          <button onClick={() => setWeekOffset(o => o + 1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 text-lg">→</button>
        </div>

        <div className="divide-y divide-gray-100">
          {jours.map(jour => {
            const dateStr  = format(jour, 'yyyy-MM-dd')
            const auj      = isToday(jour)
            const tachesJ  = taches.filter(t => tacheSemaineJour(t, dateStr))
            const faites   = tachesJ.filter(t => t.completions.some(c => c.date_completion === dateStr))
            const minsJ    = taches.flatMap(t => t.temps ?? []).filter(x => x.date === dateStr).reduce((s, x) => s + x.minutes, 0)
            return (
              <div key={dateStr} className={`px-4 py-3.5 ${auj ? 'bg-green-50 border-l-4 border-l-green-600' : ''}`}>
                <div className={`flex items-center justify-between mb-2`}>
                  <span className={`text-xs font-bold uppercase tracking-wide capitalize ${auj ? 'text-green-700' : 'text-gray-400'}`}>
                    {auj && <span className="w-1.5 h-1.5 rounded-full bg-green-600 inline-block mr-1.5 mb-0.5" />}
                    {format(jour, 'EEEE d MMM', { locale: fr })}
                  </span>
                  <div className="flex items-center gap-2">
                    {minsJ > 0 && <span className="text-[10px] text-blue-600 bg-blue-50 font-semibold px-1.5 py-0.5 rounded-full">⏱ {fmtMins(minsJ)}</span>}
                    {tachesJ.length > 0 && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${faites.length === tachesJ.length ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {faites.length}/{tachesJ.length}
                      </span>
                    )}
                  </div>
                </div>
                {tachesJ.length === 0 ? (
                  <p className="text-xs text-gray-300 italic">Aucune tâche</p>
                ) : (
                  <div className="space-y-1.5">
                    {tachesJ.map(t => {
                      const fait = t.completions.some(c => c.date_completion === dateStr)
                      return (
                        <div key={t.id} className={`flex items-center gap-2 ${fait ? 'opacity-40' : ''}`}>
                          <button onClick={() => cocherTache(t, dateStr)}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold shrink-0 transition-colors
                              ${fait ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 bg-white'}`}>
                            {fait && '✓'}
                          </button>
                          <span className={`text-sm flex-1 ${fait ? 'line-through text-gray-400' : 'text-gray-700'}`}>{t.titre}</span>
                          {t.type === 'recurrente' && <span className="text-[9px] text-green-600 bg-green-50 px-1 py-0.5 rounded">🔁</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Render Toutes ─────────────────────────────────────────────────────────────

  function renderToutes() {
    const filtrees = taches.filter(t => filtreType === 'toutes' || t.type === filtreType)
      .sort((a, b) => {
        const pA = a.priorite === 'haute' ? 0 : a.priorite === 'normale' ? 1 : 2
        const pB = b.priorite === 'haute' ? 0 : b.priorite === 'normale' ? 1 : 2
        return pA - pB || a.titre.localeCompare(b.titre, 'fr')
      })
    return (
      <div>
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex gap-2 sticky top-[49px] z-10">
          {(['toutes', 'recurrente', 'ponctuelle'] as const).map(f => (
            <button key={f} onClick={() => setFiltreType(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filtreType === f ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
              {f === 'toutes' ? `Toutes (${taches.length})` : f === 'recurrente' ? `🔁 Récurrentes (${taches.filter(t => t.type==='recurrente').length})` : `📌 Ponctuelles (${taches.filter(t => t.type==='ponctuelle').length})`}
            </button>
          ))}
        </div>
        <div className="divide-y divide-gray-100">
          {filtrees.length === 0 && <div className="py-12 text-center text-gray-400 text-sm">Aucune tâche</div>}
          {filtrees.map(t => (
            <button key={t.id} onClick={() => ouvrirEdit(t)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">{t.titre}</div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PRIO_STYLE[t.priorite] ?? PRIO_STYLE.moyenne}`}>{t.priorite}</span>
                  {t.type === 'recurrente' && t.frequence && (
                    <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">🔁 {t.frequence}</span>
                  )}
                  {t.type === 'ponctuelle' && t.date_echeance && (
                    <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
                      📌 {format(parseISO(t.date_echeance), 'd MMM', { locale: fr })}
                    </span>
                  )}
                  {t.duree_minutes && (
                    <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">~{fmtMins(t.duree_minutes)}</span>
                  )}
                </div>
              </div>
              <span className="text-gray-300 text-sm shrink-0">›</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Render Bilan ──────────────────────────────────────────────────────────────

  function renderBilan() {
    const lundi = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), bilanWeekOffset * 7)
    const jours = Array.from({ length: 7 }, (_, i) => format(addDays(lundi, i), 'yyyy-MM-dd'))

    const tachesAvecTemps = taches
      .map(t => {
        const tempsS = (t.temps ?? []).filter(x => jours.includes(x.date))
        return { t, total: tempsS.reduce((s, x) => s + x.minutes, 0) }
      })
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total)

    const totalSem = tachesAvecTemps.reduce((s, x) => s + x.total, 0)

    return (
      <div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-[49px] z-10">
          <button onClick={() => setBilanWeekOffset(o => o - 1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 text-lg">←</button>
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-700">Sem. du {format(lundi, 'd MMM', { locale: fr })}</div>
            {totalSem > 0 && <div className="text-xs text-green-700 font-bold">{fmtMins(totalSem)} loggées</div>}
            {bilanWeekOffset !== 0 && (
              <button onClick={() => setBilanWeekOffset(0)} className="text-[10px] text-green-700 underline">Cette semaine</button>
            )}
          </div>
          <button onClick={() => setBilanWeekOffset(o => o + 1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 text-lg">→</button>
        </div>

        {/* Barres par jour */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Par jour</div>
          <div className="flex gap-1.5">
            {jours.map(dateStr => {
              const mJ = taches.flatMap(t => t.temps ?? []).filter(x => x.date === dateStr).reduce((s, x) => s + x.minutes, 0)
              const auj = dateStr === todayStr
              const maxMins = Math.max(...jours.map(d => taches.flatMap(t => t.temps ?? []).filter(x => x.date === d).reduce((s, x) => s + x.minutes, 0)), 1)
              const pct = Math.round((mJ / maxMins) * 100)
              return (
                <div key={dateStr} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-16 bg-gray-100 rounded-lg overflow-hidden flex items-end">
                    <div className={`w-full rounded-lg transition-all ${auj ? 'bg-green-500' : 'bg-green-200'}`}
                      style={{ height: `${Math.max(pct, mJ > 0 ? 8 : 0)}%` }} />
                  </div>
                  <span className={`text-[9px] font-bold uppercase ${auj ? 'text-green-700' : 'text-gray-400'}`}>
                    {format(parseISO(dateStr), 'EEE', { locale: fr })}
                  </span>
                  {mJ > 0 && <span className="text-[9px] text-gray-500 font-semibold">{fmtMins(mJ)}</span>}
                </div>
              )
            })}
          </div>
        </div>

        {tachesAvecTemps.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Aucun temps logué cette semaine</div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="px-4 py-2 bg-gray-50">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Par tâche</div>
            </div>
            {tachesAvecTemps.map(({ t, total }) => {
              const pct = Math.round((total / totalSem) * 100)
              return (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-gray-800 truncate flex-1 mr-2">{t.titre}</span>
                    <span className="text-sm font-bold text-green-700 shrink-0">{fmtMins(total)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── JSX principal ──────────────────────────────────────────────────────────────

  return (
    <div className="pb-6">

      {/* Header */}
      <div className="bg-green-900 px-4 pt-6 pb-4">
        <div className="text-green-400 text-xs font-semibold uppercase tracking-widest">Les Petites Herbes</div>
        <div className="flex items-center justify-between mt-1">
          <div>
            <h1 className="text-white text-xl font-bold">✅ Tâches</h1>
            <p className="text-green-300 text-sm capitalize mt-0.5">{format(new Date(), 'EEEE d MMMM', { locale: fr })}</p>
          </div>
          {vue === 'aujourdhui' && tachesAuj.length > 0 && (
            <div className="text-right">
              <div className="text-white text-2xl font-bold leading-none">{nbFaites}<span className="text-green-400 text-base">/{tachesAuj.length}</span></div>
              <div className="text-green-400 text-xs mt-0.5">faites</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        {([
          { id: 'aujourdhui', label: "Aujourd'hui" },
          { id: 'semaine',    label: 'Semaine' },
          { id: 'toutes',     label: 'Toutes' },
          { id: 'bilan',      label: 'Bilan' },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setVue(tab.id)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2
              ${vue === tab.id ? 'text-green-800 border-green-700' : 'text-gray-400 border-transparent'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Chargement…</div>
      ) : (
        <>
          {vue === 'aujourdhui' && renderAujoundhui()}
          {vue === 'semaine'    && renderSemaine()}
          {vue === 'toutes'     && renderToutes()}
          {vue === 'bilan'      && renderBilan()}
        </>
      )}

      {/* ── Sheet log temps tâche ── */}
      {sheetTache && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setSheetId(null)}>
          <div className="bg-white w-full max-w-2xl mx-auto rounded-t-3xl shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex-1 min-w-0 pr-3">
                <h2 className="font-bold text-gray-900 text-base">{sheetTache.titre}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIO_STYLE[sheetTache.priorite] ?? PRIO_STYLE.moyenne}`}>{sheetTache.priorite}</span>
                  {sheetTache.type === 'recurrente' && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">🔁 {sheetTache.frequence}</span>}
                  {sheetTache.duree_minutes && <span className="text-[10px] text-blue-500">estimé ~{fmtMins(sheetTache.duree_minutes)}</span>}
                </div>
              </div>
              <button onClick={() => setSheetId(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-lg shrink-0">✕</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Sélecteur d'auteur */}
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Pour qui</div>
                <div className="flex gap-2">
                  {(['Antoine', 'Lucas'] as const).map(a => (
                    <button key={a}
                      onClick={() => { setAuteurTemps(a); localStorage.setItem('taches_auteur', a) }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors active:scale-95
                        ${auteurTemps === a ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
                      {a === 'Lucas' ? '🧑‍🌾' : '👨‍🌾'} {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Entrées du jour + boutons */}
              <div>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Temps aujourd&apos;hui</span>
                  {minsJour(sheetTache, todayStr) > 0 && (
                    <span className="text-xl font-bold text-green-700">{fmtMins(minsJour(sheetTache, todayStr))}</span>
                  )}
                  {minsJour(sheetTache, todayStr) === 0 && <span className="text-sm text-gray-300">Rien encore</span>}
                </div>
                {sheetTache.temps.filter(x => x.date === todayStr).length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {sheetTache.temps.filter(x => x.date === todayStr).map(x => (
                      <div key={x.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                        <span className="text-sm font-semibold text-gray-700">
                          {x.auteur === 'Lucas' ? '🧑‍🌾' : '👨‍🌾'} {x.auteur} — {fmtMins(x.minutes)}
                        </span>
                        <button onClick={() => supprimerTemps(x.id, sheetTache.id)}
                          className="text-gray-300 text-xl leading-none active:text-red-400 w-8 h-8 flex items-center justify-center rounded-lg">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {[5, 15, 30, 60].map(mins => (
                    <button key={mins} onClick={() => logguerTemps(sheetTache.id, mins)} disabled={savingTemps}
                      className="py-3 rounded-xl bg-green-50 border border-green-200 text-green-800 font-bold text-sm active:scale-95 transition-transform disabled:opacity-40">
                      +{mins >= 60 ? '1h' : `${mins}min`}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => cocherTache(sheetTache)}
                className={`w-full py-3.5 rounded-xl font-bold text-sm border-2 active:scale-95 transition-transform
                  ${sheetTache.completions.some(c => c.date_completion === todayStr)
                    ? 'bg-green-50 border-green-400 text-green-700'
                    : 'bg-white border-gray-200 text-gray-600'}`}>
                {sheetTache.completions.some(c => c.date_completion === todayStr) ? '✅ Terminée — annuler' : '⬜ Marquer comme terminée'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sheet édition tâche (Toutes) ── */}
      {editTache && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setEditSheetId(null)}>
          <div className="bg-white w-full max-w-2xl mx-auto rounded-t-3xl shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-base">Modifier la tâche</h2>
              <button onClick={() => setEditSheetId(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Titre</label>
                <input value={editTitre} onChange={e => setEditTitre(e.target.value)}
                  className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Priorité</label>
                <div className="flex gap-2 mt-1.5">
                  {(['haute','moyenne','basse'] as const).map(p => (
                    <button key={p} onClick={() => setEditPriorite(p)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${editPriorite === p ? PRIO_STYLE[p] + ' border-current' : 'bg-white text-gray-400 border-gray-200'}`}>
                      {p === 'haute' ? '🔴' : p === 'moyenne' ? '🟡' : '⚪'} {p}
                    </button>
                  ))}
                </div>
              </div>
              {editTache.type === 'recurrente' && (
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fréquence</label>
                  <input value={editFrequence} onChange={e => setEditFrequence(e.target.value)}
                    placeholder="quotidien ou lundi,mercredi,vendredi"
                    className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Durée estimée (min)</label>
                <input value={editDuree} onChange={e => setEditDuree(e.target.value)} type="number" min="0"
                  placeholder="ex: 30"
                  className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => archiverTache(editTache.id)}
                  className="px-4 py-3 rounded-xl bg-red-50 text-red-600 font-semibold text-sm border border-red-200 active:scale-95 transition-transform">
                  Archiver
                </button>
                <button onClick={sauvegarderEdit} disabled={savingEdit || !editTitre.trim()}
                  className="flex-1 py-3 rounded-xl bg-green-700 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform">
                  {savingEdit ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Ajout rapide ── */}
      {ajoutOuvert && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setAjoutOuvert(false)}>
          <div className="bg-white w-full max-w-2xl mx-auto rounded-t-3xl p-5 space-y-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">+ Nouvelle tâche pour aujourd&apos;hui</h3>
            <input value={nouvTitre} onChange={e => setNouvTitre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ajouterTache()}
              autoFocus placeholder="Nom de la tâche…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400" />
            <div className="flex gap-2">
              {(['haute','moyenne','basse'] as const).map(p => (
                <button key={p} onClick={() => setNouvPriorite(p)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${nouvPriorite === p ? PRIO_STYLE[p] + ' border-current' : 'bg-white text-gray-400 border-gray-200'}`}>
                  {p === 'haute' ? '🔴' : p === 'moyenne' ? '🟡' : '⚪'} {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAjoutOuvert(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm">Annuler</button>
              <button onClick={ajouterTache} disabled={savingAjout || !nouvTitre.trim()}
                className="flex-1 py-3 rounded-xl bg-green-700 text-white font-bold text-sm disabled:opacity-40">
                {savingAjout ? '…' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bilan / clôture journée ── */}
      {bilanOuvert && (() => {
        const bilan = genererBilan()
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setBilanOuvert(false)}>
            <div className="bg-white w-full max-w-2xl mx-auto rounded-t-3xl max-h-[88vh] flex flex-col"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                <div>
                  <h2 className="font-bold text-gray-900 text-base">📋 Clôture de la journée</h2>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">{format(new Date(), 'EEEE d MMMM', { locale: fr })}</p>
                </div>
                <button onClick={() => setBilanOuvert(false)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-50 rounded-2xl p-3 text-center">
                    <div className="text-2xl font-bold text-green-800">{nbFaites}</div>
                    <div className="text-[10px] text-green-600 font-semibold uppercase">faites</div>
                  </div>
                  <div className="bg-amber-50 rounded-2xl p-3 text-center">
                    <div className="text-2xl font-bold text-amber-800">{nbRestantes}</div>
                    <div className="text-[10px] text-amber-600 font-semibold uppercase">reportées</div>
                  </div>
                  <div className="bg-blue-50 rounded-2xl p-3 text-center">
                    <div className="text-2xl font-bold text-blue-800">{fmtMins(totalMinsAuj) || '—'}</div>
                    <div className="text-[10px] text-blue-600 font-semibold uppercase">loggées</div>
                  </div>
                </div>

                {/* Résumé auto */}
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Résumé auto-généré</div>
                  <div className="bg-gray-50 rounded-xl p-3.5 text-xs text-gray-700 font-mono whitespace-pre-wrap leading-relaxed border border-gray-100">
                    {bilan}
                  </div>
                </div>

                {/* Notes libres */}
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Notes du jour (optionnel)</div>
                  <textarea value={notesJour} onChange={e => setNotesJour(e.target.value)}
                    placeholder="Observations, météo, incidents, remarques…"
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 resize-none" />
                </div>
              </div>

              <div className="px-5 pt-3 pb-4 border-t border-gray-100 space-y-2 shrink-0">
                <button onClick={copierBilan}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${copie ? 'bg-green-600 text-white' : 'bg-green-50 border border-green-300 text-green-700'}`}>
                  {copie ? '✓ Copié dans le presse-papiers !' : '📋 Copier le bilan'}
                </button>
                <button onClick={() => setBilanOuvert(false)}
                  className="w-full py-3.5 rounded-xl font-bold text-sm bg-green-800 text-white active:scale-95 transition-transform">
                  Terminer la journée ✓
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
