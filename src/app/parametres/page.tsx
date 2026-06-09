'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Espece, Template } from '@/types'

export default function ParametresPage() {
  const router = useRouter()
  const [onglet, setOnglet] = useState<'especes' | 'templates' | 'email'>('especes')
  const [especes, setEspeces] = useState<Espece[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editEspece, setEditEspece] = useState<Espece | null>(null)

  useEffect(() => { charger() }, [])

  async function charger() {
    const [{ data: e }, { data: t }] = await Promise.all([
      supabase.from('especes').select('*').order('section,nom'),
      supabase.from('templates').select('*').order('nom'),
    ])
    if (e) setEspeces(e)
    if (t) setTemplates(t)
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-green-900">⚙️ Paramètres</h1>

      <div className="flex rounded-lg overflow-hidden border border-gray-200">
        {[
          { val: 'especes', label: '🌿 Espèces' },
          { val: 'templates', label: '📋 Templates' },
          { val: 'email', label: '📧 Email' },
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
        <span className="font-medium text-amber-800">Dashboard couts de production</span>
        <span className="text-amber-600">›</span>
      </button>

      {onglet === 'especes' && <EspecesPanel especes={especes} onEdit={setEditEspece} onRefresh={charger} />}
      {onglet === 'templates' && <TemplatesPanel templates={templates} onRefresh={charger} />}
      {onglet === 'email' && <EmailPanel />}

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
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 space-y-3 max-h-[85vh] overflow-y-auto"
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
