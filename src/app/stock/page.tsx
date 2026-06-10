'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Espece, SemisLigne, StockMouvement } from '@/types'
import { format, parseISO, differenceInDays, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'

interface LigneStock extends SemisLigne {
  espece: Espece
}

// Calcule la consommation hebdomadaire moyenne sur les 4 dernières semaines
function consommationHebdo(especeId: string, mouvements: StockMouvement[]): number {
  const il_y_a_28j = subDays(new Date(), 28)
  const mvts = mouvements.filter(
    m => m.espece_id === especeId && m.type === 'semis' && new Date(m.created_at) >= il_y_a_28j
  )
  if (mvts.length === 0) return 0
  const totalConsome = mvts.reduce((s, m) => s + Math.abs(m.quantite_g), 0)
  return totalConsome / 4 // g/semaine
}

function joursRestants(espece: Espece, mouvements: StockMouvement[]): number | null {
  const hebdo = consommationHebdo(espece.id, mouvements)
  if (hebdo === 0) return null
  return Math.round((espece.stock_actuel_g / hebdo) * 7)
}

function couleurJours(jours: number | null): { badge: string; bar: string } {
  if (jours === null) return { badge: 'bg-gray-100 text-gray-500', bar: 'bg-gray-300' }
  if (jours <= 7)  return { badge: 'bg-red-100 text-red-700 font-bold', bar: 'bg-red-500' }
  if (jours <= 14) return { badge: 'bg-orange-100 text-orange-700 font-bold', bar: 'bg-orange-400' }
  if (jours <= 28) return { badge: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400' }
  return { badge: 'bg-green-100 text-green-700', bar: 'bg-green-500' }
}

export default function StockPage() {
  const [onglet, setOnglet] = useState<'produits' | 'graines'>('produits')
  const [lignesDispo, setLignesDispo] = useState<LigneStock[]>([])
  const [especes, setEspeces] = useState<Espece[]>([])
  const [mouvements, setMouvements] = useState<StockMouvement[]>([])
  const [loading, setLoading] = useState(true)
  const [reapproModal, setReapproModal] = useState<Espece | null>(null)
  const [listeCoursesOuverte, setListeCoursesOuverte] = useState(false)

  useEffect(() => { charger() }, [])

  async function charger() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const il_y_a_28j = format(subDays(new Date(), 28), 'yyyy-MM-dd')
    const [{ data: lignes }, { data: esp }, { data: mvts }] = await Promise.all([
      supabase
        .from('semis_lignes')
        .select('*, espece:especes(*)')
        .lte('date_dispo', today)
        .gte('date_peremption', today),
      supabase.from('especes').select('*').eq('actif', true).order('section,nom'),
      supabase.from('stock_mouvements')
        .select('*')
        .eq('type', 'semis')
        .gte('created_at', il_y_a_28j),
    ])
    if (lignes) setLignesDispo(lignes as unknown as LigneStock[])
    if (esp) setEspeces(esp)
    if (mvts) setMouvements(mvts as StockMouvement[])
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>

  // Espèces critiques pour "liste de courses"
  const especesCritiques = especes.filter(e => {
    const jours = joursRestants(e, mouvements)
    if (jours !== null) return jours <= 14
    return e.stock_actuel_g < 200
  })

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-green-900">📦 Stock</h1>
        {onglet === 'graines' && especesCritiques.length > 0 && (
          <button
            onClick={() => setListeCoursesOuverte(true)}
            className="bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm flex items-center gap-1.5">
            🛒 Liste de courses
            <span className="bg-white/30 px-1.5 rounded-full">{especesCritiques.length}</span>
          </button>
        )}
      </div>

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
      {onglet === 'graines' && (
        <StockGraines especes={especes} mouvements={mouvements} onReappro={setReapproModal} />
      )}

      {reapproModal && (
        <ReapproModal espece={reapproModal} onClose={() => setReapproModal(null)} onDone={charger} />
      )}

      {listeCoursesOuverte && (
        <ListeCoursesModal
          especes={especesCritiques}
          mouvements={mouvements}
          onClose={() => setListeCoursesOuverte(false)}
        />
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

function StockGraines({ especes, mouvements, onReappro }: {
  especes: Espece[]
  mouvements: StockMouvement[]
  onReappro: (e: Espece) => void
}) {
  const sections = [
    { key: 'TAPIS', label: 'Tapis', ico: '🟩' },
    { key: 'TERREAU', label: 'Terreau', ico: '🟫' },
    { key: 'GODETS', label: 'Godets', ico: '🟧' },
  ]

  // Barre basée sur les semaines restantes (cible = 8 semaines)
  function getPct(e: Espece): number {
    const hebdo = consommationHebdo(e.id, mouvements)
    if (hebdo > 0) {
      const semaines = e.stock_actuel_g / hebdo
      return Math.min(100, (semaines / 8) * 100) // 100% = 8 semaines devant soi
    }
    // Fallback si pas d'historique
    const ref = Math.max(e.stock_actuel_g * 1.2, 500)
    return Math.min(100, (e.stock_actuel_g / ref) * 100)
  }

  return (
    <div className="space-y-4">
      {/* Légende */}
      <div className="flex gap-3 text-xs flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>≤ 7j</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block"></span>≤ 14j</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>≤ 4 sem.</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>OK</span>
        <span className="text-gray-400 ml-auto">Barre = % vers 8 semaines</span>
      </div>

      {sections.map(sec => {
        const esp = especes.filter(e => e.section === sec.key)
        return (
          <div key={sec.key} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 font-semibold text-sm border-b border-gray-200">
              {sec.ico} {sec.label}
            </div>
            <div className="divide-y divide-gray-50">
              {esp.map(e => {
                const jours = joursRestants(e, mouvements)
                const pct = getPct(e)
                const { badge, bar } = couleurJours(jours)
                const hebdo = consommationHebdo(e.id, mouvements)
                return (
                  <div key={e.id} className="px-3 py-3">
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm font-medium truncate">{e.nom}</span>
                        {jours !== null && (
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${badge}`}>
                            {jours}j
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-sm font-bold text-gray-700">
                          {e.stock_actuel_g >= 1000
                            ? `${(e.stock_actuel_g / 1000).toFixed(2)}kg`
                            : `${e.stock_actuel_g.toFixed(0)}g`}
                        </span>
                        <button onClick={() => onReappro(e)}
                          className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full hover:bg-green-200 whitespace-nowrap">
                          + Réappro
                        </button>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex gap-3 flex-wrap">
                      {e.prix_graine_kg && <span>{e.prix_graine_kg}€/kg</span>}
                      {hebdo > 0 && (
                        <span>{hebdo >= 1000
                          ? `~${(hebdo / 1000).toFixed(2)}kg/sem.`
                          : `~${hebdo.toFixed(0)}g/sem.`}
                        </span>
                      )}
                    </div>
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

function ListeCoursesModal({ especes, mouvements, onClose }: {
  especes: Espece[]
  mouvements: StockMouvement[]
  onClose: () => void
}) {
  // Cible : 8 semaines de production
  const CIBLE_SEMAINES = 8

  const lignes = especes.map(e => {
    const hebdo = consommationHebdo(e.id, mouvements)
    const cibleG = hebdo > 0 ? hebdo * CIBLE_SEMAINES : 500
    const aCommanderG = Math.max(0, cibleG - e.stock_actuel_g)
    // Arrondir au conditionnement supérieur (250g)
    const aCommanderGArrondi = Math.ceil(aCommanderG / 250) * 250
    const coutEstime = e.prix_graine_kg ? (aCommanderGArrondi / 1000) * e.prix_graine_kg : null
    const jours = joursRestants(e, mouvements)
    return { espece: e, aCommanderG: aCommanderGArrondi, coutEstime, jours, hebdo }
  }).filter(l => l.aCommanderG > 0)

  const totalEstime = lignes.reduce((s, l) => s + (l.coutEstime || 0), 0)

  function formaterQte(g: number) {
    return g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)}kg` : `${g}g`
  }

  const texteListeCourses = lignes
    .map(l => `• ${l.espece.nom}: ${formaterQte(l.aCommanderG)}${l.coutEstime ? ` (~${l.coutEstime.toFixed(2)}€)` : ''}`)
    .join('\n')

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 pb-24 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">🛒 Liste de courses</h2>
          <span className="text-xs text-gray-500">Objectif : {CIBLE_SEMAINES} sem. de production</span>
        </div>

        {lignes.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Pas de commandes urgentes !</div>
        ) : (
          <>
            <div className="space-y-2">
              {lignes.map(({ espece, aCommanderG, coutEstime, jours }) => {
                const { badge } = couleurJours(jours)
                return (
                  <div key={espece.id} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{espece.nom}</span>
                        {jours !== null && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge}`}>{jours}j restants</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Stock actuel : {espece.stock_actuel_g >= 1000
                          ? `${(espece.stock_actuel_g / 1000).toFixed(2)}kg`
                          : `${espece.stock_actuel_g.toFixed(0)}g`}
                        {espece.prix_graine_kg && ` · ${espece.prix_graine_kg}€/kg`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-800 text-sm">
                        Commander {formaterQte(aCommanderG)}
                      </div>
                      {coutEstime != null && (
                        <div className="text-xs text-gray-500">~{coutEstime.toFixed(2)}€</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {totalEstime > 0 && (
              <div className="bg-green-50 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-green-800">Total estimé</span>
                <span className="text-lg font-bold text-green-900">~{totalEstime.toFixed(2)}€</span>
              </div>
            )}

            <button
              onClick={() => {
                navigator.clipboard.writeText(texteListeCourses)
                alert('Liste copiée dans le presse-papier !')
              }}
              className="w-full py-3 rounded-xl bg-green-700 text-white font-semibold text-sm">
              📋 Copier la liste
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ReapproModal({ espece, onClose, onDone }: { espece: Espece, onClose: () => void, onDone: () => void }) {
  const conditionnements = [250, 500, 1000, 2500, 5000, 10000, 20000]
  const [mode, setMode] = useState<'reappro' | 'correction'>('reappro')
  const [qteg, setQteg] = useState(500)
  const [stockExact, setStockExact] = useState(espece.stock_actuel_g.toString())
  const [prixKg, setPrixKg] = useState(espece.prix_graine_kg?.toString() || '')
  const [saving, setSaving] = useState(false)

  async function valider() {
    setSaving(true)
    const prix = parseFloat(prixKg) || null

    if (mode === 'reappro') {
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
    } else {
      const exact = parseFloat(stockExact) || 0
      // Utilise 'ajustement' — le seul type valide pour les corrections manuelles
      await supabase.from('stock_mouvements').insert({
        espece_id: espece.id,
        type: 'ajustement',
        quantite_g: exact - espece.stock_actuel_g,
        prix_kg: prix,
      })
      await supabase.from('especes').update({
        stock_actuel_g: exact,
        ...(prix ? { prix_graine_kg: prix } : {}),
      }).eq('id', espece.id)
    }

    setSaving(false)
    onDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 pb-24 space-y-4"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Graines — {espece.nom}</h2>
        <p className="text-sm text-gray-500">Stock actuel : <strong>
          {espece.stock_actuel_g >= 1000
            ? `${(espece.stock_actuel_g / 1000).toFixed(2)}kg`
            : `${espece.stock_actuel_g}g`}
        </strong></p>

        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          <button onClick={() => setMode('reappro')}
            className={`flex-1 py-2 text-sm font-medium transition-colors
              ${mode === 'reappro' ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}>
            ➕ Réappro
          </button>
          <button onClick={() => setMode('correction')}
            className={`flex-1 py-2 text-sm font-medium transition-colors
              ${mode === 'correction' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600'}`}>
            ✏️ Correction manuelle
          </button>
        </div>

        {mode === 'reappro' ? (
          <div>
            <label className="block text-sm font-medium mb-2">Quantité reçue</label>
            <div className="grid grid-cols-4 gap-2">
              {conditionnements.map(q => (
                <button key={q} onClick={() => setQteg(q)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors
                    ${qteg === q ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-700'}`}>
                  {q >= 1000 ? `${q / 1000}kg` : `${q}g`}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Nouveau stock après réappro : {espece.stock_actuel_g + qteg >= 1000
                ? `${((espece.stock_actuel_g + qteg) / 1000).toFixed(2)}kg`
                : `${espece.stock_actuel_g + qteg}g`}
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">Poids exact en stock (g)</label>
            <input
              type="number" step="1" placeholder="ex: 350"
              value={stockExact} onChange={e => setStockExact(e.target.value)}
              className="w-full border-2 border-amber-300 rounded-lg p-3 text-lg font-bold text-center"
            />
            <p className="text-xs text-amber-700 mt-2 bg-amber-50 rounded p-2">
              ⚠️ Ceci remplace le stock actuel par la valeur saisie (remise à zéro ou correction d&apos;inventaire)
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Prix d&apos;achat (€/kg) — optionnel</label>
          <input type="number" step="0.01" placeholder="ex: 15.00" value={prixKg}
            onChange={e => setPrixKg(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-3" />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600">
            Annuler
          </button>
          <button onClick={valider} disabled={saving}
            className={`flex-1 py-3 rounded-lg text-white font-semibold disabled:opacity-50
              ${mode === 'correction' ? 'bg-amber-600' : 'bg-green-700'}`}>
            {saving ? 'Enregistrement...' : mode === 'reappro'
              ? `+ ${qteg >= 1000 ? qteg / 1000 + 'kg' : qteg + 'g'}`
              : `✅ Définir à ${parseFloat(stockExact) || 0}g`}
          </button>
        </div>
      </div>
    </div>
  )
}
