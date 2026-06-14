'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Espece, Template } from '@/types'

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
  const [onglet, setOnglet] = useState<'especes' | 'templates' | 'email' | 'export' | 'taches'>('especes')
  const [especes, setEspeces] = useState<Espece[]>([])
  const [templates, setTemplates] = useState<TemplateComplet[]>([])
  const [params, setParams] = useState<ParamsProduction | null>(null)
  const [tapis, setTapis] = useState('')
  const [godets, setGodets] = useState('')
  const [savingParams, setSavingParams] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editEspece, setEditEspece] = useState<Espece | null>(null)
  const [editTemplate, setEditTemplate] = useState<TemplateComplet | null>(null)
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

      <div className="flex rounded-lg overflow-hidden border border-gray-200">
        {[
          { val: 'especes',   label: '&#127807; Esp&egrave;ces' },
          { val: 'templates', label: '&#128203; Templates' },
          { val: 'taches',    label: 'T&acirc;ches' },
          { val: 'email',     label: '&#128231; Email' },
          { val: 'export',    label: '&#128190; Export' },
        ].map(o => (
          <button key={o.val} onClick={() => setOnglet(o.val as typeof onglet)}
            className={`flex-1 py-2 text-xs font-medium transition-colors
              ${onglet === o.val ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}
            dangerouslySetInnerHTML={{ __html: o.label }} />
        ))}
      </div>

      <button onClick={() => router.push('/couts')}
        className="w-full flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
        <span className="font-medium text-amber-800">Dashboard co&ucirc;ts de production</span>
        <span className="text-amber-600">&#x203A;</span>
      </button>

      {onglet === 'especes' && (
        <EspecesPanel
          especes={especes}
          onEdit={setEditEspece}
          onRefresh={charger}
          tapis={tapis}
          setTapis={setTapis}
          godets={godets}
          setGodets={setGodets}
          sauvegarderSeries={sauvegarderSeries}
          savingParams={savingParams}
        />
      )}
      {onglet === 'templates' && (
        <TemplatesPanel
          templates={templates} especes={especes}
          onEdit={setEditTemplate}
          onNouveauTemplate={() => setNouveauTemplate(true)}
          onRefresh={charger}
        />
      )}
      {onglet === 'taches'  && <TachesPanel />}
      {onglet === 'email'   && <EmailPanel />}
      {onglet === 'export'  && <ExportPanel />}

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
                &#x1F5D1;
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

function TemplateModal({ template, especes, onClose, onSave }: {
  template: TemplateComplet | null; especes: Espece[]
  onClose: () => void; onSave: () => void
}) {
  const [nom, setNom] = useState(template?.nom || '')
  const [description, setDescription] = useState(template?.description || '')
  const [lignes, setLignes] = useState<TemplateLigneComplet[]>(template?.templates_lignes || [])
  const [ajoutEspId, setAjoutEspId] = useState('')
  const [ajoutFormat, setAjoutFormat] = useState<'TAPIS' | 'GODET' | 'TERREAU'>('TAPIS')
  const [ajoutQte, setAjoutQte] = useState(1)
  const [saving, setSaving] = useState(false)

  const especesFiltrees = especes.filter(e => e.actif && (
    ajoutFormat === 'TAPIS'   ? e.section === 'TAPIS'   :
    ajoutFormat === 'GODET'   ? e.section === 'GODETS'  :
    e.section === 'TERREAU'
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
                <div key={idx} className="px-3 py-2.5 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
                    ${l.format === 'TAPIS' ? 'bg-green-100 text-green-700' :
                      l.format === 'GODET' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-200 text-gray-600'}`}>
                    {l.format}
                  </span>
                  <span className="flex-1 text-sm font-medium">
                    {l.espece?.nom || especes.find(e => e.id === l.espece_id)?.nom || '?'}
                  </span>
                  <span className="text-sm text-gray-500">&times;{l.quantite}</span>
                  <button onClick={() => setLignes(prev => prev.filter((_, i) => i !== idx))}
                    className="text-red-400 text-sm px-1 font-bold">&times;</button>
                </div>
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
              <button onClick={() => setAjoutQte(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-lg bg-gray-200 text-gray-700 font-bold active:scale-95">&minus;</button>
              <span className="text-sm font-bold w-6 text-center">{ajoutQte}</span>
              <button onClick={() => setAjoutQte(q => q + 1)}
                className="w-8 h-8 rounded-lg bg-green-700 text-white font-bold active:scale-95">+</button>
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

function EspecesPanel({ especes, onEdit, onRefresh, tapis, setTapis, godets, setGodets, sauvegarderSeries, savingParams }: {
  especes: Espece[]
  onEdit: (e: Espece) => void
  onRefresh: () => void
  tapis: string
  setTapis: (v: string) => void
  godets: string
  setGodets: (v: string) => void
  sauvegarderSeries: () => void
  savingParams: boolean
}) {
  const sections = ['TAPIS', 'TERREAU', 'GODETS'] as const
  const secIco = { TAPIS: '&#x1F7E9;', TERREAU: '&#x1F7EB;', GODETS: '&#x1F7E7;' }

  async function toggleActif(e: Espece) {
    await supabase.from('especes').update({ actif: !e.actif }).eq('id', e.id)
    onRefresh()
  }

  async function ajouterEspece(section: 'TAPIS' | 'TERREAU' | 'GODETS') {
    const nom = prompt(`Nom de la nouvelle espèce (${section}) :`)
    if (!nom) return
    await supabase.from('especes').insert({ nom: nom.toUpperCase(), section, actif: true })
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-green-200 p-4 space-y-3">
        <div className="font-bold text-sm text-green-900">&#x1F331; S&eacute;ries de production</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tapis par s&eacute;rie (caisse)</label>
            <input type="number" inputMode="numeric" value={tapis}
              onChange={e => setTapis(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-lg font-bold text-center focus:outline-none focus:border-green-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Godets par s&eacute;rie (plaque)</label>
            <input type="number" inputMode="numeric" value={godets}
              onChange={e => setGodets(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-lg font-bold text-center focus:outline-none focus:border-green-400" />
          </div>
        </div>
        <button onClick={sauvegarderSeries} disabled={savingParams}
          className="w-full bg-green-700 text-white py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
          dangerouslySetInnerHTML={{ __html: savingParams ? 'Sauvegarde...' : '&#x1F4BE; Enregistrer les s&eacute;ries' }} />
      </div>

      {sections.map(sec => (
        <div key={sec} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 font-semibold text-sm border-b border-gray-200 flex justify-between items-center">
            <span dangerouslySetInnerHTML={{ __html: `${secIco[sec]} ${sec}` }} />
            <button onClick={() => ajouterEspece(sec)}
              className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              + Ajouter
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {especes.filter(e => e.section === sec).map(e => (
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
                    {e.stock_actuel_g}g
                  </div>
                </div>
                <button onClick={() => onEdit(e)}
                  className="text-xs text-blue-600 px-2 py-1 rounded border border-blue-200 flex-shrink-0">
                  &Eacute;diter
                </button>
                <button onClick={() => toggleActif(e)}
                  className={`text-xs px-2 py-1 rounded border flex-shrink-0 ${e.actif ? 'text-gray-500 border-gray-200' : 'text-green-600 border-green-200'}`}>
                  {e.actif ? 'Off' : 'On'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EspeceModal({ espece, onClose, onSave }: { espece: Espece; onClose: () => void; onSave: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(espece.photo_url)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    nom:            espece.nom,
    g_tapis:        espece.g_tapis?.toString()       || '',
    g_godet:        espece.g_godet?.toString()       || '',
    g_caisse:       espece.g_caisse?.toString()      || '',
    pct_perte:      espece.pct_perte != null ? (espece.pct_perte * 100).toString() : '10',
    jours_pousse:   espece.jours_pousse?.toString()  || '',
    jours_conserv:  espece.jours_conserv?.toString() || '',
    rendement:      espece.rendement?.toString()     || '',
    prix_graine_kg: espece.prix_graine_kg?.toString() || '',
    stock_actuel_g: espece.stock_actuel_g.toString(),
  })
  const [saving, setSaving] = useState(false)

  async function handlePhoto(file: File) {
    setUploading(true)
    const ext  = file.name.split('.').pop() || 'jpg'
    const path = `${espece.id}.${ext}`
    const { error } = await supabase.storage
      .from('especes-photos')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data } = supabase.storage.from('especes-photos').getPublicUrl(path)
      setPhotoUrl(data.publicUrl)
    }
    setUploading(false)
  }

  function n(v: string) { return v ? parseFloat(v) : null }

  async function sauvegarder() {
    setSaving(true)
    await supabase.from('especes').update({
      nom:            form.nom,
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
    { key: 'nom',            label: 'Nom',                  type: 'text'   },
    { key: 'stock_actuel_g', label: 'Stock actuel (g)',     type: 'number' },
    { key: 'prix_graine_kg', label: 'Prix graine (€/kg)',   type: 'number' },
    { key: 'g_tapis',        label: 'G/tapis',              type: 'number' },
    { key: 'g_caisse',       label: 'G/caisse terreau',     type: 'number' },
    { key: 'g_godet',        label: 'G/godet',              type: 'number' },
    { key: 'pct_perte',      label: '% perte',              type: 'number' },
    { key: 'jours_pousse',   label: 'Jours pousse',         type: 'number' },
    { key: 'jours_conserv',  label: 'Jours conservation',   type: 'number' },
    { key: 'rendement',      label: 'Rendement',            type: 'number' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 pb-24 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">&Eacute;diter &mdash; {espece.nom}</h2>

        {/* Zone photo */}
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
              <span className="text-xs">Ajouter une photo</span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <span className="text-sm text-gray-600 animate-pulse">Envoi...</span>
            </div>
          )}
          {photoUrl && !uploading && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              Changer
            </div>
          )}
        </button>

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
    { key: 'taches',         label: 'Tâches',     icon: '&#x2705;',  desc: 'Agenda et tâches' },
    { key: 'pertes',         label: 'Pertes',          icon: '&#x1F4C9;', desc: 'Invendus et pertes' },
    { key: 'especes',        label: 'Espèces',    icon: '&#x1F33F;', desc: 'Catalogue des espèces micropousses' },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
        <div className="font-bold mb-1">&#x1F4BE; Export de vos donn&eacute;es</div>
        Les fichiers CSV s&apos;ouvrent directement dans Excel ou Google Sheets.
        Faites un export complet 1&times;/semaine pour sauvegarder toutes vos donn&eacute;es.
      </div>
      <button onClick={exporterTout} disabled={!!exporting}
        className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 active:scale-95 transition-transform disabled:opacity-60 bg-green-700 text-white shadow-sm"
        dangerouslySetInnerHTML={{ __html: exporting === 'all'
          ? '<span class="animate-spin">&#x23F3;</span> Export en cours&hellip;'
          : done === 'all'
          ? '&#x2705; T&eacute;l&eacute;charg&eacute; !'
          : '<span>&#x1F4E6;</span> Export complet (toutes les tables)' }} />
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Par table</div>
      <div className="space-y-2">
        {exports.map(e => (
          <button key={e.key}
            onClick={() => exporter(e.key, e.label.toLowerCase().replace(/\s/g, '_'))}
            disabled={!!exporting}
            className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 active:scale-95 transition-transform disabled:opacity-60 shadow-sm text-left">
            <span className="text-2xl" dangerouslySetInnerHTML={{ __html: e.icon }} />
            <div className="flex-1">
              <div className="font-semibold text-sm text-gray-800">{e.label}</div>
              <div className="text-xs text-gray-400">{e.desc}</div>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              exporting === e.key ? 'bg-amber-100 text-amber-700' :
              done === e.key     ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`} dangerouslySetInnerHTML={{ __html:
              exporting === e.key ? '&#x23F3; &hellip;' :
              done === e.key      ? '&#x2705; OK' : '&#x2193; CSV'
            }} />
          </button>
        ))}
      </div>
    </div>
  )
}

type CatItem       = { id: string; titre: string; categorie: string; icone: string; active: boolean; ordre: number }
type ZoneLite      = { id: string; nom: string; type: string }
type ZoneTacheLite = { zone_id: string; catalogue_id: string }

function TachesPanel() {
  const [zones, setZones]           = useState<ZoneLite[]>([])
  const [catalogue, setCatalogue]   = useState<CatItem[]>([])
  const [zoneTaches, setZoneTaches] = useState<ZoneTacheLite[]>([])
  const [vue, setVue]               = useState<string>('global')
  const [saving, setSaving]         = useState<string | null>(null)

  useEffect(() => { chargerTaches() }, [])

  async function chargerTaches() {
    const [{ data: z }, { data: c }, { data: zt }] = await Promise.all([
      supabase.from('zones').select('id,nom,type').eq('actif', true).order('ordre'),
      supabase.from('taches_catalogue').select('*').order('ordre'),
      supabase.from('zone_taches_catalogue').select('*'),
    ])
    if (z) setZones(z); if (c) setCatalogue(c as CatItem[]); if (zt) setZoneTaches(zt)
  }

  async function toggleGlobal(cat: CatItem) {
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

  const categories  = [...new Set(catalogue.map(c => c.categorie))]
  const activeCount = catalogue.filter(c => c.active).length

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-900">
        <div className="font-bold mb-1">Catalogue de tâches maraîchér</div>
        <div className="text-xs text-green-700">
          {catalogue.length} tâches au total &middot; {activeCount} actives.
          Associez les tâches typiques à chaque zone pour des suggestions personnalisées.
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setVue('global')}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border active:scale-95 flex-shrink-0
            ${vue === 'global' ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
          Global
        </button>
        {zones.map(z => (
          <button key={z.id} onClick={() => setVue(z.id)}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border active:scale-95 flex-shrink-0
              ${vue === z.id ? 'bg-green-700 text-white border-green-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {z.nom}
          </button>
        ))}
      </div>
      {vue === 'global' ? (
        <div className="space-y-2">
          <div className="text-xs text-gray-400">Activez / désactivez les tâches du catalogue.</div>
          {categories.map(cat => {
            const items = catalogue.filter(c => c.categorie === cat)
            return (
              <div key={cat} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 font-bold text-xs text-gray-600 border-b border-gray-100 flex justify-between">
                  <span>{items[0]?.icone} {cat}</span>
                  <span className="font-normal text-gray-400">{items.filter(i => i.active).length}/{items.length}</span>
                </div>
                {items.map(c => (
                  <button key={c.id} onClick={() => toggleGlobal(c)}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 text-left active:bg-gray-50 ${!c.active ? 'opacity-40' : ''}`}>
                    <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs
                      ${c.active ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 bg-white'}`}>
                      {c.active && 'v'}
                    </div>
                    <span className="text-sm text-gray-800 flex-1">{c.titre}</span>
                    {saving === c.id && <span className="text-xs text-gray-400 animate-pulse">...</span>}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-gray-400">
            Tâches typiques de {zones.find(z => z.id === vue)?.nom} &mdash;
            apparaissent en suggestions lors de l&apos;ajout rapide.
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
                        {checked && 'v'}
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
            Pour voir toutes les tâches, activez-les dans Global.
          </div>
        </div>
      )}
    </div>
  )
}
