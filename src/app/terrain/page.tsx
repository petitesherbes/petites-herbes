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
type StatutCulture  = 'semis' | 'pret_planter' | 'en_place' | 'recolte' | 'termine'
type FamilleCulture = 'champs' | 'micro_pousse'
type Culture = {
  id: string; espece: string; nom: string | null; zone_id: string | null
  statut: StatutCulture; famille: FamilleCulture
  date_semis: string | null; date_plantation: string | null
  date_debut_recolte: string | null; date_fin_recolte: string | null
  quantite: string | null; notes: string | null; auteur: string | null; actif: boolean
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

const STATUT_CULT: Record<StatutCulture, { label: string; icon: string; color: string }> = {
  semis:       { label: 'En semis',       icon: '🌱', color: 'bg-yellow-100 text-yellow-800'   },
  pret_planter:{ label: 'Prêt à planter', icon: '🪴', color: 'bg-blue-100 text-blue-800'      },
  en_place:    { label: 'En place',       icon: '🌿', color: 'bg-green-100 text-green-800'     },
  recolte:     { label: 'En récolte',     icon: '🥬', color: 'bg-emerald-100 text-emerald-800' },
  termine:     { label: 'Terminé',        icon: '✅', color: 'bg-gray-100 text-gray-500'       },
}
const STATUT_CULT_MICRO: Record<StatutCulture, { label: string; icon: string; color: string }> = {
  semis:       { label: 'Au noir',         icon: '🌑', color: 'bg-gray-800 text-gray-100'        },
  pret_planter:{ label: 'Au noir',         icon: '🌑', color: 'bg-gray-800 text-gray-100'        },
  en_place:    { label: 'En lumière',      icon: '☀️',  color: 'bg-yellow-100 text-yellow-800'   },
  recolte:     { label: 'Prêt à récolter', icon: '🥬', color: 'bg-emerald-100 text-emerald-800'  },
  termine:     { label: 'Terminé',         icon: '✅', color: 'bg-gray-100 text-gray-500'        },
}
const CHAINE_CULT_CHAMPS: StatutCulture[] = ['semis','pret_planter','en_place','recolte','termine']
const CHAINE_CULT_MICRO:  StatutCulture[] = ['semis','en_place','recolte','termine']
const STATUTS_ACTIFS_CHAMPS: StatutCulture[] = ['semis','pret_planter','en_place','recolte']
const STATUTS_ACTIFS_MICRO:  StatutCulture[] = ['semis','en_place','recolte']

function prochainStatutCulture(c: Culture): StatutCulture | null {
  const chaine = c.famille === 'micro_pousse' ? CHAINE_CULT_MICRO : CHAINE_CULT_CHAMPS
  const idx = chaine.indexOf(c.statut)
  return idx >= 0 && idx < chaine.length - 1 ? chaine[idx + 1] : null
}

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

type Tab = 'cahier' | 'agenda' | 'cultures' | 'zones' | 'pertes' | 'heures'

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
  const [cultures, setCultures]         = useState<Culture[]>([])

  useEffect(() => { charger() }, [])

  async function charger() {
    const [z, pl, ent, ta, pe, esp, esSerre, prod, cat, zt, pts, cult] = await Promise.all([
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
        const { data } = await supabase.from('especes').select('id, nom, jours_noir, jours_pousse, jours_conserv, g_tapis, g_godet, rendement').eq('actif', true).order('nom')
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
      fetchWithCache('cultures', async () => {
        const { data } = await supabase.from('cultures').select('*').neq('actif', false).order('created_at', { ascending: false })
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
    if (cult)           setCultures(cult as unknown as Culture[])
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
          zone_id: zid, actif: true,
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
    { id: 'agenda',   icon: '✅',  label: 'Agenda' },
    { id: 'cahier',   icon: '📖',  label: 'Cahier' },
    { id: 'cultures', icon: '🌾',  label: 'Cultures' },
    { id: 'zones',    icon: '🗺️', label: 'Zones' },
    { id: 'pertes',   icon: '📉',  label: 'Pertes' },
    { id: 'heures',   icon: '⏱️', label: 'Heures' },
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
                  {(() => {
                    const champZones = zones.filter(z => z.type !== 'serre')
                    const allChampIds = champZones.map(z => z.id)
                    const toutLeChampActif = allChampIds.length > 0 && allChampIds.every(id => taskZoneIds.includes(id))
                    return (
                      <button onClick={() => toutLeChampActif
                        ? setTaskZoneIds(prev => prev.filter(id => !allChampIds.includes(id)))
                        : setTaskZoneIds(prev => [...new Set([...prev, ...allChampIds])])}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                          ${toutLeChampActif ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        🌾 Tout le champ
                      </button>
                    )
                  })()}
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

      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)}
            className={`shrink-0 flex-1 min-w-[60px] py-3 flex flex-col items-center gap-0.5 text-xs font-semibold transition-colors
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
        {onglet === 'cultures' && <CulturesTab cultures={cultures} zones={zones} especes={especes} onSaved={charger} />}
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
  const [photoErreur, setPhotoErreur] = useState<{ id: string; msg: string } | null>(null)

  async function uploadPhoto(entreeId: string, file: File) {
    setUploadingPhoto(entreeId)
    setPhotoErreur(null)
    if (!navigator.onLine) {
      const localUrl = await queuePhoto(entreeId, file)
      setPendingPhotos(prev => ({ ...prev, [entreeId]: [...(prev[entreeId] || []), localUrl] }))
      setUploadingPhoto(null)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoErreur({ id: entreeId, msg: 'Photo trop lourde (max 10 Mo)' })
      setUploadingPhoto(null)
      return
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', 'cahier-photos')
    formData.append('path', `${entreeId}/${Date.now()}.${ext}`)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setPhotoErreur({ id: entreeId, msg: json.error ?? `Erreur ${res.status}` })
    } else {
      const { url } = await res.json()
      const { error: insErr } = await supabase.from('cahier_photos').insert({ entree_id: entreeId, url })
      if (insErr) {
        setPhotoErreur({ id: entreeId, msg: `Photo envoyée mais non enregistrée : ${insErr.message}` })
      } else {
        onSaved()
      }
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
                          {uploadingPhoto === e.id ? '⏳' : '📷'}
                        </label>
                      </div>
                    </div>
                    {photoErreur?.id === e.id && (
                      <div className="mx-2 mt-1 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex items-start gap-2">
                        <span className="shrink-0">⚠️</span>
                        <span>{photoErreur.msg}</span>
                        <button onClick={() => setPhotoErreur(null)} className="ml-auto text-red-400 shrink-0">✕</button>
                      </div>
                    )}
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
  const [auteur, setAuteur] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('terrain_auteur') || 'Antoine' : 'Antoine'
  )
  const [editAuteur, setEditAuteur] = useState(false)
  const [auteurDraft, setAuteurDraft] = useState(auteur)
  const [tempsOuvert, setTempsOuvert] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  // ─── Edition inline ───────────────────────────────────────────────────────────
  const [editId,    setEditId]    = useState<string | null>(null)
  const [editTitre, setEditTitre] = useState('')
  const [editType,  setEditType]  = useState<'ponctuelle' | 'recurrente'>('ponctuelle')
  const [editFreq,  setEditFreq]  = useState<string[]>([])
  const [editEch,   setEditEch]   = useState('')
  const [editPrio,  setEditPrio]  = useState('normale')
  const [editSaving, setEditSaving] = useState(false)

  function ouvrirEdit(t: Tache) {
    setEditId(t.id)
    setEditTitre(t.titre)
    setEditType(t.type as 'ponctuelle' | 'recurrente')
    setEditFreq(t.frequence ? t.frequence.split(',').map(s => s.trim()) : [])
    setEditEch(t.date_echeance || format(new Date(), 'yyyy-MM-dd'))
    setEditPrio(t.priorite)
    setTempsOuvert(null)
  }

  async function sauvegarderEdit() {
    if (!editId || !editTitre.trim()) return
    setEditSaving(true)
    const payload = {
      titre: editTitre.trim(),
      type: editType,
      frequence: editType === 'recurrente' ? editFreq.join(',') || 'quotidien' : null,
      date_echeance: editType === 'ponctuelle' ? editEch : null,
      priorite: editPrio,
    }
    if (!navigator.onLine) {
      await queueMutation({ table: 'taches', method: 'update', payload, matchCol: 'id', matchVal: editId })
    } else {
      await supabase.from('taches').update(payload).eq('id', editId)
    }
    setEditId(null)
    setEditSaving(false)
    onSaved()
  }

  function toggleEditJour(j: string) {
    setEditFreq(prev => prev.includes(j) ? prev.filter(x => x !== j) : [...prev, j])
  }

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(iv)
  }, [])
  void tick

  const aujTachesRaw = taches.filter(t => tacheEstAujourdHui(t))
  const aujTaches    = [...aujTachesRaw].sort((a, b) =>
    (tacheEstCompleteeAujourdHui(a) ? 1 : 0) - (tacheEstCompleteeAujourdHui(b) ? 1 : 0)
  )
  const autresTaches = taches.filter(t => !tacheEstAujourdHui(t))

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const tempsParPersonne: Record<string, number> = {}
  aujTaches.forEach(t => {
    (t.temps || []).filter(x => x.date === todayStr).forEach(x => {
      tempsParPersonne[x.auteur] = (tempsParPersonne[x.auteur] || 0) + x.minutes
    })
  })

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
          zone_id: zid, priorite, actif: true,
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
          <div className="flex items-center gap-2">
            <span>Aujourd'hui</span>
            {!editAuteur ? (
              <button onClick={() => { setAuteurDraft(auteur); setEditAuteur(true) }}
                className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                👤 {auteur}
              </button>
            ) : (
              <form onSubmit={e => { e.preventDefault(); const v = auteurDraft.trim(); if (v) { setAuteur(v); localStorage.setItem('terrain_auteur', v) }; setEditAuteur(false) }}
                className="flex items-center gap-1">
                <input autoFocus value={auteurDraft} onChange={e => setAuteurDraft(e.target.value)}
                  className="w-24 text-xs px-2 py-0.5 rounded-full text-gray-800 focus:outline-none" />
                <button type="submit" className="text-white text-xs">✓</button>
              </form>
            )}
          </div>
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
                    {/* Temps des autres personnes */}
                    {(t.temps || []).filter(x => x.date === todayStr && x.auteur !== auteur && x.minutes > 0).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(t.temps || []).filter(x => x.date === todayStr && x.auteur !== auteur && x.minutes > 0).map(x => (
                          <span key={x.auteur} className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-semibold">
                            {x.auteur} {formatDuree(x.minutes)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={() => ouvrirEdit(t)} className="text-gray-300 active:text-blue-400 text-sm leading-none mt-1 shrink-0 px-1">✏️</button>
                  <button onClick={() => supprimer(t.id)} className="text-gray-300 active:text-red-400 text-lg leading-none mt-0.5 shrink-0">×</button>
                </div>

                {/* Formulaire édition inline */}
                {editId === t.id && (
                  <div className="mt-3 ml-10 bg-gray-50 rounded-xl p-3 space-y-3">
                    <input value={editTitre} onChange={e => setEditTitre(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-green-400 bg-white" />
                    <div className="flex gap-2">
                      {(['ponctuelle','recurrente'] as const).map(v => (
                        <button key={v} onClick={() => setEditType(v)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors
                            ${editType === v ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
                          {v === 'ponctuelle' ? '📅 Ponctuelle' : '🔁 Récurrente'}
                        </button>
                      ))}
                    </div>
                    {editType === 'ponctuelle' ? (
                      <input type="date" value={editEch} onChange={e => setEditEch(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white" />
                    ) : (
                      <div className="grid grid-cols-4 gap-1">
                        <button onClick={() => setEditFreq(f => f.includes('quotidien') ? [] : ['quotidien'])}
                          className={`col-span-2 py-2 rounded-lg text-xs font-semibold border transition-colors
                            ${editFreq.includes('quotidien') ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
                          Tous les jours
                        </button>
                        {['lundi','mardi','mercredi','jeudi','vendredi','samedi'].map(j => (
                          <button key={j} onClick={() => toggleEditJour(j)}
                            className={`py-2 rounded-lg text-xs font-semibold border capitalize transition-colors
                              ${editFreq.includes(j) ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
                            {j.slice(0,3)}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      {(['basse','normale','haute'] as const).map(p => (
                        <button key={p} onClick={() => setEditPrio(p)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors
                            ${editPrio === p ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
                          {p === 'haute' ? '🔴' : p === 'normale' ? '🟡' : '⚪'} {p}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={sauvegarderEdit} disabled={editSaving || !editTitre.trim()}
                        className="flex-1 py-2.5 bg-green-700 text-white rounded-lg text-sm font-bold disabled:opacity-40">
                        {editSaving ? '…' : 'Enregistrer'}
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="px-4 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-lg text-sm">
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

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

        {/* Résumé temps par personne */}
        {Object.keys(tempsParPersonne).length > 0 && (
          <div className="px-4 py-3 bg-green-50 border-t border-green-100 flex flex-wrap gap-3">
            {Object.entries(tempsParPersonne).sort((a, b) => b[1] - a[1]).map(([nom, min]) => (
              <div key={nom} className={`flex items-center gap-1.5 text-xs font-semibold ${nom === auteur ? 'text-green-800' : 'text-blue-700'}`}>
                <span>{nom === auteur ? '👤' : '🧑‍🌾'} {nom}</span>
                <span className="bg-white px-1.5 py-0.5 rounded-full border border-current">{formatDuree(min)}</span>
              </div>
            ))}
          </div>
        )}
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
                <div key={t.id}>
                  <div className="px-4 py-3 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
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
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => ouvrirEdit(t)} className="text-gray-300 active:text-blue-400 text-sm px-1">✏️</button>
                      <button onClick={() => supprimer(t.id)} className="text-gray-300 active:text-red-400 text-lg leading-none">×</button>
                    </div>
                  </div>
                  {editId === t.id && (
                    <div className="mx-4 mb-3 bg-gray-50 rounded-xl p-3 space-y-3">
                      <input value={editTitre} onChange={e => setEditTitre(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-green-400 bg-white" />
                      <div className="flex gap-2">
                        {(['ponctuelle','recurrente'] as const).map(v => (
                          <button key={v} onClick={() => setEditType(v)}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors
                              ${editType === v ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
                            {v === 'ponctuelle' ? '📅 Ponctuelle' : '🔁 Récurrente'}
                          </button>
                        ))}
                      </div>
                      {editType === 'ponctuelle' ? (
                        <input type="date" value={editEch} onChange={e => setEditEch(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white" />
                      ) : (
                        <div className="grid grid-cols-4 gap-1">
                          <button onClick={() => setEditFreq(f => f.includes('quotidien') ? [] : ['quotidien'])}
                            className={`col-span-2 py-2 rounded-lg text-xs font-semibold border transition-colors
                              ${editFreq.includes('quotidien') ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
                            Tous les jours
                          </button>
                          {['lundi','mardi','mercredi','jeudi','vendredi','samedi'].map(j => (
                            <button key={j} onClick={() => toggleEditJour(j)}
                              className={`py-2 rounded-lg text-xs font-semibold border capitalize transition-colors
                                ${editFreq.includes(j) ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
                              {j.slice(0,3)}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        {(['basse','normale','haute'] as const).map(p => (
                          <button key={p} onClick={() => setEditPrio(p)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors
                              ${editPrio === p ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
                            {p === 'haute' ? '🔴' : p === 'normale' ? '🟡' : '⚪'} {p}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={sauvegarderEdit} disabled={editSaving || !editTitre.trim()}
                          className="flex-1 py-2.5 bg-green-700 text-white rounded-lg text-sm font-bold disabled:opacity-40">
                          {editSaving ? '…' : 'Enregistrer'}
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="px-4 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-lg text-sm">
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
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
  const [ajoutPlanche, setAjoutPlanche]   = useState<string | null>(null)
  const [nomPlanche, setNomPlanche]       = useState('')
  const [longueurP, setLongueurP]         = useState('')
  const [largeurP, setLargeurP]           = useState('')
  const [plantsPm2P, setPlantsPm2P]       = useState('')
  const [saving, setSaving]               = useState(false)
  const [editPlanche, setEditPlanche]     = useState<string | null>(null)
  const [editNomP, setEditNomP]           = useState('')
  const [editLongueurP, setEditLongueurP] = useState('')
  const [editLargeurP, setEditLargeurP]   = useState('')
  const [editPlantsPm2P, setEditPlantsPm2P] = useState('')
  const [savingEdit, setSavingEdit]       = useState(false)

  async function ajouterZone() {
    if (!nomZone.trim()) return
    setSaving(true)
    await supabase.from('zones').insert({
      nom: nomZone.trim(), type: typeZone,
      superficie_m2: supZone ? parseFloat(supZone) : null,
      ordre: zones.length + 1, actif: true,
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

  async function modifierPlanche(id: string) {
    setSavingEdit(true)
    await supabase.from('zone_planches').update({
      nom:          editNomP.trim()   || undefined,
      longueur_m:   editLongueurP     ? parseFloat(editLongueurP)  : null,
      largeur_m:    editLargeurP      ? parseFloat(editLargeurP)   : null,
      plants_par_m2: editPlantsPm2P   ? parseInt(editPlantsPm2P)   : null,
    }).eq('id', id)
    setSavingEdit(false); setEditPlanche(null); onSaved()
  }

  function ouvrirEditPlanche(p: Planche) {
    setEditPlanche(p.id)
    setEditNomP(p.nom)
    setEditLongueurP(p.longueur_m?.toString() || '')
    setEditLargeurP(p.largeur_m?.toString() || '')
    setEditPlantsPm2P(p.plants_par_m2?.toString() || '')
    setAjoutPlanche(null)
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
                <div key={p.id}>
                  <div className="px-4 py-3 flex items-start justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-700 font-semibold">{p.nom}</span>
                      <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-2">
                        {p.longueur_m && p.largeur_m && (
                          <span>{p.longueur_m}m × {p.largeur_m}m = {surface} m²</span>
                        )}
                        {p.plants_par_m2 && <span>{p.plants_par_m2} plants/m²</span>}
                        {capacite && <span className="text-green-700 font-semibold">= {capacite} plants</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <button onClick={() => editPlanche === p.id ? setEditPlanche(null) : ouvrirEditPlanche(p)}
                        className="text-gray-300 active:text-blue-400 text-sm px-1">✏️</button>
                      <button onClick={() => supprimerPlanche(p.id)} className="text-gray-300 active:text-red-400 text-base">×</button>
                    </div>
                  </div>
                  {editPlanche === p.id && (
                    <div className="mx-4 mb-3 bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-200">
                      <input value={editNomP} onChange={e => setEditNomP(e.target.value)}
                        placeholder="Nom de la planche"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-green-400 bg-white" />
                      <div className="grid grid-cols-3 gap-2">
                        <input value={editLongueurP} onChange={e => setEditLongueurP(e.target.value)}
                          placeholder="Long. m" type="number" inputMode="decimal"
                          className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-green-400 bg-white" />
                        <input value={editLargeurP} onChange={e => setEditLargeurP(e.target.value)}
                          placeholder="Larg. m" type="number" inputMode="decimal"
                          className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-green-400 bg-white" />
                        <input value={editPlantsPm2P} onChange={e => setEditPlantsPm2P(e.target.value)}
                          placeholder="Plants/m²" type="number" inputMode="numeric"
                          className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-green-400 bg-white" />
                      </div>
                      {editLongueurP && editLargeurP && editPlantsPm2P && (
                        <div className="text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                          {(parseFloat(editLongueurP) * parseFloat(editLargeurP)).toFixed(1)} m² × {editPlantsPm2P} = {Math.round(parseFloat(editLongueurP) * parseFloat(editLargeurP) * parseInt(editPlantsPm2P))} plants
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => modifierPlanche(p.id)} disabled={savingEdit || !editNomP.trim()}
                          className="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                          {savingEdit ? '…' : 'Enregistrer'}
                        </button>
                        <button onClick={() => setEditPlanche(null)} className="text-gray-400 px-3 py-2 text-sm">Annuler</button>
                      </div>
                    </div>
                  )}
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

      {/* Mes tâches du jour — sélection par personne */}
      {(() => {
        // Toutes les tâches prévues pour cette date
        const tachesDate = taches.filter(t => {
          if (t.type === 'ponctuelle') return t.date_echeance === dateVue
          if (!t.frequence) return false
          const jourSemaine = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'][parseISO(dateVue).getDay()]
          const freq = t.frequence.toLowerCase()
          return freq === 'quotidien' || freq.split(',').map((s: string) => s.trim()).includes(jourSemaine)
        })
        if (tachesDate.length === 0) return null

        function aTravaillerSur(t: Tache) {
          return t.temps?.some(tt => tt.date === dateVue && tt.auteur === auteur) ?? false
        }

        async function toggleTravail(t: Tache) {
          const deja = aTravaillerSur(t)
          if (deja) {
            const entry = t.temps?.find(tt => tt.date === dateVue && tt.auteur === auteur)
            if (!entry || entry.minutes > 0) return // ne supprime pas si temps enregistré
            await supabase.from('taches_temps').delete().eq('id', entry.id)
          } else {
            const payload = { tache_id: t.id, date: dateVue, auteur, minutes: 0, chrono_debut: null }
            await supabase.from('taches_temps').upsert(payload, { onConflict: 'tache_id,date,auteur' })
          }
          onSaved()
        }

        return (
          <div className="rounded-2xl border border-blue-100 overflow-hidden">
            <div className="px-4 py-3 bg-blue-700 text-white font-bold text-sm flex items-center justify-between">
              <span>👤 Mes tâches — {auteur}</span>
              <span className="text-blue-200 text-xs font-normal">{tachesDate.filter(t => aTravaillerSur(t)).length}/{tachesDate.length} sélectionnées</span>
            </div>
            <div className="divide-y divide-blue-50">
              {tachesDate.map(t => {
                const fait = aTravaillerSur(t)
                const tt = t.temps?.find(x => x.date === dateVue && x.auteur === auteur)
                const zone = zones.find(z => z.id === t.zone_id)
                const avecTemps = (tt?.minutes ?? 0) > 0
                return (
                  <button key={t.id} onClick={() => !avecTemps && toggleTravail(t)}
                    disabled={avecTemps}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 active:bg-blue-50 transition-colors ${avecTemps ? 'cursor-default' : ''}`}>
                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                      ${fait ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                      {fait && <span className="text-white text-[10px] font-bold">✓</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${fait ? 'text-blue-800' : 'text-gray-700'}`}>{t.titre}</div>
                      {zone && <div className="text-xs text-gray-400">{zone.type === 'serre' ? '🪴' : '📍'} {zone.nom}</div>}
                    </div>
                    {avecTemps && tt && (
                      <span className="shrink-0 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                        ⏱ {formatDuree(tt.minutes)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Travaux du jour — récapitulatif */}
      {(tachesJour.length > 0 || entreesJour.length > 0) && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2">
            <div>
              <div className="font-bold text-sm text-gray-700">Récapitulatif équipe</div>
              <div className="text-xs text-gray-400">Tâches complétées + cahier</div>
            </div>
            {tachesJour.length > 0 && (
              <button onClick={ajouterTachesAuxNotes}
                className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1.5 rounded-full shrink-0 active:scale-95 transition-transform">
                📋 Vers mes notes
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

// ─── Tab : Cultures ───────────────────────────────────────────────────────────

function CulturesTab({ cultures, zones, especes, onSaved }: {
  cultures: Culture[]; zones: Zone[]; especes: { id: string; nom: string }[]; onSaved: () => void
}) {
  const [familleVue, setFamilleVue]     = useState<FamilleCulture>('champs')
  const [filtreStatut, setFiltreStatut] = useState<StatutCulture | 'tout'>('tout')
  const [ouvert, setOuvert]             = useState<string | null>(null)
  const [ajout, setAjout]               = useState(false)
  const [saving, setSaving]             = useState(false)

  const [famille, setFamille]     = useState<FamilleCulture>('champs')
  const [espece, setEspece]       = useState('')
  const [nom, setNom]             = useState('')
  const [zoneId, setZoneId]       = useState('')
  const [quantite, setQuantite]   = useState('')
  const [notes, setNotes]         = useState('')
  const [dateSemis, setDateSemis] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [editNotes, setEditNotes] = useState<{ id: string; val: string } | null>(null)
  const [editQty,   setEditQty]   = useState<{ id: string; val: string } | null>(null)
  const [erreurSave, setErreurSave] = useState<string | null>(null)
  const [syncing, setSyncing]       = useState(false)
  const [syncMsg, setSyncMsg]       = useState<string | null>(null)

  async function syncDepuisSemis() {
    setSyncing(true); setSyncMsg(null)
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data: lignes, error: errL } = await supabase
      .from('semis_lignes')
      .select('id, espece_id, format, quantite')
      .in('format', ['TAPIS', 'GODET'])
      .gt('date_peremption', today)
    if (errL) { setSyncMsg(`Erreur lecture semis: ${errL.message}`); setSyncing(false); return }
    if (!lignes?.length) { setSyncMsg('Aucun semis actif trouvé.'); setSyncing(false); return }
    const payload = (lignes as {id:string;espece_id:string;format:string;quantite:number}[]).map(l => ({
      espece: especes.find(e => e.id === l.espece_id)?.nom ?? '',
      nom: l.format === 'TAPIS' ? `Tapis ×${l.quantite}` : `Godet ×${l.quantite}`,
      famille: (l.format === 'TAPIS' || l.format === 'GODET') ? 'micro_pousse' : 'champs',
      statut: 'semis' as StatutCulture,
      date_semis: today,
      quantite: String(l.quantite),
      zone_id: null, notes: null, actif: true,
    }))
    const { error } = await supabase.from('cultures').insert(payload)
    if (error) {
      setSyncMsg(`Erreur insert: ${error.message} | code: ${error.code}`)
    } else {
      setSyncMsg(`✅ ${payload.length} fiche(s) créée(s) !`)
      onSaved()
    }
    setSyncing(false)
  }

  function changerFamille(f: FamilleCulture) {
    setFamilleVue(f)
    setFiltreStatut('tout')
    setOuvert(null)
  }

  const statutsActifs = familleVue === 'micro_pousse' ? STATUTS_ACTIFS_MICRO : STATUTS_ACTIFS_CHAMPS
  const cultsFamille  = cultures.filter(c => c.famille === familleVue)
  const filtered = filtreStatut === 'tout'
    ? cultsFamille.filter(c => c.statut !== 'termine')
    : cultsFamille.filter(c => c.statut === filtreStatut)

  async function avancer(c: Culture) {
    const next = prochainStatutCulture(c)
    if (!next) return
    const now = format(new Date(), 'yyyy-MM-dd')
    const patch: Partial<Culture> = { statut: next }
    if (next === 'en_place') patch.date_plantation    = now
    if (next === 'recolte')  patch.date_debut_recolte = now
    if (next === 'termine')  patch.date_fin_recolte   = now
    if (!navigator.onLine) {
      await queueMutation({ table: 'cultures', method: 'update', payload: patch, matchCol: 'id', matchVal: c.id })
    } else {
      await supabase.from('cultures').update(patch).eq('id', c.id)
    }
    onSaved()
  }

  async function changerFamilleC(c: Culture) {
    const newFamille: FamilleCulture = c.famille === 'micro_pousse' ? 'champs' : 'micro_pousse'
    await supabase.from('cultures').update({ famille: newFamille }).eq('id', c.id)
    onSaved()
  }

  async function archiver(c: Culture) {
    if (!confirm(`Archiver "${c.espece}" ? (marque comme terminée, reste en historique)`)) return
    if (!navigator.onLine) {
      await queueMutation({ table: 'cultures', method: 'update', payload: { actif: false }, matchCol: 'id', matchVal: c.id })
    } else {
      await supabase.from('cultures').update({ actif: false }).eq('id', c.id)
    }
    onSaved()
  }

  async function supprimerCulture(c: Culture) {
    if (!confirm(`Supprimer définitivement "${c.espece}" ? Cette action est irréversible.`)) return
    await supabase.from('cultures').delete().eq('id', c.id)
    onSaved()
  }

  async function sauvegarderNotes(c: Culture, val: string) {
    const payload = { notes: val.trim() || null }
    if (!navigator.onLine) {
      await queueMutation({ table: 'cultures', method: 'update', payload, matchCol: 'id', matchVal: c.id })
    } else {
      await supabase.from('cultures').update(payload).eq('id', c.id)
    }
    setEditNotes(null)
    onSaved()
  }

  async function sauvegarderQuantite(c: Culture, val: string) {
    const payload = { quantite: val.trim() || null }
    if (!navigator.onLine) {
      await queueMutation({ table: 'cultures', method: 'update', payload, matchCol: 'id', matchVal: c.id })
    } else {
      await supabase.from('cultures').update(payload).eq('id', c.id)
    }
    setEditQty(null)
    onSaved()
  }

  async function sauvegarder() {
    if (!espece.trim()) return
    setSaving(true)
    const payload = {
      espece: espece.trim(), nom: nom.trim() || null, famille,
      zone_id: zoneId || null, quantite: quantite.trim() || null,
      notes: notes.trim() || null, date_semis: dateSemis || null,
      statut: 'semis' as StatutCulture, actif: true,
    }
    setErreurSave(null)
    if (!navigator.onLine) {
      await queueMutation({ table: 'cultures', method: 'insert', payload })
    } else {
      const { error } = await supabase.from('cultures').insert(payload)
      if (error) {
        setErreurSave(`Erreur : ${error.message}`)
        setSaving(false)
        return
      }
    }
    setSaving(false); setAjout(false)
    setEspece(''); setNom(''); setZoneId(''); setQuantite(''); setNotes('')
    setDateSemis(format(new Date(), 'yyyy-MM-dd'))
    changerFamille(famille)
    onSaved()
  }

  function ouvrirAjout(f: FamilleCulture) {
    setFamille(f)
    setEspece(''); setNom(''); setZoneId(''); setQuantite(''); setNotes('')
    setDateSemis(format(new Date(), 'yyyy-MM-dd'))
    setAjout(true)
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => changerFamille('champs')}
          className={`flex flex-col items-center py-4 rounded-xl border-2 font-semibold transition-colors
            ${familleVue === 'champs' ? 'bg-amber-50 border-amber-500 text-amber-800' : 'bg-white border-gray-200 text-gray-500'}`}>
          <span className="text-2xl mb-1">🌾</span>
          <span className="text-sm">Champs</span>
          <span className="text-xs font-normal mt-0.5 opacity-70">
            {cultures.filter(c => c.famille === 'champs' && c.statut !== 'termine').length} en cours
          </span>
        </button>
        <button onClick={() => changerFamille('micro_pousse')}
          className={`flex flex-col items-center py-4 rounded-xl border-2 font-semibold transition-colors
            ${familleVue === 'micro_pousse' ? 'bg-green-50 border-green-600 text-green-800' : 'bg-white border-gray-200 text-gray-500'}`}>
          <span className="text-2xl mb-1">🌱</span>
          <span className="text-sm">Micro-pousses</span>
          <span className="text-xs font-normal mt-0.5 opacity-70">
            {cultures.filter(c => c.famille === 'micro_pousse' && c.statut !== 'termine').length} en cours
          </span>
        </button>
      </div>

      <button onClick={() => ouvrirAjout(familleVue)}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform text-white
          ${familleVue === 'champs' ? 'bg-amber-600' : 'bg-green-700'}`}>
        + Nouvelle {familleVue === 'champs' ? 'culture champs' : 'micro-pousse'}
      </button>

      {cultures.filter(c => c.famille === familleVue).length === 0 && (
        <div className="space-y-2">
          <button onClick={syncDepuisSemis} disabled={syncing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm border-2 border-dashed border-green-300 text-green-700 bg-green-50 active:scale-95 transition-transform disabled:opacity-50">
            {syncing ? '⏳ Synchronisation…' : '🔄 Importer depuis les semis actifs'}
          </button>
          {syncMsg && (
            <div className={`text-xs rounded-xl px-3 py-2 ${syncMsg.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {syncMsg}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFiltreStatut('tout')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
            ${filtreStatut === 'tout' ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
          Tout ({cultsFamille.filter(c => c.statut !== 'termine').length})
        </button>
        {statutsActifs.map(s => {
          const info  = (familleVue === 'micro_pousse' ? STATUT_CULT_MICRO : STATUT_CULT)[s]
          const count = cultsFamille.filter(c => c.statut === s).length
          return (
            <button key={s} onClick={() => setFiltreStatut(s)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
                ${filtreStatut === s ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
              {info.icon} {info.label} ({count})
            </button>
          )
        })}
        <button onClick={() => setFiltreStatut('termine')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
            ${filtreStatut === 'termine' ? 'bg-gray-600 text-white border-gray-600' : 'bg-white text-gray-400 border-gray-200'}`}>
          ✅ Terminés ({cultsFamille.filter(c => c.statut === 'termine').length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">{familleVue === 'champs' ? '🌾' : '🌱'}</div>
          <div className="text-sm">
            Aucune {familleVue === 'champs' ? 'culture champs' : 'micro-pousse'}
            {filtreStatut !== 'tout' ? ' dans cette phase' : ''}
          </div>
          <div className="text-xs mt-1">Appuie sur le bouton + pour commencer</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const CULT   = c.famille === 'micro_pousse' ? STATUT_CULT_MICRO : STATUT_CULT
            const info   = CULT[c.statut]
            const next   = prochainStatutCulture(c)
            const zone   = zones.find(z => z.id === c.zone_id)
            const isOpen = ouvert === c.id
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => setOuvert(isOpen ? null : c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xl ${info.color}`}>
                    {info.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 text-sm truncate">
                      {c.espece}{c.nom ? ` — ${c.nom}` : ''}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${info.color}`}>
                        {info.label}
                      </span>
                      {zone && <span className="text-[10px] text-gray-400">{zone.nom}</span>}
                      {c.date_semis && (
                        <span className="text-[10px] text-gray-400">
                          Semé {format(parseISO(c.date_semis), 'd MMM', { locale: fr })}
                        </span>
                      )}
                      {c.quantite && <span className="text-[10px] text-gray-400">{c.quantite}</span>}
                    </div>
                  </div>
                  <span className={`text-gray-300 text-sm transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { label: '🌱 Semis',      val: c.date_semis },
                        { label: c.famille === 'micro_pousse' ? '☀️ En lumière' : '🪴 Plantation', val: c.date_plantation },
                        { label: '🥬 Récolte',    val: c.date_debut_recolte },
                        { label: '✅ Fin',         val: c.date_fin_recolte },
                      ] as { label: string; val: string | null }[]).filter(d => d.val).map(({ label, val }) => (
                        <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                          <div className="text-[10px] text-gray-400">{label}</div>
                          <div className="text-xs font-semibold text-gray-700">
                            {format(parseISO(val!), 'd MMMM yyyy', { locale: fr })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {editQty?.id === c.id ? (
                      <div className="flex items-center gap-2">
                        <input type="text" value={editQty.val}
                          onChange={e => setEditQty({ id: c.id, val: e.target.value })}
                          autoFocus placeholder="ex: 8 caisses"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
                        <button onClick={() => sauvegarderQuantite(c, editQty.val)}
                          className="px-3 py-2 bg-green-700 text-white text-xs rounded-lg font-semibold">OK</button>
                        <button onClick={() => setEditQty(null)}
                          className="px-3 py-2 bg-gray-100 text-gray-500 text-xs rounded-lg">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditQty({ id: c.id, val: c.quantite || '' })}
                        className="w-full text-left text-xs bg-gray-50 rounded-lg px-3 py-2 text-gray-500">
                        {c.quantite ? `📦 ${c.quantite}` : '+ Quantité réelle...'}
                      </button>
                    )}
                    {editNotes?.id === c.id ? (
                      <div className="space-y-1.5">
                        <textarea value={editNotes.val}
                          onChange={e => setEditNotes({ id: c.id, val: e.target.value })}
                          autoFocus rows={3} placeholder="Observations, germination, aspect..."
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-green-400" />
                        <div className="flex gap-2">
                          <button onClick={() => sauvegarderNotes(c, editNotes.val)}
                            className="px-3 py-1.5 bg-green-700 text-white text-xs rounded-lg font-semibold">Enregistrer</button>
                          <button onClick={() => setEditNotes(null)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setEditNotes({ id: c.id, val: c.notes || '' })}
                        className="w-full text-left text-xs bg-amber-50 rounded-lg px-3 py-2">
                        {c.notes
                          ? <span className="text-amber-800">{c.notes}</span>
                          : <span className="text-gray-400">+ Ajouter une note d&apos;observation...</span>
                        }
                      </button>
                    )}
                    {next && (
                      <button onClick={() => avancer(c)}
                        className="w-full py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold active:scale-95 transition-transform">
                        {CULT[next].icon} → {CULT[next].label}
                      </button>
                    )}
                    <button onClick={() => changerFamilleC(c)}
                      className="w-full py-2 rounded-xl border border-gray-200 text-gray-500 text-xs">
                      {c.famille === 'micro_pousse' ? '🌾 Déplacer vers Champs' : '🌱 Déplacer vers Micro-pousses'}
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => archiver(c)}
                        className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-400 text-xs">
                        ✅ Archiver (terminée)
                      </button>
                      <button onClick={() => supprimerCulture(c)}
                        className="flex-1 py-2 rounded-xl border border-red-100 text-red-400 text-xs">
                        🗑 Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {ajout && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setAjout(false)}>
          <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-5 space-y-4 pb-10 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-lg">
                {famille === 'champs' ? '🌾 Nouvelle culture champs' : '🌱 Nouvelle micro-pousse'}
              </h2>
              <button onClick={() => setAjout(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['champs','micro_pousse'] as FamilleCulture[]).map(f => (
                <button key={f} onClick={() => setFamille(f)}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-colors
                    ${famille === f
                      ? f === 'champs' ? 'bg-amber-50 border-amber-500 text-amber-800' : 'bg-green-50 border-green-600 text-green-800'
                      : 'bg-white border-gray-200 text-gray-400'}`}>
                  {f === 'champs' ? '🌾 Champs' : '🌱 Micro-pousse'}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Espèce / Plante *</label>
              <input value={espece} onChange={e => setEspece(e.target.value)}
                placeholder={famille === 'champs' ? 'Ex : Tomate, Courgette, Persil...' : 'Ex : Basilic, Radis, Pois...'}
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-green-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Variété / Nom</label>
              <input value={nom} onChange={e => setNom(e.target.value)}
                placeholder="Ex : Genovese, Cherry Roma..."
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-green-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date de semis</label>
                <input type="date" value={dateSemis} onChange={e => setDateSemis(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {famille === 'champs' ? 'Nombre de plants' : 'Quantité (caisses…)'}
                </label>
                <input value={quantite} onChange={e => setQuantite(e.target.value)}
                  placeholder={famille === 'champs' ? 'Ex : 30 plants' : 'Ex : 4 caisses'}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
              </div>
            </div>
            {zones.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Zone / Emplacement</label>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setZoneId('')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border
                      ${zoneId === '' ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    Aucune
                  </button>
                  {zones.map(z => (
                    <button key={z.id} onClick={() => setZoneId(z.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                        ${zoneId === z.id ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {z.nom}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Observations, conditions de culture..."
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 resize-none" />
            </div>
            {erreurSave && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">
                {erreurSave}
              </div>
            )}
            <button onClick={sauvegarder} disabled={saving || !espece.trim()}
              className={`w-full text-white py-4 rounded-xl font-bold text-base active:scale-95 transition-transform disabled:opacity-50
                ${famille === 'champs' ? 'bg-amber-600' : 'bg-green-700'}`}>
              {saving ? 'Enregistrement...' : famille === 'champs' ? '🌾 Démarrer la culture' : '🌱 Démarrer la micro-pousse'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
