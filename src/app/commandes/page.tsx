'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { Client, Produit, BonLivraison, ProduitCategorie, BLStatut } from '@/types'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATUT_LABEL: Record<BLStatut, string> = {
  brouillon: 'Brouillon',
  envoye:    'Envoye',
  livre:     'Livre',
  facture:   'Facture',
}
const STATUT_COLOR: Record<BLStatut, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  envoye:    'bg-blue-100 text-blue-700',
  livre:     'bg-green-100 text-green-700',
  facture:   'bg-purple-100 text-purple-700',
}

const CAT_LABEL: Record<ProduitCategorie, string> = {
  TAPIS:     'Tapis micro-pousses',
  BARQUETTE: 'Barquettes',
  GODET:     'Godets',
  BOTTE:     'Bottes',
  FLEUR:     'Fleurs',
  LIVRAISON: 'Livraison',
  CHAMP:     'Produits du champ',
  AUTRE:     'Autres',
}

export default function CommandesPage() {
  const [onglet, setOnglet] = useState<'bls' | 'catalogue' | 'clients'>('bls')
  const [bls, setBls] = useState<BonLivraison[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { charger() }, [])

  async function charger() {
    const [{ data: b }, { data: p }, { data: c }] = await Promise.all([
      supabase.from('bons_livraison')
        .select('*, client:clients(nom, email)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('produits').select('*').eq('actif', true).order('categorie,designation'),
      supabase.from('clients').select('*').eq('actif', true).order('nom'),
    ])
    if (b) setBls(b as BonLivraison[])
    if (p) setProduits(p)
    if (c) setClients(c)
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-green-900">Commandes / BL</h1>
        {onglet === 'bls' && (
          <button onClick={() => router.push('/commandes/nouveau')}
            className="bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
            + Nouveau BL
          </button>
        )}
      </div>

      <div className="flex rounded-lg overflow-hidden border border-gray-200">
        {[
          { val: 'bls',       label: 'Bons de livraison' },
          { val: 'catalogue', label: 'Catalogue' },
          { val: 'clients',   label: 'Clients' },
        ].map(o => (
          <button key={o.val} onClick={() => setOnglet(o.val as typeof onglet)}
            className={`flex-1 py-2 text-xs font-medium transition-colors
              ${onglet === o.val ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}>
            {o.label}
          </button>
        ))}
      </div>

      {onglet === 'bls'       && <BLsList bls={bls} onRefresh={charger} />}
      {onglet === 'catalogue' && <Catalogue produits={produits} onRefresh={charger} />}
      {onglet === 'clients'   && <ClientsList clients={clients} onRefresh={charger} />}
    </div>
  )
}

// ─── Liste des BLs ───────────────────────────────────────────

function BLsList({ bls, onRefresh }: { bls: BonLivraison[]; onRefresh: () => void }) {
  const router = useRouter()
  const [filtre, setFiltre] = useState<BLStatut | 'tous'>('tous')

  const filtres: Array<{ val: BLStatut | 'tous'; label: string }> = [
    { val: 'tous',     label: 'Tous' },
    { val: 'brouillon', label: 'Brouillon' },
    { val: 'envoye',    label: 'Envoyes' },
    { val: 'livre',     label: 'Livres' },
    { val: 'facture',   label: 'Factures' },
  ]

  const affichés = filtre === 'tous' ? bls : bls.filter(b => b.statut === filtre)

  if (bls.length === 0) return (
    <div className="text-center py-12 text-gray-400 space-y-2">
      <div className="text-4xl">📦</div>
      <div className="text-sm">Aucun bon de livraison</div>
      <div className="text-xs">Appuyez sur + Nouveau BL pour commencer</div>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {filtres.map(f => (
          <button key={f.val} onClick={() => setFiltre(f.val)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors
              ${filtre === f.val ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {affichés.map(bl => (
          <div key={bl.id}
            onClick={() => router.push(`/commandes/${bl.id}`)}
            className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 cursor-pointer active:bg-gray-50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-green-900">BL {bl.numero}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLOR[bl.statut]}`}>
                  {STATUT_LABEL[bl.statut]}
                </span>
              </div>
              <div className="text-sm text-gray-700 font-medium truncate mt-0.5">
                {(bl.client as unknown as { nom: string })?.nom || 'Client inconnu'}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {format(parseISO(bl.date_livraison), 'dd MMMM yyyy', { locale: fr })}
              </div>
            </div>
            <div className="text-gray-300 text-xl">›</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Catalogue produits ───────────────────────────────────────

function Catalogue({ produits, onRefresh }: { produits: Produit[]; onRefresh: () => void }) {
  const [modal, setModal] = useState<Produit | null | 'nouveau'>(null)
  const categories = Array.from(new Set(produits.map(p => p.categorie))) as ProduitCategorie[]

  return (
    <div className="space-y-3">
      <button onClick={() => setModal('nouveau')}
        className="w-full py-3 rounded-xl border-2 border-dashed border-green-300 text-green-700 text-sm font-semibold">
        + Ajouter un produit
      </button>

      {categories.map(cat => (
        <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 font-semibold text-sm border-b border-gray-100">
            {CAT_LABEL[cat]}
          </div>
          <div className="divide-y divide-gray-50">
            {produits.filter(p => p.categorie === cat).map(p => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 relative">
                  {p.photo_url ? (
                    <Image src={p.photo_url} alt={p.designation} fill className="object-cover" sizes="48px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl opacity-30">
                      {cat === 'FLEUR' ? '🌸' : cat === 'TAPIS' ? '🌱' : cat === 'GODET' ? '🪴' : '📦'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                    {p.designation}
                    {p.bio && <span className="text-xs bg-green-100 text-green-700 px-1.5 rounded-full">BIO*</span>}
                  </div>
                  <div className="text-xs text-gray-400">
                    {p.reference && `Ref. ${p.reference} · `}
                    {p.prix_ht > 0 ? `${p.prix_ht.toFixed(2)}€ HT/${p.unite}` : 'Prix a definir'}
                  </div>
                </div>
                <button onClick={() => setModal(p)}
                  className="text-xs text-blue-600 px-2 py-1 rounded border border-blue-200 shrink-0">
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {produits.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Aucun produit — ajoutez votre catalogue
        </div>
      )}

      {modal !== null && (
        <ProduitModal
          produit={modal === 'nouveau' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); onRefresh() }}
        />
      )}
    </div>
  )
}

function ProduitModal({ produit, onClose, onSave }: {
  produit: Produit | null; onClose: () => void; onSave: () => void
}) {
  const [form, setForm] = useState({
    reference:   produit?.reference  || '',
    designation: produit?.designation || '',
    categorie:   (produit?.categorie  || 'AUTRE') as ProduitCategorie,
    prix_ht:     produit?.prix_ht?.toString() || '0',
    tva_pct:     produit?.tva_pct?.toString() || '5.5',
    unite:       produit?.unite  || 'unite',
    bio:         produit?.bio ?? false,
    photo_url:   produit?.photo_url || '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function uploadPhoto(file: File) {
    setUploading(true)
    // Creer le bucket si necessaire
    await supabase.storage.createBucket('product-photos', { public: true }).catch(() => {})
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage.from('product-photos').upload(path, file, { upsert: true })
    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage.from('product-photos').getPublicUrl(data.path)
      setForm(p => ({ ...p, photo_url: publicUrl }))
    }
    setUploading(false)
  }

  async function sauvegarder() {
    setSaving(true)
    const data = {
      reference:   form.reference || null,
      designation: form.designation,
      categorie:   form.categorie,
      prix_ht:     parseFloat(form.prix_ht) || 0,
      tva_pct:     parseFloat(form.tva_pct) || 5.5,
      unite:       form.unite,
      bio:         form.bio,
      photo_url:   form.photo_url || null,
    }
    if (produit) {
      await supabase.from('produits').update(data).eq('id', produit.id)
    } else {
      await supabase.from('produits').insert({ ...data, actif: true })
    }
    setSaving(false)
    onSave()
  }

  async function supprimer() {
    if (!produit || !confirm('Supprimer ce produit ?')) return
    await supabase.from('produits').update({ actif: false }).eq('id', produit.id)
    onSave()
  }

  const cats: ProduitCategorie[] = ['TAPIS','BARQUETTE','GODET','BOTTE','FLEUR','LIVRAISON','CHAMP','AUTRE']

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{produit ? 'Modifier produit' : 'Nouveau produit'}</h2>

        {/* Photo upload */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Photo du produit</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="relative w-full aspect-[16/7] rounded-xl overflow-hidden bg-gray-50 border-2 border-dashed border-gray-200 cursor-pointer hover:border-green-400 transition-colors flex items-center justify-center">
            {form.photo_url ? (
              <Image src={form.photo_url} alt="photo" fill className="object-cover" sizes="600px" />
            ) : (
              <div className="text-center text-gray-400">
                <div className="text-3xl mb-1">📷</div>
                <div className="text-xs">{uploading ? 'Upload en cours...' : 'Appuyer pour ajouter une photo'}</div>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {form.photo_url && !uploading && (
              <div className="absolute bottom-2 right-2 bg-black/40 text-white text-xs px-2 py-1 rounded-full">
                Changer
              </div>
            )}
          </div>
          <input
            ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Designation *</label>
          <input value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))}
            placeholder="ex: Fleurs Bourrache, Barquette 10g Basilic..."
            className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Reference</label>
            <input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
              placeholder="ex: 3001"
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Categorie</label>
            <select value={form.categorie} onChange={e => setForm(p => ({ ...p, categorie: e.target.value as ProduitCategorie }))}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white">
              {cats.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Prix HT (€)</label>
            <input type="number" step="0.01" value={form.prix_ht}
              onChange={e => setForm(p => ({ ...p, prix_ht: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">TVA (%)</label>
            <select value={form.tva_pct} onChange={e => setForm(p => ({ ...p, tva_pct: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white">
              <option value="5.5">5.5%</option>
              <option value="10">10%</option>
              <option value="20">20%</option>
              <option value="0">0%</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Unite</label>
            <input value={form.unite} onChange={e => setForm(p => ({ ...p, unite: e.target.value }))}
              placeholder="unite, kg, botte..."
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" />
          </div>
          <div className="flex items-center gap-2 pt-4">
            <input type="checkbox" id="bio" checked={form.bio}
              onChange={e => setForm(p => ({ ...p, bio: e.target.checked }))}
              className="w-5 h-5 accent-green-700" />
            <label htmlFor="bio" className="text-sm font-medium">Certifie BIO*</label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          {produit && (
            <button onClick={supprimer}
              className="px-4 py-3 rounded-lg border border-red-200 text-red-500 text-sm">
              Supprimer
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600 text-sm">
            Annuler
          </button>
          <button onClick={sauvegarder} disabled={saving || !form.designation || uploading}
            className="flex-1 py-3 rounded-lg bg-green-700 text-white font-semibold text-sm disabled:opacity-50">
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Liste clients ────────────────────────────────────────────

function ClientsList({ clients, onRefresh }: { clients: Client[]; onRefresh: () => void }) {
  const [modal, setModal] = useState<Client | null | 'nouveau'>(null)

  return (
    <div className="space-y-3">
      <button onClick={() => setModal('nouveau')}
        className="w-full py-3 rounded-xl border-2 border-dashed border-green-300 text-green-700 text-sm font-semibold">
        + Ajouter un client
      </button>

      {clients.map(c => {
        const lien = c.order_token
          ? `${typeof window !== 'undefined' ? window.location.origin : 'https://petites-herbes.vercel.app'}/commander/${c.order_token}`
          : null
        return (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div onClick={() => setModal(c)} className="p-4 cursor-pointer active:bg-gray-50">
              <div className="font-semibold text-sm">{c.nom}</div>
              <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                {c.ville && <div>{c.code_postal} {c.ville}</div>}
                {c.email && <div>{c.email}</div>}
                {c.telephone && <div>{c.telephone}</div>}
              </div>
            </div>
            {lien && (
              <div className="px-4 pb-3 pt-0 border-t border-gray-50">
                <div className="text-xs text-gray-400 mb-1">Lien de commande personnel</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-50 rounded-lg px-2 py-1.5 text-xs text-gray-600 font-mono truncate">
                    {lien}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(lien)
                      alert('Lien copie !')
                    }}
                    className="shrink-0 bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold">
                    Copier
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {clients.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Aucun client — ajoutez vos restaurants et chefs
        </div>
      )}

      {modal !== null && (
        <ClientModal
          client={modal === 'nouveau' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); onRefresh() }}
        />
      )}
    </div>
  )
}

function ClientModal({ client, onClose, onSave }: {
  client: Client | null; onClose: () => void; onSave: () => void
}) {
  const [form, setForm] = useState({
    nom:         client?.nom         || '',
    adresse:     client?.adresse     || '',
    code_postal: client?.code_postal || '',
    ville:       client?.ville       || '',
    pays:        client?.pays        || 'FRANCE',
    email:       client?.email       || '',
    telephone:   client?.telephone   || '',
    siret:       client?.siret       || '',
    tva_intra:   client?.tva_intra   || '',
  })
  const [saving, setSaving] = useState(false)

  async function sauvegarder() {
    setSaving(true)
    const data = {
      nom:         form.nom,
      adresse:     form.adresse || null,
      code_postal: form.code_postal || null,
      ville:       form.ville || null,
      pays:        form.pays,
      email:       form.email || null,
      telephone:   form.telephone || null,
      siret:       form.siret || null,
      tva_intra:   form.tva_intra || null,
    }
    if (client) {
      await supabase.from('clients').update(data).eq('id', client.id)
    } else {
      await supabase.from('clients').insert({ ...data, actif: true })
    }
    setSaving(false)
    onSave()
  }

  const f = (key: keyof typeof form, label: string, placeholder?: string) => (
    <div key={key}>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{client ? 'Modifier client' : 'Nouveau client'}</h2>

        {f('nom',         'Nom *',            'ex: Restaurant Le Jardin, SAS CB...')}
        {f('adresse',     'Adresse',          'Rue, numero...')}
        <div className="grid grid-cols-2 gap-3">
          {f('code_postal', 'Code postal',    '83000')}
          {f('ville',       'Ville',          'Gassin')}
        </div>
        {f('email',       'Email',            'chef@restaurant.fr')}
        {f('telephone',   'Telephone',        '06...')}
        {f('siret',       'SIRET (optionnel)', '123 456 789 00012')}
        {f('tva_intra',   'TVA Intra (optionnel)', 'FR 66 452 014 780')}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600 text-sm">
            Annuler
          </button>
          <button onClick={sauvegarder} disabled={saving || !form.nom}
            className="flex-1 py-3 rounded-lg bg-green-700 text-white font-semibold text-sm disabled:opacity-50">
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}
