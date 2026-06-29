'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Espece, SemisLigneForm, Format, ParametresProduction, Contenant } from '@/types'
import {
  calculerPoidsGraines, calculerProdEstimee, calculerDates,
  calculerCoutGraines, calculerCoutTerreau, calculerCoutContenant, recapSemis,
  tapisParCaisse, godetsParSerie
} from '@/lib/calculs'
import { format } from 'date-fns'
import { useRouter, useParams } from 'next/navigation'

type LigneAvecId = SemisLigneForm & { _id: number; ligneDbId?: string }

let _nextId = 100
function newId() { return _nextId++ }

export default function ModifierSemisPage() {
  const router   = useRouter()
  const { id }   = useParams<{ id: string }>()

  const [dateSemis, setDateSemis]   = useState('')
  const [templateNom, setTemplateNom] = useState('')
  const [especes, setEspeces]       = useState<Espece[]>([])
  const [params, setParams]         = useState<ParametresProduction | null>(null)
  const [contenants, setContenants] = useState<Contenant[]>([])
  const [lignes, setLignes]         = useState<LigneAvecId[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [etape, setEtape]           = useState<2 | 3>(2)
  const [avertissements, setAvertissements] = useState<string[]>([])

  useEffect(() => { charger() }, [id])

  async function charger() {
    const [{ data: semis }, { data: e }, { data: p }, { data: c }] = await Promise.all([
      supabase.from('semis')
        .select('*, semis_lignes(*, espece:especes(*))')
        .eq('id', id).single(),
      supabase.from('especes').select('*').eq('actif', true).order('section,nom'),
      supabase.from('parametres_production').select('*').single(),
      supabase.from('contenants').select('*').eq('actif', true),
    ])

    if (!semis) { router.push('/historique'); return }

    setDateSemis(semis.date_semis)
    setTemplateNom(semis.nom_template || '')
    if (e) setEspeces(e)
    if (p) setParams(p)
    if (c) setContenants(c)

    const lignesChargees: LigneAvecId[] = (semis.semis_lignes || []).map((l: {
      id: string; espece_id: string; format: Format; quantite: number
      espece: Espece
    }) => ({
      _id: newId(),
      ligneDbId: l.id,
      espece_id: l.espece_id,
      format: l.format,
      quantite: l.quantite,
      espece: l.espece,
    }))
    setLignes(lignesChargees)
    setLoading(false)
  }

  function especesPourFormat(fmt: Format) {
    return especes.filter(e => {
      if (e.formats_autorises?.length) return e.formats_autorises.includes(fmt)
      return fmt === 'TAPIS' ? e.section === 'TAPIS' : (e.section === 'TERREAU' || e.section === 'GODETS')
    })
  }

  function ajouterLigne(fmt: Format) {
    const esp = especesPourFormat(fmt)
    if (esp.length === 0) return
    setLignes(prev => [...prev, { _id: newId(), espece_id: esp[0].id, format: fmt, quantite: 1, espece: esp[0] }])
  }

  function supprimerLigne(id: number) {
    setLignes(prev => prev.filter(l => l._id !== id))
  }

  function modifierLigne(id: number, champ: 'espece_id' | 'quantite', valeur: string | number) {
    setLignes(prev => prev.map(l => {
      if (l._id !== id) return l
      if (champ === 'espece_id') {
        const esp = especes.find(e => e.id === valeur)
        return { ...l, espece_id: valeur as string, espece: esp }
      }
      return { ...l, quantite: Math.max(1, Number(valeur)) }
    }))
  }

  const calculerLigne = useCallback((l: LigneAvecId) => {
    if (!l.espece || !params) return { poids: 0, prod: 0, coutG: 0, coutT: 0, coutC: 0, total: 0 }
    const poids = calculerPoidsGraines(l.espece, l.format, l.quantite, params)
    const prod  = calculerProdEstimee(l.espece, poids)
    const coutG = calculerCoutGraines(poids, l.espece.prix_graine_kg)
    const coutT = calculerCoutTerreau(l.format, l.quantite, params)
    const coutC = calculerCoutContenant(l.format, l.quantite, contenants, params)
    return { poids, prod, coutG, coutT, coutC, total: coutG + coutT + coutC }
  }, [params, contenants, especes])

  const recap      = recapSemis(lignes)
  const totalPoids = lignes.reduce((s, l) => s + calculerLigne(l).poids, 0)
  const totalCout  = lignes.reduce((s, l) => s + calculerLigne(l).total, 0)

  function passerEtape3() {
    const sansP = lignes.filter(l => l.espece && !l.espece.prix_graine_kg).map(l => l.espece!.nom)
    setAvertissements([...new Set(sansP)])
    setEtape(3)
  }

  async function sauvegarder() {
    if (lignes.length === 0) return
    setSaving(true)

    // 1. Charger les anciennes lignes pour recalculer le delta stock
    const { data: anciennesLignes } = await supabase
      .from('semis_lignes')
      .select('espece_id, poids_graines_g')
      .eq('semis_id', id)

    // 2. Supprimer anciennes lignes et mouvements
    await Promise.all([
      supabase.from('semis_lignes').delete().eq('semis_id', id),
      supabase.from('stock_mouvements').delete().eq('semis_id', id).eq('type', 'semis'),
    ])

    // 3. Restituer le stock des anciennes lignes
    for (const al of (anciennesLignes || [])) {
      const poids = Number(al.poids_graines_g || 0)
      if (poids === 0) continue
      const { data: esp } = await supabase.from('especes').select('stock_actuel_g').eq('id', al.espece_id).single()
      if (esp) {
        await supabase.from('especes')
          .update({ stock_actuel_g: (esp.stock_actuel_g || 0) + poids })
          .eq('id', al.espece_id)
      }
    }

    // 4. Insérer nouvelles lignes
    const lignesInsert = lignes.map(l => {
      const calc  = calculerLigne(l)
      const dates = l.espece ? calculerDates(new Date(dateSemis + 'T12:00:00'), l.espece) : { date_dispo: null, date_peremption: null }
      return {
        semis_id: id,
        espece_id: l.espece_id,
        format: l.format,
        quantite: l.quantite,
        poids_graines_g: calc.poids,
        prod_estimee: calc.prod,
        date_dispo: dates.date_dispo,
        date_peremption: dates.date_peremption,
        cout_graines: calc.coutG,
        cout_terreau: calc.coutT,
        cout_contenant: calc.coutC,
        cout_total_ligne: calc.total,
      }
    })
    await supabase.from('semis_lignes').insert(lignesInsert)

    // 5. Nouveaux mouvements stock + mise à jour espèces
    for (const l of lignes) {
      const poids = calculerLigne(l).poids
      const esp   = especes.find(e => e.id === l.espece_id)
      if (!esp || poids === 0) continue
      await supabase.from('stock_mouvements').insert({
        espece_id: l.espece_id, type: 'semis', quantite_g: -poids, semis_id: id,
      })
      const { data: espActuel } = await supabase.from('especes').select('stock_actuel_g').eq('id', l.espece_id).single()
      if (espActuel) {
        await supabase.from('especes')
          .update({ stock_actuel_g: Math.max(0, (espActuel.stock_actuel_g || 0) - poids) })
          .eq('id', l.espece_id)
      }
    }

    // 6. Mettre à jour le coût total du semis
    await supabase.from('semis').update({ cout_total: totalCout }).eq('id', id)

    setSaving(false)
    router.push('/historique')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">Chargement…</div>
  )

  const lignesTapis   = lignes.filter(l => l.format === 'TAPIS')
  const lignesTerreau = lignes.filter(l => l.format === 'TERREAU')
  const lignesGodets  = lignes.filter(l => l.format === 'GODET')

  if (etape === 2) return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/historique')}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">←</button>
        <div>
          <h1 className="text-lg font-bold text-green-900">✏️ Modifier semis</h1>
          <div className="text-xs text-gray-500">
            {format(new Date(dateSemis + 'T12:00:00'), 'dd/MM/yyyy')}
            {templateNom && ` · ${templateNom}`}
          </div>
        </div>
      </div>

      {/* Bandeau récap sticky */}
      <div className="sticky top-0 z-10 bg-green-900 text-white rounded-xl p-3 text-sm shadow-lg">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>🟩 <strong>{recap.tapis}</strong> caisses ({recap.tapis * tapisParCaisse(params)} tapis)</span>
          <span>🟫 <strong>{recap.terreau}</strong> caisses</span>
          <span>🟧 <strong>{recap.godets}</strong> séries ({recap.godets * godetsParSerie(params)} godets)</span>
        </div>
        <div className="flex gap-4 mt-2 pt-2 border-t border-green-700 text-green-200">
          <span>⚖️ {totalPoids.toFixed(0)}g</span>
          <span className="text-white font-semibold">💶 {totalCout.toFixed(2)}€</span>
        </div>
      </div>

      <SectionLignes titre="🟩 TAPIS" couleur="tapis" lignes={lignesTapis}
        especes={especesPourFormat('TAPIS')} format="TAPIS"
        onModifier={modifierLigne} onSupprimer={supprimerLigne}
        onAjouter={() => ajouterLigne('TAPIS')} calculer={calculerLigne} />

      <SectionLignes titre="🟫 TERREAU" couleur="terreau" lignes={lignesTerreau}
        especes={especesPourFormat('TERREAU')} format="TERREAU"
        onModifier={modifierLigne} onSupprimer={supprimerLigne}
        onAjouter={() => ajouterLigne('TERREAU')} calculer={calculerLigne} />

      <SectionLignes titre="🟧 GODETS" couleur="godets" lignes={lignesGodets}
        especes={especesPourFormat('GODET')} format="GODET"
        onModifier={modifierLigne} onSupprimer={supprimerLigne}
        onAjouter={() => ajouterLigne('GODET')} calculer={calculerLigne} />

      <button onClick={passerEtape3} disabled={lignes.length === 0}
        className="w-full bg-green-700 text-white py-4 rounded-xl font-bold text-base disabled:opacity-40 shadow-sm">
        Vérifier les modifications →
      </button>
    </div>
  )

  // Étape 3 — Confirmation
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setEtape(2)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">←</button>
        <h1 className="text-xl font-bold text-green-900">✅ Confirmer la modification</h1>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
        ⚠️ La modification recalcule le stock en annulant l&apos;ancien semis et appliquant le nouveau. Les données de production sont mises à jour.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="font-bold text-gray-900">
          Semis du {format(new Date(dateSemis + 'T12:00:00'), 'dd/MM/yyyy')}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="font-semibold text-green-800">🟩 Tapis</div>
            <div className="text-xl font-bold">{recap.tapis}</div>
            <div className="text-xs text-gray-500">{recap.tapis * tapisParCaisse(params)} tapis</div>
          </div>
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="font-semibold text-stone-700">🟫 Terreau</div>
            <div className="text-xl font-bold">{recap.terreau}</div>
            <div className="text-xs text-gray-500">caisses</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="font-semibold text-orange-700">🟧 Godets</div>
            <div className="text-xl font-bold">{recap.godets}</div>
            <div className="text-xs text-gray-500">{recap.godets * godetsParSerie(params)} godets</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-semibold text-gray-700">💶 Coût</div>
            <div className="text-xl font-bold">{totalCout.toFixed(2)}€</div>
            <div className="text-xs text-gray-500">{lignes.length} espèces</div>
          </div>
        </div>
      </div>

      {avertissements.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
          <div className="text-sm font-semibold text-orange-700 mb-1">⚠️ Prix graines manquants</div>
          <div className="text-xs text-orange-600">Coût incomplet pour : {avertissements.join(', ')}</div>
        </div>
      )}

      <button onClick={sauvegarder} disabled={saving}
        className="w-full bg-green-700 text-white py-4 rounded-xl font-bold text-base disabled:opacity-50 shadow-sm">
        {saving ? '⏳ Mise à jour…' : '✅ Enregistrer les modifications'}
      </button>
    </div>
  )
}

