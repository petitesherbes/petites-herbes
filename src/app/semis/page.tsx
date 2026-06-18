'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWithCache, queueMutation, saveCache } from '@/lib/offline'
import { Espece, Template, SemisLigneForm, Format, ParametresProduction, Contenant } from '@/types'
import {
  calculerPoidsGraines, calculerProdEstimee, calculerDates,
  calculerCoutGraines, calculerCoutTerreau, calculerCoutContenant, recapSemis,
  tapisParCaisse, godetsParSerie
} from '@/lib/calculs'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useRouter } from 'next/navigation'

type LigneAvecId = SemisLigneForm & { _id: number }

type Zone = { id: string; nom: string; type: string; superficie_m2: number | null; description: string | null; ordre: number; actif: boolean }
type StatutCulture  = 'semis' | 'pret_planter' | 'en_place' | 'recolte' | 'termine'
type FamilleCulture = 'champs' | 'micro_pousse'
type Culture = {
  id: string; espece: string; nom: string | null; zone_id: string | null
  statut: StatutCulture; famille: FamilleCulture
  date_semis: string | null; date_plantation: string | null
  date_debut_recolte: string | null; date_fin_recolte: string | null
  quantite: string | null; notes: string | null; auteur: string | null; actif: boolean
}

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
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [nouveauTemplateName, setNouveauTemplateName] = useState('')
  const [avertissements, setAvertissements] = useState<string[]>([])
  const [demande, setDemande] = useState<{ designation: string; total: number; nbClients: number }[]>([])
  const [demandeOuverte, setDemandeOuverte] = useState(false)
  const [vue, setVue] = useState<'semis' | 'cultures'>('semis')
  const [cultures, setCultures] = useState<Culture[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [culturesChargees, setCulturesChargees] = useState(false)

  useEffect(() => { chargerDonnees() }, [])

  async function chargerDonnees() {
    const [t, e, pArr, c, rec] = await Promise.all([
      fetchWithCache('templates', async () => {
        const { data } = await supabase.from('templates').select('*, templates_lignes(*, espece:especes(*))').order('nom')
        return data
      }).then(r => r.data),
      fetchWithCache('especes', async () => {
        const { data } = await supabase.from('especes').select('*').eq('actif', true).order('section,nom')
        return data
      }).then(r => r.data),
      fetchWithCache<ParametresProduction>('params_production', async () => {
        const { data } = await supabase.from('parametres_production').select('*').single()
        return data ? [data as ParametresProduction] : []
      }).then(r => r.data),
      fetchWithCache('contenants', async () => {
        const { data } = await supabase.from('contenants').select('*').eq('actif', true)
        return data
      }).then(r => r.data),
      supabase.from('commandes_recurrentes').select('designation, quantite, client_id').eq('actif', true).then(r => r.data),
    ])
    if (t?.length) setTemplates(t)
    if (e?.length) setEspeces(e)
    if (pArr?.[0]) setParams(pArr[0])
    if (c?.length) setContenants(c)
    // Agréger la demande des commandes habituelles par produit
    if (rec && rec.length > 0) {
      const parProduit = new Map<string, { total: number; clients: Set<string> }>()
      for (const l of rec) {
        const entry = parProduit.get(l.designation) || { total: 0, clients: new Set<string>() }
        entry.total += Number(l.quantite)
        entry.clients.add(l.client_id)
        parProduit.set(l.designation, entry)
      }
      setDemande(
        Array.from(parProduit.entries())
          .map(([designation, v]) => ({ designation, total: v.total, nbClients: v.clients.size }))
          .sort((a, b) => b.total - a.total)
      )
    }
  }

  async function chargerCultures() {
    if (culturesChargees) return
    const [cult, zon] = await Promise.all([
      fetchWithCache('cultures', async () => {
        const { data } = await supabase.from('cultures').select('*').eq('actif', true)
          .order('created_at', { ascending: false })
        return data
      }).then(r => r.data),
      fetchWithCache('zones', async () => {
        const { data } = await supabase.from('zones').select('*').eq('actif', true).order('ordre')
        return data
      }).then(r => r.data),
    ])
    if (cult?.length) setCultures(cult as unknown as Culture[])
    if (zon?.length)  setZones(zon as unknown as Zone[])
    setCulturesChargees(true)
  }

  async function refreshCultures() {
    const [{ data: cult }, { data: zon }] = await Promise.all([
      supabase.from('cultures').select('*').eq('actif', true).order('created_at', { ascending: false }),
      supabase.from('zones').select('*').eq('actif', true).order('ordre'),
    ])
    if (cult) setCultures(cult as unknown as Culture[])
    if (zon)  setZones(zon as unknown as Zone[])
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
      fmt === 'TAPIS'
        ? e.section === 'TAPIS'
        : (e.section === 'TERREAU' || e.section === 'GODETS')
    )
  }

  const calculerLigne = useCallback((l: LigneAvecId) => {
    if (!l.espece || !params) return { poids: 0, prod: 0, coutG: 0, coutT: 0, coutC: 0, total: 0 }
    const poids = calculerPoidsGraines(l.espece, l.format, l.quantite, params)
    const prod = calculerProdEstimee(l.espece, poids)
    const coutG = calculerCoutGraines(poids, l.espece.prix_graine_kg)
    const coutT = calculerCoutTerreau(l.format, l.quantite, params)
    const coutC = calculerCoutContenant(l.format, l.quantite, contenants, params)
    return { poids, prod, coutG, coutT, coutC, total: coutG + coutT + coutC }
  }, [params, contenants, especes])

  async function telechargerBonTravail() {
    setGeneratingPdf(true)
    try {
      const body = {
        lignes: lignes.map(l => ({
          espece: l.espece?.nom ?? '',
          format: l.format,
          quantite: l.quantite,
          poids: calculerLigne(l).poids,
        })),
        dateSemis,
        templateNom: templateChoisi || undefined,
        tapisParCaisse: params?.tapis_par_caisse ?? 24,
        godetsParSerie: params?.godets_par_serie ?? 14,
      }
      const res = await fetch('/api/pdf/semis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `semis-${dateSemis}.pdf`
        document.body.appendChild(a); a.click()
        document.body.removeChild(a); URL.revokeObjectURL(url)
      }
    } finally {
      setGeneratingPdf(false)
    }
  }

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

    // Génère l'UUID ici pour pouvoir l'utiliser offline
    const semisId = crypto.randomUUID()
    const semisPayload = { id: semisId, date_semis: dateSemis, nom_template: templateChoisi || null, cout_total: totalCout }

    const lignesInsert = lignes.map(l => {
      const calc = calculerLigne(l)
      const dates = l.espece ? calculerDates(new Date(dateSemis + 'T12:00:00'), l.espece) : { date_dispo: null, date_peremption: null }
      return {
        semis_id: semisId,
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

    // Fiches culture automatiques (TAPIS = micro_pousse, GODET = champs)
    const culturesPayload = lignes
      .filter(l => l.format === 'TAPIS' || l.format === 'GODET')
      .map(l => ({
        espece: l.espece?.nom ?? '',
        nom: l.format === 'TAPIS' ? `Tapis ×${l.quantite}` : `Godet ×${l.quantite}`,
        famille: l.format === 'TAPIS' ? 'micro_pousse' : 'champs',
        statut: 'semis',
        date_semis: dateSemis,
        quantite: String(l.quantite),
      }))

    if (!navigator.onLine) {
      // Queue toutes les opérations pour sync ultérieure
      await queueMutation({ table: 'semis', method: 'insert', payload: semisPayload })
      await queueMutation({ table: 'semis_lignes', method: 'insert', payload: lignesInsert })
      if (culturesPayload.length > 0)
        await queueMutation({ table: 'cultures', method: 'insert', payload: culturesPayload })
      for (const l of lignes) {
        const poids = calculerLigne(l).poids
        const esp = especes.find(e => e.id === l.espece_id)
        if (!esp || poids === 0) continue
        await queueMutation({ table: 'stock_mouvements', method: 'insert', payload: { espece_id: l.espece_id, type: 'semis', quantite_g: -poids, semis_id: semisId } })
        await queueMutation({ table: 'especes', method: 'update', payload: { stock_actuel_g: Math.max(0, esp.stock_actuel_g - poids) }, matchCol: 'id', matchVal: l.espece_id })
      }
      // Mise à jour optimiste du cache espèces
      const especesUpdated = especes.map(e => {
        const ligne = lignes.find(l => l.espece_id === e.id)
        if (!ligne) return e
        return { ...e, stock_actuel_g: Math.max(0, e.stock_actuel_g - calculerLigne(ligne).poids) }
      })
      await saveCache('especes', especesUpdated)
      setSaving(false)
      router.push('/semis/historique')
      return
    }

    const { data: semisData, error } = await supabase
      .from('semis')
      .insert(semisPayload)
      .select().single()

    if (error || !semisData) { setSaving(false); alert('Erreur lors de la création du semis'); return }

    await supabase.from('semis_lignes').insert(lignesInsert)
    if (culturesPayload.length > 0) await supabase.from('cultures').insert(culturesPayload)

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

  if (vue === 'cultures') return (
    <div className="p-4 pb-24">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setVue('semis')}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">←</button>
        <h1 className="text-xl font-bold text-green-900">🌾 Suivi cultures</h1>
      </div>
      <CulturesTab cultures={cultures} zones={zones} onSaved={refreshCultures} />
    </div>
  )

  if (etape === 1) return (
    <div className="p-4 space-y-5">
      <div className="flex gap-2">
        <button className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-green-700 text-white">
          🌱 Nouveau semis
        </button>
        <button onClick={() => { setVue('cultures'); chargerCultures() }}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600">
          🌾 Cultures
        </button>
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

        {/* Demande clients (commandes habituelles) */}
        {demande.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl overflow-hidden">
            <button onClick={() => setDemandeOuverte(o => !o)}
              className="w-full px-3 py-2.5 flex justify-between items-center text-sm font-semibold text-indigo-800">
              <span>🛒 Demande clients ({demande.length} produits commandés régulièrement)</span>
              <span className="text-indigo-400">{demandeOuverte ? '▲' : '▼'}</span>
            </button>
            {demandeOuverte && (
              <div className="divide-y divide-indigo-100 border-t border-indigo-100">
                {demande.map(d => (
                  <div key={d.designation} className="px-3 py-2 flex justify-between items-center text-sm bg-white">
                    <span className="text-gray-700">{d.designation}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{d.nbClients} client{d.nbClients > 1 ? 's' : ''}</span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full text-xs">× {d.total}/sem.</span>
                    </span>
                  </div>
                ))}
                <div className="px-3 py-2 text-[11px] text-indigo-400 bg-indigo-50">
                  Totaux hebdomadaires des commandes habituelles enregistrées par vos clients — à couvrir par vos semis.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bandeau récap sticky */}
        <div className="sticky top-0 z-10 bg-green-900 text-white rounded-xl p-3 text-sm shadow-lg">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>🟩 <strong>{recap.tapis}</strong> caisses ({recap.tapis * tapisParCaisse(params)} tapis)</span>
            <span>🟫 <strong>{recap.terreau}</strong> caisses</span>
            <span>🟧 <strong>{recap.godets}</strong> séries ({recap.godets * godetsParSerie(params)} godets)</span>
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

      <button onClick={telechargerBonTravail} disabled={generatingPdf || saving}
        className="w-full border-2 border-green-600 text-green-700 py-3.5 rounded-xl font-semibold text-sm disabled:opacity-50 active:scale-95 transition-transform flex items-center justify-center gap-2">
        {generatingPdf ? '⏳ Génération PDF...' : '📄 Télécharger le bon de travail'}
      </button>

      <button onClick={validerSemis} disabled={saving}
        className="w-full bg-green-700 hover:bg-green-800 text-white py-4 rounded-xl font-bold text-base disabled:opacity-50 transition-colors shadow-sm">
        {saving ? '⏳ Enregistrement...' : '✅ Confirmer le semis'}
      </button>
    </div>
  )
}

// ─── Cultures ────────────────────────────────────────────────────────────────

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

const CHAINE_CHAMPS:         StatutCulture[] = ['semis','pret_planter','en_place','recolte','termine']
const CHAINE_MICRO:          StatutCulture[] = ['semis','en_place','recolte','termine']
const STATUTS_ACTIFS_CHAMPS: StatutCulture[] = ['semis','pret_planter','en_place','recolte']
const STATUTS_ACTIFS_MICRO:  StatutCulture[] = ['semis','en_place','recolte']

function prochainStatut(c: Culture): StatutCulture | null {
  const chaine = c.famille === 'micro_pousse' ? CHAINE_MICRO : CHAINE_CHAMPS
  const idx = chaine.indexOf(c.statut)
  return idx >= 0 && idx < chaine.length - 1 ? chaine[idx + 1] : null
}

function CulturesTab({ cultures, zones, onSaved }: {
  cultures: Culture[]; zones: Zone[]; onSaved: () => void
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
    const next = prochainStatut(c)
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

  async function archiver(c: Culture) {
    if (!confirm(`Archiver "${c.espece}" ?`)) return
    if (!navigator.onLine) {
      await queueMutation({ table: 'cultures', method: 'update', payload: { actif: false }, matchCol: 'id', matchVal: c.id })
    } else {
      await supabase.from('cultures').update({ actif: false }).eq('id', c.id)
    }
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
      statut: 'semis' as StatutCulture,
    }
    if (!navigator.onLine) {
      await queueMutation({ table: 'cultures', method: 'insert', payload })
    } else {
      await supabase.from('cultures').insert(payload)
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
            const next   = prochainStatut(c)
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
                    {/* Quantité réelle éditable */}
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
                    {/* Notes éditables */}
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
                    <button onClick={() => archiver(c)}
                      className="w-full py-2 rounded-xl border border-red-100 text-red-400 text-xs">
                      Archiver
                    </button>
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

// ─── SectionLignes ────────────────────────────────────────────────────────────

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
                      <input type="number" min={1} value={l.quantite}
                        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) onModifier(l._id, 'quantite', v) }}
                        className="w-12 text-center text-sm font-semibold bg-transparent focus:outline-none" />
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
