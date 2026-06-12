'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, parseISO, isToday, isTomorrow, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

type Zone = {
  id: string; nom: string; type: string
  superficie_m2: number | null; description: string | null; ordre: number; actif: boolean
}
type Planche = {
  id: string; zone_id: string; nom: string
  longueur_m: number | null; largeur_m: number | null; notes: string | null; ordre: number
}
type EntreeCahier = {
  id: string; zone_id: string | null; date_operation: string
  type_operation: string; espece_id: string | null; quantite: number | null
  unite: string | null; notes: string | null; auteur: string | null
  zone?: { nom: string } | null
  espece?: { nom: string } | null
}
type Tache = {
  id: string; titre: string; description: string | null; type: string
  frequence: string | null; date_echeance: string | null
  zone_id: string | null; priorite: string; actif: boolean
  completions?: { date_completion: string }[]
}
type Perte = {
  id: string; date_perte: string; designation: string
  quantite: number; unite: string; raison: string; notes: string | null
  espece?: { nom: string } | null
}
type Espece = { id: string; nom: string }

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPES_OP = [
  { val: 'semis',       label: 'Semer',      icon: '🌱', color: 'bg-green-100 border-green-400 text-green-800' },
  { val: 'recolte',     label: 'Récolter',   icon: '✂️',  color: 'bg-emerald-100 border-emerald-400 text-emerald-800' },
  { val: 'arrosage',    label: 'Arroser',    icon: '💧', color: 'bg-blue-100 border-blue-400 text-blue-800' },
  { val: 'traitement',  label: 'Traitement', icon: '🌿', color: 'bg-amber-100 border-amber-400 text-amber-800' },
  { val: 'observation', label: 'Observer',   icon: '👁', color: 'bg-purple-100 border-purple-400 text-purple-800' },
  { val: 'taille',      label: 'Tailler',    icon: '✂️',  color: 'bg-orange-100 border-orange-400 text-orange-800' },
  { val: 'autre',       label: 'Autre',      icon: '📝', color: 'bg-gray-100 border-gray-400 text-gray-700' },
]

const RAISONS_PERTE = [
  { val: 'germination_ratee', label: 'Germination ratée',  icon: '🫘' },
  { val: 'pourriture',        label: 'Pourriture',         icon: '🍂' },
  { val: 'surproduction',     label: 'Surproduction',      icon: '📦' },
  { val: 'invendu',           label: 'Invendu',            icon: '🏷️' },
  { val: 'meteo',             label: 'Météo (gel, vent…)', icon: '⛈️' },
  { val: 'autre',             label: 'Autre raison',       icon: '❓' },
]

const UNITES = ['barquettes', 'kg', 'plateaux', 'L', 'pièces']
const JOURS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tacheEstAujourdHui(t: Tache): boolean {
  const today = new Date()
  if (t.type === 'ponctuelle') {
    return t.date_echeance === format(today, 'yyyy-MM-dd')
  }
  if (!t.frequence) return false
  const freq = t.frequence.toLowerCase()
  if (freq === 'quotidien') return true
  const jourFr = JOURS_FR[today.getDay()]
  return freq.split(',').map(s => s.trim()).includes(jourFr)
}

function tacheEstCompleteeAujourdHui(t: Tache): boolean {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  return (t.completions || []).some(c => c.date_completion === todayStr)
}

function labelDate(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Aujourd\'hui'
  if (isTomorrow(d)) return 'Demain'
  return format(d, 'EEE d MMM', { locale: fr })
}

