'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ParamsDocs } from '@/lib/pdf/types'

type Form = Omit<ParamsDocs, 'prochain_numero_facture' | 'logo_url' | 'delai_paiement_jours' | 'couleur_principale' | 'adresse_exploitation' | 'code_postal_exploitation' | 'ville_exploitation'> & {
  prochain_numero_facture: string
  delai_paiement_jours: string
  couleur_principale: string
  adresse_exploitation: string
  code_postal_exploitation: string
  ville_exploitation: string
}

const DEFAUT: Form = {
  nom: 'GAEC Les Petites Herbes',
  adresse: '15 rue François Arago',
  code_postal: '83310',
  ville: 'Cogolin',
  adresse_exploitation: '270 avenue du Caucadis',
  code_postal_exploitation: '83310',
  ville_exploitation: 'Grimaud',
  telephone: '06 09 93 75 89 / 07 71 63 16 53',
  email: 'petitesherbes@gmail.com',
  activite: 'Producteur de micro pousses, plantes aromatiques et médicinales',
  siret: '983 294 703 00019',
  rcs: 'FREJUS',
  capital: '2000',
  tva_intra: 'FR 49 983 294 703',
  ape_naf: '7010Z',
  certification_bio: 'FR-BIO-01',
  iban: 'FR76 1027 8091 1400 0203 1770 467',
  bic: 'CMCIFR2A',
  titulaire_iban: 'GAEC Les Petites Herbes',
  couleur_principale: '#1B5E20',
  mention_reserve_propriete: "En application de la loi n° 80335 du 12 mai 1980 relative aux clauses de réserve de propriété dans les contrats de vente, les produits vendus restent notre propriété jusqu'à paiement complet de la facture.",
  mention_article_441: "Article D 441-5 du code de commerce : le montant de l'indemnité forfaitaire pour frais de recouvrement due au créancier en cas de retard de paiement est fixée à 40 €. Cette indemnité sera due de plein droit et sans formalités par le professionnel en situation de retard. Escompte pour paiement anticipé : néant.",
  conditions_reglement: 'Comptant à réception de facture',
  delai_paiement_jours: '0',
  prochain_numero_facture: '485',
}

