'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ParametresProduction, Contenant, Semis, SemisLigne, Espece } from '@/types'
import { format, parseISO, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface SemisComplet extends Semis {
  semis_lignes: (SemisLigne & { espece: Espece })[]
}

type BLVente = {
  id: string
  created_at: string
  date_livraison: string | null
  client: { nom: string } | null
  bl_lignes: { designation: string; quantite: number; prix_ht: number; tva_pct: number }[]
}

export default function CoutsPage() {
  const [onglet, setOnglet] = useState<'dashboard' | 'ventes' | 'params' | 'simulateur'>('dashboard')
  const [semisList, setSemisList] = useState<SemisComplet[]>([])
  const [params, setParams] = useState<ParametresProduction | null>(null)
  const [contenants, setContenants] = useState<Contenant[]>([])
  const [ventes, setVentes] = useState<BLVente[]>([])
  const [loading, setLoading] = useState(true)
  const [marge, setMarge] = useState(300)

  useEffect(() => { charger() }, [])

  async function charger() {
    const sixMois = new Date()
    sixMois.setMonth(sixMois.getMonth() - 6)

    const [{ data: s }, { data: p }, { data: c }, { data: v }] = await Promise.all([
      supabase.from('semis').select('*, semis_lignes(*, espece:especes(*))').order('date_semis', { ascending: false }).limit(50),
      supabase.from('parametres_production').select('*').single(),
      supabase.from('contenants').select('*').eq('actif', true),
      supabase.from('bons_livraison')
        .select('id, created_at, date_livraison, client:clients(nom), bl_lignes(designation, quantite, prix_ht, tva_pct)')
        .gte('created_at', sixMois.toISOString())
        .order('created_at', { ascending: false }),
    ])
    if (s) setSemisList(s as SemisComplet[])
    if (p) setParams(p)
    if (c) setContenants(c)
    if (v) setVentes(v as unknown as BLVente[])
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-green-900">Couts de production</h1>

      <div className="flex rounded-lg overflow-hidden border border-gray-200">
        {[
          { val: 'dashboard', label: 'Coûts' },
          { val: 'ventes', label: '💶 Ventes' },
          { val: 'params', label: 'Params' },
          { val: 'simulateur', label: 'Simulateur' },
        ].map(o => (
          <button key={o.val} onClick={() => setOnglet(o.val as typeof onglet)}
            className={`flex-1 py-2 text-xs font-medium transition-colors
              ${onglet === o.val ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}>
            {o.label}
          </button>
        ))}
      </div>

      {onglet === 'dashboard' && <Dashboard semisList={semisList} />}
      {onglet === 'ventes' && <StatsVentes ventes={ventes} />}
      {onglet === 'params' && <Parametres params={params} contenants={contenants} onSave={charger} />}
      {onglet === 'simulateur' && <Simulateur params={params} contenants={contenants} marge={marge} setMarge={setMarge} />}
    </div>
  )
}

function StatsVentes({ ventes }: { ventes: BLVente[] }) {
  function totalBL(bl: BLVente): number {
    return bl.bl_lignes.reduce((s, l) => s + l.quantite * l.prix_ht * (1 + l.tva_pct / 100), 0)
  }

  const caTotal = ventes.reduce((s, bl) => s + totalBL(bl), 0)

  // CA par mois (6 derniers mois)
  const parMois = new Map<string, number>()
  for (const bl of ventes) {
    const mois = format(parseISO(bl.created_at), 'MMM yy', { locale: fr })
    parMois.set(mois, (parMois.get(mois) || 0) + totalBL(bl))
  }
  const moisData = Array.from(parMois.entries()).reverse().map(([mois, ca]) => ({ mois, ca: Math.round(ca) }))

  // Top clients
  const parClient = new Map<string, { ca: number; nb: number }>()
  for (const bl of ventes) {
    const nom = bl.client?.nom || 'Inconnu'
    const e = parClient.get(nom) || { ca: 0, nb: 0 }
    e.ca += totalBL(bl); e.nb += 1
    parClient.set(nom, e)
  }
  const topClients = Array.from(parClient.entries())
    .map(([nom, v]) => ({ nom, ...v }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 8)

  // Top produits
  const parProduit = new Map<string, { ca: number; qte: number }>()
  for (const bl of ventes) {
    for (const l of bl.bl_lignes) {
      if (l.designation.toLowerCase().includes('livraison')) continue
      const e = parProduit.get(l.designation) || { ca: 0, qte: 0 }
      e.ca += l.quantite * l.prix_ht * (1 + l.tva_pct / 100)
      e.qte += l.quantite
      parProduit.set(l.designation, e)
    }
  }
  const topProduits = Array.from(parProduit.entries())
    .map(([nom, v]) => ({ nom, ...v }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 8)

  const maxClientCa = topClients[0]?.ca || 1
  const maxProduitCa = topProduits[0]?.ca || 1

  if (ventes.length === 0) return (
    <div className="text-center py-12 text-gray-400">
      <div className="text-4xl mb-2">💶</div>
      <p>Aucune vente sur les 6 derniers mois</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500">CA 6 derniers mois (TTC)</div>
          <div className="text-xl font-bold text-green-800">{caTotal.toFixed(0)}€</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Bons de livraison</div>
          <div className="text-xl font-bold text-green-800">{ventes.length}</div>
        </div>
      </div>

      {moisData.length > 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">CA par mois</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={moisData}>
              <XAxis dataKey="mois" fontSize={11} />
              <YAxis fontSize={11} width={40} />
              <Tooltip formatter={(v) => [`${v}€`, 'CA TTC']} />
              <Bar dataKey="ca" fill="#2E7D32" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="text-sm font-semibold text-gray-700 mb-3">🏆 Top clients</div>
        <div className="space-y-2">
          {topClients.map(c => (
            <div key={c.nom}>
              <div className="flex justify-between text-sm mb-0.5">
                <span className="font-medium truncate">{c.nom}</span>
                <span className="text-green-800 font-bold shrink-0 ml-2">{c.ca.toFixed(0)}€ <span className="text-gray-400 font-normal text-xs">({c.nb} BL)</span></span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-600 rounded-full" style={{ width: `${(c.ca / maxClientCa) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="text-sm font-semibold text-gray-700 mb-3">🌱 Top produits</div>
        <div className="space-y-2">
          {topProduits.map(p => (
            <div key={p.nom}>
              <div className="flex justify-between text-sm mb-0.5">
                <span className="font-medium truncate">{p.nom}</span>
                <span className="text-green-800 font-bold shrink-0 ml-2">{p.ca.toFixed(0)}€ <span className="text-gray-400 font-normal text-xs">(×{p.qte})</span></span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(p.ca / maxProduitCa) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Dashboard({ semisList }: { semisList: SemisComplet[] }) {
  const totalGraines = semisList.reduce((s, sem) =>
    s + sem.semis_lignes.reduce((a, l) => a + Number(l.cout_graines || 0), 0), 0)
  const totalSubstrat = semisList.reduce((s, sem) =>
    s + sem.semis_lignes.reduce((a, l) => a + Number(l.cout_terreau || 0), 0), 0)
  const totalContenants = semisList.reduce((s, sem) =>
    s + sem.semis_lignes.reduce((a, l) => a + Number(l.cout_contenant || 0), 0), 0)
  const total = totalGraines + totalSubstrat + totalContenants

  const pieData = [
    { name: 'Graines', value: totalGraines, color: '#2E7D32' },
    { name: 'Substrat', value: totalSubstrat, color: '#5D4037' },
    { name: 'Contenants/Plateaux', value: totalContenants, color: '#E65100' },
  ].filter(d => d.value > 0)

  const parSemaine: Record<string, number> = {}
  semisList.forEach(s => {
    const semaine = format(startOfWeek(parseISO(s.date_semis), { weekStartsOn: 1 }), 'dd/MM', { locale: fr })
    parSemaine[semaine] = (parSemaine[semaine] || 0) + Number(s.cout_total || 0)
  })
  const barData = Object.entries(parSemaine).slice(-8).map(([k, v]) => ({ semaine: k, cout: v }))

  const statsTapis = semisList.flatMap(s => s.semis_lignes.filter(l => l.format === 'TAPIS'))
  const statsTerreau = semisList.flatMap(s => s.semis_lignes.filter(l => l.format === 'TERREAU'))

  const moyTapis = statsTapis.length > 0
    ? statsTapis.reduce((s, l) => s + Number(l.cout_total_ligne || 0), 0) / statsTapis.reduce((s, l) => s + l.quantite, 0)
    : 0
  const moyTerreau = statsTerreau.length > 0
    ? statsTerreau.reduce((s, l) => s + Number(l.cout_total_ligne || 0), 0) / statsTerreau.reduce((s, l) => s + l.quantite, 0)
    : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Total ({semisList.length} semis)</div>
          <div className="text-xl font-bold text-green-900">{total.toFixed(2)}€</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Cout moyen / semis</div>
          <div className="text-xl font-bold text-green-900">
            {semisList.length > 0 ? (total / semisList.length).toFixed(2) : '0.00'}€
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Moy. / caisse tapis</div>
          <div className="text-xl font-bold">{moyTapis.toFixed(2)}€</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Moy. / caisse terreau</div>
          <div className="text-xl font-bold">{moyTerreau.toFixed(2)}€</div>
        </div>
      </div>

      {pieData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold mb-3">Repartition des couts</h3>
          <div className="flex items-center gap-4">
            <PieChart width={120} height={120}>
              <Pie data={pieData} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value">
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
            <div className="space-y-1 text-sm">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                  <span className="text-gray-600">{d.name}</span>
                  <span className="font-medium">{d.value.toFixed(2)}€</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {barData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold mb-3">Cout par semaine</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={barData}>
              <XAxis dataKey="semaine" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: unknown) => `${Number(v).toFixed(2)}€`} />
              <Bar dataKey="cout" fill="#2E7D32" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 font-semibold text-sm border-b border-gray-200">
          Top especes (cout graines)
        </div>
        <TopEspeces semisList={semisList} />
      </div>
    </div>
  )
}

function TopEspeces({ semisList }: { semisList: SemisComplet[] }) {
  const parEspece: Record<string, { nom: string, cout: number }> = {}
  semisList.forEach(s => {
    s.semis_lignes.forEach(l => {
      if (!l.espece) return
      if (!parEspece[l.espece_id]) parEspece[l.espece_id] = { nom: l.espece.nom, cout: 0 }
      parEspece[l.espece_id].cout += Number(l.cout_graines || 0)
    })
  })
  const top5 = Object.values(parEspece).sort((a, b) => b.cout - a.cout).slice(0, 5)
  const max = top5[0]?.cout || 1

  if (top5.length === 0) return (
    <div className="px-3 py-4 text-sm text-gray-400 text-center">Aucune donnee — creez des semis d&apos;abord</div>
  )

  return (
    <div className="divide-y divide-gray-50">
      {top5.map((e, i) => (
        <div key={i} className="px-3 py-2">
          <div className="flex justify-between text-sm mb-1">
            <span>{e.nom}</span>
            <span className="font-medium">{e.cout.toFixed(2)}€</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full">
            <div className="h-full bg-green-600 rounded-full" style={{ width: `${(e.cout / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Parametres({ params, contenants, onSave }: {
  params: ParametresProduction | null
  contenants: Contenant[]
  onSave: () => void
}) {
  const [form, setForm] = useState({
    // Terreau
    cout_terreau_litre: params?.cout_terreau_litre?.toString() || '0.15',
    litres_par_caisse:  params?.litres_par_caisse?.toString()  || '15',
    // TAPIS — plateaux de culture
    prix_plateau:     params?.prix_plateau?.toString()     || '0.08',
    tapis_par_caisse: params?.tapis_par_caisse?.toString() || '24',
    // GODETS
    prix_godet:       params?.prix_godet?.toString()       || '0.078',
    godets_par_serie: params?.godets_par_serie?.toString() || '14',
    litres_par_godet: params?.litres_par_godet?.toString() || '0.3',
  })
  const [saving, setSaving] = useState(false)

  // Apercu des couts calcules
  const prixPlateau    = parseFloat(form.prix_plateau) || 0
  const tapisCaisse    = parseInt(form.tapis_par_caisse) || 24
  const prixGodet      = parseFloat(form.prix_godet) || 0
  const godetsSerie    = parseInt(form.godets_par_serie) || 14
  const litresGodet    = parseFloat(form.litres_par_godet) || 0
  const coutTerreau    = parseFloat(form.cout_terreau_litre) || 0
  const litresCaisse   = parseFloat(form.litres_par_caisse) || 0

  const coutCaisseTerreau = litresCaisse * coutTerreau
  const coutCaisseTapis   = tapisCaisse * prixPlateau
  const coutSerieGodets   = prixGodet + litresGodet * coutTerreau

  async function sauvegarder() {
    setSaving(true)
    if (params) {
      await supabase.from('parametres_production').update({
        cout_terreau_litre: parseFloat(form.cout_terreau_litre),
        litres_par_caisse:  parseFloat(form.litres_par_caisse),
        prix_plateau:       parseFloat(form.prix_plateau),
        tapis_par_caisse:   parseInt(form.tapis_par_caisse),
        prix_godet:         parseFloat(form.prix_godet),
        godets_par_serie:   parseInt(form.godets_par_serie),
        litres_par_godet:   parseFloat(form.litres_par_godet),
        updated_at: new Date().toISOString(),
      }).eq('id', params.id)
    }
    setSaving(false)
    onSave()
    alert('Parametres sauvegardes !')
  }

  function champ(key: keyof typeof form, label: string, note?: string) {
    return (
      <div key={key}>
        <label className="block text-sm text-gray-600 mb-1">{label}</label>
        {note && <div className="text-xs text-gray-400 mb-1">{note}</div>}
        <input type="number" step="0.001" value={form[key]}
          onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" />
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* TAPIS */}
      <div className="bg-white rounded-lg border border-green-200 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-green-800">Tapis (plateaux de culture)</h3>
        <div className="bg-green-50 rounded-lg p-2 text-xs text-green-700">
          Substrat : plateau 67x96x8mm perfore.
        </div>
        {champ('tapis_par_caisse', 'Plateaux par caisse', 'Nombre de tapis dans une caisse (ex: 24)')}
        {champ('prix_plateau', 'Prix plateau (€/piece)', 'Cout reel = produit + transport, ex: 0.08€')}
        <div className="bg-gray-50 rounded-lg p-2 text-sm">
          Cout substrat / caisse : <strong>{coutCaisseTapis.toFixed(2)}€</strong>
          <span className="text-xs text-gray-400 ml-1">({tapisCaisse} × {prixPlateau.toFixed(3)}€)</span>
        </div>
      </div>

      {/* GODETS */}
      <div className="bg-white rounded-lg border border-orange-200 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-orange-800">Godets (TEKU TK914S)</h3>
        <div className="bg-orange-50 rounded-lg p-2 text-xs text-orange-700">
          Plaque recyclable. 1 serie = 1 plaque + terreau.
        </div>
        {champ('godets_par_serie', 'Godets par serie (plaque)', 'Nombre de godets par plaque (ex: 14)')}
        {champ('prix_godet', 'Prix plaque godets (€/plaque)', 'TEKU TK914S, ex: 0.078€/plaque')}
        {champ('litres_par_godet', 'Litres terreau par serie', `Volume total pour une serie de ${godetsSerie} godets`)}
        <div className="bg-gray-50 rounded-lg p-2 text-sm">
          Cout substrat / serie : <strong>{coutSerieGodets.toFixed(2)}€</strong>
          <span className="text-xs text-gray-400 ml-1">
            ({prixGodet.toFixed(3)}€ plaque + {(litresGodet * coutTerreau).toFixed(3)}€ terreau)
          </span>
        </div>
      </div>

      {/* TERREAU */}
      <div className="bg-white rounded-lg border border-stone-200 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-stone-700">Terreau (caisses)</h3>
        {champ('cout_terreau_litre', 'Prix terreau (€/litre)')}
        {champ('litres_par_caisse', 'Litres par caisse terreau')}
        <div className="bg-gray-50 rounded-lg p-2 text-sm">
          Cout substrat / caisse : <strong>{coutCaisseTerreau.toFixed(2)}€</strong>
          <span className="text-xs text-gray-400 ml-1">({litresCaisse}L × {coutTerreau}€/L)</span>
        </div>
      </div>

      {/* Contenants TERREAU */}
      {contenants.filter(c => c.type === 'TERREAU').length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="font-semibold text-sm">Contenants / bacs terreau</h3>
          {contenants.filter(c => c.type === 'TERREAU').map(c => (
            <ContenantRow key={c.id} contenant={c} onSave={onSave} />
          ))}
        </div>
      )}

      <button onClick={sauvegarder} disabled={saving}
        className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50">
        {saving ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </div>
  )
}

function ContenantRow({ contenant, onSave }: { contenant: Contenant, onSave: () => void }) {
  const [val, setVal] = useState(contenant.cout_unitaire.toString())

  async function sauvegarder() {
    await supabase.from('contenants').update({ cout_unitaire: parseFloat(val) }).eq('id', contenant.id)
    onSave()
  }

  return (
    <div className="flex items-center gap-2">
      <label className="flex-1 text-sm text-gray-600">{contenant.nom}</label>
      <input type="number" step="0.01" value={val} onChange={e => setVal(e.target.value)}
        onBlur={sauvegarder}
        className="w-24 border border-gray-200 rounded p-2 text-sm text-right" />
      <span className="text-sm text-gray-400">€</span>
    </div>
  )
}

function Simulateur({ params, contenants, marge, setMarge }: {
  params: ParametresProduction | null
  contenants: Contenant[]
  marge: number
  setMarge: (v: number) => void
}) {
  const cTerreau = contenants.find(c => c.type === 'TERREAU')

  // Couts par unite (caisse / serie) — substrat + contenant
  const prixPlateau  = params?.prix_plateau ?? 0
  const nbTapis      = params?.tapis_par_caisse ?? 24
  const coutTapis    = nbTapis * prixPlateau

  // TERREAU : terreau + bac eventuellement
  const coutTerreauCaisse = params
    ? params.litres_par_caisse * params.cout_terreau_litre
    : 0
  const coutTerreauTotal = coutTerreauCaisse + (cTerreau?.cout_unitaire || 0)

  // GODETS : plaque + terreau
  const prixGodet   = params?.prix_godet ?? 0
  const nbGodets    = params?.godets_par_serie ?? 14
  const litresGodet = params?.litres_par_godet ?? 0
  const coutGodet   = prixGodet + litresGodet * (params?.cout_terreau_litre ?? 0)

  const factor = 1 + marge / 100

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="font-semibold text-sm">Taux de marge souhaite</h3>
        <div className="flex items-center gap-3">
          <input type="range" min={50} max={1000} step={50} value={marge}
            onChange={e => setMarge(parseInt(e.target.value))}
            className="flex-1" />
          <span className="text-lg font-bold text-green-900 w-20 text-right">{marge}%</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
          {[100, 200, 300, 400, 500].map(v => (
            <button key={v} onClick={() => setMarge(v)}
              className={`py-1 rounded border ${marge === v ? 'border-green-600 text-green-600 font-semibold' : 'border-gray-200'}`}>
              x{(1 + v / 100).toFixed(0)} ({v}%)
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 font-semibold text-sm border-b border-gray-200">
          Prix de vente recommandes (hors graines)
        </div>
        <div className="divide-y divide-gray-50">
          {[
            {
              label: `Caisse tapis (${nbTapis} plateaux)`,
              cout: coutTapis,
              detail: `${nbTapis} × ${prixPlateau.toFixed(3)}€ — pas de terreau`,
              unite: 'caisse',
            },
            {
              label: 'Caisse terreau',
              cout: coutTerreauTotal,
              detail: `${params?.litres_par_caisse || 0}L × ${params?.cout_terreau_litre || 0}€/L`,
              unite: 'caisse',
            },
            {
              label: `Serie godets (${nbGodets} godets)`,
              cout: coutGodet,
              detail: `${prixGodet.toFixed(3)}€ plaque + ${(litresGodet * (params?.cout_terreau_litre ?? 0)).toFixed(3)}€ terreau`,
              unite: 'serie',
            },
          ].map(r => (
            <div key={r.label} className="px-3 py-3">
              <div className="text-sm font-medium">{r.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{r.detail}</div>
              <div className="flex justify-between mt-1 text-sm">
                <span className="text-gray-500">Cout substrat : {r.cout.toFixed(3)}€</span>
                <span className="font-bold text-green-800">
                  Min. vente : {(r.cout * factor).toFixed(2)}€/{r.unite}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
        Ces prix incluent uniquement le substrat et les contenants. Ajoutez le cout des graines par espece pour un prix de vente precis.
      </div>
    </div>
  )
}
