'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Espece, Template } from '@/types'

type ParamsProduction = {
  id: string
  tapis_par_caisse: number | null
  godets_par_serie: number | null
}

export default function ParametresPage() {
  const router = useRouter()
  const [onglet, setOnglet] = useState<'especes' | 'templates' | 'email' | 'export' | 'taches'>('especes')
  const [especes, setEspeces] = useState<Espece[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [params, setParams] = useState<ParamsProduction | null>(null)
  const [tapis, setTapis] = useState('')
  const [godets, setGodets] = useState('')
  const [savingParams, setSavingParams] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editEspece, setEditEspece] = useState<Espece | null>(null)

  useEffect(() => { charger() }, [])

  async function charger() {
    const [{ data: e }, { data: t }, { data: p }] = await Promise.all([
      supabase.from('especes').select('*').order('section,nom'),
      supabase.from('templates').select('*').order('nom'),
      supabase.from('parametres_production').select('*').single(),
    ])
    if (e) setEspeces(e)
    if (t) setTemplates(t)
    if (p) {
      setParams(p as ParamsProduction)
      setTapis((p as ParamsProduction).tapis_par_caisse?.toString() || '24')
      setGodets((p as ParamsProduction).godets_par_serie?.toString() || '14')
    }
    setLoading(false)
  }

  async function sauvegarderSeries() {
    if (!params) return
    setSavingParams(true)
    await supabase.from('parametres_production').update({
      tapis_par_caisse: parseInt(tapis) || 24,
      godets_par_serie: parseInt(godets) || 14,
    }).eq('id', params.id)
    setSavingParams(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-green-900">⚙️ Paramètres</h1>

      {/* Series de production */}
      <div className="bg-white rounded-2xl border border-green-200 p-4 space-y-3">
        <div className="font-bold text-sm text-green-900">🌱 Séries de production</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tapis par série (caisse)</label>
            <input
              type="number" inputMode="numeric" value={tapis}
              onChange={e => setTapis(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-lg font-bold text-center focus:outline-none focus:border-green-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Godets par série (plaque)</label>
            <input
              type="number" inputMode="numeric" value={godets}
              onChange={e => setGodets(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-lg font-bold text-center focus:outline-none focus:border-green-400"
            />
          </div>
        </div>
        <button onClick={sauvegarderSeries} disabled={savingParams}
          className="w-full bg-green-700 text-white py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50">
          {savingParams ? 'Sauvegarde...' : '💾 Enregistrer les séries'}
        </button>
      </div>

      <div className="flex rounded-lg overflow-hidden border border-gray-200">
        {[
          { val: 'especes',   label: '🌿 Espèces' },
          { val: 'templates', label: '📋 Templates' },
          { val: 'taches',    label: 'Tâches' },
          { val: 'email',     label: '📧 Email' },
          { val: 'export',    label: '💾 Export' },
        ].map(o => (
          <button key={o.val} onClick={() => setOnglet(o.val as typeof onglet)}
            className={`flex-1 py-2 text-xs font-medium transition-colors
              ${onglet === o.val ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}>
            {o.label}
          </button>
        ))}
      </div>

      {/* Raccourci Couts */}
      <button onClick={() => router.push('/couts')}
        className="w-full flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
        <span className="font-medium text-amber-800">Dashboard coûts de production</span>
        <span className="text-amber-600">›</span>
      </button>

      {onglet === 'especes'   && <EspecesPanel especes={especes} onEdit={setEditEspece} onRefresh={charger} />}
      {onglet === 'templates' && <TemplatesPanel templates={templates} onRefresh={charger} />}
      {onglet === 'taches'    && <TachesPanel />}
      {onglet === 'email'     && <EmailPanel />}
      {onglet === 'export'    && <ExportPanel />}

      {editEspece && (
        <EspeceModal espece={editEspece} onClose={() => setEditEspece(null)} onSave={charger} />
      )}
    </div>
  )
}

function EspecesPanel({ especes, onEdit, onRefresh }: {
  especes: Espece[]; onEdit: (e: Espece) => void; onRefresh: () => void
}) {
  const sections = ['TAPIS', 'TERREAU', 'GODETS'] as const
  const secIco = { TAPIS: '🟩', TERREAU: '🟫', GODETS: '🟧' }

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
    <div className="space-y-3">
      {sections.map(sec => (
        <div key={sec} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 font-semibold text-sm border-b border-gray-200 flex justify-between items-center">
            <span>{secIco[sec]} {sec}</span>
            <button onClick={() => ajouterEspece(sec)}
              className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              + Ajouter
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {especes.filter(e => e.section === sec).map(e => (
              <div key={e.id} className={`px-3 py-2 flex items-center gap-2 ${!e.actif ? 'opacity-40' : ''}`}>
                <div className="flex-1">
                  <div className="text-sm font-medium">{e.nom}</div>
                  <div className="text-xs text-gray-400">
                    {e.prix_graine_kg ? `${e.prix_graine_kg}€/kg` : 'Prix non renseigné'}
                    {' · '}
                    {e.stock_actuel_g}g en stock
                  </div>
                </div>
                <button onClick={() => onEdit(e)}
                  className="text-xs text-blue-600 px-2 py-1 rounded border border-blue-200">
                  Éditer
                </button>
                <button onClick={() => toggleActif(e)}
                  className={`text-xs px-2 py-1 rounded border ${e.actif ? 'text-gray-500 border-gray-200' : 'text-green-600 border-green-200'}`}>
                  {e.actif ? 'Désactiver' : 'Activer'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EspeceModal({ espece, onClose, onSave }: { espece: Espece, onClose: () => void, onSave: () => void }) {
  const [form, setForm] = useState({
    nom: espece.nom,
    g_tapis: espece.g_tapis?.toString() || '',
    g_godet: espece.g_godet?.toString() || '',
    g_caisse: espece.g_caisse?.toString() || '',
    pct_perte: espece.pct_perte != null ? (espece.pct_perte * 100).toString() : '10',
    jours_pousse: espece.jours_pousse?.toString() || '',
    jours_conserv: espece.jours_conserv?.toString() || '',
    rendement: espece.rendement?.toString() || '',
    prix_graine_kg: espece.prix_graine_kg?.toString() || '',
    stock_actuel_g: espece.stock_actuel_g.toString(),
  })
  const [saving, setSaving] = useState(false)

  function n(v: string) { return v ? parseFloat(v) : null }

  async function sauvegarder() {
    setSaving(true)
    await supabase.from('especes').update({
      nom: form.nom,
      g_tapis: n(form.g_tapis),
      g_godet: n(form.g_godet),
      g_caisse: n(form.g_caisse),
      pct_perte: form.pct_perte ? parseFloat(form.pct_perte) / 100 : null,
      jours_pousse: form.jours_pousse ? parseInt(form.jours_pousse) : null,
      jours_conserv: form.jours_conserv ? parseInt(form.jours_conserv) : null,
      rendement: n(form.rendement),
      prix_graine_kg: n(form.prix_graine_kg),
      stock_actuel_g: parseFloat(form.stock_actuel_g) || 0,
    }).eq('id', espece.id)
    setSaving(false)
    onSave()
    onClose()
  }

  const champs = [
    { key: 'nom', label: 'Nom', type: 'text' },
    { key: 'stock_actuel_g', label: 'Stock actuel (g)', type: 'number' },
    { key: 'prix_graine_kg', label: 'Prix graine (€/kg)', type: 'number' },
    { key: 'g_tapis', label: 'G/tapis', type: 'number' },
    { key: 'g_caisse', label: 'G/caisse terreau', type: 'number' },
    { key: 'g_godet', label: 'G/godet', type: 'number' },
    { key: 'pct_perte', label: '% perte', type: 'number' },
    { key: 'jours_pousse', label: 'Jours pousse', type: 'number' },
    { key: 'jours_conserv', label: 'Jours conservation', type: 'number' },
    { key: 'rendement', label: 'Rendement', type: 'number' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 pb-24 space-y-3 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Éditer — {espece.nom}</h2>
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
          <button onClick={sauvegarder} disabled={saving}
            className="flex-1 py-3 rounded-lg bg-green-700 text-white font-semibold disabled:opacity-50">
            {saving ? 'Sauvegarde...' : '💾 Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TemplatesPanel({ templates, onRefresh }: { templates: Template[], onRefresh: () => void }) {
  async function supprimer(id: string) {
    if (!confirm('Supprimer ce template ?')) return
    await supabase.from('templates').delete().eq('id', id)
    onRefresh()
  }

  return (
    <div className="space-y-2">
      {templates.map(t => (
        <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-2">
          <div className="flex-1">
            <div className="font-medium text-sm">{t.nom}</div>
            {t.description && <div className="text-xs text-gray-400">{t.description}</div>}
          </div>
          <button onClick={() => supprimer(t.id)}
            className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded border border-red-200">
            Supprimer
          </button>
        </div>
      ))}
      {templates.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Aucun template. Créez-en depuis la page Semis.
        </div>
      )}
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
        <div className="bg-gray-50 rounded p-2 text-sm font-mono text-gray-700">
          petitesherbes@gmail.com
        </div>
        <p className="text-xs text-gray-400">
          Modifiable via la variable EMAIL_DESTINATION dans .env.local
        </p>
      </div>
      <button onClick={testerEmail} disabled={testing}
        className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50">
        {testing ? 'Envoi...' : '📧 Envoyer un email de test'}
      </button>
    </div>
  )
}

// ─── Export Panel ─────────────────────────────────────────────────────────────

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
    a.href     = url
    a.download = nom
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function exporter(table: string, nom: string, select = '*') {
    setExporting(table)
    const { data } = await supabase.from(table).select(select).order('created_at', { ascending: false })
    if (data && data.length > 0) {
      const date = new Date().toISOString().slice(0, 10)
      telecharger(toCSV(data as unknown as Record<string, unknown>[]), `${nom}_${date}.csv`)
      setDone(table)
      setTimeout(() => setDone(null), 3000)
    }
    setExporting(null)
  }

  async function exporterTout() {
    setExporting('all')
    const tables = [
      { key: 'clients',             sel: '*' },
      { key: 'especes',             sel: '*' },
      { key: 'semis',               sel: '*' },
      { key: 'semis_lignes',        sel: '*' },
      { key: 'bons_livraison',      sel: '*' },
      { key: 'bl_lignes',           sel: '*' },
      { key: 'cahier_culture',      sel: '*' },
      { key: 'taches',              sel: '*' },
      { key: 'pertes',              sel: '*' },
      { key: 'especes_serre',       sel: '*' },
      { key: 'produits_traitement', sel: '*' },
    ]
    const allData: Record<string, unknown>[] = []
    for (const t of tables) {
      const { data } = await supabase.from(t.key).select(t.sel).order('created_at', { ascending: false })
      if (data) {
        for (const row of data) {
          allData.push({ _table: t.key, ...(row as unknown as Record<string, unknown>) })
        }
      }
    }
    const date = new Date().toISOString().slice(0, 10)
    telecharger(toCSV(allData), `petites_herbes_backup_${date}.csv`)
    setExporting(null)
    setDone('all')
    setTimeout(() => setDone(null), 3000)
  }

  const exports = [
    { key: 'clients',        label: 'Clients',         icon: '👤', desc: 'Noms, téléphones, liens boutique' },
    { key: 'bons_livraison', label: 'Commandes (BLs)', icon: '📦', desc: 'Tous les bons de livraison' },
    { key: 'semis',          label: 'Semis',           icon: '🌱', desc: 'Historique des semis' },
    { key: 'cahier_culture', label: 'Cahier terrain',  icon: '📖', desc: 'Toutes les entrées terrain' },
    { key: 'taches',         label: 'Tâches',          icon: '✅', desc: 'Agenda et tâches' },
    { key: 'pertes',         label: 'Pertes',          icon: '📉', desc: 'Invendus et pertes' },
    { key: 'especes',        label: 'Espèces',         icon: '🌿', desc: 'Catalogue des espèces micropousses' },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
        <div className="font-bold mb-1">💾 Export de vos données</div>
        Les fichiers CSV s&apos;ouvrent directement dans Excel ou Google Sheets.
        Faites un export complet 1×/semaine pour sauvegarder toutes vos données.
      </div>

      <button onClick={exporterTout} disabled={!!exporting}
        className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 active:scale-95 transition-transform disabled:opacity-60 bg-green-700 text-white shadow-sm">
        {exporting === 'all' ? (
          <><span className="animate-spin">⏳</span> Export en cours…</>
        ) : done === 'all' ? (
          '✅ Téléchargé !'
        ) : (
          <><span>📦</span> Export complet (toutes les tables)</>
        )}
      </button>

      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Par table</div>
      <div className="space-y-2">
        {exports.map(e => (
          <button key={e.key}
            onClick={() => exporter(e.key, e.label.toLowerCase().replace(/\s/g, '_'))}
            disabled={!!exporting}
            className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 active:scale-95 transition-transform disabled:opacity-60 shadow-sm text-left">
            <span className="text-2xl">{e.icon}</span>
            <div className="flex-1">
              <div className="font-semibold text-sm text-gray-800">{e.label}</div>
              <div className="text-xs text-gray-400">{e.desc}</div>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              exporting === e.key ? 'bg-amber-100 text-amber-700' :
              done === e.key     ? 'bg-green-100 text-green-700' :
                                   'bg-gray-100 text-gray-500'
            }`}>
              {exporting === e.key ? '⏳ …' : done === e.key ? '✅ OK' : '↓ CSV'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Taches Panel ─────────────────────────────────────────────────────────────

type CatItem = { id: string; titre: string; categorie: string; icone: string; active: boolean; ordre: number }
type ZoneLite = { id: string; nom: string; type: string }
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
    if (z)  setZones(z)
    if (c)  setCatalogue(c as CatItem[])
    if (zt) setZoneTaches(zt)
  }

  async function toggleGlobal(cat: CatItem) {
    setSaving(cat.id)
    await supabase.from('taches_catalogue').update({ active: !cat.active }).eq('id', cat.id)
    await chargerTaches()
    setSaving(null)
  }

  async function toggleZone(zoneId: string, catalogId: string) {
    setSaving(catalogId)
    const existe = zoneTaches.some(zt => zt.zone_id === zoneId && zt.catalogue_id === catalogId)
    if (existe) {
      await supabase.from('zone_taches_catalogue').delete()
        .eq('zone_id', zoneId).eq('catalogue_id', catalogId)
    } else {
      await supabase.from('zone_taches_catalogue').insert({ zone_id: zoneId, catalogue_id: catalogId })
    }
    await chargerTaches()
    setSaving(null)
  }

  const categories  = [...new Set(catalogue.map(c => c.categorie))]
  const activeCount = catalogue.filter(c => c.active).length

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-900">
        <div className="font-bold mb-1">Catalogue de tâches maraîcher</div>
        <div className="text-xs text-green-700">
          {catalogue.length} tâches au total · {activeCount} actives.
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
                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 text-left active:bg-gray-50
                      ${!c.active ? 'opacity-40' : ''}`}>
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
            Tâches typiques de {zones.find(z => z.id === vue)?.nom} —
            apparaissent en suggestions lors de l&apos;ajout rapide.
          </div>
          {categories.map(cat => {
            const items = catalogue.filter(c => c.active && c.categorie === cat)
            if (!items.length) return null
            const nbCochees = items.filter(c =>
              zoneTaches.some(zt => zt.zone_id === vue && zt.catalogue_id === c.id)
            ).length
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
