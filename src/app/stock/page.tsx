'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Espece, SemisLigne } from '@/types'
import { format, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'

interface LigneStock extends SemisLigne {
  espece: Espece
}

export default function StockPage() {
  const [onglet, setOnglet] = useState<'produits' | 'graines'>('produits')
  const [lignesDispo, setLignesDispo] = useState<LigneStock[]>([])
  const [especes, setEspeces] = useState<Espece[]>([])
  const [loading, setLoading] = useState(true)
  const [reapproModal, setReapproModal] = useState<Espece | null>(null)

  useEffect(() => { charger() }, [])

  async function charger() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const [{ data: lignes }, { data: esp }] = await Promise.all([
      supabase
        .from('semis_lignes')
        .select('*, espece:especes(*)')
        .lte('date_dispo', today)
        .gte('date_peremption', today),
      supabase.from('especes').select('*').eq('actif', true).order('section,nom'),
    ])
    if (lignes) setLignesDispo(lignes as unknown as LigneStock[])
    if (esp) setEspeces(esp)
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-green-900">📦 Stock</h1>

      <div className="flex rounded-lg overflow-hidden border border-gray-200">
        <button onClick={() => setOnglet('produits')}
          className={`flex-1 py-2 text-sm font-medium transition-colors
            ${onglet === 'produits' ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}>
          Produits disponibles
        </button>
        <button onClick={() => setOnglet('graines')}
          className={`flex-1 py-2 text-sm font-medium transition-colors
            ${onglet === 'graines' ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}>
          Stock graines
        </button>
      </div>

      {onglet === 'produits' && <StockProduits lignes={lignesDispo} />}
      {onglet === 'graines' && <StockGraines especes={especes} onReappro={setReapproModal} />}

      {reapproModal && (
        <ReapproModal espece={reapproModal} onClose={() => setReapproModal(null)} onDone={charger} />
      )}
    </div>
  )
}

function StockProduits({ lignes }: { lignes: LigneStock[] }) {
  const aujourd = new Date(); aujourd.setHours(0, 0, 0, 0)

  if (lignes.length === 0) return (
    <div className="text-center py-12 text-gray-400">
      <div className="text-4xl mb-2">📦</div>
      <p>Aucun produit disponible en ce moment</p>
    </div>
  )

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">{lignes.length} produit(s) disponible(s)</p>
      {lignes.map(l => {
        const jours = l.date_peremption
          ? differenceInDays(parseISO(l.date_peremption), aujourd)
          : null
        const ico = l.format === 'TAPIS' ? '🟩' : l.format === 'TERREAU' ? '🟫' : '🟧'
        const urgent = jours !== null && jours <= 2
        return (
          <div key={l.id} className={`bg-white rounded-lg border p-3 ${urgent ? 'border-red-200' : 'border-gray-200'}`}>
            <div className="flex justify-between items-start">
              <span className="font-medium text-sm">{ico} {l.espece?.nom}</span>
              {jours !== null && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                  ${jours <= 2 ? 'bg-red-100 text-red-600' : jours <= 5 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                  {jours}j
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1 flex gap-3 flex-wrap">
              <span>Qté: {l.quantite}</span>
              {l.prod_estimee != null && <span>~{Number(l.prod_estimee).toFixed(0)} unités</span>}
              {l.date_dispo && <span>Depuis: {format(parseISO(l.date_dispo), 'd MMM', { locale: fr })}</span>}
              {l.date_peremption && <span>Expire: {format(parseISO(l.date_peremption), 'd MMM', { locale: fr })}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StockGraines({ especes, onReappro }: { especes: Espece[], onReappro: (e: Espece) => void }) {
  const sections = [
    { key: 'TAPIS', label: 'Tapis', ico: '🟩' },
    { key: 'TERREAU', label: 'Terreau', ico: '🟫' },
    { key: 'GODETS', label: 'Godets', ico: '🟧' },
  ]

  function getMax(e: Espece) { return Math.max(e.stock_actuel_g * 1.5, 500) }
  function getPct(e: Espece) { return Math.min(100, (e.stock_actuel_g / getMax(e)) * 100) }
  function getColor(pct: number) {
    if (pct < 20) return { bar: 'bg-red-500', text: 'text-red-600' }
    if (pct < 40) return { bar: 'bg-orange-400', text: 'text-orange-600' }
    return { bar: 'bg-green-500', text: 'text-green-600' }
  }

  return (
    <div className="space-y-4">
      {sections.map(sec => {
        const esp = especes.filter(e => e.section === sec.key)
        return (
          <div key={sec.key} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 font-semibold text-sm border-b border-gray-200">
              {sec.ico} {sec.label}
            </div>
            <div className="divide-y divide-gray-50">
              {esp.map(e => {
                const pct = getPct(e)
                const { bar, text } = getColor(pct)
                return (
                  <div key={e.id} className="px-3 py-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{e.nom}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${text}`}>
                          {e.stock_actuel_g.toFixed(0)}g
                        </span>
                        <button onClick={() => onReappro(e)}
                          className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full hover:bg-green-200">
                          + Réappro
                        </button>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    {e.prix_graine_kg && (
                      <div className="text-xs text-gray-400 mt-1">{e.prix_graine_kg}€/kg</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ReapproModal({ espece, onClose, onDone }: { espece: Espece, onClose: () => void, onDone: () => void }) {
  const conditionnements = [250, 500, 1000, 2500, 5000, 10000, 20000]
  const [qteg, setQteg] = useState(500)
  const [prixKg, setPrixKg] = useState(espece.prix_graine_kg?.toString() || '')
  const [saving, setSaving] = useState(false)

  async function valider() {
    setSaving(true)
    const prix = parseFloat(prixKg) || null
    await supabase.from('stock_mouvements').insert({
      espece_id: espece.id,
      type: 'reappro',
      quantite_g: qteg,
      prix_kg: prix,
    })
    await supabase.from('especes').update({
      stock_actuel_g: espece.stock_actuel_g + qteg,
      ...(prix ? { prix_graine_kg: prix } : {}),
    }).eq('id', espece.id)
    setSaving(false)
    onDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 space-y-4"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Réappro — {espece.nom}</h2>
        <p className="text-sm text-gray-500">Stock actuel : {espece.stock_actuel_g}g</p>

        <div>
          <label className="block text-sm font-medium mb-2">Quantité</label>
          <div className="grid grid-cols-4 gap-2">
            {conditionnements.map(q => (
              <button key={q} onClick={() => setQteg(q)}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors
                  ${qteg === q ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-700'}`}>
                {q >= 1000 ? `${q / 1000}kg` : `${q}g`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Prix d&apos;achat (€/kg)</label>
          <input type="number" step="0.01" placeholder="ex: 15.00" value={prixKg}
            onChange={e => setPrixKg(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-3" />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600">
            Annuler
          </button>
          <button onClick={valider} disabled={saving}
            className="flex-1 py-3 rounded-lg bg-green-700 text-white font-semibold disabled:opacity-50">
            {saving ? 'Enregistrement...' : `+ ${qteg >= 1000 ? qteg / 1000 + 'kg' : qteg + 'g'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