function prioriteColor(p: string): string {
  if (p === 'haute') return 'bg-red-100 text-red-700 border-red-300'
  if (p === 'basse') return 'bg-gray-100 text-gray-500 border-gray-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ value, onChange, step = 1, min = 0 }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number
}) {
  return (
    <div className="flex items-center gap-4">
      <button onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        className="w-16 h-16 rounded-2xl bg-gray-100 text-3xl font-bold text-gray-700 active:scale-95 transition-transform flex items-center justify-center select-none">
        −
      </button>
      <span className="text-3xl font-bold text-gray-800 min-w-[64px] text-center">{value}</span>
      <button onClick={() => onChange(+(value + step).toFixed(2))}
        className="w-16 h-16 rounded-2xl bg-green-700 text-white text-3xl font-bold active:scale-95 transition-transform flex items-center justify-center select-none">
        +
      </button>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

type Tab = 'zones' | 'cahier' | 'agenda' | 'pertes'

export default function TerrainPage() {
  const [onglet, setOnglet] = useState<Tab>('cahier')
  const [zones, setZones]     = useState<Zone[]>([])
  const [planches, setPlanches] = useState<Planche[]>([])
  const [entrees, setEntrees]   = useState<EntreeCahier[]>([])
  const [taches, setTaches]     = useState<Tache[]>([])
  const [pertes, setPertes]     = useState<Perte[]>([])
  const [especes, setEspeces]   = useState<Espece[]>([])

  useEffect(() => { charger() }, [])

  async function charger() {
    const [
      { data: z }, { data: pl }, { data: ent }, { data: ta }, { data: pe }, { data: esp }
    ] = await Promise.all([
      supabase.from('zones').select('*').eq('actif', true).order('ordre'),
      supabase.from('zone_planches').select('*').order('ordre'),
      supabase.from('cahier_culture')
        .select('*, zone:zones(nom), espece:especes(nom)')
        .order('date_operation', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('taches')
        .select('*, completions:taches_completions(date_completion)')
        .eq('actif', true)
        .order('priorite', { ascending: false }),
      supabase.from('pertes')
        .select('*, espece:especes(nom)')
        .order('date_perte', { ascending: false })
        .limit(30),
      supabase.from('especes').select('id, nom').eq('actif', true).order('nom'),
    ])
    if (z)   setZones(z)
    if (pl)  setPlanches(pl)
    if (ent) setEntrees(ent as unknown as EntreeCahier[])
    if (ta)  setTaches(ta as unknown as Tache[])
    if (pe)  setPertes(pe as unknown as Perte[])
    if (esp) setEspeces(esp)
  }

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'cahier', icon: '📖', label: 'Cahier' },
    { id: 'agenda', icon: '✅', label: 'Agenda' },
    { id: 'zones',  icon: '🗺️', label: 'Zones' },
    { id: 'pertes', icon: '📉', label: 'Pertes' },
  ]

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-green-900 px-5 pt-6 pb-4">
        <div className="text-green-400 text-xs font-semibold uppercase tracking-widest">Terrain & Culture</div>
        <h1 className="text-white text-2xl font-bold mt-1">🌿 Suivi du terrain</h1>
        <p className="text-green-300 text-sm mt-0.5">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs font-semibold transition-colors
              ${onglet === t.id ? 'text-green-800 border-b-2 border-green-700' : 'text-gray-400'}`}>
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {onglet === 'cahier' && (
          <CahierTab zones={zones} especes={especes} entrees={entrees} onSaved={charger} />
        )}
        {onglet === 'agenda' && (
          <AgendaTab taches={taches} zones={zones} onSaved={charger} />
        )}
        {onglet === 'zones' && (
          <ZonesTab zones={zones} planches={planches} onSaved={charger} />
        )}
        {onglet === 'pertes' && (
          <PertesTab pertes={pertes} especes={especes} onSaved={charger} />
        )}
      </div>
    </div>
  )
}

// ─── Tab : Cahier de culture ───────────────────────────────────────────────────

function CahierTab({ zones, especes, entrees, onSaved }: {
  zones: Zone[]; especes: Espece[]; entrees: EntreeCahier[]; onSaved: () => void
}) {
  const [etape, setEtape] = useState<1 | 2 | 3 | 4>(1)
  const [zoneId, setZoneId]         = useState<string>('')
  const [typeOp, setTypeOp]         = useState<string>('')
  const [especeId, setEspeceId]     = useState<string>('')
  const [quantite, setQuantite]     = useState(1)
  const [unite, setUnite]           = useState('barquettes')
  const [notes, setNotes]           = useState('')
  const [auteur, setAuteur]         = useState('Moi')
  const [saving, setSaving]         = useState(false)
  const [recherche, setRecherche]   = useState('')

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('terrain_auteur') : null
    if (saved) setAuteur(saved)
  }, [])

  const avecQuantite = ['semis', 'recolte', 'traitement'].includes(typeOp)
  const avecEspece   = ['semis', 'recolte'].includes(typeOp)
  const especesFiltrees = especes.filter(e =>
    e.nom.toLowerCase().includes(recherche.toLowerCase())
  )

  function reset() {
    setEtape(1); setZoneId(''); setTypeOp(''); setEspeceId('')
    setQuantite(1); setUnite('barquettes'); setNotes(''); setRecherche('')
  }

  async function sauvegarder() {
    setSaving(true)
    await supabase.from('cahier_culture').insert({
      zone_id:        zoneId || null,
      type_operation: typeOp,
      espece_id:      especeId || null,
      quantite:       avecQuantite ? quantite : null,
      unite:          avecQuantite ? unite : null,
      notes:          notes || null,
      auteur,
    })
    localStorage.setItem('terrain_auteur', auteur)
    setSaving(false)
    reset()
    onSaved()
  }

  const typeInfo = TYPES_OP.find(t => t.val === typeOp)
  const zoneInfo = zones.find(z => z.id === zoneId)

  return (
    <div className="space-y-4">
      {/* Formulaire rapide */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-green-700 text-white font-bold text-sm flex items-center justify-between">
          <span>📖 Nouvelle entrée</span>
          {etape > 1 && (
            <button onClick={reset} className="text-green-200 text-xs font-normal underline">
              Recommencer
            </button>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Fil d'Ariane */}
          {etape > 1 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {zoneInfo && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full font-semibold">
                  📍 {zoneInfo.nom}
                </span>
              )}
              {typeInfo && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">
                  {typeInfo.icon} {typeInfo.label}
                </span>
              )}
            </div>
          )}

          {/* Étape 1 : Zone */}
          {etape === 1 && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-gray-700">1. Quelle zone ?</div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => { setZoneId(''); setEtape(2) }}
                  className="py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-semibold active:scale-95 transition-transform">
                  Aucune
                </button>
                {zones.map(z => (
                  <button key={z.id}
                    onClick={() => { setZoneId(z.id); setEtape(2) }}
                    className="py-4 rounded-xl border-2 border-green-400 bg-green-50 text-green-800 font-bold text-lg active:scale-95 transition-transform">
                    {z.nom}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Étape 2 : Type d'opération */}
          {etape === 2 && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-gray-700">2. Quelle opération ?</div>
              <div className="grid grid-cols-2 gap-2">
                {TYPES_OP.map(t => (
                  <button key={t.val}
                    onClick={() => { setTypeOp(t.val); setEtape(3) }}
                    className={`py-4 rounded-xl border-2 ${t.color} font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform`}>
                    <span className="text-xl">{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Étape 3 : Espèce + Quantité */}
          {etape === 3 && (
            <div className="space-y-4">
              {avecEspece && (
                <div className="space-y-2">
                  <div className="text-sm font-bold text-gray-700">3a. Quelle espèce ?</div>
                  <input
                    value={recherche}
                    onChange={e => setRecherche(e.target.value)}
                    placeholder="Rechercher…"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
                  />
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    <button onClick={() => setEspeceId('')}
                      className={`py-3 rounded-xl border text-sm font-semibold text-gray-500 border-gray-200 active:scale-95 transition-transform ${especeId === '' ? 'bg-gray-100' : ''}`}>
                      Sans espèce
                    </button>
                    {especesFiltrees.map(e => (
                      <button key={e.id}
                        onClick={() => setEspeceId(e.id)}
                        className={`py-3 rounded-xl border text-sm font-semibold active:scale-95 transition-transform
                          ${especeId === e.id
                            ? 'bg-green-700 text-white border-green-700'
                            : 'bg-white text-gray-700 border-gray-200'}`}>
                        {e.nom}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {avecQuantite && (
                <div className="space-y-2">
                  <div className="text-sm font-bold text-gray-700">
                    {avecEspece ? '3b.' : '3.'} Quantité
                  </div>
                  <div className="flex items-center justify-center py-2">
                    <Stepper value={quantite} onChange={setQuantite} />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {UNITES.map(u => (
                      <button key={u} onClick={() => setUnite(u)}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold border active:scale-95 transition-transform
                          ${unite === u ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setEtape(4)}
                className="w-full bg-green-700 text-white py-3.5 rounded-xl font-bold text-base active:scale-95 transition-transform">
                Suivant →
              </button>
            </div>
          )}

          {/* Étape 4 : Note + auteur + save */}
          {etape === 4 && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-gray-700">Note (optionnel)</div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observation, commentaire…"
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 resize-none"
              />
              <div className="flex gap-2">
                {['Antoine', 'Lucas', 'Moi'].map(a => (
                  <button key={a} onClick={() => setAuteur(a)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border active:scale-95 transition-transform
                      ${auteur === a ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {a}
                  </button>
                ))}
              </div>
              <button onClick={sauvegarder} disabled={saving}
                className="w-full bg-green-700 text-white py-4 rounded-xl font-bold text-lg active:scale-95 transition-transform disabled:opacity-50">
                {saving ? 'Enregistrement…' : '✅ Enregistrer'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Historique récent */}
      {entrees.length > 0 && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 font-bold text-sm text-gray-700 border-b border-gray-100">
            Entrées récentes
          </div>
          <div className="divide-y divide-gray-100">
            {entrees.slice(0, 20).map(e => {
              const op = TYPES_OP.find(t => t.val === e.type_operation)
              return (
                <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="text-lg mt-0.5">{op?.icon || '📝'}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">
                        {op?.label || e.type_operation}
                        {e.espece && <span className="text-gray-500 font-normal"> · {(e.espece as { nom: string }).nom}</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-2">
                        {e.zone && <span>📍 {(e.zone as { nom: string }).nom}</span>}
                        {e.quantite && <span>{e.quantite} {e.unite}</span>}
                        {e.auteur && e.auteur !== 'Moi' && <span>👤 {e.auteur}</span>}
                        {e.notes && <span className="italic">"{e.notes}"</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">{labelDate(e.date_operation)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab : Agenda ──────────────────────────────────────────────────────────────

function AgendaTab({ taches, zones, onSaved }: {
  taches: Tache[]; zones: Zone[]; onSaved: () => void
}) {
  const [ajout, setAjout]   = useState(false)
  const [titre, setTitre]   = useState('')
  const [type, setType]     = useState<'ponctuelle' | 'recurrente'>('ponctuelle')
  const [frequence, setFreq] = useState<string[]>([])
  const [echeance, setEch]  = useState(format(new Date(), 'yyyy-MM-dd'))
  const [zoneId, setZoneId] = useState('')
  const [priorite, setPrio] = useState('normale')
  const [saving, setSaving] = useState(false)

  const aujTaches  = taches.filter(t => tacheEstAujourdHui(t))
  const autresTaches = taches.filter(t => !tacheEstAujourdHui(t))

  async function cocher(t: Tache) {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    if (tacheEstCompleteeAujourdHui(t)) {
      await supabase.from('taches_completions')
        .delete()
        .eq('tache_id', t.id)
        .eq('date_completion', todayStr)
    } else {
      await supabase.from('taches_completions')
        .upsert({ tache_id: t.id, date_completion: todayStr }, { onConflict: 'tache_id,date_completion' })
    }
    onSaved()
  }

  async function supprimer(id: string) {
    await supabase.from('taches').update({ actif: false }).eq('id', id)
    onSaved()
  }

  async function sauvegarder() {
    if (!titre.trim()) return
    setSaving(true)
    await supabase.from('taches').insert({
      titre: titre.trim(),
      type,
      frequence: type === 'recurrente' ? frequence.join(',') || 'quotidien' : null,
      date_echeance: type === 'ponctuelle' ? echeance : null,
      zone_id: zoneId || null,
      priorite,
    })
    setSaving(false)
    setAjout(false)
    setTitre(''); setType('ponctuelle'); setFreq([]); setPrio('normale'); setZoneId('')
    onSaved()
  }

  function toggleJour(j: string) {
    setFreq(prev => prev.includes(j) ? prev.filter(x => x !== j) : [...prev, j])
  }

  return (
    <div className="space-y-4">
      {/* Tâches du jour */}
      <div className="rounded-2xl border border-green-200 overflow-hidden">
        <div className="px-4 py-3 bg-green-700 text-white font-bold text-sm flex justify-between items-center">
          <span>✅ Aujourd&apos;hui</span>
          <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {aujTaches.filter(t => !tacheEstCompleteeAujourdHui(t)).length} restantes
          </span>
        </div>
        <div className="divide-y divide-green-100">
          {aujTaches.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Aucune tâche aujourd&apos;hui 🎉</div>
          )}
          {aujTaches.map(t => {
            const faite = tacheEstCompleteeAujourdHui(t)
            const zone = zones.find(z => z.id === t.zone_id)
            return (
              <div key={t.id} className={`px-4 py-3 flex items-start gap-3 ${faite ? 'opacity-50' : ''}`}>
                <button onClick={() => cocher(t)}
                  className={`mt-0.5 w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 active:scale-95 transition-all
                    ${faite ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 bg-white'}`}>
                  {faite && '✓'}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${faite ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {t.titre}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-2">
                    {zone && <span>📍 {zone.nom}</span>}
                    <span className={`px-1.5 py-0.5 rounded-full border text-[10px] ${prioriteColor(t.priorite)}`}>
                      {t.priorite}
                    </span>
                    {t.type === 'recurrente' && <span>🔁 {t.frequence}</span>}
                  </div>
                </div>
                <button onClick={() => supprimer(t.id)} className="text-gray-300 active:text-red-400 text-lg leading-none">×</button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bouton ajouter */}
      <button onClick={() => setAjout(!ajout)}
        className="w-full bg-green-700 text-white py-3.5 rounded-xl font-bold text-base active:scale-95 transition-transform">
        {ajout ? '✕ Annuler' : '+ Ajouter une tâche'}
      </button>

      {/* Formulaire ajout */}
      {ajout && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <input
            value={titre} onChange={e => setTitre(e.target.value)}
            placeholder="Titre de la tâche…"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base font-semibold focus:outline-none focus:border-green-400"
          />

          {/* Type */}
          <div className="flex gap-2">
            {(['ponctuelle', 'recurrente'] as const).map(v => (
              <button key={v} onClick={() => setType(v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border active:scale-95 transition-transform
                  ${type === v ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {v === 'ponctuelle' ? '📅 Ponctuelle' : '🔁 Récurrente'}
              </button>
            ))}
          </div>

          {/* Date ou jours */}
          {type === 'ponctuelle' ? (
            <input type="date" value={echeance} onChange={e => setEch(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500">Fréquence</div>
              <div className="grid grid-cols-4 gap-1.5">
                <button onClick={() => setFreq(f => f.includes('quotidien') ? [] : ['quotidien'])}
                  className={`py-2 rounded-lg text-xs font-semibold border col-span-2 active:scale-95 transition-transform
                    ${frequence.includes('quotidien') ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  🔄 Tous les jours
                </button>
                {['lundi','mardi','mercredi','jeudi','vendredi','samedi'].map(j => (
                  <button key={j} onClick={() => toggleJour(j)}
                    className={`py-2 rounded-lg text-xs font-semibold border active:scale-95 transition-transform capitalize
                      ${frequence.includes(j) ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {j.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Zone */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setZoneId('')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                ${!zoneId ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
              Sans zone
            </button>
            {zones.map(z => (
              <button key={z.id} onClick={() => setZoneId(z.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                  ${zoneId === z.id ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                📍 {z.nom}
              </button>
            ))}
          </div>

          {/* Priorité */}
          <div className="flex gap-2">
            {(['basse', 'normale', 'haute'] as const).map(p => (
              <button key={p} onClick={() => setPrio(p)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border active:scale-95 transition-transform capitalize
                  ${priorite === p ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {p === 'haute' ? '🔴' : p === 'normale' ? '🟡' : '⚪'} {p}
              </button>
            ))}
          </div>

          <button onClick={sauvegarder} disabled={saving || !titre.trim()}
            className="w-full bg-green-700 text-white py-4 rounded-xl font-bold text-base active:scale-95 transition-transform disabled:opacity-50">
            {saving ? 'Enregistrement…' : '✅ Enregistrer la tâche'}
          </button>
        </div>
      )}

      {/* Autres tâches planifiées */}
      {autresTaches.length > 0 && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 font-bold text-sm text-gray-700 border-b border-gray-100">
            Toutes les tâches
          </div>
          <div className="divide-y divide-gray-100">
            {autresTaches.map(t => {
              const zone = zones.find(z => z.id === t.zone_id)
              return (
                <div key={t.id} className="px-4 py-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{t.titre}</div>
                    <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-2">
                      {t.date_echeance && <span>📅 {labelDate(t.date_echeance)}</span>}
                      {t.frequence && <span>🔁 {t.frequence}</span>}
                      {zone && <span>📍 {zone.nom}</span>}
                      <span className={`px-1.5 py-0.5 rounded-full border text-[10px] ${prioriteColor(t.priorite)}`}>
                        {t.priorite}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => supprimer(t.id)} className="text-gray-300 active:text-red-400 text-lg leading-none mt-0.5">×</button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab : Zones ───────────────────────────────────────────────────────────────

function ZonesTab({ zones, planches, onSaved }: {
  zones: Zone[]; planches: Planche[]; onSaved: () => void
}) {
  const [ajoutZone, setAjoutZone] = useState(false)
  const [nomZone, setNomZone]     = useState('')
  const [typeZone, setTypeZone]   = useState('plein_champ')
  const [supZone, setSupZone]     = useState('')
  const [ajoutPlanche, setAjoutPlanche] = useState<string | null>(null)
  const [nomPlanche, setNomPlanche]     = useState('')
  const [saving, setSaving]             = useState(false)

  async function ajouterZone() {
    if (!nomZone.trim()) return
    setSaving(true)
    await supabase.from('zones').insert({
      nom: nomZone.trim(),
      type: typeZone,
      superficie_m2: supZone ? parseFloat(supZone) : null,
      ordre: zones.length + 1,
    })
    setSaving(false); setAjoutZone(false); setNomZone(''); setSupZone('')
    onSaved()
  }

  async function supprimerZone(id: string) {
    await supabase.from('zones').update({ actif: false }).eq('id', id)
    onSaved()
  }

  async function ajouterPlanche(zoneId: string) {
    if (!nomPlanche.trim()) return
    setSaving(true)
    await supabase.from('zone_planches').insert({
      zone_id: zoneId, nom: nomPlanche.trim(),
      ordre: planches.filter(p => p.zone_id === zoneId).length + 1,
    })
    setSaving(false); setAjoutPlanche(null); setNomPlanche('')
    onSaved()
  }

  async function supprimerPlanche(id: string) {
    await supabase.from('zone_planches').delete().eq('id', id)
    onSaved()
  }

  return (
    <div className="space-y-3">
      {zones.map(z => {
        const pls = planches.filter(p => p.zone_id === z.id)
        return (
          <div key={z.id} className="rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-green-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-green-900 text-base">{z.nom}</span>
                <span className="ml-2 text-xs text-green-600 capitalize">{z.type.replace('_', ' ')}</span>
                {z.superficie_m2 && (
                  <span className="ml-2 text-xs text-gray-400">{z.superficie_m2} m²</span>
                )}
              </div>
              <button onClick={() => supprimerZone(z.id)} className="text-gray-300 active:text-red-400 text-lg leading-none">×</button>
            </div>

            {/* Planches */}
            {pls.length > 0 && (
              <div className="divide-y divide-gray-100">
                {pls.map(p => (
                  <div key={p.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">{p.nom}
                      {p.longueur_m && p.largeur_m && (
                        <span className="text-gray-400 font-normal ml-2">{p.longueur_m}×{p.largeur_m}m</span>
                      )}
                    </span>
                    <button onClick={() => supprimerPlanche(p.id)} className="text-gray-300 active:text-red-400 text-base">×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Ajout planche */}
            {ajoutPlanche === z.id ? (
              <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                <input value={nomPlanche} onChange={e => setNomPlanche(e.target.value)}
                  placeholder="Nom de la planche (ex: Planche A)"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                />
                <button onClick={() => ajouterPlanche(z.id)} disabled={saving}
                  className="bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-semibold active:scale-95 disabled:opacity-50">
                  ✓
                </button>
                <button onClick={() => setAjoutPlanche(null)} className="text-gray-400 px-2">✕</button>
              </div>
            ) : (
              <button onClick={() => { setAjoutPlanche(z.id); setNomPlanche('') }}
                className="w-full px-4 py-2.5 text-sm text-green-700 font-semibold border-t border-gray-100 text-left active:bg-green-50 transition-colors">
                + Ajouter une planche
              </button>
            )}
          </div>
        )
      })}

      {/* Ajout zone */}
      {ajoutZone ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <input value={nomZone} onChange={e => setNomZone(e.target.value)}
            placeholder="Nom de la zone (ex: J6, Jardin Nord)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-green-400"
          />
          <div className="flex gap-2">
            {[['plein_champ', '🌾 Plein champ'], ['serre', '🏠 Serre'], ['jardin', '🌻 Jardin']].map(([v, l]) => (
              <button key={v} onClick={() => setTypeZone(v)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border active:scale-95 transition-transform
                  ${typeZone === v ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {l}
              </button>
            ))}
          </div>
          <input value={supZone} onChange={e => setSupZone(e.target.value)}
            placeholder="Superficie m² (optionnel)"
            type="number" inputMode="decimal"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
          />
          <div className="flex gap-2">
            <button onClick={ajouterZone} disabled={saving || !nomZone.trim()}
              className="flex-1 bg-green-700 text-white py-3 rounded-xl font-bold active:scale-95 disabled:opacity-50">
              ✓ Ajouter
            </button>
            <button onClick={() => { setAjoutZone(false); setNomZone('') }}
              className="px-4 py-3 text-gray-500 font-semibold">
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAjoutZone(true)}
          className="w-full border-2 border-dashed border-green-300 rounded-2xl py-4 text-green-700 font-bold text-sm active:scale-95 transition-transform">
          + Nouvelle zone
        </button>
      )}
    </div>
  )
}

// ─── Tab : Pertes ──────────────────────────────────────────────────────────────

function PertesTab({ pertes, especes, onSaved }: {
  pertes: Perte[]; especes: Espece[]; onSaved: () => void
}) {
  const [designation, setDesignation] = useState('')
  const [especeId, setEspeceId]       = useState('')
  const [quantite, setQuantite]       = useState(1)
  const [unite, setUnite]             = useState('barquettes')
  const [raison, setRaison]           = useState('')
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [recherche, setRecherche]     = useState('')

  async function sauvegarder() {
    if (!designation.trim() || !raison) return
    setSaving(true)
    await supabase.from('pertes').insert({
      designation: designation.trim(),
      espece_id: especeId || null,
      quantite, unite, raison,
      notes: notes || null,
    })
    setSaving(false)
    setDesignation(''); setEspeceId(''); setQuantite(1); setRaison(''); setNotes(''); setRecherche('')
    onSaved()
  }

  // Stats mensuelles
  const maintenant = new Date()
  const ce_mois = pertes.filter(p => {
    const d = parseISO(p.date_perte)
    return d.getMonth() === maintenant.getMonth() && d.getFullYear() === maintenant.getFullYear()
  })
  const parRaison = RAISONS_PERTE.map(r => ({
    ...r,
    count: ce_mois.filter(p => p.raison === r.val).reduce((s, p) => s + p.quantite, 0)
  })).filter(r => r.count > 0).sort((a, b) => b.count - a.count)

  const especesFiltrees = especes.filter(e =>
    e.nom.toLowerCase().includes(recherche.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Stats mois */}
      {ce_mois.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="text-sm font-bold text-red-800 mb-2">
            📉 Ce mois : {ce_mois.reduce((s, p) => s + p.quantite, 0)} {ce_mois[0]?.unite || 'unités'} perdues
          </div>
          {parRaison.map(r => (
            <div key={r.val} className="flex items-center gap-2 text-xs text-red-700 mt-1">
              <span>{r.icon}</span>
              <span>{r.label}</span>
              <span className="ml-auto font-bold">{r.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-red-600 text-white font-bold text-sm">📉 Enregistrer une perte</div>
        <div className="p-4 space-y-4">
          <input value={designation} onChange={e => setDesignation(e.target.value)}
            placeholder="Produit perdu (ex: Radis barquettes)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400"
          />

          {/* Espèce optionnelle */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500">Espèce (optionnel)</div>
            <input value={recherche} onChange={e => setRecherche(e.target.value)}
              placeholder="Filtrer les espèces…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-300"
            />
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              <button onClick={() => setEspeceId('')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                  ${!especeId ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                Sans espèce
              </button>
              {especesFiltrees.map(e => (
                <button key={e.id} onClick={() => setEspeceId(e.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                    ${especeId === e.id ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                  {e.nom}
                </button>
              ))}
            </div>
          </div>

          {/* Quantité */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500">Quantité</div>
            <div className="flex items-center justify-center py-1">
              <Stepper value={quantite} onChange={setQuantite} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {UNITES.map(u => (
                <button key={u} onClick={() => setUnite(u)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border active:scale-95 transition-transform
                    ${unite === u ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Raison */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500">Raison de la perte</div>
            <div className="grid grid-cols-2 gap-2">
              {RAISONS_PERTE.map(r => (
                <button key={r.val} onClick={() => setRaison(r.val)}
                  className={`py-3 rounded-xl border text-sm font-semibold flex items-center gap-2 px-3 active:scale-95 transition-transform
                    ${raison === r.val ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                  <span>{r.icon}</span> {r.label}
                </button>
              ))}
            </div>
          </div>

          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Note optionnelle…"
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400 resize-none"
          />

          <button onClick={sauvegarder} disabled={saving || !designation.trim() || !raison}
            className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-base active:scale-95 transition-transform disabled:opacity-50">
            {saving ? 'Enregistrement…' : '📉 Enregistrer la perte'}
          </button>
        </div>
      </div>

      {/* Historique pertes */}
      {pertes.length > 0 && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 font-bold text-sm text-gray-700 border-b border-gray-100">
            Historique des pertes
          </div>
          <div className="divide-y divide-gray-100">
            {pertes.map(p => {
              const r = RAISONS_PERTE.find(x => x.val === p.raison)
              return (
                <div key={p.id} className="px-4 py-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">
                      {r?.icon} {p.designation}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-2">
                      <span>{p.quantite} {p.unite}</span>
                      <span>{r?.label}</span>
                      {p.notes && <span className="italic">"{p.notes}"</span>}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">{labelDate(p.date_perte)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
