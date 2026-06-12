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
  produit_traitement_id: string | null
  zone?: { nom: string } | null
  espece?: { nom: string } | null
  produit?: { nom: string } | null
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
type Espece            = { id: string; nom: string }
type EspeceSerre       = { id: string; nom: string; categorie: string }
type ProduitTraitement = { id: string; nom: string; type: string }
type TacheCatalogue    = { id: string; titre: string; categorie: string; icone: string; active: boolean; ordre: number }
type ZoneTacheCat      = { zone_id: string; catalogue_id: string }

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPES_OP_CHAMP = [
  { val: 'semis',       label: 'Semer',      icon: '🌱', color: 'bg-green-100 border-green-400 text-green-800' },
  { val: 'recolte',     label: 'Récolter',   icon: '✂️',  color: 'bg-emerald-100 border-emerald-400 text-emerald-800' },
  { val: 'arrosage',    label: 'Arroser',    icon: '💧', color: 'bg-blue-100 border-blue-400 text-blue-800' },
  { val: 'traitement',  label: 'Traitement', icon: '🌿', color: 'bg-amber-100 border-amber-400 text-amber-800' },
  { val: 'observation', label: 'Observer',   icon: '👁', color: 'bg-purple-100 border-purple-400 text-purple-800' },
  { val: 'taille',      label: 'Tailler',    icon: '✂️',  color: 'bg-orange-100 border-orange-400 text-orange-800' },
  { val: 'autre',       label: 'Autre',      icon: '📝', color: 'bg-gray-100 border-gray-300 text-gray-700' },
]

const TYPES_OP_SERRE = [
  { val: 'semis',       label: 'Semer',       icon: '🌱', color: 'bg-green-100 border-green-400 text-green-800' },
  { val: 'repiquage',   label: 'Repiquer',    icon: '🪴', color: 'bg-lime-100 border-lime-400 text-lime-800' },
  { val: 'arrosage',    label: 'Arroser',     icon: '💧', color: 'bg-blue-100 border-blue-400 text-blue-800' },
  { val: 'traitement',  label: 'Traitement',  icon: '🌿', color: 'bg-amber-100 border-amber-400 text-amber-800' },
  { val: 'recolte',     label: 'Sortir plants',icon: '📦', color: 'bg-emerald-100 border-emerald-400 text-emerald-800' },
  { val: 'observation', label: 'Observer',    icon: '👁', color: 'bg-purple-100 border-purple-400 text-purple-800' },
  { val: 'autre',       label: 'Autre',       icon: '📝', color: 'bg-gray-100 border-gray-300 text-gray-700' },
]

const TYPES_PRODUIT = ['purin','engrais','fongicide','insecticide','autre']
const CATS_SERRE    = ['plante','aromatique','legume','fleur','autre']