export default function ParametresDocumentsPage() {
  const router = useRouter()
  const [form, setForm] = useState<Form>(DEFAUT)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [rowId, setRowId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [onglet, setOnglet] = useState<'entete' | 'pied' | 'mentions' | 'facture'>('entete')

  useEffect(() => { charger() }, [])

  async function charger() {
    const { data } = await supabase.from('parametres_documents').select('*').limit(1).single()
    if (data) {
      setRowId(data.id)
      setLogoUrl(data.logo_url)
      setForm({
        nom: data.nom || '',
        adresse: data.adresse || '',
        code_postal: data.code_postal || '',
        ville: data.ville || '',
        adresse_exploitation: data.adresse_exploitation || '',
        code_postal_exploitation: data.code_postal_exploitation || '',
        ville_exploitation: data.ville_exploitation || '',
        telephone: data.telephone || '',
        email: data.email || '',
        activite: data.activite || '',
        siret: data.siret || '',
        rcs: data.rcs || '',
        capital: data.capital || '',
        tva_intra: data.tva_intra || '',
        ape_naf: data.ape_naf || '',
        certification_bio: data.certification_bio || '',
        iban: data.iban || '',
        bic: data.bic || '',
        titulaire_iban: data.titulaire_iban || '',
        couleur_principale: data.couleur_principale || '#1B5E20',
        mention_reserve_propriete: data.mention_reserve_propriete || '',
        mention_article_441: data.mention_article_441 || '',
        conditions_reglement: data.conditions_reglement || '',
        delai_paiement_jours: String(data.delai_paiement_jours ?? '0'),
        prochain_numero_facture: String(data.prochain_numero_facture ?? 485),
      })
    }
    setLoading(false)
  }

  async function uploadLogo(file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', 'documents')
    formData.append('path', `logo-${Date.now()}.${ext}`)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (res.ok) {
      const { url } = await res.json()
      setLogoUrl(url)
    }
    setUploading(false)
  }

  async function sauvegarder() {
    setSaving(true)
    const payload = {
      ...form,
      logo_url: logoUrl,
      delai_paiement_jours: parseInt(form.delai_paiement_jours) || 0,
      prochain_numero_facture: parseInt(form.prochain_numero_facture) || 485,
      adresse_exploitation: form.adresse_exploitation || null,
      code_postal_exploitation: form.code_postal_exploitation || null,
      ville_exploitation: form.ville_exploitation || null,
      couleur_principale: form.couleur_principale || null,
      updated_at: new Date().toISOString(),
    }
    if (rowId) {
      await supabase.from('parametres_documents').update(payload).eq('id', rowId)
    } else {
      const { data } = await supabase.from('parametres_documents').insert(payload).select().single()
      if (data) setRowId(data.id)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const input = (label: string, k: keyof Form, placeholder?: string, type = 'text') => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={form[k] as string}
        onChange={set(k)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-green-400"
      />
    </div>
  )

  const textarea = (label: string, k: keyof Form, rows = 3) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <textarea
        value={form[k] as string}
        onChange={set(k)}
        rows={rows}
        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:border-green-400"
      />
    </div>
  )

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement…</div>

  const tableMissing = !rowId && !loading

  return (
    <div className="p-4 space-y-4 pb-32">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">←</button>
        <h1 className="text-xl font-bold text-green-900 flex-1">⚙️ Paramètres documents</h1>
        {saved && (
          <span className="text-xs text-green-700 bg-green-100 px-3 py-1 rounded-full font-semibold">
            ✅ Sauvegardé
          </span>
        )}
      </div>

      {tableMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
          <div className="font-semibold mb-1">⚠️ Table non créée</div>
          La table <code className="font-mono">parametres_documents</code> n&apos;existe pas encore.
          Appliquez la migration <code className="font-mono">013_parametres_documents.sql</code> dans le SQL Editor Supabase,
          puis rechargez cette page.
        </div>
      )}

      {/* Onglets */}
      <div className="grid grid-cols-4 rounded-lg overflow-hidden border border-gray-200">
        {[
          { val: 'entete', label: 'En-tête' },
          { val: 'pied',   label: 'Pied de page' },
          { val: 'mentions', label: 'Mentions' },
          { val: 'facture', label: 'Facturation' },
        ].map(o => (
          <button key={o.val} onClick={() => setOnglet(o.val as typeof onglet)}
            className={`py-2 text-xs font-medium transition-colors
              ${onglet === o.val ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}>
            {o.label}
          </button>
        ))}
      </div>

      {/* ── En-tête ── */}
      {onglet === 'entete' && (
        <div className="space-y-3">
          {/* Logo */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Logo</label>
            <div onClick={() => fileRef.current?.click()}
              className="relative h-24 rounded-xl overflow-hidden bg-gray-50 border-2 border-dashed border-gray-200 cursor-pointer flex items-center justify-center">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="logo" className="h-20 object-contain" />
              ) : (
                <div className="text-center text-gray-400">
                  <div className="text-3xl">🖼️</div>
                  <div className="text-xs mt-1">{uploading ? 'Upload…' : 'Appuyer pour ajouter le logo'}</div>
                </div>
              )}
              {logoUrl && <div className="absolute bottom-1 right-2 text-xs bg-black/30 text-white px-2 py-0.5 rounded-full">Changer</div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }} />
            {logoUrl && (
              <button onClick={() => setLogoUrl(null)} className="text-xs text-red-500 mt-1">Supprimer le logo</button>
            )}
          </div>

          {input('Nom *', 'nom', 'GAEC Les Petites Herbes')}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
            <div className="text-xs font-semibold text-amber-800">🏛 Siège social (mentions légales)</div>
            {input('Adresse siège', 'adresse', '15 rue François Arago')}
            <div className="grid grid-cols-2 gap-3">
              {input('Code postal', 'code_postal', '83310')}
              {input('Ville', 'ville', 'Cogolin')}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-3">
            <div className="text-xs font-semibold text-green-800">🌱 Adresse d&apos;exploitation (ferme) — affichée sur les BL</div>
            <div className="text-xs text-green-600">Laissez vide pour utiliser l&apos;adresse du siège sur les BL.</div>
            {input('Adresse ferme', 'adresse_exploitation', '270 avenue du Caucadis')}
            <div className="grid grid-cols-2 gap-3">
              {input('Code postal', 'code_postal_exploitation', '83310')}
              {input('Ville', 'ville_exploitation', 'Grimaud')}
            </div>
          </div>

          {input('Téléphone', 'telephone', '06 09 93 75 89')}
          {input('Email', 'email', 'petitesherbes@gmail.com', 'email')}
          {textarea('Activité (ligne sous le nom)', 'activite', 2)}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Couleur principale des documents</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.couleur_principale}
                onChange={e => setForm(f => ({ ...f, couleur_principale: e.target.value }))}
                className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
              <input type="text" value={form.couleur_principale}
                onChange={e => setForm(f => ({ ...f, couleur_principale: e.target.value }))}
                placeholder="#1B5E20"
                className="flex-1 border border-gray-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:border-green-400" />
              <button onClick={() => setForm(f => ({ ...f, couleur_principale: '#1B5E20' }))}
                className="text-xs text-gray-400 hover:text-gray-600 px-2">Réinit.</button>
            </div>
            <div className="mt-2 h-6 rounded-lg" style={{ backgroundColor: form.couleur_principale }} />
          </div>
        </div>
      )}

      {/* ── Pied de page ── */}
      {onglet === 'pied' && (
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1">
            <div className="font-semibold">Aperçu pied de page :</div>
            <div>{form.nom} - {form.adresse} - {form.code_postal} {form.ville.toUpperCase()}</div>
            <div>Au capital de {form.capital}€ - RCS {form.rcs} N°SIRET : {form.siret} - TVA Intra. : {form.tva_intra} - APE/NAF : {form.ape_naf}</div>
            {form.certification_bio && <div>* Certifié par {form.certification_bio}</div>}
          </div>

          {input('SIRET', 'siret', '983 294 703 00019')}
          {input('RCS', 'rcs', 'FREJUS')}
          {input('Capital social (€)', 'capital', '2000')}
          {input('TVA Intracommunautaire', 'tva_intra', 'FR 49 983 294 703')}
          {input('APE / NAF', 'ape_naf', '7010Z')}
          {input('Certification BIO', 'certification_bio', 'FR-BIO-01')}
        </div>
      )}

      {/* ── Mentions légales ── */}
      {onglet === 'mentions' && (
        <div className="space-y-3">
          {textarea('Clause de réserve de propriété', 'mention_reserve_propriete', 4)}
          {textarea("Article D 441-5 (retard de paiement)", 'mention_article_441', 4)}
        </div>
      )}

      {/* ── Facturation ── */}
      {onglet === 'facture' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            💡 Le numéro de facture s&apos;incrémente automatiquement à chaque facture générée.
          </div>
          {input('Prochain N° de facture', 'prochain_numero_facture', '485', 'number')}
          {input('Conditions de règlement', 'conditions_reglement', 'Comptant à réception de facture')}
          {input('Délai de paiement (jours)', 'delai_paiement_jours', '0', 'number')}
          {input('IBAN', 'iban', 'FR76 1027 8091 1400 0203 1770 467')}
          <div className="grid grid-cols-2 gap-3">
            {input('BIC', 'bic', 'CMCIFR2A')}
            {input('Titulaire', 'titulaire_iban', 'GAEC Les Petites Herbes')}
          </div>
        </div>
      )}

      {/* Bouton sauvegarder */}
      <div className="fixed bottom-16 left-0 right-0 max-w-2xl mx-auto px-4 pb-2">
        <button
          onClick={sauvegarder}
          disabled={saving || tableMissing}
          className="w-full py-3.5 rounded-xl bg-green-700 text-white font-bold text-sm shadow-lg disabled:opacity-50">
          {saving ? 'Sauvegarde…' : '💾 Sauvegarder les paramètres'}
        </button>
      </div>
    </div>
  )
}
