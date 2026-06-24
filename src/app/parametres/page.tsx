'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Espece, Template } from '@/types'
import { ALL_NAV_TABS } from '@/components/BottomNav'
import { loadFormatColors, saveFormatColors, FORMAT_COLORS_DEFAULT, type FormatKey } from '@/lib/formatColors'
import { loadTestMode, saveTestMode } from '@/lib/testMode'
import { saveCache } from '@/lib/offline'

type ParamsProduction = {
  id: string
  tapis_par_caisse: number | null
  godets_par_serie: number | null
}

type TemplateLigneComplet = {
  id: string; template_id: string; espece_id: string
  format: string; quantite: number; ordre: number
  espece?: { nom: string } | null
}

type TemplateComplet = Template & {
  templates_lignes: TemplateLigneComplet[]
}

export default function ParametresPage() {
  const router = useRouter()
  const [onglet, setOnglet]               = useState<'cultures' | 'taches' | 'reglages'>('cultures')
  const [sousCultures, setSousCultures]   = useState<'especes' | 'templates'>('especes')
  const [especes, setEspeces]             = useState<Espece[]>([])
  const [templates, setTemplates]         = useState<TemplateComplet[]>([])
  const [params, setParams]               = useState<ParamsProduction | null>(null)
  const [tapis, setTapis]                 = useState('')
  const [godets, setGodets]               = useState('')
  const [savingParams, setSavingParams]   = useState(false)
  const [loading, setLoading]             = useState(true)
  const [editEspece, setEditEspece]       = useState<Espece | null>(null)
  const [editTemplate, setEditTemplate]   = useState<TemplateComplet | null>(null)
  const [nouveauTemplate, setNouveauTemplate] = useState(false)

  useEffect(() => { charger() }, [])

  async function charger() {
    const [{ data: e }, { data: t }, { data: p }] = await Promise.all([
      supabase.from('especes').select('*').order('section,nom'),
      supabase.from('templates').select('*, templates_lignes(*, espece:especes(nom))').order('nom'),
      supabase.from('parametres_production').select('*').single(),
    ])
    if (e) setEspeces(e)
    if (t) setTemplates(t as unknown as TemplateComplet[])
    if (p) {
      setParams(p as ParamsProduction)
      setTapis((p as ParamsProduction).tapis_par_caisse?.toString() || '30')
      setGodets((p as ParamsProduction).godets_par_serie?.toString() || '14')
    }
    setLoading(false)
  }

  async function sauvegarderSeries() {
    if (!params) return
    setSavingParams(true)
    await supabase.from('parametres_production').update({
      tapis_par_caisse: parseInt(tapis) || 30,
      godets_par_serie: parseInt(godets) || 14,
    }).eq('id', params.id)
    setSavingParams(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-green-900">&#x2699;&#xFE0F; Param&egrave;tres</h1>

      {/* ── 3 onglets principaux ── */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200">
        {([
          { val: 'cultures',  label: '🌿 Cultures' },
          { val: 'taches',    label: '✅ Tâches' },
          { val: 'reglages',  label: '⚙️ Réglages' },
        ] as { val: typeof onglet; label: string }[]).map(o => (
          <button key={o.val} onClick={() => setOnglet(o.val)}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors
              ${onglet === o.val ? 'bg-green-700 text-white' : 'bg-white text-gray-500'}`}>
            {o.label}
          </button>
        ))}
      </div>

      {/* ── Cultures : sous-onglets Espèces / Templates ── */}
      {onglet === 'cultures' && (
        <>
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            {([
              { val: 'especes',   label: '🌱 Espèces' },
              { val: 'templates', label: '📋 Templates semis' },
            ] as { val: typeof sousCultures; label: string }[]).map(o => (
              <button key={o.val} onClick={() => setSousCultures(o.val)}
                className={`flex-1 py-2 text-xs font-medium transition-colors
                  ${sousCultures === o.val ? 'bg-green-100 text-green-800 font-semibold' : 'bg-white text-gray-500'}`}>
                {o.label}
              </button>
            ))}
          </div>
          {sousCultures === 'especes' && (
            <EspecesPanel especes={especes} onEdit={setEditEspece} onRefresh={charger} />
          )}
          {sousCultures === 'templates' && (
            <TemplatesPanel
              templates={templates} especes={especes}
              onEdit={setEditTemplate}
              onNouveauTemplate={() => setNouveauTemplate(true)}
              onRefresh={charger}
            />
          )}
        </>
      )}

      {onglet === 'taches' && <TachesPanel />}

      {onglet === 'reglages' && (
        <ReglagesPanel
          router={router}
          tapis={tapis} setTapis={setTapis}
          godets={godets} setGodets={setGodets}
          sauvegarderSeries={sauvegarderSeries}
          savingParams={savingParams}
        />
      )}

      {editEspece && (
        <EspeceModal espece={editEspece} onClose={() => setEditEspece(null)} onSave={charger} />
      )}
      {(editTemplate || nouveauTemplate) && (
        <TemplateModal
          template={editTemplate}
          especes={especes}
          onClose={() => { setEditTemplate(null); setNouveauTemplate(false) }}
          onSave={() => { setEditTemplate(null); setNouveauTemplate(false); charger() }}
        />
      )}
    </div>
  )
}

// ─── Réglages panel ───────────────────────────────────────────────────────────

function ReglagesPanel({ router, tapis, setTapis, godets, setGodets, sauvegarderSeries, savingParams }: {
  router: ReturnType<typeof useRouter>
  tapis: string; setTapis: (v: string) => void
  godets: string; setGodets: (v: string) => void
  sauvegarderSeries: () => void; savingParams: boolean
}) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  function toggle(s: string) { setOuvert(o => o === s ? null : s) }

  const sections = [
    { key: 'production', icon: '📦', label: 'Production',      desc: 'Séries, coûts, stock' },
    { key: 'affichage',  icon: '🎨', label: 'Affichage',       desc: 'Couleurs, navigation' },
    { key: 'comm',       icon: '📧', label: 'Communication',   desc: 'Email récapitulatif' },
    { key: 'export',     icon: '💾', label: 'Export données',  desc: 'CSV, sauvegarde' },
    { key: 'test',       icon: '🧪', label: 'Mode test',       desc: 'Données isolées' },
  ]

  return (
    <div className="space-y-2">
      {sections.map(s => (
        <div key={s.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button onClick={() => toggle(s.key)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left">
            <span className="text-xl">{s.icon}</span>
            <div className="flex-1">
              <div className="font-semibold text-sm text-gray-800">{s.label}</div>
              <div className="text-xs text-gray-400">{s.desc}</div>
            </div>
            <span className={`text-gray-300 text-sm transition-transform duration-200 ${ouvert === s.key ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {ouvert === s.key && (
            <div className="border-t border-gray-100">
              {s.key === 'production' && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tapis par série (caisse)</label>
                      <input type="number" inputMode="numeric" value={tapis}
                        onChange={e => setTapis(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-lg font-bold text-center focus:outline-none focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Godets par série (plaque)</label>
                      <input type="number" inputMode="numeric" value={godets}
                        onChange={e => setGodets(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-lg font-bold text-center focus:outline-none focus:border-green-400" />
                    </div>
                  </div>
                  <button onClick={sauvegarderSeries} disabled={savingParams}
                    className="w-full bg-green-700 text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50">
                    {savingParams ? 'Sauvegarde...' : '💾 Enregistrer les séries'}
                  </button>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button onClick={() => router.push('/couts')}
                      className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="font-medium text-amber-800 text-xs">📊 Coûts production</span>
                      <span className="text-amber-600">›</span>
                    </button>
                    <button onClick={() => router.push('/stock')}
                      className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                      <span className="font-medium text-green-800 text-xs">🌾 Stock & produits</span>
                      <span className="text-green-600">›</span>
                    </button>
                  </div>
                </div>
              )}
              {s.key === 'affichage'  && <div className="divide-y divide-gray-50"><CouleurPanel /><NavPanel /></div>}
              {s.key === 'comm'       && <EmailPanel />}
              {s.key === 'export'     && <ExportPanel />}
              {s.key === 'test'       && <TestPanel />}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Couleurs panel ───────────────────────────────────────────────────────────

function CouleurPanel() {
  const [colors, setColors] = useState(loadFormatColors)

  function handleChange(fk: FormatKey, prop: 'header' | 'light' | 'border', val: string) {
    const next = { ...colors, [fk]: { ...colors[fk], [prop]: val } }
    setColors(next)
    saveFormatColors(next)
  }

  function reinitialiser() {
    setColors(FORMAT_COLORS_DEFAULT)
    saveFormatColors(FORMAT_COLORS_DEFAULT)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Ces couleurs s&apos;appliquent dans la fiche semis et lors de la saisie d&apos;un semis.
      </p>
      {(Object.entries(FORMAT_COLORS_DEFAULT) as [FormatKey, typeof FORMAT_COLORS_DEFAULT.tapis][]).map(([fk]) => {
        const c = colors[fk]
        const def = FORMAT_COLORS_DEFAULT[fk]
        return (
          <div key={fk} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="font-semibold text-sm" style={{ color: c.header }}>
              {def.emoji} {c.label}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                { prop: 'header' as const, label: 'En-tête' },
                { prop: 'light'  as const, label: 'Fond' },
                { prop: 'border' as const, label: 'Bordure' },
              ]).map(({ prop, label }) => (
                <div key={prop} className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-500">{label}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={c[prop]}
                      onChange={e => handleChange(fk, prop, e.target.value)}
                      className="w-9 h-9 rounded-lg cursor-pointer border border-gray-200 p-0.5" />
                    <span className="text-[10px] text-gray-400 font-mono">{c[prop]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <button onClick={reinitialiser}
        className="w-full py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
        R&eacute;initialiser les couleurs par d&eacute;faut
      </button>
    </div>
  )
}

// ─── Test panel ───────────────────────────────────────────────────────────────

function TestPanel() {
  const [active, setActive] = useState(loadTestMode)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState<string | null>(null)

  function toggle() {
    const next = !active
    setActive(next)
    saveTestMode(next)
  }

  async function effacerDonneesTest() {
    if (!confirm('Supprimer toutes les données de test ? (cultures, semis, completions test)')) return
    setClearing(true)
    // Ordre séquentiel pour respecter les FK : lignes avant parents
    await supabase.from('cultures').delete().eq('is_test', true)
    await supabase.from('semis_lignes').delete().eq('is_test', true)
    await supabase.from('semis').delete().eq('is_test', true)
    await supabase.from('taches_completions').delete().eq('is_test', true)
    await supabase.from('stock_mouvements').delete().eq('is_test', true)
    // Invalider le cache historique
    await saveCache('semis_complets_test', [])
    await saveCache('semis_complets_prod', [])
    setClearing(false)
    setCleared('Données test supprimées ✓')
    setTimeout(() => setCleared(null), 3000)
  }

  return (
    <div className="space-y-4 p-4">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-orange-900 text-sm">Mode test</div>
            <div className="text-xs text-orange-700 mt-0.5">
              Toutes les actions (semis, cultures, tâches) créent des données isolées, invisibles en mode normal.
            </div>
          </div>
          <button onClick={toggle}
            className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ml-4 ${active ? 'bg-orange-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {active && (
          <div className="text-xs text-orange-800 bg-orange-100 rounded-lg px-3 py-2">
            🧪 Actif — une bannière orange apparaît en haut de l&apos;app
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <div className="font-semibold text-gray-800 text-sm">Nettoyer les données test</div>
        <div className="text-xs text-gray-500">Supprime tous les semis, cultures, completions et mouvements de stock créés en mode test.</div>
        <button onClick={effacerDonneesTest} disabled={clearing}
          className="w-full mt-1 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-semibold disabled:opacity-50">
          {clearing ? 'Suppression...' : '🗑 Effacer les données test'}
        </button>
        {cleared && <div className="text-xs text-green-700 text-center">{cleared}</div>}
      </div>
    </div>
  )
}

// ─── Nav panel ────────────────────────────────────────────────────────────────

function NavPanel() {
  const [visible, setVisible] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ALL_NAV_TABS.map(t => t.href)
    const stored = localStorage.getItem('nav_visible_tabs')
    return stored ? JSON.parse(stored) as string[] : ALL_NAV_TABS.map(t => t.href)
  })

  function toggle(href: string) {
    const tab = ALL_NAV_TABS.find(t => t.href === href)
    if (tab?.locked) return
    const next = visible.includes(href) ? visible.filter(h => h !== href) : [...visible, href]
    setVisible(next)
    localStorage.setItem('nav_visible_tabs', JSON.stringify(next))
  }

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
        Choisissez les pages &agrave; afficher dans la barre de navigation du bas.
        Accueil et R&eacute;glages sont toujours pr&eacute;sents.
      </div>
      {ALL_NAV_TABS.map(tab => (
        <button key={tab.href} onClick={() => toggle(tab.href)}
          disabled={tab.locked}
          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-colors text-left
            ${visible.includes(tab.href) ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white'}
            ${tab.locked ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'}`}>
          <span className="text-2xl leading-none">{tab.icon}</span>
          <div className="flex-1">
            <div className="font-semibold text-sm text-gray-800">{tab.label}</div>
            {tab.locked && <div className="text-xs text-gray-400">Toujours visible</div>}
          </div>
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold
            ${visible.includes(tab.href) ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 bg-white'}`}>
            {visible.includes(tab.href) ? '&#x2713;' : ''}
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Templates panel ──────────────────────────────────────────────────────────

function TemplatesPanel({ templates, especes, onEdit, onNouveauTemplate, onRefresh }: {
  templates: TemplateComplet[]; especes: Espece[]
  onEdit: (t: TemplateComplet) => void
  onNouveauTemplate: () => void
  onRefresh: () => void
}) {
  async function supprimer(id: string) {
    if (!confirm('Supprimer ce template ?')) return
    await supabase.from('templates').delete().eq('id', id)
    onRefresh()
  }

  return (
    <div className="space-y-3">
      <button onClick={onNouveauTemplate}
        className="w-full border-2 border-dashed border-green-300 rounded-2xl py-3 text-green-700 font-bold text-sm active:scale-95 transition-transform">
        + Nouveau template
      </button>
      {templates.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Aucun template. Cr&eacute;ez-en depuis la page Semis ou avec le bouton ci-dessus.
        </div>
      )}
      {templates.map(t => (
        <div key={t.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="font-semibold text-sm text-gray-800">{t.nom}</div>
              {t.description && <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>}
              <div className="text-xs text-gray-400 mt-1">{t.templates_lignes?.length || 0} ligne(s)</div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => onEdit(t)}
                className="text-xs text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 font-semibold">
                &#x270F;&#xFE0F; &Eacute;diter
              </button>
              <button onClick={() => supprimer(t.id)}
                className="text-xs text-red-400 px-3 py-1.5 rounded-lg border border-red-200 font-semibold">
                &#x1F5D1;&#xFE0F;
              </button>
            </div>
          </div>
          {t.templates_lignes && t.templates_lignes.length > 0 && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {t.templates_lignes.map(l => (
                <div key={l.id} className="px-4 py-2 flex items-center gap-2 text-xs text-gray-600">
                  <span className="font-semibold">{l.espece?.nom || '?'}</span>
                  <span className="text-gray-300">&middot;</span>
                  <span className={`px-1.5 py-0.5 rounded-full font-semibold text-[10px]
                    ${l.format === 'TAPIS' ? 'bg-green-100 text-green-700' :
                      l.format === 'GODET' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'}`}>
                    {l.format}
                  </span>
                  <span className="text-gray-400">&times;{l.quantite}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Template modal ───────────────────────────────────────────────────────────

function TemplateModal({ template, especes, onClose, onSave }: {
  template: TemplateComplet | null; especes: Espece[]
  onClose: () => void; onSave: () => void
}) {
  const [nom, setNom] = useState(template?.nom || '')
  const [description, setDescription] = useState(template?.description || '')
  const [lignes, setLignes] = useState<TemplateLigneComplet[]>(template?.templates_lignes || [])
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [ajoutEspId, setAjoutEspId] = useState('')
  const [ajoutFormat, setAjoutFormat] = useState<'TAPIS' | 'GODET' | 'TERREAU'>('TAPIS')
  const [ajoutQte, setAjoutQte] = useState(1)
  const [saving, setSaving] = useState(false)

  function updateLigne(idx: number, patch: Partial<TemplateLigneComplet>) {
    setLignes(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l))
  }

  const especesFiltrees = especes.filter(e => e.actif && (
    ajoutFormat === 'TAPIS'
      ? e.section === 'TAPIS'
      : (e.section === 'TERREAU' || e.section === 'GODETS')
  ))

  async function sauvegarder() {
    if (!nom.trim()) return
    setSaving(true)
    if (template) {
      await supabase.from('templates').update({ nom: nom.trim(), description: description || null }).eq('id', template.id)
      const idsActuels = lignes.map(l => l.id).filter(Boolean)
      const idsDansDB  = template.templates_lignes.map(l => l.id)
      const aSupprimer = idsDansDB.filter(id => !idsActuels.includes(id))
      if (aSupprimer.length > 0)
        await supabase.from('templates_lignes').delete().in('id', aSupprimer)
      for (const [i, l] of lignes.entries()) {
        if (l.id && idsDansDB.includes(l.id)) {
          await supabase.from('templates_lignes').update({
            espece_id: l.espece_id, format: l.format, quantite: l.quantite, ordre: i,
          }).eq('id', l.id)
        } else if (!l.id) {
          await supabase.from('templates_lignes').insert({
            template_id: template.id, espece_id: l.espece_id, format: l.format, quantite: l.quantite, ordre: i,
          })
        }
      }
    } else {
      const { data: newT } = await supabase.from('templates')
        .insert({ nom: nom.trim(), description: description || null }).select().single()
      if (newT && lignes.length > 0) {
        await supabase.from('templates_lignes').insert(
          lignes.map((l, i) => ({
            template_id: (newT as { id: string }).id,
            espece_id: l.espece_id, format: l.format, quantite: l.quantite, ordre: i,
          }))
        )
      }
    }
    setSaving(false)
    onSave()
  }

  function ajouterLigne() {
    if (!ajoutEspId) return
    const esp = especes.find(e => e.id === ajoutEspId)
    setLignes(prev => [...prev, {
      id: '', template_id: template?.id || '',
      espece_id: ajoutEspId, format: ajoutFormat, quantite: ajoutQte, ordre: prev.length,
      espece: esp ? { nom: esp.nom } : null,
    }])
    setAjoutEspId(''); setAjoutQte(1)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 pb-24 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">
          {template ? <>&Eacute;diter &mdash; {template.nom}</> : 'Nouveau template'}
        </h2>

        <div className="space-y-2">
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom du template"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-green-400" />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optionnel)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400" />
        </div>

        {lignes.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Lignes</div>
            <div className="bg-gray-50 rounded-xl overflow-hidden divide-y divide-gray-100">
              {lignes.map((l, idx) => (
                editIdx === idx ? (
                  /* Mode édition inline */
                  <div key={idx} className="px-3 py-3 bg-green-50 border-l-2 border-green-500 space-y-2">
                    <div className="text-xs font-semibold text-green-800 truncate">
                      {l.espece?.nom || especes.find(e => e.id === l.espece_id)?.nom}
                    </div>
                    <div className="flex gap-1">
                      {(['TAPIS', 'GODET', 'TERREAU'] as const).map(f => (
                        <button key={f} onClick={() => updateLigne(idx, { format: f })}
                          className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition-colors
                            ${l.format === f ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200'}`}>
                          {f}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Qté :</span>
                      <input type="number" min={1} value={l.quantite}
                        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) updateLigne(idx, { quantite: v }) }}
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:border-green-400" />
                      <div className="flex-1" />
                      <button onClick={() => setEditIdx(null)}
                        className="text-xs bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold active:scale-95">
                        OK
                      </button>
                      <button onClick={() => { setLignes(prev => prev.filter((_, i) => i !== idx)); setEditIdx(null) }}
                        className="text-xs text-red-400 border border-red-200 px-2 py-1.5 rounded-lg font-semibold active:scale-95">
                        Suppr.
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Mode lecture */
                  <div key={idx} className="px-3 py-2.5 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0
                      ${l.format === 'TAPIS' ? 'bg-green-100 text-green-700' :
                        l.format === 'GODET' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-200 text-gray-600'}`}>
                      {l.format}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate">
                      {l.espece?.nom || especes.find(e => e.id === l.espece_id)?.nom || '?'}
                    </span>
                    <span className="text-sm text-gray-500 flex-shrink-0">&times;{l.quantite}</span>
                    <button onClick={() => { setEditIdx(idx) }}
                      className="text-blue-400 text-sm px-1 flex-shrink-0" title="Modifier">&#x270F;&#xFE0F;</button>
                    <button onClick={() => setLignes(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 text-sm px-1 font-bold flex-shrink-0">&times;</button>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 border border-green-200 rounded-xl p-3 bg-green-50">
          <div className="text-xs font-bold text-green-800">+ Ajouter une ligne</div>
          <div className="flex gap-1.5">
            {(['TAPIS', 'GODET', 'TERREAU'] as const).map(f => (
              <button key={f} onClick={() => { setAjoutFormat(f); setAjoutEspId('') }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors
                  ${ajoutFormat === f ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
                {f}
              </button>
            ))}
          </div>
          <select value={ajoutEspId} onChange={e => setAjoutEspId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-green-400 bg-white">
            <option value="">-- Choisir une esp&egrave;ce --</option>
            {especesFiltrees.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-gray-500">Qt&eacute; :</span>
              <input type="number" min={1} value={ajoutQte}
                onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) setAjoutQte(v) }}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:border-green-400" />
            </div>
            <button onClick={ajouterLigne} disabled={!ajoutEspId}
              className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold disabled:opacity-40 active:scale-95">
              Ajouter
            </button>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">
            Annuler
          </button>
          <button onClick={sauvegarder} disabled={saving || !nom.trim()}
            className="flex-1 py-3 rounded-xl bg-green-700 text-white font-bold disabled:opacity-50 active:scale-95"
            dangerouslySetInnerHTML={{ __html: saving ? 'Sauvegarde...' : '&#x1F4BE; Sauvegarder' }} />
        </div>
      </div>
    </div>
  )
}

// ─── Espèces panel ────────────────────────────────────────────────────────────

function EspecesPanel({ especes, onEdit, onRefresh }: {
  especes: Espece[]
  onEdit: (e: Espece) => void
  onRefresh: () => void
}) {
  const especesTapis   = especes.filter(e => e.section === 'TAPIS')
  const especesTerreau = especes.filter(e => e.section === 'TERREAU' || e.section === 'GODETS')

  const totalPoidsG = especes.filter(e => e.actif).reduce((s, e) => s + e.stock_actuel_g, 0)
  const totalValeur = especes.filter(e => e.actif && e.prix_graine_kg)
    .reduce((s, e) => s + (e.stock_actuel_g / 1000) * (e.prix_graine_kg || 0), 0)

  async function toggleActif(e: Espece) {
    await supabase.from('especes').update({ actif: !e.actif }).eq('id', e.id)
    onRefresh()
  }


  async function ajouterEspece(section: 'TAPIS' | 'TERREAU') {
    const nom = prompt(`Nom de la nouvelle espèce (${section}) :`)
    if (!nom) return
    await supabase.from('especes').insert({ nom: nom.toUpperCase(), section, actif: true })
    onRefresh()
  }

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <div className="text-xs text-green-700 font-semibold mb-0.5">Stock total</div>
          <div className="text-xl font-bold text-green-900">
            {totalPoidsG >= 1000 ? `${(totalPoidsG / 1000).toFixed(2)} kg` : `${totalPoidsG.toFixed(0)} g`}
          </div>
          <div className="text-[10px] text-green-600 mt-0.5">toutes esp&egrave;ces actives</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="text-xs text-amber-700 font-semibold mb-0.5">Valeur stock</div>
          <div className="text-xl font-bold text-amber-900">{totalValeur.toFixed(2)} &euro;</div>
          <div className="text-[10px] text-amber-600 mt-0.5">esp&egrave;ces avec prix renseign&eacute;</div>
        </div>
      </div>

      <SectionEspeces
        titre="&#x1F7E9; TAPIS"
        especes={especesTapis}
        onToggleActif={toggleActif}
        onEdit={onEdit}
        onAjouter={() => ajouterEspece('TAPIS')}
      />

      <SectionEspeces
        titre="&#x1F7EB; AVEC TERREAU"
        especes={especesTerreau}
        onToggleActif={toggleActif}
        onEdit={onEdit}
        onAjouter={() => ajouterEspece('TERREAU')}
      />
    </div>
  )
}

function SectionEspeces({ titre, especes, onToggleActif, onEdit, onAjouter }: {
  titre: string
  especes: Espece[]
  onToggleActif: (e: Espece) => void
  onEdit: (e: Espece) => void
  onAjouter: () => void
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 font-semibold text-sm border-b border-gray-200 flex justify-between items-center">
        <span>{titre}</span>
        <button onClick={onAjouter}
          className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
          + Ajouter
        </button>
      </div>
      <div className="divide-y divide-gray-50">
        {especes.length === 0 && (
          <div className="px-3 py-4 text-sm text-gray-400 text-center">Aucune esp&egrave;ce</div>
        )}
        {especes.map(e => (
          <div key={e.id} className={`px-3 py-2 flex items-center gap-2 ${!e.actif ? 'opacity-40' : ''}`}>
            {e.photo_url
              ? <img src={e.photo_url} alt={e.nom} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
              : <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-300 flex-shrink-0">{e.nom[0]}</div>
            }
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{e.nom}</div>
              <div className="text-xs text-gray-400">
                {e.prix_graine_kg ? `${e.prix_graine_kg}€/kg` : 'Prix non renseigné'}
                {' · '}
                {e.stock_actuel_g >= 1000
                  ? `${(e.stock_actuel_g / 1000).toFixed(2)} kg`
                  : `${e.stock_actuel_g} g`}
              </div>
            </div>
            <button onClick={() => onEdit(e)}
              className="text-xs text-blue-600 px-2 py-1 rounded border border-blue-200 flex-shrink-0">
              &Eacute;diter
            </button>

            <button onClick={() => onToggleActif(e)}
              className={`text-xs px-2 py-1 rounded border flex-shrink-0 ${e.actif ? 'text-gray-500 border-gray-200' : 'text-green-600 border-green-200'}`}>
              {e.actif ? 'Off' : 'On'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Espèce modal ─────────────────────────────────────────────────────────────

function EspeceModal({ espece, onClose, onSave }: { espece: Espece; onClose: () => void; onSave: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(espece.photo_url)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [section, setSection] = useState<'TAPIS' | 'TERREAU'>(
    espece.section === 'TAPIS' ? 'TAPIS' : 'TERREAU'
  )

  // ─── Opérations de culture ─────────────────────────────────────────────────
  const [operations, setOperations] = useState<{ id: string; titre: string; ordre: number }[]>([])
  const [newOp, setNewOp]           = useState('')
  const [addingOp, setAddingOp]     = useState(false)

  useEffect(() => {
    supabase.from('espece_operations')
      .select('id,titre,ordre').eq('espece_id', espece.id).eq('actif', true).order('ordre')
      .then(({ data }) => { if (data) setOperations(data) })
  }, [espece.id])

  async function ajouterOp() {
    if (!newOp.trim()) return
    const ordre = operations.length > 0 ? Math.max(...operations.map(o => o.ordre)) + 1 : 1
    const { data } = await supabase.from('espece_operations')
      .insert({ espece_id: espece.id, titre: newOp.trim(), ordre, actif: true }).select()
    if (data?.[0]) setOperations(prev => [...prev, data[0]])
    setNewOp(''); setAddingOp(false)
  }

  async function supprimerOp(id: string) {
    await supabase.from('espece_operations').update({ actif: false }).eq('id', id)
    setOperations(prev => prev.filter(o => o.id !== id))
  }

  const [form, setForm] = useState({
    nom:            espece.nom,
    g_tapis:        espece.g_tapis?.toString()        || '',
    g_godet:        espece.g_godet?.toString()        || '',
    g_caisse:       espece.g_caisse?.toString()       || '',
    pct_perte:      espece.pct_perte != null ? (espece.pct_perte * 100).toString() : '10',
    jours_pousse:   espece.jours_pousse?.toString()   || '',
    jours_conserv:  espece.jours_conserv?.toString()  || '',
    rendement:      espece.rendement?.toString()      || '',
    prix_graine_kg: espece.prix_graine_kg?.toString() || '',
    stock_actuel_g: espece.stock_actuel_g.toString(),
  })
  const [saving, setSaving] = useState(false)

  async function handlePhoto(file: File) {
    setUploading(true)
    setUploadError(null)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', 'especes-photos')
    formData.append('path', `${espece.id}.${ext}`)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setUploadError(json.error ?? `Erreur ${res.status}`)
    } else {
      const { url } = await res.json()
      setPhotoUrl(url + `?t=${Date.now()}`)
    }
    setUploading(false)
  }

  function n(v: string) { return v ? parseFloat(v) : null }

  async function sauvegarder() {
    setSaving(true)
    await supabase.from('especes').update({
      nom:            form.nom,
      section,
      g_tapis:        n(form.g_tapis),
      g_godet:        n(form.g_godet),
      g_caisse:       n(form.g_caisse),
      pct_perte:      form.pct_perte ? parseFloat(form.pct_perte) / 100 : null,
      jours_pousse:   form.jours_pousse  ? parseInt(form.jours_pousse)  : null,
      jours_conserv:  form.jours_conserv ? parseInt(form.jours_conserv) : null,
      rendement:      n(form.rendement),
      prix_graine_kg: n(form.prix_graine_kg),
      stock_actuel_g: parseFloat(form.stock_actuel_g) || 0,
      photo_url:      photoUrl,
    }).eq('id', espece.id)
    setSaving(false); onSave(); onClose()
  }

  const champs = [
    { key: 'nom',            label: 'Nom',                 type: 'text'   },
    { key: 'stock_actuel_g', label: 'Stock actuel (g)',    type: 'number' },
    { key: 'prix_graine_kg', label: 'Prix graine (€/kg)', type: 'number' },
    { key: 'g_tapis',        label: 'G/tapis',             type: 'number' },
    { key: 'g_caisse',       label: 'G/caisse terreau',    type: 'number' },
    { key: 'g_godet',        label: 'G/godet',             type: 'number' },
    { key: 'pct_perte',      label: '% perte',             type: 'number' },
    { key: 'jours_pousse',   label: 'Jours pousse',        type: 'number' },
    { key: 'jours_conserv',  label: 'Jours conservation',  type: 'number' },
    { key: 'rendement',      label: 'Rendement',           type: 'number' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 pb-24 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">&Eacute;diter &mdash; {espece.nom}</h2>

        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f) }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-full relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 hover:border-green-400 transition-colors"
          style={{ aspectRatio: '3/1' }}>
          {photoUrl ? (
            <img src={photoUrl} alt={espece.nom} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-400">
              <span className="text-2xl">&#x1F4F7;</span>
              <span className="text-xs">Toucher pour ajouter une photo</span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <span className="text-sm text-gray-600 animate-pulse">Envoi en cours...</span>
            </div>
          )}
          {photoUrl && !uploading && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              Changer
            </div>
          )}
        </button>

        {uploadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
            {uploadError}
            <div className="mt-1 text-red-500">V&eacute;rifiez que le bucket &laquo;especes-photos&raquo; existe dans Supabase Storage avec une policy publique.</div>
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Famille</label>
          <div className="grid grid-cols-2 gap-2">
            {(['TAPIS', 'TERREAU'] as const).map(s => (
              <button key={s} onClick={() => setSection(s)}
                className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors
                  ${section === s
                    ? s === 'TAPIS' ? 'bg-green-50 border-green-600 text-green-800' : 'bg-stone-50 border-stone-500 text-stone-800'
                    : 'bg-white border-gray-200 text-gray-400'}`}>
                {s === 'TAPIS' ? '&#x1F7E9; Tapis' : '&#x1F7EB; Avec terreau'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {champs.map(c => (
            <div key={c.key} className={c.key === 'nom' ? 'col-span-2' : ''}>
              <label className="block text-xs text-gray-500 mb-1">{c.label}</label>
              <input type={c.type} value={form[c.key as keyof typeof form]}
                onChange={e => setForm(prev => ({ ...prev, [c.key]: e.target.value }))}
                className="w-full border border-gray-200 rounded p-2 text-sm" />
            </div>
          ))}
        </div>
        {/* ── Opérations de culture ── */}
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">🌿 Opérations de culture</div>
          <div className="text-[11px] text-gray-400">Ces opérations apparaîtront dans les tâches liées à cette espèce.</div>
          <div className="space-y-1.5">
            {operations.map(op => (
              <div key={op.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                <span className="text-sm flex-1 text-gray-700">{op.titre}</span>
                <button onClick={() => supprimerOp(op.id)}
                  className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
              </div>
            ))}
            {operations.length === 0 && !addingOp && (
              <div className="text-xs text-gray-400 italic px-1">Aucune opération définie</div>
            )}
            {addingOp ? (
              <div className="flex gap-2">
                <input autoFocus value={newOp} onChange={e => setNewOp(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') ajouterOp(); if (e.key === 'Escape') { setAddingOp(false); setNewOp('') } }}
                  placeholder="Ex : Égourmander, Tuteurer..."
                  className="flex-1 border border-green-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none bg-white" />
                <button onClick={ajouterOp} className="px-3 py-2 bg-green-700 text-white rounded-lg text-xs font-bold">OK</button>
                <button onClick={() => { setAddingOp(false); setNewOp('') }}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-xs text-gray-500">✕</button>
              </div>
            ) : (
              <button onClick={() => setAddingOp(true)}
                className="w-full text-left px-3 py-2 text-xs text-green-700 font-semibold border border-dashed border-green-200 rounded-lg active:bg-green-50">
                + Ajouter une opération
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600">Annuler</button>
          <button onClick={sauvegarder} disabled={saving || uploading}
            className="flex-1 py-3 rounded-lg bg-green-700 text-white font-semibold disabled:opacity-50"
            dangerouslySetInnerHTML={{ __html: saving ? 'Sauvegarde...' : '&#x1F4BE; Sauvegarder' }} />
        </div>
      </div>
    </div>
  )
}

// ─── Email panel ──────────────────────────────────────────────────────────────

function EmailPanel() {
  const [testing, setTesting] = useState(false)

  async function testerEmail() {
    setTesting(true)
    const res = await fetch('/api/email/test', { method: 'POST' })
    setTesting(false)
    if (res.ok) alert('Email de test envoyé !')
    else alert("Erreur lors de l'envoi — vérifiez la clé Resend")
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="font-semibold text-sm">Adresse de réception</h3>
        <div className="bg-gray-50 rounded p-2 text-sm font-mono text-gray-700">petitesherbes@gmail.com</div>
        <p className="text-xs text-gray-400">Modifiable via la variable EMAIL_DESTINATION dans .env.local</p>
      </div>
      <button onClick={testerEmail} disabled={testing}
        className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50"
        dangerouslySetInnerHTML={{ __html: testing ? 'Envoi...' : '&#x1F4E7; Envoyer un email de test' }} />
    </div>
  )
}

// ─── Export panel ─────────────────────────────────────────────────────────────

function ExportPanel() {
  const [exporting, setExporting] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  function toCSV(rows: Record<string, unknown>[]): string {
    if (!rows.length) return ''
    const BOM = '﻿'
    const headers = Object.keys(rows[0])
    const lines = rows.map(row =>
      headers.map(h => {
        const v = row[h]
        if (v == null) return ''
        const s = String(v).replace(/"/g, '""')
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
      }).join(',')
    )
    return BOM + [headers.join(','), ...lines].join('\r\n')
  }

  function telecharger(csv: string, nom: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = nom
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  async function exporter(table: string, nom: string) {
    setExporting(table)
    const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false })
    if (data && data.length > 0) {
      telecharger(toCSV(data as unknown as Record<string, unknown>[]), `${nom}_${new Date().toISOString().slice(0, 10)}.csv`)
      setDone(table); setTimeout(() => setDone(null), 3000)
    }
    setExporting(null)
  }

  async function exporterTout() {
    setExporting('all')
    const tables = ['clients','especes','semis','semis_lignes','bons_livraison','bl_lignes','cahier_culture','taches','pertes','especes_serre','produits_traitement']
    const allData: Record<string, unknown>[] = []
    for (const key of tables) {
      const { data } = await supabase.from(key).select('*').order('created_at', { ascending: false })
      if (data) for (const row of data) allData.push({ _table: key, ...(row as unknown as Record<string, unknown>) })
    }
    telecharger(toCSV(allData), `petites_herbes_backup_${new Date().toISOString().slice(0, 10)}.csv`)
    setExporting(null); setDone('all'); setTimeout(() => setDone(null), 3000)
  }

  const exports = [
    { key: 'clients',        label: 'Clients',         icon: '&#x1F464;', desc: 'Noms, téléphones, liens boutique' },
    { key: 'bons_livraison', label: 'Commandes (BLs)', icon: '&#x1F4E6;', desc: 'Tous les bons de livraison' },
    { key: 'semis',          label: 'Semis',           icon: '&#x1F331;', desc: 'Historique des semis' },
    { key: 'cahier_culture', label: 'Cahier terrain',  icon: '&#x1F4D6;', desc: 'Toutes les entrées terrain' },
    { key: 'taches',         label: 'Tâches',          icon: '&#x2705;',  desc: 'Agenda et tâches' },
    { key: 'pertes',         label: 'Pertes',          icon: '&#x1F4C9;', desc: 'Invendus et pertes' },
    { key: 'especes',        label: 'Espèces',         icon: '&#x1F33F;', desc: 'Catalogue des espèces micropousses' },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
        <div className="font-bold mb-1">&#x1F4BE; Export de vos donn&eacute;es</div>
        Les fichiers CSV s&apos;ouvrent directement dans Excel ou Google Sheets.
        Faites un export complet 1&times;/semaine pour sauvegarder toutes vos donn&eacute;es.
      </div>
      <button onClick={exporterTout} disabled={!!exporting}
        className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 active:scale-95 transition-transform disabled:opacity-60 bg-green-700 text-white shadow-sm">
        {exporting === 'all' ? '&#x23F3; Export en cours…' : done === 'all' ? '&#x2705; Téléchargé !' : '&#x1F4E6; Export complet (toutes les tables)'}
      </button>
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Par table</div>
      <div className="space-y-2">
        {exports.map(e => (
          <button key={e.key}
            onClick={() => exporter(e.key, e.label.toLowerCase().replace(/\s/g, '_'))}
            disabled={!!exporting}
            className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 active:scale-95 transition-transform disabled:opacity-60 shadow-sm text-left">
            <span className="text-2xl leading-none" dangerouslySetInnerHTML={{ __html: e.icon }} />
            <div className="flex-1">
              <div className="font-semibold text-sm text-gray-800">{e.label}</div>
              <div className="text-xs text-gray-400">{e.desc}</div>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              exporting === e.key ? 'bg-amber-100 text-amber-700' :
              done === e.key     ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {exporting === e.key ? '&#x23F3;' : done === e.key ? '&#x2705; OK' : '&#x2193; CSV'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Tâches panel ─────────────────────────────────────────────────────────────

type CatItem       = { id: string; titre: string; categorie: string; icone: string; active: boolean; ordre: number; duree_minutes: number | null }
type ZoneLite      = { id: string; nom: string; type: string }
type ZoneTacheLite = { zone_id: string; catalogue_id: string }
type RecurrenteLite = { id: string; titre: string; frequence: string | null; catalogue_id: string | null }

const FREQ_PRESETS = [
  { val: 'quotidien',                          label: 'Tous les jours' },
  { val: 'lundi,mardi,mercredi,jeudi,vendredi', label: 'Lun – Ven' },
  { val: 'lundi,mercredi,vendredi',             label: 'Lun · Mer · Ven' },
  { val: 'mardi,jeudi',                         label: 'Mar · Jeu' },
  { val: 'vendredi',                            label: 'Vendredi' },
]

function TachesPanel() {
  const [zones, setZones]           = useState<ZoneLite[]>([])
  const [catalogue, setCatalogue]   = useState<CatItem[]>([])
  const [zoneTaches, setZoneTaches] = useState<ZoneTacheLite[]>([])
  const [recurrentes, setRecurrentes] = useState<RecurrenteLite[]>([])
  const [vue, setVue]               = useState<string>('global')
  const [saving, setSaving]         = useState<string | null>(null)

  // état édition / ajout
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editingTitre, setEditingTitre] = useState('')
  const [addingCat, setAddingCat]     = useState<string | null>(null)
  const [newTaskTitre, setNewTaskTitre] = useState('')
  const [newCatMode, setNewCatMode]   = useState(false)
  const [newCatNom, setNewCatNom]     = useState('')
  const [newCatIcone, setNewCatIcone] = useState('📋')
  const [savingEdit, setSavingEdit]   = useState(false)

  // état activation récurrente
  const [activantId,   setActivantId]   = useState<string | null>(null)
  const [activantFreq, setActivantFreq] = useState('quotidien')

  // état déplacement de catégorie
  const [deplacantId,   setDeplacantId]   = useState<string | null>(null)
  const [deplacantVers, setDeplacantVers] = useState('')

  // état renommage catégorie
  const [renamingCat,    setRenamingCat]    = useState<string | null>(null)
  const [renamingCatVal, setRenamingCatVal] = useState('')

  useEffect(() => { chargerTaches() }, [])

  async function chargerTaches() {
    const [{ data: z }, { data: c }, { data: zt }, { data: r }] = await Promise.all([
      supabase.from('zones').select('id,nom,type').eq('actif', true).order('ordre'),
      supabase.from('taches_catalogue').select('*').order('ordre'),
      supabase.from('zone_taches_catalogue').select('*'),
      supabase.from('taches').select('id,titre,frequence,catalogue_id').eq('type', 'recurrente').eq('actif', true),
    ])
    if (z) setZones(z); if (c) setCatalogue(c as CatItem[])
    if (zt) setZoneTaches(zt); if (r) setRecurrentes(r as RecurrenteLite[])
  }

  function trouverRecurrente(cat: CatItem): RecurrenteLite | undefined {
    return recurrentes.find(r => r.catalogue_id === cat.id || r.titre.toLowerCase() === cat.titre.toLowerCase())
  }

  async function activerRecurrente(cat: CatItem) {
    const existing = trouverRecurrente(cat)
    if (existing) {
      await supabase.from('taches').update({ frequence: activantFreq, catalogue_id: cat.id, duree_minutes: cat.duree_minutes }).eq('id', existing.id)
    } else {
      await supabase.from('taches').insert({ titre: cat.titre, type: 'recurrente', frequence: activantFreq, actif: true, priorite: 'normale', catalogue_id: cat.id, duree_minutes: cat.duree_minutes })
    }
    setActivantId(null)
    await chargerTaches()
  }

  async function desactiverRecurrente(cat: CatItem) {
    const existing = trouverRecurrente(cat)
    if (!existing) return
    if (!confirm(`Désactiver la tâche récurrente "${cat.titre}" ?`)) return
    await supabase.from('taches').update({ actif: false }).eq('id', existing.id)
    await chargerTaches()
  }

  async function sauvegarderDuree(cat: CatItem, val: string) {
    const minutes = val === '' ? null : parseInt(val)
    if (minutes !== null && isNaN(minutes)) return
    await supabase.from('taches_catalogue').update({ duree_minutes: minutes }).eq('id', cat.id)
    const existing = trouverRecurrente(cat)
    if (existing) await supabase.from('taches').update({ duree_minutes: minutes }).eq('id', existing.id)
    await chargerTaches()
  }

  async function deplacerTache(catId: string, nouvelleCategorie: string) {
    await supabase.from('taches_catalogue').update({ categorie: nouvelleCategorie }).eq('id', catId)
    setDeplacantId(null); setDeplacantVers('')
    await chargerTaches()
  }

  async function renommerCategorie(ancienNom: string, nouveauNom: string) {
    if (!nouveauNom.trim() || nouveauNom === ancienNom) { setRenamingCat(null); return }
    await supabase.from('taches_catalogue').update({ categorie: nouveauNom.trim() }).eq('categorie', ancienNom)
    setRenamingCat(null)
    await chargerTaches()
  }

  async function toggleGlobal(cat: CatItem) {
    if (editingId === cat.id) return
    setSaving(cat.id)
    await supabase.from('taches_catalogue').update({ active: !cat.active }).eq('id', cat.id)
    await chargerTaches(); setSaving(null)
  }

  async function toggleZone(zoneId: string, catalogId: string) {
    setSaving(catalogId)
    const existe = zoneTaches.some(zt => zt.zone_id === zoneId && zt.catalogue_id === catalogId)
    if (existe) {
      await supabase.from('zone_taches_catalogue').delete().eq('zone_id', zoneId).eq('catalogue_id', catalogId)
    } else {
      await supabase.from('zone_taches_catalogue').insert({ zone_id: zoneId, catalogue_id: catalogId })
    }
    await chargerTaches(); setSaving(null)
  }

  async function sauvegarderEdition() {
    if (!editingId || !editingTitre.trim()) return
    setSavingEdit(true)
    await supabase.from('taches_catalogue').update({ titre: editingTitre.trim() }).eq('id', editingId)
    await chargerTaches()
    setEditingId(null); setSavingEdit(false)
  }

  async function supprimerTache(id: string) {
    if (!confirm('Supprimer cette tâche du catalogue ?')) return
    await supabase.from('zone_taches_catalogue').delete().eq('catalogue_id', id)
    await supabase.from('taches_catalogue').delete().eq('id', id)
    await chargerTaches()
  }

  async function ajouterDansCategorie(categorie: string, icone: string) {
    if (!newTaskTitre.trim()) return
    setSavingEdit(true)
    const maxOrdre = Math.max(0, ...catalogue.filter(c => c.categorie === categorie).map(c => c.ordre))
    await supabase.from('taches_catalogue').insert({
      titre: newTaskTitre.trim(), categorie, icone, active: true, ordre: maxOrdre + 1,
    })
    await chargerTaches()
    setAddingCat(null); setNewTaskTitre(''); setSavingEdit(false)
  }

  async function ajouterNouvelleCat() {
    if (!newCatNom.trim() || !newTaskTitre.trim()) return
    setSavingEdit(true)
    const maxOrdre = Math.max(0, ...catalogue.map(c => c.ordre))
    await supabase.from('taches_catalogue').insert({
      titre: newTaskTitre.trim(), categorie: newCatNom.trim(), icone: newCatIcone, active: true, ordre: maxOrdre + 1,
    })
    await chargerTaches()
    setNewCatMode(false); setNewCatNom(''); setNewTaskTitre(''); setSavingEdit(false)
  }

  const categories  = [...new Set(catalogue.map(c => c.categorie))]
  const activeCount = catalogue.filter(c => c.active).length

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-900">
        <div className="font-bold mb-1">Catalogue de t&acirc;ches mara&icirc;cher</div>
        <div className="text-xs text-green-700">
          {catalogue.length} t&acirc;ches &middot; {activeCount} actives.
          Cochez pour activer, ✏️ pour renommer, × pour supprimer.
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setVue('recurrentes')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border active:scale-95 flex-shrink-0
            ${vue === 'recurrentes' ? 'bg-green-700 text-white border-green-700' : 'bg-green-50 text-green-700 border-green-200'}`}>
          🔁 Récurrentes ({recurrentes.length})
        </button>
        <button onClick={() => setVue('global')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border active:scale-95 flex-shrink-0
            ${vue === 'global' ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
          Catalogue
        </button>
        {zones.map(z => (
          <button key={z.id} onClick={() => setVue(z.id)}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border active:scale-95 flex-shrink-0
              ${vue === z.id ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {z.nom}
          </button>
        ))}
      </div>

      {vue === 'recurrentes' ? (
        <div className="space-y-2">
          {recurrentes.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <div className="text-3xl mb-2">🔁</div>
              Aucune tâche récurrente active.<br />
              <span className="text-xs">Activez-en depuis l&apos;onglet Catalogue.</span>
            </div>
          ) : recurrentes.map(r => {
            const cat = catalogue.find(c => c.id === r.catalogue_id || c.titre.toLowerCase() === r.titre.toLowerCase())
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {activantId === r.catalogue_id || activantId === r.id ? (
                  <div className="p-3 bg-green-50 border border-green-200 space-y-2">
                    <div className="text-xs font-bold text-green-800">Modifier — {r.titre}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {FREQ_PRESETS.map(f => (
                        <button key={f.val} onClick={() => setActivantFreq(f.val)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors
                            ${activantFreq === f.val ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-green-700 font-semibold whitespace-nowrap">🕐 Durée estimée :</label>
                      <input type="number" inputMode="numeric" placeholder="min"
                        defaultValue={cat?.duree_minutes ?? ''}
                        onBlur={e => cat && sauvegarderDuree(cat, e.target.value)}
                        className="w-20 border border-green-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:border-green-400" />
                      <span className="text-xs text-gray-400">min</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => cat ? activerRecurrente(cat) : null}
                        className="flex-1 py-2 bg-green-700 text-white rounded-lg text-xs font-bold active:scale-95">
                        ✓ Mettre à jour
                      </button>
                      <button onClick={() => cat ? desactiverRecurrente(cat) : null}
                        className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold">
                        Désactiver
                      </button>
                      <button onClick={() => setActivantId(null)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500">✕</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setActivantId(r.catalogue_id || r.id); setActivantFreq(r.frequence || 'quotidien') }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800">{r.titre}</div>
                      {cat?.duree_minutes != null && (
                        <div className="text-xs text-amber-600 mt-0.5">
                          🕐 {cat.duree_minutes < 60 ? `${cat.duree_minutes} min estimées` : `${Math.floor(cat.duree_minutes/60)}h${cat.duree_minutes%60>0?cat.duree_minutes%60+'min':''} estimées`}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200 shrink-0">
                      🔁 {r.frequence === 'quotidien' ? 'tous les jours' : r.frequence?.split(',').map(j => j.trim().slice(0,3)).join(' · ') || '—'}
                    </span>
                    <span className="text-gray-300 text-sm">›</span>
                  </button>
                )}
              </div>
            )
          })}
          <button onClick={() => setVue('global')}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 font-semibold active:scale-95 transition-transform">
            + Ajouter depuis le catalogue
          </button>
        </div>
      ) : vue === 'global' ? (
        <div className="space-y-2">
          {categories.map(cat => {
            const items = catalogue.filter(c => c.categorie === cat)
            const icone = items[0]?.icone || '📋'
            const autresCats = categories.filter(c2 => c2 !== cat)
            return (
              <div key={cat} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {/* En-tête catégorie — cliquable pour renommer */}
                <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  {renamingCat === cat ? (
                    <form className="flex-1 flex gap-2" onSubmit={e => { e.preventDefault(); renommerCategorie(cat, renamingCatVal) }}>
                      <input autoFocus value={renamingCatVal} onChange={e => setRenamingCatVal(e.target.value)}
                        className="flex-1 border border-green-300 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none bg-white" />
                      <button type="submit" className="text-xs bg-green-700 text-white px-2.5 py-1 rounded-lg font-semibold">OK</button>
                      <button type="button" onClick={() => setRenamingCat(null)} className="text-xs text-gray-400 px-2 py-1 rounded-lg border border-gray-200">✕</button>
                    </form>
                  ) : (
                    <>
                      <span className="font-bold text-xs text-gray-600 flex-1">{icone} {cat}</span>
                      <button onClick={() => { setRenamingCat(cat); setRenamingCatVal(cat) }}
                        className="text-gray-300 hover:text-blue-500 text-xs px-1" title="Renommer cette catégorie">✏️</button>
                      <span className="font-normal text-gray-400 text-xs">{items.filter(i => i.active).length}/{items.length}</span>
                    </>
                  )}
                </div>

                {items.map(c => {
                  const recurrente = trouverRecurrente(c)
                  return (
                  <div key={c.id}>
                  {editingId === c.id ? (
                    <div className="px-3 py-2.5 border-b border-gray-50 bg-green-50 flex items-center gap-2">
                      <input autoFocus value={editingTitre} onChange={e => setEditingTitre(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') sauvegarderEdition(); if (e.key === 'Escape') setEditingId(null) }}
                        className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-green-400 bg-white" />
                      <button onClick={sauvegarderEdition} disabled={savingEdit}
                        className="text-xs bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold active:scale-95 disabled:opacity-50">OK</button>
                      <button onClick={() => setEditingId(null)}
                        className="text-xs text-gray-400 px-2 py-1.5 rounded-lg border border-gray-200">✕</button>
                    </div>
                  ) : (
                    <div className={`flex items-center gap-1.5 px-3 py-2.5 border-b border-gray-50 ${!c.active ? 'opacity-40' : ''}`}>
                      <button onClick={() => toggleGlobal(c)}
                        className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs transition-colors active:scale-95
                          ${c.active ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 bg-white'}`}>
                        {c.active ? '✓' : ''}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-800 leading-snug">{c.titre}</span>
                        {c.duree_minutes != null && (
                          <span className="ml-2 text-[10px] text-gray-400">🕐 {c.duree_minutes < 60 ? `${c.duree_minutes}min` : `${Math.floor(c.duree_minutes/60)}h${c.duree_minutes%60>0?c.duree_minutes%60+'':''}` }</span>
                        )}
                      </div>
                      {saving === c.id ? <span className="text-xs text-gray-400 animate-pulse">...</span> : <>
                        {/* Badge récurrente ou bouton d'activation */}
                        {recurrente ? (
                          <button onClick={() => { setActivantId(c.id); setActivantFreq(recurrente.frequence || 'quotidien') }}
                            title="Tâche récurrente active — cliquer pour modifier"
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300 flex-shrink-0">
                            ⟳ {recurrente.frequence === 'quotidien' ? 'tous les jours' : recurrente.frequence?.split(',').map(j => j.slice(0,3)).join('·') || ''}
                          </button>
                        ) : (
                          <button onClick={() => { setActivantId(activantId === c.id ? null : c.id); setActivantFreq('quotidien') }}
                            title="Activer comme tâche récurrente"
                            className="text-gray-300 hover:text-green-600 text-base px-1 flex-shrink-0">⟳</button>
                        )}
                        {/* Déplacer entre catégories */}
                        <button onClick={() => { setDeplacantId(deplacantId === c.id ? null : c.id); setDeplacantVers('') }}
                          title="Déplacer vers une autre catégorie"
                          className="text-gray-300 hover:text-purple-500 text-xs px-1 flex-shrink-0">↕</button>
                        <button onClick={() => { setEditingId(c.id); setEditingTitre(c.titre) }}
                          className="text-gray-300 hover:text-blue-500 px-1 text-sm active:scale-95 flex-shrink-0" title="Renommer">✏️</button>
                        <button onClick={() => supprimerTache(c.id)}
                          className="text-gray-300 hover:text-red-500 px-1 text-sm font-bold active:scale-95 flex-shrink-0" title="Supprimer">×</button>
                      </>}
                    </div>
                  )}

                  {/* Panneau activation récurrente */}
                  {activantId === c.id && (
                    <div className="mx-3 mb-2 mt-1 bg-green-50 rounded-xl p-3 border border-green-200 space-y-2">
                      <div className="text-xs font-bold text-green-800">
                        {recurrente ? `Modifier la fréquence — "${c.titre}"` : `Activer "${c.titre}" comme récurrente`}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {FREQ_PRESETS.map(f => (
                          <button key={f.val} onClick={() => setActivantFreq(f.val)}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors
                              ${activantFreq === f.val ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-green-700 font-semibold whitespace-nowrap">🕐 Durée :</label>
                        <input type="number" inputMode="numeric" placeholder="min"
                          defaultValue={c.duree_minutes ?? ''}
                          onBlur={e => sauvegarderDuree(c, e.target.value)}
                          className="w-20 border border-green-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:border-green-400" />
                        <span className="text-xs text-gray-400">min</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => activerRecurrente(c)}
                          className="flex-1 py-2 bg-green-700 text-white rounded-lg text-xs font-bold active:scale-95">
                          ✓ {recurrente ? 'Mettre à jour' : 'Activer'}
                        </button>
                        {recurrente && (
                          <button onClick={() => desactiverRecurrente(c)}
                            className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold">
                            Désactiver
                          </button>
                        )}
                        <button onClick={() => setActivantId(null)}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500">✕</button>
                      </div>
                    </div>
                  )}

                  {/* Panneau déplacement catégorie */}
                  {deplacantId === c.id && (
                    <div className="mx-3 mb-2 mt-1 bg-purple-50 rounded-xl p-3 border border-purple-200 flex gap-2 items-center">
                      <select value={deplacantVers} onChange={e => setDeplacantVers(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white">
                        <option value="">Déplacer vers...</option>
                        {autresCats.map(c2 => <option key={c2} value={c2}>{c2}</option>)}
                      </select>
                      <button onClick={() => deplacerTache(c.id, deplacantVers)} disabled={!deplacantVers}
                        className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold disabled:opacity-40 active:scale-95">↕ OK</button>
                      <button onClick={() => setDeplacantId(null)}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500">✕</button>
                    </div>
                  )}
                  </div>
                  )
                })}

                {/* Ajouter dans cette catégorie */}
                {addingCat === cat ? (
                  <div className="px-3 py-2.5 bg-green-50 flex items-center gap-2 border-t border-green-100">
                    <input autoFocus value={newTaskTitre} onChange={e => setNewTaskTitre(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') ajouterDansCategorie(cat, icone); if (e.key === 'Escape') setAddingCat(null) }}
                      placeholder="Nom de la tâche..."
                      className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-green-400 bg-white" />
                    <button onClick={() => ajouterDansCategorie(cat, icone)} disabled={savingEdit || !newTaskTitre.trim()}
                      className="text-xs bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold active:scale-95 disabled:opacity-50">
                      Ajouter
                    </button>
                    <button onClick={() => { setAddingCat(null); setNewTaskTitre('') }}
                      className="text-xs text-gray-400 px-2 py-1.5 rounded-lg border border-gray-200">
                      ✕
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setAddingCat(cat); setNewTaskTitre(''); setEditingId(null) }}
                    className="w-full text-left px-4 py-2.5 text-xs text-green-600 font-semibold border-t border-gray-50 active:bg-green-50">
                    + Ajouter une tâche dans {cat.toLowerCase()}
                  </button>
                )}
              </div>
            )
          })}

          {/* Nouvelle catégorie */}
          {newCatMode ? (
            <div className="bg-white rounded-xl border border-green-200 p-4 space-y-3">
              <div className="text-xs font-bold text-green-800">Nouvelle catégorie</div>
              <div className="flex gap-2">
                <input value={newCatIcone} onChange={e => setNewCatIcone(e.target.value)}
                  className="w-12 border border-gray-200 rounded-lg px-2 py-2 text-base text-center focus:outline-none" />
                <input autoFocus value={newCatNom} onChange={e => setNewCatNom(e.target.value)}
                  placeholder="Nom de la catégorie..."
                  className="flex-1 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <input value={newTaskTitre} onChange={e => setNewTaskTitre(e.target.value)}
                placeholder="Première tâche dans cette catégorie..."
                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-green-400" />
              <div className="flex gap-2">
                <button onClick={() => { setNewCatMode(false); setNewCatNom(''); setNewTaskTitre('') }}
                  className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm">Annuler</button>
                <button onClick={ajouterNouvelleCat} disabled={savingEdit || !newCatNom.trim() || !newTaskTitre.trim()}
                  className="flex-1 py-2 rounded-lg bg-green-700 text-white text-sm font-semibold disabled:opacity-40 active:scale-95">
                  Créer
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setNewCatMode(true); setNewCatNom(''); setNewTaskTitre(''); setAddingCat(null) }}
              className="w-full border-2 border-dashed border-green-300 rounded-xl py-3 text-green-700 font-bold text-sm active:scale-95 transition-transform">
              + Nouvelle catégorie
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-gray-400">
            T&acirc;ches typiques de {zones.find(z => z.id === vue)?.nom} &mdash;
            cochez pour les associer à cette zone.
          </div>
          {categories.map(cat => {
            const items = catalogue.filter(c => c.active && c.categorie === cat)
            if (!items.length) return null
            const nbCochees = items.filter(c => zoneTaches.some(zt => zt.zone_id === vue && zt.catalogue_id === c.id)).length
            return (
              <div key={cat} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 font-bold text-xs text-gray-600 border-b border-gray-100 flex justify-between">
                  <span>{items[0]?.icone} {cat}</span>
                  <span className="font-normal text-gray-400">{nbCochees}/{items.length}</span>
                </div>
                {items.map(c => {
                  const checked = zoneTaches.some(zt => zt.zone_id === vue && zt.catalogue_id === c.id)
                  return (
                    <button key={c.id} onClick={() => toggleZone(vue, c.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 text-left active:bg-gray-50">
                      <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs
                        ${checked ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 bg-white'}`}>
                        {checked ? '✓' : ''}
                      </div>
                      <span className="text-sm text-gray-800 flex-1">{c.titre}</span>
                      {saving === c.id && <span className="text-xs text-gray-400 animate-pulse">...</span>}
                    </button>
                  )
                })}
              </div>
            )
          })}
          <div className="text-center text-xs text-gray-400 pt-1">
            Pour modifier les tâches, allez dans l&apos;onglet Global.
          </div>
        </div>
      )}
    </div>
  )
}
