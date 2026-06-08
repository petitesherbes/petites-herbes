'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Espece, Template, SemisLigneForm, Format, ParametresProduction, Contenant } from '@/types'
import {
  calculerPoidsGraines, calculerProdEstimee, calculerDates,
  calculerCoutGraines, calculerCoutTerreau, calculerCoutContenant, recapSemis
} from '@/lib/calculs'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

type LigneAvecId = SemisLigneForm & { _id: number }

let _nextId = 0
function newId() { return _nextId++ }

export default function NouveauSemisPage() {
  const router = useRouter()
  const [etape, setEtape] = useState<1 | 2 | 3>(1)
  const [dateSemis, setDateSemis] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [templateChoisi, setTemplateChoisi] = useState<string>('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [especes, setEspeces] = useState<Espece[]>([])
  const [params, setParams] = useState<ParametresProduction | null>(null)
  const [contenants, setContenants] = useState<Contenant[]>([])
  const [lignes, setLignes] = useState<LigneAvecId[]>([])
  const [saving, setSaving] = useState(false)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [nouveauTemplateName, setNouveauTemplateName] = useState('')
  const [avertissements, setAvertissements] = useState<string[]>([])

  useEffect(() => { chargerDonnees() }, [])

  async function chargerDonnees() {
    const [{ data: t }, { data: e }, { data: p }, { data: c }] = await Promise.all([
      supabase.from('templates').select('*, templates_lignes(*, espece:especes(*))').order('nom'),
      supabase.from('especes').select('*').eq('actif', true).order('section,nom'),
      supabase.from('parametres_production').select('*').single(),
      supabase.from('contenants').select('*').eq('actif', true),
    ])
    if (t) setTemplates(t)
    if (e) setEspeces(e)
    if (p) setParams(p)
    if (c) setContenants(c)
  }

  function appliquerTemplate(templateId: string) {
    const t = templates.find(t => t.id === templateId)
    if (!t?.templates_lignes) return
    const nouvLignes: LigneAvecId[] = t.templates_lignes
      .sort((a, b) => a.ordre - b.ordre)
      .map(tl => ({
        _id: newId(),
        espece_id: tl.espece_id,
        format: tl.format as Format,
        quantite: tl.quantite,
        espece: tl.espece,
      }))
    setLignes(nouvLignes)
    setTemplateChoisi(t.nom)
  }

  function ajouterLigne(fmt: Format) {
    const especesFiltrees = especesPourFormat(fmt)
    if (especesFiltrees.length === 0) return
    setLignes(prev => [...prev, {
      _id: newId(),
      espece_id: especesFiltrees[0].id,
      format: fmt,
      quantite: 1,
      espece: especesFiltrees[0],
    }])
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

  function especesPourFormat(fmt: Format) {
    return especes.filter(e =>
      fmt === 'TAPIS' ? e.section === 'TAPIS' :
      fmt === 'GODET' ? e.section === 'GODETS' : e.section === 'TERREAU'
    )
  }

  const calculerLigne = useCallback((l: LigneAvecId) => {
    if (!l.espece || !params) return { poids: 0, prod: 0, coutG: 0, coutT: 0, coutC: 0, total: 0 }
    const poids = calculerPoidsGraines(l.espece, l.format, l.quantite)
    const prod = calculerProdEstimee(l.espece, poids)
    const coutG = calculerCoutGraines(poids, l.espece.prix_graine_kg)
    const coutT = calculerCoutTerreau(l.format, l.quantite, params)
    const coutC = calculerCoutContenant(l.format, l.quantite, contenants, params)
    return { poids, prod, coutG, coutT, coutC, total: coutG + coutT + coutC }
  }, [params, contenants, especes])

  const recap = recapSemis(lignes)
  const totalPoids = lignes.reduce((s, l) => s + calculerLigne(l).poids, 0)
  const totalCout = lignes.reduce((s, l) => s + calculerLigne(l).total, 0)

  function passerEtape3() {
    // Avertissements prix manquants
    const sansP = lignes.filter(l => l.espece && !l.espece.prix_graine_kg).map(l => l.espece!.nom)
    setAvertissements([...new Set(sansP)])
    setEtape(3)
  }

  async function validerSemis() {
    if (lignes.length === 0) return
    setSaving(true)

    const { data: semisData, error } = await supabase
      .from('semis')
      .insert({ date_semis: dateSemis, nom_template: templateChoisi || null, cout_total: totalCout })
      .select().single()

    if (error || !semisData) { setSaving(false); alert('Erreur lors de la création du semis'); return }

    const lignesInsert = lignes.map(l => {
      const calc = calculerLigne(l)
      const dates = l.espece ? calculerDates(new Date(dateSemis + 'T12:00:00'), l.espece) : { date_dispo: null, date_peremption: null }
      return {
        semis_id: semisData.id,
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

    // Mouvements stock + mise à jour
    for (const l of lignes) {
      const poids = calculerLigne(l).poids
      const esp = especes.find(e => e.id === l.espece_id)
      if (!esp || poids === 0) continue
      await supabase.from('stock_mouvements').insert({
        espece_id: l.espece_id, type: 'semis', quantite_g: -poids, semis_id: semisData.id,
      })
      await supabase.from('especes')
        .update({ stock_actuel_g: Math.max(0, esp.stock_actuel_g - poids) })
        .eq('id', l.espece_id)
    }

    if (saveAsTemplate && nouveauTemplateName.trim()) {
      const { data: newT } = await supabase.from('templates')
        .insert({ nom: nouveauTemplateName.trim() }).select().single()
      if (newT) {
        await supabase.from('templates_lignes').insert(
          lignes.map((l, i) => ({ template_id: newT.id, espece_id: l.espece_id, format: l.format, quantite: l.quantite, ordre: i }))
        )
      }
    }

    // Email en arrière-plan (ne bloque pas)
    fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateSemis, templateNom: templateChoisi,
        lignes: lignes.map(l => ({ espece: l.espece, format: l.format, quantite: l.quantite, calc: calculerLigne(l) })),
        recap, totalPoids, totalCout,
      }),
    }).catch(() => {})

    setSaving(false)
    router.push('/historique')
  }

  if (etape === 1) return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-green-900">🌱 Nouveau Semis</h1>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Date de semis</label>
        <input type="date" value={dateSemis} onChange={e => setDateSemis(e.target.value)}
          className="w-full border-2 border-gray-200 rounded-xl p-3 text-base focus:border-green-500 focus:outline-none" />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Choisir un template</label>
        <div className="space-y-2">
          {templates.map(t => (
            <button key={t.id} onClick={() => appliquerTemplate(t.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all
                ${templateChoisi === t.nom
                  ? 'border-green-600 bg-green-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-green-300'}`}>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-800">{t.nom}</div>
                {templateChoisi === t.nom && <span className="text-green-600 text-lg">✓</span>}
              </div>
              {t.description && <div className="text-sm text-gray-500 mt-0.5">{t.description}</div>}
            </button>
          ))}
          <button onClick={() => { setTemplateChoisi(''); setLignes([]) }}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all
              ${templateChoisi === '' && lignes.length === 0
                ? 'border-green-600 bg-green-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-green-300'}`}>
            <div className="flex items-center justify-between">
              <div className="font-semibold text-gray-800">Semis vide</div>
              {templateChoisi === '' && lignes.length === 0 && <span className="text-green-600 text-lg">✓</span>}
            </div>
            <div className="text-sm text-gray-500">Ajouter les espèces manuellement</div>
          </button>
        </div>
      </div>

      <button onClick={() => setEtape(2)}
        className="w-full bg-green-700 hover:bg-green-800 text-white py-4 rounded-xl font-bold text-base transition-colors shadow-sm">
        Continuer →
      </button>
    </div>
  )

  if (etape === 2) {
    const lignesTapis = lignes.filter(l => l.format === 'TAPIS')
    const lignesTerreau = lignes.filter(l => l.format === 'TERREAU')
    const lignesGodets = lignes.filter(l => l.format === 'GODET')

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setEtape(1)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">←</button>
          <div>
            <h1 className="text-lg font-bold text-green-900">Semis du {format(new Date(dateSemis + 'T12:00:00'), 'dd/MM/yyyy')}</h1>
            {templateChoisi && <div className="text-xs text-gray-500">{templateChoisi}</div>}
          </div>
        </div>

        {/* Bandeau récap sticky */}
        <div className="sticky top-0 z-10 bg-green-900 text-white rounded-xl p-3 text-sm shadow-lg">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>🟩 <strong>{recap.tapis}</strong> caisses ({recap.tapis * 24} tapis)</span>
            <span>🟫 <strong>{recap.terreau}</strong> caisses</span>
            <span>🟧 <strong>{recap.godets}</strong> séries ({recap.godets * 14} godets)</span>
          </div>
          <div className="flex gap-4 mt-2 pt-2 border-t border-green-700 text-green-200">
            <span>⚖️ {totalPoids.toFixed(0)}g graines</span>
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
          className="w-full bg-green-700 hover:bg-green-800 text-white py-4 rounded-xl font-bold text-base disabled:opacity-40 transition-colors shadow-sm">
          Valider ce semis →
        </button>
      </div>
    )
  }

  // Étape 3 — Confirmation
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setEtape(2)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">←</button>
        <h1 className="text-xl font-bold text-green-900">✅ Confirmation</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="text-lg font-bold text-gray-900">
          Semis du {format(new Date(dateSemis + 'T12:00:00'), 'dd/MM/yyyy')}
        </div>
        {templateChoisi && <div className="text-sm text-gray-500">Template : {templateChoisi}</div>}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="font-semibold text-green-800">🟩 Tapis</div>
            <div className="text-xl font-bold">{recap.tapis}</div>
            <div className="text-xs text-gray-500">{recap.tapis * 24} tapis</div>
          </div>
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="font-semibold text-stone-700">🟫 Terreau</div>
            <div className="text-xl font-bold">{recap.terreau}</div>
            <div className="text-xs text-gray-500">caisses</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="font-semibold text-orange-700">🟧 Godets</div>
            <div className="text-xl font-bold">{recap.godets}</div>
            <div className="text-xs text-gray-500">{recap.godets * 14} godets</div>
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
          <div className="text-xs text-orange-600">
            Le coût affiché est incomplet pour : {avertissements.join(', ')}.
            Renseignez les prix dans Paramètres → Espèces.
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={saveAsTemplate} onChange={e => setSaveAsTemplate(e.target.checked)}
            className="w-5 h-5 accent-green-700" />
          <span className="text-sm font-medium">Enregistrer comme template</span>
        </label>
        {saveAsTemplate && (
          <input type="text" placeholder="Nom du template (ex: Mercredi type)"
            value={nouveauTemplateName} onChange={e => setNouveauTemplateName(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg p-2.5 text-sm focus:border-green-500 focus:outline-none" />
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700">
        📧 Un bon de production sera envoyé par email automatiquement.
      </div>

      <button onClick={validerSemis} disabled={saving}
        className="w-full bg-green-700 hover:bg-green-800 text-white py-4 rounded-xl font-bold text-base disabled:opacity-50 transition-colors shadow-sm">
        {saving ? '⏳ Enregistrement...' : '✅ Confirmer le semis'}
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
          className="bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1 text-sm font-semibold transition-colors">
          + Ajouter
        </button>
      </div>
      <div className={`${colors.light}`}>
        {lignes.length === 0 ? (
          <div className="px-3 py-5 text-sm text-gray-400 text-center">
            Appuyez sur + Ajouter pour commencer
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {lignes.map(l => {
              const calc = calculer(l)
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
                        className="px-2.5 py-2 text-gray-500 hover:bg-gray-100 text-lg leading-none">−</button>
                      <span className="w-8 text-center text-sm font-semibold">{l.quantite}</span>
                      <button onClick={() => onModifier(l._id, 'quantite', l.quantite + 1)}
                        className="px-2.5 py-2 text-gray-500 hover:bg-gray-100 text-lg leading-none">+</button>
                    </div>
                    <button onClick={() => onSupprimer(l._id)}
                      className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">✕</button>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500 pl-1">
                    <span>⚖️ {calc.poids.toFixed(1)}g</span>
                    {sansPrix
                      ? <span className="text-orange-500">⚠️ Prix manquant</span>
                      : <span>💶 {calc.total.toFixed(2)}€</span>
                    }
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
