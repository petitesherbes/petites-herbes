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

export default function CoutsPage() {
  const [onglet, setOnglet] = useState<'dashboard' | 'params' | 'simulateur'>('dashboard')
  const [semisList, setSemisList] = useState<SemisComplet[]>([])
  const [params, setParams] = useState<ParametresProduction | null>(null)
  const [contenants, setContenants] = useState<Contenant[]>([])
  const [loading, setLoading] = useState(true)
  const [marge, setMarge] = useState(300)

  useEffect(() => { charger() }, [])

  async function charger() {
    const [{ data: s }, { data: p }, { data: c }] = await Promise.all([
      supabase.from('semis').select('*, semis_lignes(*, espece:especes(*))').order('date_semis', { ascending: false }).limit(50),
      supabase.from('parametres_production').select('*').single(),
      supabase.from('contenants').select('*').eq('actif', true),
    ])
    if (s) setSemisList(s as SemisComplet[])
    if (p) setParams(p)
    if (c) setContenants(c)
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-green-900">💶 Coûts de production</h1>

      <div className="flex rounded-lg overflow-hidden border border-gray-200">
        {[
          { val: 'dashboard', label: '📊 Dashboard' },
          { val: 'params', label: '⚙️ Paramètres' },
          { val: 'simulateur', label: '🧮 Simulateur' },
        ].map(o => (
          <button key={o.val} onClick={() => setOnglet(o.val as typeof onglet)}
            className={`flex-1 py-2 text-xs font-medium transition-colors
              ${onglet === o.val ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}>
            {o.label}
          </button>
        ))}
      </div>

      {onglet === 'dashboard' && <Dashboard semisList={semisList} />}
      {onglet === 'params' && <Parametres params={params} contenants={contenants} onSave={charger} />}
      {onglet === 'simulateur' && <Simulateur params={params} contenants={contenants} marge={marge} setMarge={setMarge} />}
    </div>
  )
}

function Dashboard({ semisList }: { semisList: SemisComplet[] }) {
  const totalGraines = semisList.reduce((s, sem) =>
    s + sem.semis_lignes.reduce((a, l) => a + Number(l.cout_graines || 0), 0), 0)
  const totalTerreau = semisList.reduce((s, sem) =>
    s + sem.semis_lignes.reduce((a, l) => a + Number(l.cout_terreau || 0), 0), 0)
  const totalContenants = semisList.reduce((s, sem) =>
    s + sem.semis_lignes.reduce((a, l) => a + Number(l.cout_contenant || 0), 0), 0)
  const total = totalGraines + totalTerreau + totalContenants

  const pieData = [
    { name: 'Graines', value: totalGraines, color: '#2E7D32' },
    { name: 'Terreau', value: totalTerreau, color: '#5D4037' },
    { name: 'Contenants', value: totalContenants, color: '#E65100' },
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
          <div className="text-xs text-gray-500">Coût moyen / semis</div>
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
          <h3 className="text-sm font-semibold mb-3">Répartition des coûts</h3>
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
          <h3 className="text-sm font-semibold mb-3">Coût par semaine</h3>
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
          Top espèces (coût graines)
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
    <div className="px-3 py-4 text-sm text-gray-400 text-center">Aucune donnée — créez des semis d'abord</div>
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
    cout_terreau_litre: params?.cout_terreau_litre?.toString() || '0.15',
    litres_par_caisse: params?.litres_par_caisse?.toString() || '15',
    litres_par_tapis: params?.litres_par_tapis?.toString() || '3',
    litres_par_godet: params?.litres_par_godet?.toString() || '0.3',
  })
  const [saving, setSaving] = useState(false)

  async function sauvegarder() {
    setSaving(true)
    if (params) {
      await supabase.from('parametres_production').update({
        cout_terreau_litre: parseFloat(form.cout_terreau_litre),
        litres_par_caisse: parseFloat(form.litres_par_caisse),
        litres_par_tapis: parseFloat(form.litres_par_tapis),
        litres_par_godet: parseFloat(form.litres_par_godet),
        updated_at: new Date().toISOString(),
      }).eq('id', params.id)
    }
    setSaving(false)
    onSave()
    alert('Paramètres sauvegardés !')
  }

  const fields = [
    { key: 'cout_terreau_litre', label: 'Prix du terreau (€/litre)' },
    { key: 'litres_par_caisse', label: 'Litres par caisse terreau' },
    { key: 'litres_par_tapis', label: 'Litres par plateau tapis' },
    { key: 'litres_par_godet', label: 'Litres par godet' },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="font-semibold text-sm">Terreau</h3>
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-sm text-gray-600 mb-1">{f.label}</label>
            <input type="number" step="0.01" value={form[f.key as keyof typeof form]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="font-semibold text-sm">Contenants</h3>
        {contenants.map(c => (
          <ContenantRow key={c.id} contenant={c} onSave={onSave} />
        ))}
      </div>

      <button onClick={sauvegarder} disabled={saving}
        className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50">
        {saving ? 'Sauvegarde...' : '💾 Sauvegarder'}
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
  const cTapis = contenants.find(c => c.type === 'TAPIS')
  const cTerreau = contenants.find(c => c.type === 'TERREAU')
  const cGodets = contenants.find(c => c.type === 'GODET')

  const coutTapis = (params ? params.litres_par_tapis * params.cout_terreau_litre : 0) + (cTapis?.cout_unitaire || 0)
  const coutTerreau = (params ? params.litres_par_caisse * params.cout_terreau_litre : 0) + (cTerreau?.cout_unitaire || 0)
  const coutGodets = (params ? params.litres_par_godet * 14 * params.cout_terreau_litre : 0) + (cGodets?.cout_unitaire || 0)

  const factor = 1 + marge / 100

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="font-semibold text-sm">Taux de marge souhaité</h3>
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
              ×{(1 + v / 100).toFixed(0)} ({v}%)
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 font-semibold text-sm border-b border-gray-200">
          Prix de vente recommandés
        </div>
        <div className="divide-y divide-gray-50">
          {[
            { label: '🟩 Caisse tapis (×24 tapis)', cout: coutTapis, unite: 'caisse' },
            { label: '🟫 Caisse terreau', cout: coutTerreau, unite: 'caisse' },
            { label: '🟧 Série godets (×14)', cout: coutGodets, unite: 'série' },
          ].map(r => (
            <div key={r.label} className="px-3 py-3">
              <div className="text-sm font-medium">{r.label}</div>
              <div className="flex justify-between mt-1 text-sm">
                <span className="text-gray-500">Coût: {r.cout.toFixed(2)}€</span>
                <span className="font-bold text-green-800">
                  Prix: {(r.cout * factor).toFixed(2)}€/{r.unite}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
        💡 Ces prix incluent uniquement terreau et contenants. Ajoutez le coût des graines par espèce pour un prix plus précis.
      </div>
    </div>
  )
}
