'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithCache, queueMutation, saveCache, queuePhoto } from '@/lib/offline'
import { format, parseISO, isToday, isTomorrow, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

type Zone = {
  id: string; nom: string; type: string
  superficie_m2: number | null; description: string | null; ordre: number; actif: boolean
}
type Planche = {
  id: string; zone_id: string; nom: string
  longueur_m: number | null; largeur_m: number | null
  plants_par_m2: number | null; notes: string | null; ordre: number
}
type CahierPhoto = { id: string; entree_id: string; url: string; created_at: string }

type EntreeCahier = {
  id: string; zone_id: string | null; date_operation: string
  type_operation: string; espece_id: string | null; quantite: number | null
  unite: string | null; notes: string | null; auteur: string | null
  produit_traitement_id: string | null
  zone?: { nom: string } | null
  espece?: { nom: string } | null
  produit?: { nom: string } | null
  photos?: CahierPhoto[]
}
type TempsTache = {
  id: string; tache_id: string; date: string; auteur: string
  minutes: number; chrono_debut: string | null
}
type Tache = {
  id: string; titre: string; description: string | null; type: string
  frequence: string | null; date_echeance: string | null
  zone_id: string | null; priorite: string; actif: boolean
  completions?: { date_completion: string }[]
  temps?: TempsTache[]
}
type Perte = {
  id: string; date_perte: string; designation: string
  quantite: number; unite: string; raison: string; notes: string | null
  espece?: { nom: string } | null
}
type Espece            = { id: string; nom: string }
type EspeceSerre       = { id: string; nom: string; categorie: string }
type ProduitTraitement = { id: string; nom: string; type: string }
type TacheCatalogue    = { id: string; titre: string; categorie: string; icone: string; active: boolean; ordre: number }
type ZoneTacheCat      = { zone_id: string; catalogue_id: string }
type Pointage = {
  id: string; date: string; auteur: string
  heure_arrivee: string | null; heure_depart: string | null
  pause_minutes: number; notes: string | null
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPES_OP_CHAMP = [
  { val: 'semis',       label: 'Semer',      icon: '🌱', color: 'bg-green-100 border-green-400 text-green-800' },
  { val: 'recolte',     label: 'Recolter',   icon: '✂️',  color: 'bg-emerald-100 border-emerald-400 text-emerald-800' },
  { val: 'arrosage',    label: 'Arroser',    icon: '💧', color: 'bg-blue-100 border-blue-400 text-blue-800' },
  { val: 'traitement',  label: 'Traitement', icon: '🌿', color: 'bg-amber-100 border-amber-400 text-amber-800' },
  { val: 'observation', label: 'Observer',   icon: '👁', color: 'bg-purple-100 border-purple-400 text-purple-800' },
  { val: 'taille',      label: 'Tailler',    icon: '✂️',  color: 'bg-orange-100 border-orange-400 text-orange-800' },
  { val: 'autre',       label: 'Autre',      icon: '📝', color: 'bg-gray-100 border-gray-300 text-gray-700' },
]

const TYPES_OP_SERRE = [
  { val: 'semis',       label: 'Semer',        icon: '🌱', color: 'bg-green-100 border-green-400 text-green-800' },
  { val: 'repiquage',   label: 'Repiquer',     icon: '🪴', color: 'bg-lime-100 border-lime-400 text-lime-800' },
  { val: 'arrosage',    label: 'Arroser',      icon: '💧', color: 'bg-blue-100 border-blue-400 text-blue-800' },
  { val: 'traitement',  label: 'Traitement',   icon: '🌿', color: 'bg-amber-100 border-amber-400 text-amber-800' },
  { val: 'recolte',     label: 'Sortir plants',icon: '📦', color: 'bg-emerald-100 border-emerald-400 text-emerald-800' },
  { val: 'observation', label: 'Observer',     icon: '👁', color: 'bg-purple-100 border-purple-400 text-purple-800' },
  { val: 'autre',       label: 'Autre',        icon: '📝', color: 'bg-gray-100 border-gray-300 text-gray-700' },
]

const RAISONS_PERTE = [
  { val: 'germination_ratee', label: 'Germination ratee',  icon: '🫘' },
  { val: 'pourriture',        label: 'Pourriture',         icon: '🍂' },
  { val: 'surproduction',     label: 'Surproduction',      icon: '📦' },
  { val: 'invendu',           label: 'Invendu',            icon: '🏷️' },
  { val: 'meteo',             label: 'Meteo',              icon: '⛈️' },
  { val: 'autre',             label: 'Autre',              icon: '❓' },
]

const JOURS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tacheEstAujourdHui(t: Tache): boolean {
  const today = new Date()
  if (t.type === 'ponctuelle') return t.date_echeance === format(today, 'yyyy-MM-dd')
  if (!t.frequence) return false
  const freq = t.frequence.toLowerCase()
  if (freq === 'quotidien') return true
  return freq.split(',').map(s => s.trim()).includes(JOURS_FR[today.getDay()])
}

function tacheEstCompleteeAujourdHui(t: Tache): boolean {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  return (t.completions || []).some(c => c.date_completion === todayStr)
}

function labelDate(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return "Aujourd'hui"
  if (isTomorrow(d)) return 'Demain'
  return format(d, 'EEE d MMM', { locale: fr })
}

function calcMinutes(debut: string, fin: string): number {
  const [dh, dm] = debut.split(':').map(Number)
  const [fh, fm] = fin.split(':').map(Number)
  return (fh * 60 + fm) - (dh * 60 + dm)
}

function formatDuree(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.abs(minutes) % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

async function ajouterAuCatalogueSiNouveau(titre: string, catalogueTaches: TacheCatalogue[]) {
  const t = titre.trim()
  if (!t || catalogueTaches.some(c => c.titre.toLowerCase() === t.toLowerCase())) return
  const payload = { titre: t, categorie: 'autre', icone: '📝', active: true, ordre: 999 }
  if (!navigator.onLine) {
    await queueMutation({ table: 'taches_catalogue', method: 'insert', payload })
  } else {
    await supabase.from('taches_catalogue').insert(payload)
  }
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

// ─── ListeAvecAjout ───────────────────────────────────────────────────────────

function ListeAvecAjout<T extends { id: string; nom: string }>({ items, valeur, onChange, placeholder, onAjouter, grouper }: {
  items: T[]
  valeur: string
  onChange: (id: string) => void
  placeholder?: string
  onAjouter: (nom: string, extra?: string) => Promise<void>
  grouper?: (item: T) => string
}) {
  const [recherche, setRecherche] = useState('')
  const [ajout, setAjout]         = useState(false)
  const [nouveauNom, setNouveauNom] = useState('')
  const [nouvelleCategorie, setNouvelleCategorie] = useState('')
  const [saving, setSaving]       = useState(false)

  const filtres = items.filter(i => i.nom.toLowerCase().includes(recherche.toLowerCase()))
  const groupes: Record<string, T[]> = {}
  if (grouper) {
    for (const item of filtres) {
      const g = grouper(item)
      if (!groupes[g]) groupes[g] = []
      groupes[g].push(item)
    }
  }

  async function sauvegarder() {
    if (!nouveauNom.trim()) return
    setSaving(true)
    await onAjouter(nouveauNom.trim(), nouvelleCategorie || undefined)
    setSaving(false)
    setAjout(false); setNouveauNom(''); setNouvelleCategorie('')
  }

  return (
    <div className="space-y-2">
      <input value={recherche} onChange={e => setRecherche(e.target.value)}
        placeholder={placeholder || 'Rechercher...'}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
      />
      <div className="max-h-52 overflow-y-auto space-y-1">
        <button onClick={() => onChange('')}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors
            ${valeur === '' ? 'bg-gray-200 border-gray-300 font-semibold' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
          Aucun
        </button>
        {grouper && Object.keys(groupes).length > 0
          ? Object.entries(groupes).map(([groupe, groupItems]) => (
              <div key={groupe}>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 pt-1.5 pb-0.5 capitalize">{groupe}</div>
                {groupItems.map(i => (
                  <button key={i.id} onClick={() => onChange(i.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-colors font-medium
                      ${valeur === i.id ? 'bg-green-700 text-white border-green-700' : 'bg-white border-gray-100 text-gray-700 active:bg-green-50'}`}>
                    {i.nom}
                  </button>
                ))}
              </div>
            ))
          : filtres.map(i => (
              <button key={i.id} onClick={() => onChange(i.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-colors font-medium
                  ${valeur === i.id ? 'bg-green-700 text-white border-green-700' : 'bg-white border-gray-100 text-gray-700 active:bg-green-50'}`}>
                {i.nom}
              </button>
            ))
        }
        {filtres.length === 0 && !ajout && (
          <div className="text-center text-xs text-gray-400 py-3">Aucun resultat</div>
        )}
      </div>
      {ajout ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
          <input value={nouveauNom} onChange={e => setNouveauNom(e.target.value)}
            placeholder="Nom..."
            className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          />
          <input value={nouvelleCategorie} onChange={e => setNouvelleCategorie(e.target.value)}
            placeholder="Categorie (ex: aromatique, engrais...)"
            className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          />
          <div className="flex gap-2">
            <button onClick={sauvegarder} disabled={saving || !nouveauNom.trim()}
              className="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm font-bold active:scale-95 disabled:opacity-50">
              {saving ? '...' : 'Sauvegarder'}
            </button>
            <button onClick={() => { setAjout(false); setNouveauNom('') }}
              className="px-3 py-2 text-gray-500 text-sm">Annuler</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAjout(true)}
          className="w-full text-center text-sm text-green-700 font-semibold py-2 border border-dashed border-green-300 rounded-xl active:bg-green-50">
          + Ajouter a cette liste
        </button>
      )}
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

type Tab = 'cahier' | 'agenda' | 'zones' | 'pertes' | 'heures'

export default function TerrainPage() {
  const [onglet, setOnglet]             = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const init = localStorage.getItem('terrain_init_tab')
      if (init) { localStorage.removeItem('terrain_init_tab'); return init as Tab }
    }
    return 'agenda'
  })
  const [taskRapide, setTaskRapide]     = useState(false)
  const [taskTitre, setTaskTitre]       = useState('')
  const [taskDate, setTaskDate]         = useState(format(new Date(), 'yyyy-MM-dd'))
  const [taskPrio, setTaskPrio]         = useState('normale')
  const [taskZoneIds, setTaskZoneIds]   = useState<string[]>([])
  const [taskSaving, setTaskSaving]     = useState(false)
  const [zones, setZones]               = useState<Zone[]>([])
  const [planches, setPlanches]         = useState<Planche[]>([])
  const [entrees, setEntrees]           = useState<EntreeCahier[]>([])
  const [taches, setTaches]             = useState<Tache[]>([])
  const [pertes, setPertes]             = useState<Perte[]>([])
  const [especes, setEspeces]           = useState<Espece[]>([])
  const [especesSerre, setEspecesSerre] = useState<EspeceSerre[]>([])
  const [produits, setProduits]         = useState<ProduitTraitement[]>([])
  const [catalogueTaches, setCatalogueTaches] = useState<TacheCatalogue[]>([])
  const [zoneTaches, setZoneTaches]     = useState<ZoneTacheCat[]>([])
  const [pointages, setPointages]       = useState<Pointage[]>([])

  useEffect(() => { charger() }, [])

  async function charger() {
    const [z, pl, ent, ta, pe, esp, esSerre, prod, cat, zt, pts] = await Promise.all([
      fetchWithCache('zones', async () => {
        const { data } = await supabase.from('zones').select('*').eq('actif', true).order('ordre')
        return data
      }).then(r => r.data),
      fetchWithCache('zone_planches', async () => {
        const { data } = await supabase.from('zone_planches').select('*').order('ordre')
        return data
      }).then(r => r.data),
      fetchWithCache('cahier_culture', async () => {
        const { data } = await supabase.from('cahier_culture')
          .select('*, zone:zones(nom), espece:especes(nom), produit:produits_traitement(nom), photos:cahier_photos(*)')
          .order('date_operation', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(50)
        return data
      }).then(r => r.data),
      fetchWithCache('taches', async () => {
        // Essai avec la table taches_temps (migration 025)
        const { data, error } = await supabase.from('taches')
          .select('*, completions:taches_completions(date_completion), temps:taches_temps(id, tache_id, date, auteur, minutes, chrono_debut)')
          .eq('actif', true).order('priorite', { ascending: false })
        if (!error) return data
        // Fallback si migration 025 pas encore appliquée
        const { data: d2 } = await supabase.from('taches')
          .select('*, completions:taches_completions(date_completion)')
          .eq('actif', true).order('priorite', { ascending: false })
        return d2
      }).then(r => r.data),
      fetchWithCache('pertes', async () => {
        const { data } = await supabase.from('pertes')
          .select('*, espece:especes(nom)')
          .order('date_perte', { ascending: false }).limit(30)
        return data
      }).then(r => r.data),
      fetchWithCache('especes_noms', async () => {
        const { data } = await supabase.from('especes').select('id, nom').eq('actif', true).order('nom')
        return data
      }).then(r => r.data),
      fetchWithCache('especes_serre', async () => {
        const { data } = await supabase.from('especes_serre').select('*').eq('actif', true).order('categorie,nom')
        return data
      }).then(r => r.data),
      fetchWithCache('produits_traitement', async () => {
        const { data } = await supabase.from('produits_traitement').select('*').eq('actif', true).order('type,nom')
        return data
      }).then(r => r.data),
      fetchWithCache('taches_catalogue', async () => {
        const { data } = await supabase.from('taches_catalogue').select('*').eq('active', true).order('ordre')
        return data
      }).then(r => r.data),
      fetchWithCache('zone_taches_catalogue', async () => {
        const { data } = await supabase.from('zone_taches_catalogue').select('*')
        return data
      }).then(r => r.data),
      fetchWithCache('pointages', async () => {
        const { data } = await supabase.from('pointages').select('*').order('date', { ascending: false }).limit(60)
        return data
      }).then(r => r.data),
    ])
    if (z?.length)      setZones(z)
    if (pl?.length)     setPlanches(pl)
    if (ent?.length)    setEntrees(ent as unknown as EntreeCahier[])
    if (ta?.length)     setTaches(ta as unknown as Tache[])
    if (pe?.length)     setPertes(pe as unknown as Perte[])
    if (esp?.length)    setEspeces(esp)
    if (esSerre?.length) setEspecesSerre(esSerre)
    if (prod?.length)   setProduits(prod)
    if (cat?.length)    setCatalogueTaches(cat as unknown as TacheCatalogue[])
    if (zt?.length)     setZoneTaches(zt)
    if (pts?.length)    setPointages(pts as unknown as Pointage[])
  }

  // Cree une tache par zone selectionnee (ou une sans zone si aucune)
  async function sauvegarderTaskRapide() {
    if (!taskTitre.trim()) return
    setTaskSaving(true)
    const zids = taskZoneIds.length > 0 ? taskZoneIds : [null]
    if (!navigator.onLine) {
      await Promise.all(zids.map(zid =>
        queueMutation({ table: 'taches', method: 'insert', payload: { titre: taskTitre.trim(), type: 'ponctuelle', date_echeance: taskDate, priorite: taskPrio, zone_id: zid } })
      ))
    } else {
      await Promise.all(zids.map(zid =>
        supabase.from('taches').insert({
          titre: taskTitre.trim(), type: 'ponctuelle',
          date_echeance: taskDate, priorite: taskPrio,
          zone_id: zid,
        })
      ))
    }
    await ajouterAuCatalogueSiNouveau(taskTitre, catalogueTaches)
    setTaskSaving(false); setTaskRapide(false)
    setTaskTitre(''); setTaskPrio('normale'); setTaskZoneIds([])
    setTaskDate(format(new Date(), 'yyyy-MM-dd'))
    charger()
  }

  async function ajouterEspeceSerre(nom: string, categorie?: string) {
    await supabase.from('especes_serre').insert({ nom, categorie: categorie || 'plante' })
    const { data } = await supabase.from('especes_serre').select('*').eq('actif', true).order('categorie,nom')
    if (data) setEspecesSerre(data)
  }

  async function ajouterProduit(nom: string, type?: string) {
    await supabase.from('produits_traitement').insert({ nom, type: type || 'autre' })
    const { data } = await supabase.from('produits_traitement').select('*').eq('actif', true).order('type,nom')
    if (data) setProduits(data)
  }

  function toggleTaskZone(zid: string) {
    setTaskZoneIds(prev => prev.includes(zid) ? prev.filter(x => x !== zid) : [...prev, zid])
  }

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'agenda', icon: '✅', label: 'Agenda' },
    { id: 'cahier', icon: '📖', label: 'Cahier' },
    { id: 'zones',  icon: '🗺️', label: 'Zones' },
    { id: 'pertes', icon: '📉', label: 'Pertes' },
    { id: 'heures', icon: '⏱️', label: 'Heures' },
  ]

  return (
    <div className="pb-24">
      <div className="bg-green-900 px-5 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-green-400 text-xs font-semibold uppercase tracking-widest">Terrain & Culture</div>
            <h1 className="text-white text-2xl font-bold mt-1">🌿 Suivi du terrain</h1>
            <p className="text-green-300 text-sm mt-0.5">{format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}</p>
          </div>
          <button onClick={() => setTaskRapide(true)}
            className="bg-green-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md mt-1 active:scale-95 transition-transform">
            + Tache
          </button>
        </div>
      </div>

      {/* Modal tache rapide */}
      {taskRapide && (() => {
        const chips = taskZoneIds.length === 1
          ? catalogueTaches.filter(c => zoneTaches.some(zt => zt.zone_id === taskZoneIds[0] && zt.catalogue_id === c.id))
          : catalogueTaches.slice(0, 12)
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setTaskRapide(false)}>
            <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-5 space-y-4 pb-10 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-800 text-lg">✅ Tache rapide</h2>
                <button onClick={() => setTaskRapide(false)} className="text-gray-400 text-2xl leading-none">x</button>
              </div>

              {/* Zone multi-select */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-gray-500">
                  Zone(s) — {taskZoneIds.length === 0 ? 'aucune' : `${taskZoneIds.length} selectionnee${taskZoneIds.length > 1 ? 's' : ''}`}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {zones.filter(z => z.type !== 'serre').map(z => (
                    <button key={z.id} onClick={() => toggleTaskZone(z.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                        ${taskZoneIds.includes(z.id) ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      📍 {z.nom}
                    </button>
                  ))}
                  {zones.filter(z => z.type === 'serre').map(z => (
                    <button key={z.id} onClick={() => toggleTaskZone(z.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                        ${taskZoneIds.includes(z.id) ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      🪴 {z.nom}
                    </button>
                  ))}
                  {taskZoneIds.length > 0 && (
                    <button onClick={() => setTaskZoneIds([])}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 text-gray-400 active:scale-95">
                      x Effacer
                    </button>
                  )}
                </div>
                {taskZoneIds.length > 1 && (
                  <div className="text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                    {taskZoneIds.length} taches seront creees, une par zone
                  </div>
                )}
              </div>

              {/* Suggestions catalogue */}
              {chips.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-gray-400">
                    Suggestions{taskZoneIds.length === 1 ? ` - ${zones.find(z => z.id === taskZoneIds[0])?.nom}` : ''}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {chips.map(c => (
                      <button key={c.id} onClick={() => setTaskTitre(c.titre)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                          ${taskTitre === c.titre
                            ? 'bg-green-700 text-white border-green-700'
                            : 'bg-green-50 text-green-800 border-green-200'}`}>
                        {c.icone} {c.titre}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <input value={taskTitre} onChange={e => setTaskTitre(e.target.value)}
                placeholder="Que faut-il faire ?"
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base font-semibold focus:outline-none focus:border-green-400"
              />

              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-500">Pour quand ?</div>
                <div className="flex gap-2">
                  {[
                    { label: "Aujourd'hui", val: format(new Date(), 'yyyy-MM-dd') },
                    { label: 'Demain',      val: format(addDays(new Date(), 1), 'yyyy-MM-dd') },
                  ].map(d => (
                    <button key={d.val} onClick={() => setTaskDate(d.val)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border active:scale-95 transition-transform
                        ${taskDate === d.val ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      📅 {d.label}
                    </button>
                  ))}
                  <input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-green-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-500">Priorite</div>
                <div className="flex gap-2">
                  {(['basse','normale','haute'] as const).map(p => (
                    <button key={p} onClick={() => setTaskPrio(p)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border active:scale-95 transition-transform capitalize
                        ${taskPrio === p ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {p === 'haute' ? '🔴' : p === 'normale' ? '🟡' : '⚪'} {p}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={sauvegarderTaskRapide} disabled={taskSaving || !taskTitre.trim()}
                className="w-full bg-green-700 text-white py-4 rounded-xl font-bold text-lg active:scale-95 transition-transform disabled:opacity-50">
                {taskSaving ? 'Enregistrement...' : taskZoneIds.length > 1
                  ? `Creer ${taskZoneIds.length} taches`
                  : 'Enregistrer la tache'}
              </button>
            </div>
          </div>
        )
      })()}

      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs font-semibold transition-colors
              ${onglet === t.id ? 'text-green-800 border-b-2 border-green-700' : 'text-gray-400'}`}>
            <span className="text-lg leading-none">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {onglet === 'cahier' && (
          <CahierTab
            zones={zones} especes={especes} especesSerre={especesSerre}
            produits={produits} entrees={entrees}
            onSaved={charger}
            onAjouterEspece={ajouterEspeceSerre}
            onAjouterProduit={ajouterProduit}
          />
        )}
        {onglet === 'agenda' && (
          <AgendaTab taches={taches} zones={zones}
            catalogueTaches={catalogueTaches} zoneTaches={zoneTaches}
            onSaved={charger} />
        )}
        {onglet === 'zones'  && <ZonesTab zones={zones} planches={planches} onSaved={charger} />}
        {onglet === 'pertes' && <PertesTab pertes={pertes} especes={especes} onSaved={charger} />}
        {onglet === 'heures' && (
          <HeuresTab taches={taches} entrees={entrees} zones={zones} pointages={pointages} onSaved={charger} />
        )}
      </div>
    </div>
  )
}

// ─── Tab : Cahier de culture ───────────────────────────────────────────────────

function CahierTab({ zones, especes, especesSerre, produits, entrees, onSaved, onAjouterEspece, onAjouterProduit }: {
  zones: Zone[]; especes: Espece[]; especesSerre: EspeceSerre[]
  produits: ProduitTraitement[]; entrees: EntreeCahier[]
  onSaved: () => void
  onAjouterEspece: (nom: string, cat?: string) => Promise<void>
  onAjouterProduit: (nom: string, type?: string) => Promise<void>
}) {
  const [etape, setEtape]       = useState<1 | 2 | 3 | 4>(1)
  const [zoneId, setZoneId]     = useState('')
  const [typeOp, setTypeOp]     = useState('')
  const [especeId, setEspeceId] = useState('')
  const [produitId, setProduitId] = useState('')
  const [quantite, setQuantite] = useState(1)
  const [unite, setUnite]       = useState('barquettes')
  const [notes, setNotes]       = useState('')
  const [auteur, setAuteur]     = useState('Moi')
  const [saving, setSaving]         = useState(false)
  const [filtre, setFiltre]         = useState<'tout' | 'traitements'>('tout')
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null)
  const [pendingPhotos, setPendingPhotos] = useState<Record<string, string[]>>({})

  async function uploadPhoto(entreeId: string, file: File) {
    setUploadingPhoto(entreeId)
    if (!navigator.onLine) {
      const localUrl = await queuePhoto(entreeId, file)
      setPendingPhotos(prev => ({ ...prev, [entreeId]: [...(prev[entreeId] || []), localUrl] }))
      setUploadingPhoto(null)
      return
    }
    const ext  = file.name.split('.').pop() || 'jpg'
    const path = `${entreeId}/${Date.now()}.${ext}`
    const { data: up } = await supabase.storage.from('cahier-photos').upload(path, file, { upsert: false })
    if (up) {
      const { data: urlData } = supabase.storage.from('cahier-photos').getPublicUrl(up.path)
      await supabase.from('cahier_photos').insert({ entree_id: entreeId, url: urlData.publicUrl })
      onSaved()
    }
    setUploadingPhoto(null)
  }

  function exportCSV() {
    const rows = [
      ['Date', 'Zone', 'Operation', 'Espece / Produit', 'Quantite', 'Unite', 'Auteur', 'Notes'],
      ...entrees.map(e => [
        e.date_operation,
        (e.zone  as { nom: string } | null)?.nom    || '',
        e.type_operation,
        (e.espece   as { nom: string } | null)?.nom || (e.produit as { nom: string } | null)?.nom || '',
        e.quantite ?? '',
        e.unite    ?? '',
        e.auteur   ?? '',
        e.notes    ?? '',
      ]),
    ]
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `cahier-culture-${format(new Date(), 'yyyy-MM')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPDF() {
    const w = window.open('', '_blank')
    if (!w) return
    const lignes = entrees.map(e => `<tr>
      <td>${format(parseISO(e.date_operation), 'd MMM yyyy', { locale: fr })}</td>
      <td>${(e.zone as { nom: string } | null)?.nom || '—'}</td>
      <td>${e.type_operation}</td>
      <td>${(e.espece as { nom: string } | null)?.nom || (e.produit as { nom: string } | null)?.nom || '—'}</td>
      <td>${e.quantite ? `${e.quantite} ${e.unite ?? ''}` : '—'}</td>
      <td>${e.auteur || '—'}</td>
      <td>${e.notes || ''}</td>
    </tr>`).join('')
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Cahier de culture</title>
      <style>
        body{font-family:sans-serif;font-size:11px;padding:20px}
        h1{font-size:16px;margin-bottom:2px}
        p{color:#888;margin:0 0 14px;font-size:10px}
        table{width:100%;border-collapse:collapse}
        th{background:#2D3E1B;color:#fff;padding:5px 7px;text-align:left;font-size:10px}
        td{padding:5px 7px;border-bottom:1px solid #eee;font-size:10px;vertical-align:top}
        tr:nth-child(even) td{background:#f8f8f8}
        @media print{body{padding:0}}
      </style>
    </head><body>
      <h1>Les Petites Herbes — Cahier de culture</h1>
      <p>Export du ${format(new Date(), 'd MMMM yyyy', { locale: fr })}</p>
      <table>
        <thead><tr>
          <th>Date</th><th>Zone</th><th>Operation</th><th>Espece / Produit</th>
          <th>Quantite</th><th>Auteur</th><th>Notes</th>
        </tr></thead>
        <tbody>${lignes}</tbody>
      </table>
      <script>window.onload=()=>window.print()<\/script>
    </body></html>`)
    w.document.close()
  }

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('terrain_auteur') : null
    if (saved) setAuteur(saved)
  }, [])

  const zoneSelectionnee = zones.find(z => z.id === zoneId)
  const estSerre         = zoneSelectionnee?.type === 'serre'
  const estTraitement    = typeOp === 'traitement'
  const avecEspece       = ['semis', 'recolte', 'repiquage'].includes(typeOp) && !estTraitement
  const avecQuantite     = ['semis', 'recolte', 'traitement', 'repiquage'].includes(typeOp)

  const typesOp    = estSerre ? TYPES_OP_SERRE : TYPES_OP_CHAMP
  const unitesDisp = estSerre
    ? ['plants', 'bottes', 'godets', 'pieces']
    : estTraitement
      ? ['L', 'mL', 'kg', 'g', 'doses']
      : ['barquettes', 'kg', 'plateaux', 'L', 'pieces']

  useEffect(() => {
    if (estSerre) setUnite('plants')
    else if (estTraitement) setUnite('L')
    else setUnite('barquettes')
  }, [estSerre, estTraitement])

  function reset() {
    setEtape(1); setZoneId(''); setTypeOp(''); setEspeceId('')
    setProduitId(''); setQuantite(1); setNotes('')
  }

  async function sauvegarder() {
    setSaving(true)
    const payload = {
      zone_id:               zoneId || null,
      type_operation:        typeOp,
      espece_id:             avecEspece && especeId ? especeId : null,
      produit_traitement_id: estTraitement && produitId ? produitId : null,
      quantite:              avecQuantite ? quantite : null,
      unite:                 avecQuantite ? unite : null,
      notes:                 notes || null,
      auteur,
    }

    if (!navigator.onLine) {
      await queueMutation({ table: 'cahier_culture', method: 'insert', payload })
      // Mise à jour optimiste du cache local
      const entreeLocale = { id: `local_${Date.now()}`, ...payload, created_at: new Date().toISOString() }
      const cached = await import('@/lib/offline').then(m => m.loadCache<EntreeCahier[]>('cahier_culture'))
      await saveCache('cahier_culture', [entreeLocale, ...(cached ?? [])])
    } else {
      await supabase.from('cahier_culture').insert(payload)
    }
    localStorage.setItem('terrain_auteur', auteur)
    setSaving(false); reset(); onSaved()
  }

  const typeInfo = typesOp.find(t => t.val === typeOp)
  const zoneInfo = zoneSelectionnee
  const produitSelectionne = produits.find(p => p.id === produitId)

  const zonesChamp = zones.filter(z => z.type !== 'serre')
  const zonesSerre = zones.filter(z => z.type === 'serre')

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-green-700 text-white font-bold text-sm flex items-center justify-between">
          <span>{estSerre ? '🪴 Saisie Serre' : '📖 Saisie terrain'}</span>
          {etape > 1 && (
            <button onClick={reset} className="text-green-200 text-xs underline font-normal">
              Recommencer
            </button>
          )}
        </div>

        <div className="p-4 space-y-4">
          {etape > 1 && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {zoneInfo && (
                <span className={`px-2 py-1 rounded-full font-semibold ${estSerre ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                  {estSerre ? '🪴' : '📍'} {zoneInfo.nom}
                </span>
              )}
              {!zoneInfo && <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold">📍 Sans zone</span>}
              {typeInfo && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">
                  {typeInfo.icon} {typeInfo.label}
                </span>
              )}
              {produitSelectionne && (
                <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-semibold">
                  🌿 {produitSelectionne.nom}
                </span>
              )}
            </div>
          )}

          {/* Etape 1 : Zone */}
          {etape === 1 && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-gray-700">1. Quelle zone ?</div>

              {zonesSerre.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">🪴 Serre</div>
                  <div className="grid grid-cols-3 gap-2">
                    {zonesSerre.map(z => (
                      <button key={z.id}
                        onClick={() => { setZoneId(z.id); setEtape(2) }}
                        className="py-4 rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-800 font-bold text-base active:scale-95 transition-transform">
                        🪴 {z.nom}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {zonesSerre.length > 0 && (
                  <div className="text-[10px] font-bold text-green-700 uppercase tracking-wider">🌾 Plein champ</div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => { setZoneId(''); setEtape(2) }}
                    className="py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-semibold active:scale-95 transition-transform">
                    Aucune
                  </button>
                  {zonesChamp.map(z => (
                    <button key={z.id}
                      onClick={() => { setZoneId(z.id); setEtape(2) }}
                      className="py-4 rounded-xl border-2 border-green-400 bg-green-50 text-green-800 font-bold text-lg active:scale-95 transition-transform">
                      {z.nom}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Etape 2 : Type d'operation */}
          {etape === 2 && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-gray-700">2. Quelle operation ?</div>
              <div className="grid grid-cols-2 gap-2">
                {typesOp.map(t => (
                  <button key={t.val}
                    onClick={() => { setTypeOp(t.val); setEtape(3) }}
                    className={`py-4 rounded-xl border-2 ${t.color} font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform`}>
                    <span className="text-xl">{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Etape 3 : Espece / Produit + Quantite */}
          {etape === 3 && (
            <div className="space-y-4">
              {estTraitement && (
                <div className="space-y-2">
                  <div className="text-sm font-bold text-gray-700">3a. Quel produit ?</div>
                  <ListeAvecAjout
                    items={produits}
                    valeur={produitId}
                    onChange={setProduitId}
                    placeholder="Rechercher un produit..."
                    onAjouter={onAjouterProduit}
                    grouper={(p: ProduitTraitement) => p.type}
                  />
                </div>
              )}
              {avecEspece && (
                <div className="space-y-2">
                  <div className="text-sm font-bold text-gray-700">
                    3a. {estSerre ? 'Quelle plante ?' : 'Quelle espece ?'}
                  </div>
                  {estSerre ? (
                    <ListeAvecAjout
                      items={especesSerre}
                      valeur={especeId}
                      onChange={setEspeceId}
                      placeholder="Rechercher une plante..."
                      onAjouter={onAjouterEspece}
                      grouper={(e: EspeceSerre) => e.categorie}
                    />
                  ) : (
                    <ListeAvecAjout
                      items={especes}
                      valeur={especeId}
                      onChange={setEspeceId}
                      placeholder="Rechercher une espece..."
                      onAjouter={async (nom) => { await supabase.from('especes').insert({ nom, actif: true }); onSaved() }}
                    />
                  )}
                </div>
              )}
              {avecQuantite && (
                <div className="space-y-2">
                  <div className="text-sm font-bold text-gray-700">
                    {(avecEspece || estTraitement) ? '3b.' : '3.'} Quantite
                  </div>
                  <div className="flex items-center justify-center py-1">
                    <Stepper value={quantite} onChange={setQuantite}
                      step={estTraitement ? 0.1 : 1} />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {unitesDisp.map(u => (
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

          {/* Etape 4 : Note + auteur + save */}
          {etape === 4 && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-gray-700">Note (optionnel)</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Observation, remarque..."
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 resize-none" />
              <div className="text-xs font-semibold text-gray-500">Qui ?</div>
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
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Historique + suivi traitements */}
      {entrees.length > 0 && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">

          {/* Toggle filtre + exports */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-gray-700">
                {filtre === 'traitements' ? '🌿 Suivi traitements' : 'Entrees recentes'}
              </span>
              <div className="flex rounded-xl overflow-hidden border border-gray-200 text-xs font-semibold">
                <button onClick={() => setFiltre('tout')}
                  className={`px-3 py-1.5 transition-colors ${filtre === 'tout' ? 'bg-green-700 text-white' : 'bg-white text-gray-500'}`}>
                  Tout
                </button>
                <button onClick={() => setFiltre('traitements')}
                  className={`px-3 py-1.5 transition-colors ${filtre === 'traitements' ? 'bg-amber-600 text-white' : 'bg-white text-gray-500'}`}>
                  🌿 Traitements
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={exportCSV}
                className="flex-1 text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-xl active:scale-95 transition-transform text-center">
                📊 Export Excel
              </button>
              <button onClick={exportPDF}
                className="flex-1 text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-xl active:scale-95 transition-transform text-center">
                📄 Export PDF
              </button>
            </div>
          </div>

          {/* Vue : tout */}
          {filtre === 'tout' && (
            <div className="divide-y divide-gray-100">
              {entrees.slice(0, 20).map(e => {
                const op = [...TYPES_OP_CHAMP, ...TYPES_OP_SERRE].find(t => t.val === e.type_operation)
                return (
                  <div key={e.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <span className="text-lg mt-0.5">{op?.icon || '📝'}</span>
                        <div>
                          <div className="text-sm font-semibold text-gray-800">
                            {op?.label || e.type_operation}
                            {e.espece && <span className="text-gray-500 font-normal"> · {(e.espece as { nom: string }).nom}</span>}
                            {e.produit && <span className="text-amber-700 font-normal"> · {(e.produit as { nom: string }).nom}</span>}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-2">
                            {e.zone && <span>📍 {(e.zone as { nom: string }).nom}</span>}
                            {e.quantite && <span>{e.quantite} {e.unite}</span>}
                            {e.auteur && e.auteur !== 'Moi' && <span>👤 {e.auteur}</span>}
                            {e.notes && <span className="italic">&ldquo;{e.notes}&rdquo;</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-xs text-gray-400 whitespace-nowrap">{labelDate(e.date_operation)}</div>
                        <label className={`cursor-pointer text-base leading-none ${uploadingPhoto === e.id ? 'opacity-40' : ''}`}>
                          <input type="file" accept="image/*" capture="environment" className="hidden"
                            disabled={uploadingPhoto === e.id}
                            onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadPhoto(e.id, f); ev.target.value = '' }} />
                          📷
                        </label>
                      </div>
                    </div>
                    {((e.photos && e.photos.length > 0) || pendingPhotos[e.id]?.length > 0) && (
                      <div className="flex gap-2 flex-wrap pl-8">
                        {e.photos?.map((p: CahierPhoto) => (
                          <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                            <img src={p.url} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                          </a>
                        ))}
                        {pendingPhotos[e.id]?.map((url, i) => (
                          <div key={`pending-${i}`} className="relative">
                            <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border-2 border-amber-400 opacity-80" />
                            <span className="absolute top-0.5 right-0.5 text-[8px] bg-amber-500 text-white rounded px-1 leading-tight">⏳</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Vue : traitements groupés par zone */}
          {filtre === 'traitements' && (() => {
            const trts = entrees.filter(e => e.type_operation === 'traitement')
            if (trts.length === 0) return (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                Aucun traitement enregistré
              </div>
            )
            // Grouper par zone
            const parZone = new Map<string, EntreeCahier[]>()
            for (const e of trts) {
              const key = (e.zone as { nom: string } | null)?.nom || 'Sans zone'
              if (!parZone.has(key)) parZone.set(key, [])
              parZone.get(key)!.push(e)
            }
            return (
              <div className="divide-y divide-gray-100">
                {Array.from(parZone.entries()).map(([zone, items]) => (
                  <div key={zone}>
                    <div className="px-4 py-1.5 bg-amber-50 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                      📍 {zone}
                    </div>
                    {items.map(e => (
                      <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-2 border-t border-amber-50">
                        <div>
                          <div className="text-sm font-semibold text-gray-800">
                            🌿 {e.produit ? (e.produit as { nom: string }).nom : 'Traitement'}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-2">
                            {e.quantite && <span>{e.quantite} {e.unite}</span>}
                            {e.auteur && e.auteur !== 'Moi' && <span>👤 {e.auteur}</span>}
                            {e.notes && <span className="italic">&ldquo;{e.notes}&rdquo;</span>}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 whitespace-nowrap">{labelDate(e.date_operation)}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ─── Tab : Agenda ──────────────────────────────────────────────────────────────

function AgendaTab({ taches, zones, catalogueTaches, zoneTaches, onSaved }: {
  taches: Tache[]; zones: Zone[]
  catalogueTaches: TacheCatalogue[]; zoneTaches: ZoneTacheCat[]
  onSaved: () => void
}) {
  const [ajout, setAjout]       = useState(false)
  const [titre, setTitre]       = useState('')
  const [type, setType]         = useState<'ponctuelle' | 'recurrente'>('ponctuelle')
  const [frequence, setFreq]    = useState<string[]>([])
  const [echeance, setEch]      = useState(format(new Date(), 'yyyy-MM-dd'))
  const [zoneIds, setZoneIds]   = useState<string[]>([])
  const [priorite, setPrio]     = useState('normale')
  const [saving, setSaving]     = useState(false)
  const [auteur] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('terrain_auteur') || 'Antoine' : 'Antoine'
  )
  const [tempsOuvert, setTempsOuvert] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(iv)
  }, [])
  void tick

  const aujTaches    = taches.filter(t => tacheEstAujourdHui(t))
  const autresTaches = taches.filter(t => !tacheEstAujourdHui(t))

  function tempsAujourdHui(t: Tache): TempsTache | undefined {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    return t.temps?.find(x => x.date === todayStr && x.auteur === auteur)
  }

  async function demarrerChrono(t: Tache) {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const existant = tempsAujourdHui(t)
    const payload = { tache_id: t.id, date: todayStr, auteur, minutes: existant?.minutes || 0, chrono_debut: new Date().toISOString() }
    if (!navigator.onLine) {
      await queueMutation({ table: 'taches_temps', method: 'upsert', payload, onConflict: 'tache_id,date,auteur' })
    } else {
      await supabase.from('taches_temps').upsert(payload, { onConflict: 'tache_id,date,auteur' })
    }
    onSaved()
  }

  async function arreterChrono(t: Tache) {
    const tt = tempsAujourdHui(t)
    if (!tt?.chrono_debut) return
    const ecoule = Math.max(1, Math.round((Date.now() - new Date(tt.chrono_debut).getTime()) / 60000))
    const payload = { tache_id: t.id, date: tt.date, auteur, minutes: tt.minutes + ecoule, chrono_debut: null }
    if (!navigator.onLine) {
      await queueMutation({ table: 'taches_temps', method: 'upsert', payload, onConflict: 'tache_id,date,auteur' })
    } else {
      await supabase.from('taches_temps').upsert(payload, { onConflict: 'tache_id,date,auteur' })
    }
    onSaved()
  }

  async function ajouterTempsManuel(t: Tache, minutes: number) {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const existant = tempsAujourdHui(t)
    const payload = { tache_id: t.id, date: todayStr, auteur, minutes: (existant?.minutes || 0) + minutes, chrono_debut: existant?.chrono_debut || null }
    if (!navigator.onLine) {
      await queueMutation({ table: 'taches_temps', method: 'upsert', payload, onConflict: 'tache_id,date,auteur' })
    } else {
      await supabase.from('taches_temps').upsert(payload, { onConflict: 'tache_id,date,auteur' })
    }
    onSaved()
  }

  async function cocher(t: Tache) {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    if (tacheEstCompleteeAujourdHui(t)) {
      if (!navigator.onLine) {
        await queueMutation({ table: 'taches_completions', method: 'delete', payload: {}, matchCol: 'tache_id', matchVal: t.id })
      } else {
        await supabase.from('taches_completions').delete()
          .eq('tache_id', t.id).eq('date_completion', todayStr)
      }
    } else {
      const payload = { tache_id: t.id, date_completion: todayStr }
      if (!navigator.onLine) {
        await queueMutation({ table: 'taches_completions', method: 'upsert', payload, onConflict: 'tache_id,date_completion' })
      } else {
        await supabase.from('taches_completions').upsert(payload, { onConflict: 'tache_id,date_completion' })
      }
    }
    onSaved()
  }

  async function supprimer(id: string) {
    if (!navigator.onLine) {
      await queueMutation({ table: 'taches', method: 'update', payload: { actif: false }, matchCol: 'id', matchVal: id })
    } else {
      await supabase.from('taches').update({ actif: false }).eq('id', id)
    }
    onSaved()
  }

  async function sauvegarder() {
    if (!titre.trim()) return
    setSaving(true)
    const zids = zoneIds.length > 0 ? zoneIds : [null]
    if (!navigator.onLine) {
      await Promise.all(zids.map(zid =>
        queueMutation({ table: 'taches', method: 'insert', payload: { titre: titre.trim(), type, frequence: type === 'recurrente' ? frequence.join(',') || 'quotidien' : null, date_echeance: type === 'ponctuelle' ? echeance : null, zone_id: zid, priorite } })
      ))
    } else {
      await Promise.all(zids.map(zid =>
        supabase.from('taches').insert({
          titre: titre.trim(), type,
          frequence: type === 'recurrente' ? frequence.join(',') || 'quotidien' : null,
          date_echeance: type === 'ponctuelle' ? echeance : null,
          zone_id: zid, priorite,
        })
      ))
    }
    await ajouterAuCatalogueSiNouveau(titre, catalogueTaches)
    setSaving(false); setAjout(false)
    setTitre(''); setType('ponctuelle'); setFreq([]); setPrio('normale'); setZoneIds([])
    onSaved()
  }

  function toggleJour(j: string) {
    setFreq(prev => prev.includes(j) ? prev.filter(x => x !== j) : [...prev, j])
  }

  function toggleZoneAgenda(zid: string) {
    setZoneIds(prev => prev.includes(zid) ? prev.filter(x => x !== zid) : [...prev, zid])
  }

  const chipsAgenda = zoneIds.length === 1
    ? catalogueTaches.filter(c => zoneTaches.some(zt => zt.zone_id === zoneIds[0] && zt.catalogue_id === c.id))
    : catalogueTaches.slice(0, 8)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-green-200 overflow-hidden">
        <div className="px-4 py-3 bg-green-700 text-white font-bold text-sm flex justify-between items-center">
          <span>Aujourd'hui</span>
          <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {aujTaches.filter(t => !tacheEstCompleteeAujourdHui(t)).length} restantes
          </span>
        </div>
        <div className="divide-y divide-green-100">
          {aujTaches.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Aucune tache aujourd'hui</div>
          )}
          {aujTaches.map(t => {
            const faite = tacheEstCompleteeAujourdHui(t)
            const zone  = zones.find(z => z.id === t.zone_id)
            const tt = tempsAujourdHui(t)
            const enChrono = !!tt?.chrono_debut
            const chronoMin = enChrono && tt
              ? Math.max(0, Math.floor((Date.now() - new Date(tt.chrono_debut!).getTime()) / 60000)) + tt.minutes
              : null
            return (
              <div key={t.id} className={`px-4 py-3 ${faite ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button onClick={() => cocher(t)}
                    className={`mt-0.5 w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 active:scale-95 transition-all
                      ${faite ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 bg-white'}`}>
                    {faite && '✓'}
                  </button>

                  {/* Titre + badge chrono */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`flex-1 text-sm font-semibold leading-snug ${faite ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {t.titre}
                      </span>
                      {/* Badge chrono — toujours visible sur la ligne du titre */}
                      {enChrono ? (
                        <button onClick={() => arreterChrono(t)}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white text-xs font-bold active:scale-95 transition-transform shadow-sm">
                          ⏱ {formatDuree(chronoMin || 0)} ⏹
                        </button>
                      ) : (tt?.minutes ?? 0) > 0 ? (
                        <button onClick={() => setTempsOuvert(tempsOuvert === t.id ? null : t.id)}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold active:scale-95 transition-transform">
                          ⏱ {formatDuree(tt!.minutes)}
                        </button>
                      ) : (
                        <button onClick={() => setTempsOuvert(tempsOuvert === t.id ? null : t.id)}
                          className="shrink-0 px-2.5 py-1 rounded-full border border-gray-200 text-gray-400 text-xs active:scale-95 transition-transform">
                          ⏱
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-2">
                      {zone && <span>{zone.type === 'serre' ? '🪴' : '📍'} {zone.nom}</span>}
                      <span className={`px-1.5 py-0.5 rounded-full border text-[10px] ${prioriteColor(t.priorite)}`}>
                        {t.priorite}
                      </span>
                      {t.type === 'recurrente' && <span>🔁 {t.frequence}</span>}
                    </div>
                  </div>

                  <button onClick={() => supprimer(t.id)} className="text-gray-300 active:text-red-400 text-lg leading-none mt-0.5 shrink-0">×</button>
                </div>

                {/* Panneau temps — s'affiche sous la ligne quand le badge est tappé */}
                {tempsOuvert === t.id && !enChrono && (
                  <div className="mt-2 ml-10 flex items-center gap-2 flex-wrap">
                    <button onClick={() => { demarrerChrono(t); setTempsOuvert(null) }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold active:scale-95 transition-transform">
                      ▶️ Démarrer le chrono
                    </button>
                    {[5, 15, 30, 60].map(m => (
                      <button key={m} onClick={() => { ajouterTempsManuel(t, m); setTempsOuvert(null) }}
                        className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold active:scale-95 transition-transform">
                        +{m} min
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <button onClick={() => setAjout(!ajout)}
        className="w-full bg-green-700 text-white py-3.5 rounded-xl font-bold text-base active:scale-95 transition-transform">
        {ajout ? 'Annuler' : '+ Ajouter une tache'}
      </button>

      {ajout && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          {chipsAgenda.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400">
                Suggestions{zoneIds.length === 1 ? ` - ${zones.find(z => z.id === zoneIds[0])?.nom}` : ''}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {chipsAgenda.map(c => (
                  <button key={c.id} onClick={() => setTitre(c.titre)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                      ${titre === c.titre
                        ? 'bg-green-700 text-white border-green-700'
                        : 'bg-green-50 text-green-800 border-green-200'}`}>
                    {c.icone} {c.titre}
                  </button>
                ))}
              </div>
            </div>
          )}

          <input value={titre} onChange={e => setTitre(e.target.value)}
            placeholder="Titre de la tache..."
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base font-semibold focus:outline-none focus:border-green-400"
          />

          <div className="flex gap-2">
            {(['ponctuelle', 'recurrente'] as const).map(v => (
              <button key={v} onClick={() => setType(v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border active:scale-95 transition-transform
                  ${type === v ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {v === 'ponctuelle' ? '📅 Ponctuelle' : '🔁 Recurrente'}
              </button>
            ))}
          </div>

          {type === 'ponctuelle' ? (
            <input type="date" value={echeance} onChange={e => setEch(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500">Frequence</div>
              <div className="grid grid-cols-4 gap-1.5">
                <button onClick={() => setFreq(f => f.includes('quotidien') ? [] : ['quotidien'])}
                  className={`py-2 rounded-lg text-xs font-semibold border col-span-2 active:scale-95 transition-transform
                    ${frequence.includes('quotidien') ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  Tous les jours
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

          {/* Zone multi-select */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-gray-500">
              Zone(s) — {zoneIds.length === 0 ? 'aucune' : `${zoneIds.length} selectionnee${zoneIds.length > 1 ? 's' : ''}`}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {zones.filter(z => z.type !== 'serre').map(z => (
                <button key={z.id} onClick={() => toggleZoneAgenda(z.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                    ${zoneIds.includes(z.id) ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                  📍 {z.nom}
                </button>
              ))}
              {zones.filter(z => z.type === 'serre').map(z => (
                <button key={z.id} onClick={() => toggleZoneAgenda(z.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                    ${zoneIds.includes(z.id) ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  🪴 {z.nom}
                </button>
              ))}
            </div>
            {zoneIds.length > 1 && (
              <div className="text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                {zoneIds.length} taches seront creees, une par zone
              </div>
            )}
          </div>

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
            {saving ? 'Enregistrement...' : zoneIds.length > 1
              ? `Creer ${zoneIds.length} taches`
              : 'Enregistrer la tache'}
          </button>
        </div>
      )}

      {autresTaches.length > 0 && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 font-bold text-sm text-gray-700 border-b border-gray-100">
            Toutes les taches
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
                      {zone && <span>{zone.type === 'serre' ? '🪴' : '📍'} {zone.nom}</span>}
                      <span className={`px-1.5 py-0.5 rounded-full border text-[10px] ${prioriteColor(t.priorite)}`}>
                        {t.priorite}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => supprimer(t.id)} className="text-gray-300 active:text-red-400 text-lg leading-none mt-0.5">x</button>
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
  const [ajoutZone, setAjoutZone]       = useState(false)
  const [nomZone, setNomZone]           = useState('')
  const [typeZone, setTypeZone]         = useState('plein_champ')
  const [supZone, setSupZone]           = useState('')
  const [ajoutPlanche, setAjoutPlanche] = useState<string | null>(null)
  const [nomPlanche, setNomPlanche]     = useState('')
  const [longueurP, setLongueurP]       = useState('')
  const [largeurP, setLargeurP]         = useState('')
  const [plantsPm2P, setPlantsPm2P]     = useState('')
  const [saving, setSaving]             = useState(false)

  async function ajouterZone() {
    if (!nomZone.trim()) return
    setSaving(true)
    await supabase.from('zones').insert({
      nom: nomZone.trim(), type: typeZone,
      superficie_m2: supZone ? parseFloat(supZone) : null,
      ordre: zones.length + 1,
    })
    setSaving(false); setAjoutZone(false); setNomZone(''); setSupZone(''); onSaved()
  }

  async function supprimerZone(id: string) {
    await supabase.from('zones').update({ actif: false }).eq('id', id); onSaved()
  }

  async function ajouterPlanche(zoneId: string) {
    if (!nomPlanche.trim()) return
    setSaving(true)
    await supabase.from('zone_planches').insert({
      zone_id: zoneId, nom: nomPlanche.trim(),
      longueur_m:    longueurP  ? parseFloat(longueurP)  : null,
      largeur_m:     largeurP   ? parseFloat(largeurP)   : null,
      plants_par_m2: plantsPm2P ? parseInt(plantsPm2P)   : null,
      ordre: planches.filter(p => p.zone_id === zoneId).length + 1,
    })
    setSaving(false); setAjoutPlanche(null)
    setNomPlanche(''); setLongueurP(''); setLargeurP(''); setPlantsPm2P('')
    onSaved()
  }

  async function supprimerPlanche(id: string) {
    await supabase.from('zone_planches').delete().eq('id', id); onSaved()
  }

  const zonesChamp = zones.filter(z => z.type !== 'serre')
  const zonesSerre = zones.filter(z => z.type === 'serre')

  function renderZone(z: Zone) {
    const pls = planches.filter(p => p.zone_id === z.id)
    const isSerre = z.type === 'serre'
    return (
      <div key={z.id} className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className={`px-4 py-3 flex items-center justify-between ${isSerre ? 'bg-amber-50' : 'bg-green-50'}`}>
          <div>
            <span className={`font-bold text-base ${isSerre ? 'text-amber-900' : 'text-green-900'}`}>
              {isSerre ? '🪴 ' : ''}{z.nom}
            </span>
            <span className="ml-2 text-xs text-gray-500 capitalize">{z.type.replace('_', ' ')}</span>
            {z.superficie_m2 && <span className="ml-2 text-xs text-gray-400">{z.superficie_m2} m2</span>}
          </div>
          <button onClick={() => supprimerZone(z.id)} className="text-gray-300 active:text-red-400 text-lg leading-none">x</button>
        </div>

        {pls.length > 0 && (
          <div className="divide-y divide-gray-100">
            {pls.map(p => {
              const surface  = p.longueur_m && p.largeur_m ? (p.longueur_m * p.largeur_m).toFixed(1) : null
              const capacite = surface && p.plants_par_m2 ? Math.round(parseFloat(surface) * p.plants_par_m2) : null
              return (
                <div key={p.id} className="px-4 py-3 flex items-start justify-between text-sm">
                  <div>
                    <span className="text-gray-700 font-semibold">{p.nom}</span>
                    <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-2">
                      {p.longueur_m && p.largeur_m && (
                        <span>{p.longueur_m}m x {p.largeur_m}m = {surface} m2</span>
                      )}
                      {p.plants_par_m2 && <span>{p.plants_par_m2} plants/m2</span>}
                      {capacite && <span className="text-green-700 font-semibold">= {capacite} plants</span>}
                    </div>
                  </div>
                  <button onClick={() => supprimerPlanche(p.id)} className="text-gray-300 active:text-red-400 text-base mt-0.5">x</button>
                </div>
              )
            })}
          </div>
        )}

        {ajoutPlanche === z.id ? (
          <div className="px-4 py-3 border-t border-gray-100 space-y-2">
            <input value={nomPlanche} onChange={e => setNomPlanche(e.target.value)}
              placeholder="Nom (ex: Planche A)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
            />
            <div className="grid grid-cols-3 gap-2">
              <input value={longueurP} onChange={e => setLongueurP(e.target.value)}
                placeholder="Long. m" type="number" inputMode="decimal"
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-green-400"
              />
              <input value={largeurP} onChange={e => setLargeurP(e.target.value)}
                placeholder="Larg. m" type="number" inputMode="decimal"
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-green-400"
              />
              <input value={plantsPm2P} onChange={e => setPlantsPm2P(e.target.value)}
                placeholder="Plants/m2" type="number" inputMode="numeric"
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-green-400"
              />
            </div>
            {longueurP && largeurP && plantsPm2P && (
              <div className="text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                {(parseFloat(longueurP) * parseFloat(largeurP)).toFixed(1)} m2 x {plantsPm2P} = {Math.round(parseFloat(longueurP) * parseFloat(largeurP) * parseInt(plantsPm2P))} plants
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => ajouterPlanche(z.id)} disabled={saving || !nomPlanche.trim()}
                className="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm font-semibold active:scale-95 disabled:opacity-50">
                Ajouter
              </button>
              <button onClick={() => { setAjoutPlanche(null); setNomPlanche(''); setLongueurP(''); setLargeurP(''); setPlantsPm2P('') }}
                className="text-gray-400 px-3 py-2 text-sm">Annuler</button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setAjoutPlanche(z.id); setNomPlanche('') }}
            className="w-full px-4 py-2.5 text-sm text-green-700 font-semibold border-t border-gray-100 text-left active:bg-green-50 transition-colors">
            + Ajouter une planche
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Section Serre — separee et mise en avant */}
      {zonesSerre.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wider px-1">🪴 Serre</div>
          {zonesSerre.map(renderZone)}
        </div>
      )}

      {/* Section Plein champ */}
      <div className="space-y-2">
        {zonesSerre.length > 0 && (
          <div className="text-xs font-bold text-green-700 uppercase tracking-wider px-1 mt-2">🌾 Plein champ</div>
        )}
        {zonesChamp.map(renderZone)}
      </div>

      {ajoutZone ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <input value={nomZone} onChange={e => setNomZone(e.target.value)}
            placeholder="Nom de la zone (ex: J6, Serre 2...)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-green-400"
          />
          <div className="flex gap-2">
            {[['plein_champ', '🌾 Plein champ'], ['serre', '🪴 Serre'], ['jardin', '🌻 Jardin']].map(([v, l]) => (
              <button key={v} onClick={() => setTypeZone(v)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border active:scale-95 transition-transform
                  ${typeZone === v ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {l}
              </button>
            ))}
          </div>
          <input value={supZone} onChange={e => setSupZone(e.target.value)}
            placeholder="Superficie m2 (optionnel)" type="number" inputMode="decimal"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
          />
          <div className="flex gap-2">
            <button onClick={ajouterZone} disabled={saving || !nomZone.trim()}
              className="flex-1 bg-green-700 text-white py-3 rounded-xl font-bold active:scale-95 disabled:opacity-50">
              Ajouter
            </button>
            <button onClick={() => { setAjoutZone(false); setNomZone('') }}
              className="px-4 py-3 text-gray-500 font-semibold">Annuler</button>
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
    const payload = { designation: designation.trim(), espece_id: especeId || null, quantite, unite, raison, notes: notes || null }
    if (!navigator.onLine) {
      await queueMutation({ table: 'pertes', method: 'insert', payload })
    } else {
      await supabase.from('pertes').insert(payload)
    }
    setSaving(false)
    setDesignation(''); setEspeceId(''); setQuantite(1); setRaison(''); setNotes(''); setRecherche('')
    onSaved()
  }

  const maintenant = new Date()
  const ce_mois = pertes.filter(p => {
    const d = parseISO(p.date_perte)
    return d.getMonth() === maintenant.getMonth() && d.getFullYear() === maintenant.getFullYear()
  })
  const parRaison = RAISONS_PERTE.map(r => ({
    ...r, count: ce_mois.filter(p => p.raison === r.val).reduce((s, p) => s + p.quantite, 0)
  })).filter(r => r.count > 0).sort((a, b) => b.count - a.count)

  const especesFiltrees = especes.filter(e => e.nom.toLowerCase().includes(recherche.toLowerCase()))

  return (
    <div className="space-y-4">
      {ce_mois.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="text-sm font-bold text-red-800 mb-2">
            Ce mois : {ce_mois.reduce((s, p) => s + p.quantite, 0)} unites perdues
          </div>
          {parRaison.map(r => (
            <div key={r.val} className="flex items-center gap-2 text-xs text-red-700 mt-1">
              <span>{r.icon}</span><span>{r.label}</span>
              <span className="ml-auto font-bold">{r.count}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-red-600 text-white font-bold text-sm">Enregistrer une perte</div>
        <div className="p-4 space-y-4">
          <input value={designation} onChange={e => setDesignation(e.target.value)}
            placeholder="Produit perdu (ex: Radis barquettes)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400"
          />
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500">Espece liee (optionnel)</div>
            <input value={recherche} onChange={e => setRecherche(e.target.value)}
              placeholder="Filtrer..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              <button onClick={() => setEspeceId('')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                  ${!especeId ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                Sans espece
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
          <div className="flex items-center justify-center py-1">
            <Stepper value={quantite} onChange={setQuantite} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['barquettes','kg','plateaux','L','pieces'].map(u => (
              <button key={u} onClick={() => setUnite(u)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border active:scale-95 transition-transform
                  ${unite === u ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {u}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {RAISONS_PERTE.map(r => (
              <button key={r.val} onClick={() => setRaison(r.val)}
                className={`py-3 rounded-xl border text-sm font-semibold flex items-center gap-2 px-3 active:scale-95 transition-transform
                  ${raison === r.val ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                <span>{r.icon}</span> {r.label}
              </button>
            ))}
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Note optionnelle..." rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none" />
          <button onClick={sauvegarder} disabled={saving || !designation.trim() || !raison}
            className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-base active:scale-95 transition-transform disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Enregistrer la perte'}
          </button>
        </div>
      </div>

      {pertes.length > 0 && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 font-bold text-sm text-gray-700 border-b border-gray-100">
            Historique
          </div>
          <div className="divide-y divide-gray-100">
            {pertes.map(p => {
              const r = RAISONS_PERTE.find(x => x.val === p.raison)
              return (
                <div key={p.id} className="px-4 py-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{r?.icon} {p.designation}</div>
                    <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-2">
                      <span>{p.quantite} {p.unite}</span><span>{r?.label}</span>
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

// ─── Tab : Heures ──────────────────────────────────────────────────────────────

function HeuresTab({ taches, entrees, zones, pointages, onSaved }: {
  taches: Tache[]; entrees: EntreeCahier[]; zones: Zone[]
  pointages: Pointage[]; onSaved: () => void
}) {
  const [auteur, setAuteur] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('terrain_auteur') || 'Antoine' : 'Antoine'
  )
  const [dateVue, setDateVue] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [arrivee, setArrivee] = useState('')
  const [depart, setDepart]   = useState('')
  const [pause, setPause]     = useState(0)
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [modifManu, setModifManu] = useState(false)
  const [pauseDebut, setPauseDebut] = useState<string | null>(null)
  const [tick, setTick]       = useState(0)

  const pauseKey = `pointage_pause_${auteur}_${dateVue}`
  const pointage = pointages.find(p => p.auteur === auteur && p.date === dateVue)
  const isAujourdHui = dateVue === format(new Date(), 'yyyy-MM-dd')

  // Charge pauseDebut depuis localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') setPauseDebut(localStorage.getItem(pauseKey))
  }, [pauseKey])

  // Sync champs quand le pointage change
  useEffect(() => {
    setArrivee(pointage?.heure_arrivee?.slice(0, 5) || '')
    setDepart(pointage?.heure_depart?.slice(0, 5) || '')
    setPause(pointage?.pause_minutes || 0)
    setNotes(pointage?.notes || '')
    setModifManu(false)
  }, [auteur, dateVue, pointage?.id])

  // Timer live (mise à jour toutes les 30s)
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(iv)
  }, [])

  // États dérivés
  const enCours    = !!arrivee && !depart && isAujourdHui
  const enPause    = enCours && !!pauseDebut
  const terminee   = !!arrivee && !!depart
  const totalMin   = terminee ? calcMinutes(arrivee, depart) - pause : null

  // Chrono live (minutes depuis l'arrivée, moins les pauses déjà validées)
  let chronoMin: number | null = null
  if (enCours && !enPause) {
    const [ah, am] = arrivee.split(':').map(Number)
    chronoMin = Math.floor((Date.now() - new Date().setHours(ah, am, 0, 0)) / 60000) - pause
  }
  let pauseElapsedMin: number | null = null
  if (enPause && pauseDebut) {
    pauseElapsedMin = Math.floor((Date.now() - new Date(pauseDebut).getTime()) / 60000)
  }

  async function sauvegarderAvec(updates: {
    heure_arrivee?: string | null; heure_depart?: string | null
    pause_minutes?: number; notes?: string | null
  }) {
    setSaving(true)
    const payload = {
      date: dateVue, auteur,
      heure_arrivee:  updates.heure_arrivee  !== undefined ? updates.heure_arrivee  : (arrivee || null),
      heure_depart:   updates.heure_depart   !== undefined ? updates.heure_depart   : (depart || null),
      pause_minutes:  updates.pause_minutes  !== undefined ? updates.pause_minutes  : pause,
      notes:          updates.notes          !== undefined ? updates.notes          : (notes || null),
    }
    if (!navigator.onLine) {
      await queueMutation({ table: 'pointages', method: 'upsert', payload, onConflict: 'date,auteur' })
    } else {
      await supabase.from('pointages').upsert(payload, { onConflict: 'date,auteur' })
    }
    setSaving(false); onSaved()
  }

  async function pointer(type: 'arrivee' | 'depart') {
    const h = format(new Date(), 'HH:mm')
    if (type === 'arrivee') { setArrivee(h); await sauvegarderAvec({ heure_arrivee: h }) }
    else                    { setDepart(h);  await sauvegarderAvec({ heure_depart: h }) }
  }

  function debutPause_fn() {
    const iso = new Date().toISOString()
    localStorage.setItem(pauseKey, iso)
    setPauseDebut(iso)
  }

  async function finPause_fn() {
    if (!pauseDebut) return
    const mins = Math.max(1, Math.round((Date.now() - new Date(pauseDebut).getTime()) / 60000))
    const nouvPause = pause + mins
    localStorage.removeItem(pauseKey)
    setPauseDebut(null)
    setPause(nouvPause)
    await sauvegarderAvec({ pause_minutes: nouvPause })
  }

  async function sauvegarderManu() {
    await sauvegarderAvec({ heure_arrivee: arrivee || null, heure_depart: depart || null, pause_minutes: pause, notes: notes || null })
    setModifManu(false)
  }

  function ajouterTachesAuxNotes() {
    const lignes = tachesJour.map(t => {
      const tt = t.temps?.find(x => x.date === dateVue && x.auteur === auteur)
      const dureeTxt = tt?.minutes ? ` (${formatDuree(tt.minutes)})` : ''
      return `- ${t.titre}${dureeTxt}`
    })
    if (lignes.length === 0) return
    setNotes(prev => (prev ? prev + '\n' : '') + lignes.join('\n'))
    setModifManu(true)
  }

  function aller(delta: number) {
    setDateVue(format(addDays(parseISO(dateVue), delta), 'yyyy-MM-dd'))
  }

  const semaine = Array.from({ length: 7 }, (_, i) => {
    const d = format(addDays(new Date(), i - 6), 'yyyy-MM-dd')
    const p = pointages.find(pt => pt.auteur === auteur && pt.date === d)
    let mins: number | null = null
    if (p?.heure_arrivee && p?.heure_depart) {
      mins = calcMinutes(p.heure_arrivee.slice(0, 5), p.heure_depart.slice(0, 5)) - (p.pause_minutes || 0)
    }
    return { date: d, mins }
  })
  const totalSemaine = semaine.reduce((s, d) => s + (d.mins && d.mins > 0 ? d.mins : 0), 0)
  const tachesJour   = taches.filter(t => (t.completions || []).some(c => c.date_completion === dateVue))
  const entreesJour  = entrees.filter(e => e.date_operation === dateVue)
  const TYPES_OP_ALL = [...TYPES_OP_CHAMP, ...TYPES_OP_SERRE]

  // Void reference to suppress unused-var warning for tick
  void tick

  return (
    <div className="space-y-4">

      {/* Qui */}
      <div className="flex gap-2">
        {['Antoine', 'Lucas'].map(a => (
          <button key={a}
            onClick={() => { setAuteur(a); if (typeof window !== 'undefined') localStorage.setItem('terrain_auteur', a) }}
            className={`flex-1 py-3.5 rounded-2xl font-bold text-base border-2 active:scale-95 transition-transform
              ${auteur === a ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
            👤 {a}
          </button>
        ))}
      </div>

      {/* Navigation date */}
      <div className="flex items-center gap-2">
        <button onClick={() => aller(-1)}
          className="w-11 h-11 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 font-bold active:bg-gray-100 text-lg">←</button>
        <div className="flex-1 text-center">
          <div className="font-bold text-gray-800 capitalize text-base">
            {isAujourdHui ? "Aujourd'hui" : format(parseISO(dateVue), 'EEEE d MMMM', { locale: fr })}
          </div>
          {!isAujourdHui && (
            <button onClick={() => setDateVue(format(new Date(), 'yyyy-MM-dd'))}
              className="text-xs text-green-700 font-semibold">Revenir a aujourd'hui</button>
          )}
        </div>
        <button onClick={() => aller(1)} disabled={isAujourdHui}
          className="w-11 h-11 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 font-bold active:bg-gray-100 text-lg disabled:opacity-30">→</button>
      </div>

      {/* ── Pointage rapide (aujourd'hui uniquement) ── */}
      {isAujourdHui && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-green-900 text-white font-bold text-sm flex items-center justify-between">
            <span>⏱️ Pointage</span>
            {saving && <span className="text-[11px] text-green-300 font-normal">Sauvegarde...</span>}
          </div>
          <div className="p-4 space-y-3">

            {/* État : pas encore arrivé */}
            {!arrivee && (
              <button onClick={() => pointer('arrivee')} disabled={saving}
                className="w-full py-5 rounded-2xl bg-green-600 text-white font-bold text-xl active:scale-95 transition-transform disabled:opacity-50 shadow-md">
                🟢 Pointer l'arrivée
              </button>
            )}

            {/* État : en cours de travail */}
            {enCours && !enPause && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-4 text-center">
                  <div className="text-xs text-green-600 font-semibold uppercase tracking-wide">En cours depuis {arrivee}</div>
                  <div className="text-4xl font-bold text-green-800 mt-1">
                    {chronoMin !== null && chronoMin > 0 ? formatDuree(chronoMin) : '—'}
                  </div>
                  {pause > 0 && <div className="text-xs text-gray-400 mt-1">dont {pause}min de pause déjà validée</div>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={debutPause_fn} disabled={saving}
                    className="py-4 rounded-2xl bg-amber-500 text-white font-bold text-base active:scale-95 transition-transform disabled:opacity-50">
                    ☕ Début pause
                  </button>
                  <button onClick={() => pointer('depart')} disabled={saving}
                    className="py-4 rounded-2xl bg-red-500 text-white font-bold text-base active:scale-95 transition-transform disabled:opacity-50">
                    🔴 Fin journée
                  </button>
                </div>
              </>
            )}

            {/* État : en pause */}
            {enPause && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 text-center">
                  <div className="text-xs text-amber-600 font-semibold uppercase tracking-wide">☕ En pause</div>
                  <div className="text-4xl font-bold text-amber-700 mt-1">
                    {pauseElapsedMin !== null ? formatDuree(pauseElapsedMin) : '—'}
                  </div>
                </div>
                <button onClick={finPause_fn} disabled={saving}
                  className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-xl active:scale-95 transition-transform disabled:opacity-50">
                  ▶️ Reprendre le travail
                </button>
              </>
            )}

            {/* État : journée terminée */}
            {terminee && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500">
                      🟢 {arrivee} → 🔴 {depart}
                      {pause > 0 && <span className="ml-2">☕ {pause}min de pause</span>}
                    </div>
                    {totalMin !== null && totalMin > 0 && (
                      <div className="text-2xl font-bold text-green-800">{formatDuree(totalMin)} travaillées</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Lien modifier manuellement */}
            {(arrivee || !isAujourdHui) && (
              <button onClick={() => setModifManu(m => !m)}
                className="w-full text-xs text-gray-400 text-center py-1 underline">
                {modifManu ? 'Masquer' : '✏️ Modifier manuellement'}
              </button>
            )}

            {/* Formulaire manuel (toujours visible si pas aujourd'hui) */}
            {(modifManu || !isAujourdHui) && (
              <div className="space-y-3 pt-1 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-gray-500">Arrivée</div>
                    <input type="time" value={arrivee} onChange={e => setArrivee(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-2 py-2.5 text-base font-bold text-center focus:outline-none focus:border-green-400" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-gray-500">Départ</div>
                    <input type="time" value={depart} onChange={e => setDepart(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-2 py-2.5 text-base font-bold text-center focus:outline-none focus:border-green-400" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-gray-500">Pause (min)</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[0, 15, 30, 45, 60, 90].map(m => (
                      <button key={m} onClick={() => setPause(m)}
                        className={`px-3 h-9 rounded-lg text-xs font-bold border active:scale-95 transition-transform
                          ${pause === m ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {m}min
                      </button>
                    ))}
                  </div>
                </div>
                {arrivee && depart && calcMinutes(arrivee, depart) - pause > 0 && (
                  <div className="text-center text-sm font-bold text-green-700">
                    = {formatDuree(calcMinutes(arrivee, depart) - pause)} travaillées
                  </div>
                )}
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Notes du jour..." rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 resize-none" />
                <button onClick={sauvegarderManu} disabled={saving}
                  className="w-full bg-green-700 text-white py-3.5 rounded-xl font-bold text-base active:scale-95 transition-transform disabled:opacity-50">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pointage passé (jours précédents) */}
      {!isAujourdHui && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-green-900 text-white font-bold text-sm">Pointage</div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-gray-500">Arrivée</div>
                <input type="time" value={arrivee} onChange={e => setArrivee(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-2 py-2.5 text-base font-bold text-center focus:outline-none focus:border-green-400" />
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-gray-500">Départ</div>
                <input type="time" value={depart} onChange={e => setDepart(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-2 py-2.5 text-base font-bold text-center focus:outline-none focus:border-green-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-500">Pause (min)</div>
              <div className="flex gap-1.5 flex-wrap">
                {[0, 15, 30, 45, 60, 90].map(m => (
                  <button key={m} onClick={() => setPause(m)}
                    className={`px-3 h-9 rounded-lg text-xs font-bold border active:scale-95 transition-transform
                      ${pause === m ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {m}min
                  </button>
                ))}
              </div>
            </div>
            {totalMin !== null && totalMin > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                <div className="text-3xl font-bold text-green-800">{formatDuree(totalMin)}</div>
              </div>
            )}
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notes du jour..." rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 resize-none" />
            <button onClick={sauvegarderManu} disabled={saving}
              className="w-full bg-green-700 text-white py-3.5 rounded-xl font-bold text-base active:scale-95 transition-transform disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Tâches du jour */}
      {(tachesJour.length > 0 || entreesJour.length > 0) && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2">
            <div>
              <div className="font-bold text-sm text-gray-700">Travaux du jour</div>
              <div className="text-xs text-gray-400">Agenda + Cahier</div>
            </div>
            {tachesJour.length > 0 && (
              <button onClick={ajouterTachesAuxNotes}
                className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1.5 rounded-full shrink-0 active:scale-95 transition-transform">
                📋 Ajouter aux notes
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {tachesJour.map(t => {
              const zone = zones.find(z => z.id === t.zone_id)
              return (
                <div key={t.id} className="px-4 py-3 flex items-start gap-2.5">
                  <span className="text-green-600 text-base mt-0.5 shrink-0">✓</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{t.titre}</div>
                    {zone && <div className="text-xs text-gray-400">{zone.type === 'serre' ? '🪴' : '📍'} {zone.nom}</div>}
                  </div>
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold shrink-0">tâche</span>
                </div>
              )
            })}
            {entreesJour.map(e => {
              const op  = TYPES_OP_ALL.find(t => t.val === e.type_operation)
              const zone = e.zone as { nom: string } | null
              const esp  = e.espece as { nom: string } | null
              return (
                <div key={e.id} className="px-4 py-3 flex items-start gap-2.5">
                  <span className="text-base mt-0.5 shrink-0">{op?.icon || '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">
                      {op?.label || e.type_operation}
                      {esp && <span className="text-gray-500 font-normal"> · {esp.nom}</span>}
                    </div>
                    <div className="text-xs text-gray-400 flex flex-wrap gap-2">
                      {zone && <span>📍 {zone.nom}</span>}
                      {e.quantite && <span>{e.quantite} {e.unite}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-semibold shrink-0">cahier</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Mini semaine */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="font-bold text-sm text-gray-700">7 derniers jours — {auteur}</div>
          {totalSemaine > 0 && (
            <div className="text-green-700 font-bold text-sm">{formatDuree(totalSemaine)} cette sem.</div>
          )}
        </div>
        <div className="px-3 py-3 grid grid-cols-7 gap-1">
          {semaine.map(({ date: d, mins }) => {
            const jour   = parseISO(d)
            const estAuj = d === format(new Date(), 'yyyy-MM-dd')
            const estSel = d === dateVue
            return (
              <button key={d} onClick={() => setDateVue(d)}
                className={`flex flex-col items-center py-2.5 rounded-xl transition-colors
                  ${estSel ? 'bg-green-100 border border-green-300' : 'hover:bg-gray-50'}`}>
                <span className={`text-[10px] font-semibold capitalize ${estAuj ? 'text-green-700' : 'text-gray-400'}`}>
                  {format(jour, 'EEE', { locale: fr }).slice(0, 2)}
                </span>
                <span className={`text-xs font-bold mt-0.5 ${estAuj ? 'text-green-800' : 'text-gray-700'}`}>
                  {format(jour, 'd')}
                </span>
                {mins !== null && mins > 0
                  ? <span className="text-[9px] text-green-700 font-bold mt-0.5">{formatDuree(mins)}</span>
                  : <span className="text-[9px] text-gray-300 mt-1">—</span>
                }
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}