function SectionLignes({ titre, couleur, lignes, especes, format: fmt, onModifier, onSupprimer, onAjouter, calculer }: {
  titre: string; couleur: 'tapis' | 'terreau' | 'godets'
  lignes: LigneAvecId[]; especes: Espece[]; format: Format
  onModifier: (id: number, champ: 'espece_id' | 'quantite', val: string | number) => void
  onSupprimer: (id: number) => void
  onAjouter: () => void
  calculer: (l: LigneAvecId) => { poids: number; total: number; coutG: number }
}) {
  const colors = {
    tapis:   { header: 'bg-green-700',  light: 'bg-green-50',  border: 'border-green-200' },
    terreau: { header: 'bg-stone-700',  light: 'bg-stone-50',  border: 'border-stone-200' },
    godets:  { header: 'bg-orange-700', light: 'bg-orange-50', border: 'border-orange-200' },
  }[couleur]

  return (
    <div className={`rounded-xl border ${colors.border} overflow-hidden shadow-sm`}>
      <div className={`${colors.header} text-white px-3 py-2.5 font-bold text-sm flex justify-between items-center`}>
        <span>{titre} <span className="font-normal opacity-80">({lignes.length})</span></span>
        <button onClick={onAjouter}
          className="bg-white/20 rounded-lg px-3 py-1 text-sm font-semibold">
          + Ajouter
        </button>
      </div>
      <div className={colors.light}>
        {lignes.length === 0 ? (
          <div className="px-3 py-5 text-sm text-gray-400 text-center">Aucune ligne</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {lignes.map(l => {
              const calc     = calculer(l)
              const sansPrix = l.espece && !l.espece.prix_graine_kg
              return (
                <div key={l._id} className="px-3 py-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    <select value={l.espece_id}
                      onChange={e => onModifier(l._id, 'espece_id', e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg p-2 text-sm bg-white focus:border-green-500 focus:outline-none">
                      {especes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                    </select>
                    <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden">
                      <button onClick={() => onModifier(l._id, 'quantite', l.quantite - 1)}
                        className="px-2.5 py-2 text-gray-500 text-lg leading-none">−</button>
                      <span className="w-8 text-center text-sm font-semibold">{l.quantite}</span>
                      <button onClick={() => onModifier(l._id, 'quantite', l.quantite + 1)}
                        className="px-2.5 py-2 text-gray-500 text-lg leading-none">+</button>
                    </div>
                    <button onClick={() => onSupprimer(l._id)}
                      className="w-8 h-8 flex items-center justify-center text-red-400 rounded-lg">✕</button>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500 pl-1">
                    <span>⚖️ {calc.poids.toFixed(1)}g</span>
                    {sansPrix
                      ? <span className="text-orange-500">⚠️ Prix manquant</span>
                      : <span>💶 {calc.total.toFixed(2)}€</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
