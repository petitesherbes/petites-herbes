'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithCache } from '@/lib/offline'
import { loadTestMode } from '@/lib/testMode'
import { Semis, SemisLigne, Espece } from '@/types'
import { format, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'

interface SemisComplet extends Semis {
  semis_lignes: (SemisLigne & { espece: Espece })[]
}

export default function HistoriquePage() {
  const [semisList, setSemisList] = useState<SemisComplet[]>([])
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtreStatut, setFiltreStatut] = useState<'tous' | 'en_cours' | 'disponible' | 'perime'>('tous')

  useEffect(() => { charger() }, [])

  async function charger() {
    const isTest = loadTestMode()
    const cacheKey = isTest ? 'semis_complets_test' : 'semis_complets_prod'
    const { data } = await fetchWithCache(cacheKey, async () => {
      const { data: s } = await supabase
        .from('semis')
        .select('*, semis_lignes(*, espece:especes(*))')
        .eq('is_test', isTest)
        .order('date_semis', { ascending: false })
      return s
    })
    if (data.length) setSemisList(data as unknown as SemisComplet[])
    setLoading(false)
  }

  function statutSemis(s: SemisComplet): 'en_cours' | 'disponible' | 'perime' {
    const today = format(new Date(), 'yyyy-MM-dd')
    const lignes = s.semis_lignes.filter(l => l.date_dispo && l.date_peremption)
    if (lignes.length === 0) return 'en_cours'
    const toutesPerimees = lignes.every(l => l.date_peremption! < today)
    const toutesDispos = lignes.every(l => l.date_dispo! <= today)
    if (toutesPerimees) return 'perime'
    if (toutesDispos) return 'disponible'
    return 'en_cours'
  }

  const semisFiltres = semisList.filter(s =>
    filtreStatut === 'tous' ? true : statutSemis(s) === filtreStatut
  )

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-green-900">📋 Historique</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { val: 'tous', label: 'Tous' },
          { val: 'en_cours', label: '🌱 En cours' },
          { val: 'disponible', label: '✅ Disponible' },
          { val: 'perime', label: '❌ Périmé' },
        ].map(f => (
          <button key={f.val} onClick={() => setFiltreStatut(f.val as typeof filtreStatut)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${filtreStatut === f.val ? 'bg-green-700 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {semisFiltres.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">📋</div>
          <p>Aucun semis</p>
        </div>
      )}

      <div className="space-y-2">
        {semisFiltres.map(s => {
          const statut = statutSemis(s)
          const isOpen = ouvert === s.id
          const tapis = s.semis_lignes.filter(l => l.format === 'TAPIS')
          const terreau = s.semis_lignes.filter(l => l.format === 'TERREAU')
          const godets = s.semis_lignes.filter(l => l.format === 'GODET')
          const statutColors = {
            en_cours: 'bg-blue-100 text-blue-700',
            disponible: 'bg-green-100 text-green-700',
            perime: 'bg-gray-100 text-gray-500',
          }[statut]

          return (
            <div key={s.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => setOuvert(isOpen ? null : s.id)}
                className="w-full text-left px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900 capitalize">
                    {format(parseISO(s.date_semis), 'EEEE d MMM yyyy', { locale: fr })}
                  </div>
                  <div className="text-sm text-gray-500 flex gap-2 flex-wrap mt-0.5">
                    {s.nom_template && <span>{s.nom_template}</span>}
                    <span>{s.semis_lignes.length} espèces</span>
                    {s.cout_total != null && <span>💶 {Number(s.cout_total).toFixed(2)}€</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statutColors}`}>
                    {statut === 'en_cours' ? 'En cours' : statut === 'disponible' ? 'Disponible' : 'Périmé'}
                  </span>
                  <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  <SemisDetail semis={s} tapis={tapis} terreau={terreau} godets={godets} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SemisDetail({ semis, tapis, terreau, godets }: {
  semis: SemisComplet
  tapis: (SemisLigne & { espece: Espece })[]
  terreau: (SemisLigne & { espece: Espece })[]
  godets: (SemisLigne & { espece: Espece })[]
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [recoltes, setRecoltes] = useState<Record<string, number | null>>(
    () => Object.fromEntries(semis.semis_lignes.map(l => [l.id, l.recolte_reelle ?? null]))
  )

  async function saisirRecolte(ligne: SemisLigne & { espece: Espece }) {
    const actuel = recoltes[ligne.id]
    const saisie = prompt(
      `Récolte réelle pour ${ligne.espece?.nom} (en grammes)${ligne.prod_estimee ? `\nEstimé : ${Number(ligne.prod_estimee).toFixed(0)}g` : ''}`,
      actuel != null ? String(actuel) : ''
    )
    if (saisie === null) return
    const valeur = saisie.trim() === '' ? null : Number(saisie.replace(',', '.'))
    if (valeur !== null && (isNaN(valeur) || valeur < 0)) { alert('Valeur invalide'); return }
    await supabase.from('semis_lignes').update({ recolte_reelle: valeur }).eq('id', ligne.id)
    setRecoltes(prev => ({ ...prev, [ligne.id]: valeur }))
  }

  async function renvoyerEmail() {
    await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateSemis: semis.date_semis,
        templateNom: semis.nom_template,
        lignes: semis.semis_lignes.map(l => ({
          espece: l.espece,
          format: l.format,
          quantite: l.quantite,
          calc: {
            poids: l.poids_graines_g || 0,
            coutG: l.cout_graines || 0,
            coutT: l.cout_terreau || 0,
            coutC: l.cout_contenant || 0,
            total: l.cout_total_ligne || 0,
          }
        })),
        recap: {
          tapis: tapis.reduce((s, l) => s + l.quantite, 0),
          terreau: terreau.reduce((s, l) => s + l.quantite, 0),
          godets: godets.reduce((s, l) => s + l.quantite, 0),
        },
        totalPoids: semis.semis_lignes.reduce((s, l) => s + Number(l.poids_graines_g || 0), 0),
        totalCout: semis.cout_total || 0,
      }),
    })
    alert('Email renvoyé !')
  }

  async function sauvegarderTemplate() {
    const nom = prompt('Nom du template :')
    if (!nom) return
    const { data: t } = await supabase.from('templates').insert({ nom }).select().single()
    if (t) {
      const lignes = semis.semis_lignes.map((l, i) => ({
        template_id: t.id,
        espece_id: l.espece_id,
        format: l.format,
        quantite: l.quantite,
        ordre: i,
      }))
      await supabase.from('templates_lignes').insert(lignes)
      alert('Template sauvegardé !')
    }
  }

  const renderGroupe = (lignes: (SemisLigne & { espece: Espece })[], titre: string, ico: string) => {
    if (lignes.length === 0) return null
    return (
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2 bg-gray-50">
          {ico} {titre}
        </div>
        <div className="divide-y divide-gray-50">
          {lignes.map(l => {
            const isDispos = l.date_dispo && l.date_dispo <= today
            const isPerime = l.date_peremption && l.date_peremption < today
            const jours = l.date_peremption
              ? differenceInDays(parseISO(l.date_peremption), new Date())
              : null
            return (
              <div key={l.id} className="px-4 py-2 text-sm">
                <div className="flex justify-between items-start">
                  <span className="font-medium">{l.espece?.nom}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    isPerime ? 'bg-gray-100 text-gray-400' :
                    isDispos ? 'bg-green-100 text-green-700' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {isPerime ? 'Périmé' : isDispos ? `Dispo (${jours}j)` : 'En pousse'}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5 flex gap-3 flex-wrap">
                  <span>×{l.quantite}</span>
                  {l.poids_graines_g != null && <span>⚖️ {Number(l.poids_graines_g).toFixed(1)}g</span>}
                  {l.date_dispo && <span>Dispo: {format(parseISO(l.date_dispo), 'd MMM', { locale: fr })}</span>}
                  {l.date_peremption && <span>Expire: {format(parseISO(l.date_peremption), 'd MMM', { locale: fr })}</span>}
                  {l.cout_total_ligne != null && <span>💶 {Number(l.cout_total_ligne).toFixed(2)}€</span>}
                </div>
                {(isDispos || isPerime) && (() => {
                  const recolte = recoltes[l.id]
                  const estime  = l.prod_estimee ? Number(l.prod_estimee) : null
                  const pct     = recolte != null && estime ? Math.round((recolte / estime) * 100) : null
                  return (
                    <button onClick={() => saisirRecolte(l)}
                      className={`mt-1.5 text-xs px-2 py-1 rounded-lg border font-medium
                        ${recolte != null
                          ? pct != null && pct >= 90 ? 'border-green-200 bg-green-50 text-green-700'
                          : pct != null && pct >= 70 ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-red-200 bg-red-50 text-red-600'
                          : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                      {recolte != null
                        ? `📥 Récolté : ${recolte.toFixed(0)}g${pct != null ? ` (${pct}% de l'estimé)` : ''}`
                        : '📥 Saisir la récolte réelle'}
                    </button>
                  )
                })()}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      {renderGroupe(tapis, 'TAPIS', '🟩')}
      {renderGroupe(terreau, 'TERREAU', '🟫')}
      {renderGroupe(godets, 'GODETS', '🟧')}
      <div className="px-4 py-3 grid grid-cols-3 gap-2 border-t border-gray-100">
        <a href={`/semis/${semis.id}/modifier`}
          className="text-center text-sm py-2 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 font-medium">
          ✏️ Modifier
        </a>
        <button onClick={sauvegarderTemplate}
          className="text-sm py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
          💾 Template
        </button>
        <button onClick={renvoyerEmail}
          className="text-sm py-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50">
          📧 Email
        </button>
      </div>
    </div>
  )
}