const RAISONS_PERTE = [
  { val: 'germination_ratee', label: 'Germination ratée',  icon: '🫘' },
  { val: 'pourriture',        label: 'Pourriture',         icon: '🍂' },
  { val: 'surproduction',     label: 'Surproduction',      icon: '📦' },
  { val: 'invendu',           label: 'Invendu',            icon: '🏷️' },
  { val: 'meteo',             label: 'Météo',              icon: '⛈️' },
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

// ─── ListeAvecAjout ───────────────────────────────────────────────────────────
// Sélecteur avec recherche + bouton "Ajouter" pour sauvegarder de nouveaux items

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

  const filtrés = items.filter(i => i.nom.toLowerCase().includes(recherche.toLowerCase()))

  // Grouper par catégorie si besoin
  const groupes: Record<string, T[]> = {}
  if (grouper) {
    for (const item of filtrés) {
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
        placeholder={placeholder || 'Rechercher…'}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
      />

      <div className="max-h-52 overflow-y-auto space-y-1">
        {/* Sans sélection */}
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
          : filtrés.map(i => (
              <button key={i.id} onClick={() => onChange(i.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-colors font-medium
                  ${valeur === i.id ? 'bg-green-700 text-white border-green-700' : 'bg-white border-gray-100 text-gray-700 active:bg-green-50'}`}>
                {i.nom}
              </button>
            ))
        }

        {filtrés.length === 0 && !ajout && (
          <div className="text-center text-xs text-gray-400 py-3">Aucun résultat</div>
        )}
      </div>

      {/* Ajout inline */}
      {ajout ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
          <input value={nouveauNom} onChange={e => setNouveauNom(e.target.value)}
            placeholder="Nom…"
            className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          />
          {nouvelleCategorie !== undefined && (
            <input value={nouvelleCategorie} onChange={e => setNouvelleCategorie(e.target.value)}
              placeholder="Catégorie (ex: aromatique, engrais…)"
              className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
          )}
          <div className="flex gap-2">
            <button onClick={sauvegarder} disabled={saving || !nouveauNom.trim()}
              className="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm font-bold active:scale-95 disabled:opacity-50">
              {saving ? '…' : '✓ Sauvegarder'}
            </button>
            <button onClick={() => { setAjout(false); setNouveauNom('') }}
              className="px-3 py-2 text-gray-500 text-sm">Annuler</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAjout(true)}
          className="w-full text-center text-sm text-green-700 font-semibold py-2 border border-dashed border-green-300 rounded-xl active:bg-green-50">
          + Ajouter à cette liste
        </button>
      )}
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

type Tab = 'cahier' | 'agenda' | 'zones' | 'pertes'

export default function TerrainPage() {
  const [onglet, setOnglet]             = useState<Tab>('agenda')
  const [taskRapide, setTaskRapide]     = useState(false)
  const [taskTitre, setTaskTitre]       = useState('')
  const [taskDate, setTaskDate]         = useState(format(new Date(), 'yyyy-MM-dd'))
  const [taskPrio, setTaskPrio]         = useState('normale')
  const [taskZoneId, setTaskZoneId]     = useState('')
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

  useEffect(() => { charger() }, [])

  async function charger() {
    const [
      { data: z }, { data: pl }, { data: ent }, { data: ta }, { data: pe },
      { data: esp }, { data: esSerre }, { data: prod }, { data: cat }, { data: zt }
    ] = await Promise.all([
      supabase.from('zones').select('*').eq('actif', true).order('ordre'),
      supabase.from('zone_planches').select('*').order('ordre'),
      supabase.from('cahier_culture')
        .select('*, zone:zones(nom), espece:especes(nom), produit:produits_traitement(nom)')
        .order('date_operation', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('taches')
        .select('*, completions:taches_completions(date_completion)')
        .eq('actif', true).order('priorite', { ascending: false }),
      supabase.from('pertes')
        .select('*, espece:especes(nom)')
        .order('date_perte', { ascending: false }).limit(30),
      supabase.from('especes').select('id, nom').eq('actif', true).order('nom'),
      supabase.from('especes_serre').select('*').eq('actif', true).order('categorie,nom'),
      supabase.from('produits_traitement').select('*').eq('actif', true).order('type,nom'),
      supabase.from('taches_catalogue').select('*').eq('active', true).order('ordre'),
      supabase.from('zone_taches_catalogue').select('*'),
    ])
    if (z)    setZones(z)
    if (pl)   setPlanches(pl)
    if (ent)  setEntrees(ent as unknown as EntreeCahier[])
    if (ta)   setTaches(ta as unknown as Tache[])
    if (pe)   setPertes(pe as unknown as Perte[])
    if (esp)  setEspeces(esp)
    if (esSerre) setEspecesSerre(esSerre)
    if (prod) setProduits(prod)
    if (cat)  setCatalogueTaches(cat as unknown as TacheCatalogue[])
    if (zt)   setZoneTaches(zt)
  }

  async function sauvegarderTaskRapide() {
    if (!taskTitre.trim()) return
    setTaskSaving(true)
    await supabase.from('taches').insert({
      titre: taskTitre.trim(), type: 'ponctuelle',
      date_echeance: taskDate, priorite: taskPrio,
      zone_id: taskZoneId || null,
    })
    setTaskSaving(false); setTaskRapide(false)
    setTaskTitre(''); setTaskPrio('normale'); setTaskZoneId('')
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

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'agenda', icon: '✅', label: 'Agenda' },
    { id: 'cahier', icon: '📖', label: 'Cahier' },
    { id: 'zones',  icon: '🗺️', label: 'Zones' },
    { id: 'pertes', icon: '📉', label: 'Pertes' },
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
            + Tâche
          </button>
        </div>
      </div>

      {/* ── Modal tâche rapide ── */}
      {taskRapide && (() => {
        const chips = taskZoneId
          ? catalogueTaches.filter(c => zoneTaches.some(zt => zt.zone_id === taskZoneId && zt.catalogue_id === c.id))
          : catalogueTaches.slice(0, 12)
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setTaskRapide(false)}>
            <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-5 space-y-4 pb-10 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-800 text-lg">✅ Tâche rapide</h2>
                <button onClick={() => setTaskRapide(false)} className="text-gray-400 text-2xl leading-none">×</button>
              </div>

              {/* Zone (optionnel) */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-gray-500">Zone (optionnel)</div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setTaskZoneId('')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                      ${!taskZoneId ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    Toutes
                  </button>
                  {zones.map(z => (
                    <button key={z.id} onClick={() => setTaskZoneId(z.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
                        ${taskZoneId === z.id ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      {z.type === 'serre' ? '🪴' : '📍'} {z.nom}
                    </button>
                  ))}
                </div>
              </div>

              {/* Suggestions catalogue */}
              {chips.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-gray-500">
                    ⚡ Suggestions{taskZoneId ? ` — ${zones.find(z => z.id === taskZoneId)?.nom}` : ''}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {chips.map(c => (
                      <button key={c.id}
                        onClick={() => setTaskTitre(c.titre)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform
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
                <div className="text-xs font-semibold text-gray-500">Priorité</div>
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
                {taskSaving ? 'Enregistrement…' : '✅ Enregistrer la tâche'}
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
  const [saving, setSaving]     = useState(false)

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
    ? ['plants', 'bottes', 'godets', 'pièces']
    : estTraitement
      ? ['L', 'mL', 'kg', 'g', 'doses']
      : ['barquettes', 'kg', 'plateaux', 'L', 'pièces']

  // Réinitialiser l'unité quand le contexte change
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
    await supabase.from('cahier_culture').insert({
      zone_id:               zoneId || null,
      type_operation:        typeOp,
      espece_id:             avecEspece && especeId ? especeId : null,
      produit_traitement_id: estTraitement && produitId ? produitId : null,
      quantite:              avecQuantite ? quantite : null,
      unite:                 avecQuantite ? unite : null,
      notes:                 notes || null,
      auteur,
    })
    localStorage.setItem('terrain_auteur', auteur)
    setSaving(false); reset(); onSaved()
  }

  const typeInfo = typesOp.find(t => t.val === typeOp)
  const zoneInfo = zoneSelectionnee

  // Produire une description lisible du produit de traitement sélectionné
  const produitSelectionne = produits.find(p => p.id === produitId)

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
          {/* Fil d'Ariane */}
          {etape > 1 && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {zoneInfo && (
                <span className={`px-2 py-1 rounded-full font-semibold ${estSerre ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                  📍 {zoneInfo.nom}
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
                    className={`py-4 rounded-xl border-2 font-bold text-lg active:scale-95 transition-transform
                      ${z.type === 'serre'
                        ? 'border-amber-400 bg-amber-50 text-amber-800'
                        : 'border-green-400 bg-green-50 text-green-800'}`}>
                    {z.type === 'serre' ? '🪴' : ''}{z.nom}
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

          {/* Étape 3 : Espèce / Produit + Quantité */}
          {etape === 3 && (
            <div className="space-y-4">

              {/* Sélection produit traitement */}
              {estTraitement && (
                <div className="space-y-2">
                  <div className="text-sm font-bold text-gray-700">3a. Quel produit ?</div>
                  <ListeAvecAjout
                    items={produits}
                    valeur={produitId}
                    onChange={setProduitId}
                    placeholder="Rechercher un produit…"
                    onAjouter={onAjouterProduit}
                    grouper={(p: ProduitTraitement) => p.type}
                  />
                </div>
              )}

              {/* Sélection espèce (serre ou micropousses) */}
              {avecEspece && (
                <div className="space-y-2">
                  <div className="text-sm font-bold text-gray-700">
                    3a. {estSerre ? 'Quelle plante ?' : 'Quelle espèce ?'}
                  </div>
                  {estSerre ? (
                    <ListeAvecAjout
                      items={especesSerre}
                      valeur={especeId}
                      onChange={setEspeceId}
                      placeholder="Rechercher une plante…"
                      onAjouter={onAjouterEspece}
                      grouper={(e: EspeceSerre) => e.categorie}
                    />
                  ) : (
                    <ListeAvecAjout
                      items={especes}
                      valeur={especeId}
                      onChange={setEspeceId}
                      placeholder="Rechercher une espèce…"
                      onAjouter={async (nom) => { await supabase.from('especes').insert({ nom, actif: true }); onSaved() }}
                    />
                  )}
                </div>
              )}

              {/* Quantité */}
              {avecQuantite && (
                <div className="space-y-2">
                  <div className="text-sm font-bold text-gray-700">
                    {(avecEspece || estTraitement) ? '3b.' : '3.'} Quantité
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

          {/* Étape 4 : Note + auteur + save */}
          {etape === 4 && (
            <div className="space-y-3">
              <div className="text-sm font-bold text-gray-700">Note (optionnel)</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Observation, remarque…"
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
              const op = [...TYPES_OP_CHAMP, ...TYPES_OP_SERRE].find(t => t.val === e.type_operation)
              return (
                <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-2">
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

function AgendaTab({ taches, zones, catalogueTaches, zoneTaches, onSaved }: {
  taches: Tache[]; zones: Zone[]
  catalogueTaches: TacheCatalogue[]; zoneTaches: ZoneTacheCat[]
  onSaved: () => void
}) {
  const [ajout, setAjout]    = useState(false)
  const [titre, setTitre]    = useState('')
  const [type, setType]      = useState<'ponctuelle' | 'recurrente'>('ponctuelle')
  const [frequence, setFreq] = useState<string[]>([])
  const [echeance, setEch]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [zoneId, setZoneId]  = useState('')
  const [priorite, setPrio]  = useState('normale')
  const [saving, setSaving]  = useState(false)

  const aujTaches    = taches.filter(t => tacheEstAujourdHui(t))
  const autresTaches = taches.filter(t => !tacheEstAujourdHui(t))

  async function cocher(t: Tache) {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    if (tacheEstCompleteeAujourdHui(t)) {
      await supabase.from('taches_completions').delete()
        .eq('tache_id', t.id).eq('date_completion', todayStr)
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
      titre: titre.trim(), type,
      frequence: type === 'recurrente' ? frequence.join(',') || 'quotidien' : null,
      date_echeance: type === 'ponctuelle' ? echeance : null,
      zone_id: zoneId || null, priorite,
    })
    setSaving(false); setAjout(false)
    setTitre(''); setType('ponctuelle'); setFreq([]); setPrio('normale'); setZoneId('')
    onSaved()
  }

  function toggleJour(j: string) {
    setFreq(prev => prev.includes(j) ? prev.filter(x => x !== j) : [...prev, j])
  }

  return (
    <div className="space-y-4">
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
            const zone  = zones.find(z => z.id === t.zone_id)
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

      <button onClick={() => setAjout(!ajout)}
        className="w-full bg-green-700 text-white py-3.5 rounded-xl font-bold text-base active:scale-95 transition-transform">
        {ajout ? '✕ Annuler' : '+ Ajouter une tâche'}
      </button>

      {ajout && (() => {
        const chips = zoneId
          ? catalogueTaches.filter(c => zoneTaches.some(zt => zt.zone_id === zoneId && zt.catalogue_id === c.id))
          : catalogueTaches.slice(0, 10)
        return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          {chips.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-400">
                ⚡ Suggestions{zoneId ? ` — ${zones.find(z => z.id === zoneId)?.nom}` : ''}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {chips.map(c => (
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
            placeholder="Titre de la tâche…"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base font-semibold focus:outline-none focus:border-green-400"
          />
          <div className="flex gap-2">
            {(['ponctuelle', 'recurrente'] as const).map(v => (
              <button key={v} onClick={() => setType(v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border active:scale-95 transition-transform
                  ${type === v ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {v === 'ponctuelle' ? '📅 Ponctuelle' : '🔁 Récurrente'}
              </button>
            ))}
          </div>
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
        )
      })()}

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
  const [ajoutZone, setAjoutZone]     = useState(false)
  const [nomZone, setNomZone]         = useState('')
  const [typeZone, setTypeZone]       = useState('plein_champ')
  const [supZone, setSupZone]         = useState('')
  const [ajoutPlanche, setAjoutPlanche] = useState<string | null>(null)
  const [nomPlanche, setNomPlanche]   = useState('')
  const [saving, setSaving]           = useState(false)

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
      ordre: planches.filter(p => p.zone_id === zoneId).length + 1,
    })
    setSaving(false); setAjoutPlanche(null); setNomPlanche(''); onSaved()
  }

  async function supprimerPlanche(id: string) {
    await supabase.from('zone_planches').delete().eq('id', id); onSaved()
  }

  return (
    <div className="space-y-3">
      {zones.map(z => {
        const pls = planches.filter(p => p.zone_id === z.id)
        return (
          <div key={z.id} className="rounded-2xl border border-gray-100 overflow-hidden">
            <div className={`px-4 py-3 flex items-center justify-between ${z.type === 'serre' ? 'bg-amber-50' : 'bg-green-50'}`}>
              <div>
                <span className="font-bold text-green-900 text-base">{z.nom}</span>
                <span className="ml-2 text-xs text-green-600 capitalize">{z.type.replace('_', ' ')}</span>
                {z.superficie_m2 && <span className="ml-2 text-xs text-gray-400">{z.superficie_m2} m²</span>}
              </div>
              <button onClick={() => supprimerZone(z.id)} className="text-gray-300 active:text-red-400 text-lg leading-none">×</button>
            </div>
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
            {ajoutPlanche === z.id ? (
              <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                <input value={nomPlanche} onChange={e => setNomPlanche(e.target.value)}
                  placeholder="Nom de la planche (ex: Planche A)"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                />
                <button onClick={() => ajouterPlanche(z.id)} disabled={saving}
                  className="bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-semibold active:scale-95 disabled:opacity-50">✓</button>
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

      {ajoutZone ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <input value={nomZone} onChange={e => setNomZone(e.target.value)}
            placeholder="Nom de la zone (ex: J6, Serre 2…)"
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
            placeholder="Superficie m² (optionnel)" type="number" inputMode="decimal"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
          />
          <div className="flex gap-2">
            <button onClick={ajouterZone} disabled={saving || !nomZone.trim()}
              className="flex-1 bg-green-700 text-white py-3 rounded-xl font-bold active:scale-95 disabled:opacity-50">
              ✓ Ajouter
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
    await supabase.from('pertes').insert({
      designation: designation.trim(), espece_id: especeId || null,
      quantite, unite, raison, notes: notes || null,
    })
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
            📉 Ce mois : {ce_mois.reduce((s, p) => s + p.quantite, 0)} unités perdues
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
        <div className="px-4 py-3 bg-red-600 text-white font-bold text-sm">📉 Enregistrer une perte</div>
        <div className="p-4 space-y-4">
          <input value={designation} onChange={e => setDesignation(e.target.value)}
            placeholder="Produit perdu (ex: Radis barquettes)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400"
          />
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500">Espèce liée (optionnel)</div>
            <input value={recherche} onChange={e => setRecherche(e.target.value)}
              placeholder="Filtrer…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
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
          <div className="flex items-center justify-center py-1">
            <Stepper value={quantite} onChange={setQuantite} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['barquettes','kg','plateaux','L','pièces'].map(u => (
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
            placeholder="Note optionnelle…" rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none" />
          <button onClick={sauvegarder} disabled={saving || !designation.trim() || !raison}
            className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-base active:scale-95 transition-transform disabled:opacity-50">
            {saving ? 'Enregistrement…' : '📉 Enregistrer la perte'}
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
