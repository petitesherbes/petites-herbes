'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Client, Produit, BLLigne, ProduitCategorie } from '@/types'
import { format } from 'date-fns'

type LigneForm = Omit<BLLigne, 'id' | 'bl_id'> & { _id: number }

let _nextId = 0
function newId() { return _nextId++ }

const CAT_LABEL: Record<ProduitCategorie, string> = {
  TAPIS:     'Tapis',
  BARQUETTE: 'Barquettes',
  GODET:     'Godets',
  BOTTE:     'Bottes',
  FLEUR:     'Fleurs',
  LIVRAISON: 'Livraison',
  CHAMP:     'Champ',
  AUTRE:     'Autres',
}

export default function NouveauBLPage() {
  const router = useRouter()
  const [etape, setEtape] = useState<1 | 2 | 3>(1)
  const [clients, setClients] = useState<Client[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [clientId, setClientId] = useState('')
  const [dateLivraison, setDateLivraison] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [lignes, setLignes] = useState<LigneForm[]>([])
  const [saving, setSaving] = useState(false)
  const [recherche, setRecherche] = useState('')

  useEffect(() => { charger() }, [])

  async function charger() {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('clients').select('*').eq('actif', true).order('nom'),
      supabase.from('produits').select('*').eq('actif', true).order('categorie,designation'),
    ])
    if (c) { setClients(c); if (c.length > 0) setClientId(c[0].id) }
    if (p) setProduits(p)
  }

  function ajouterProduit(produit: Produit) {
    // Si deja dans la liste, incrementer quantite
    const existing = lignes.find(l => l.produit_id === produit.id)
    if (existing) {
      setLignes(prev => prev.map(l =>
        l._id === existing._id ? { ...l, quantite: l.quantite + 1 } : l
      ))
      return
    }
    setLignes(prev => [...prev, {
      _id: newId(),
      produit_id: produit.id,
      designation: produit.designation + (produit.bio ? ' BIO*' : ''),
      reference: produit.reference,
      quantite: 1,
      prix_ht: produit.prix_ht,
      tva_pct: produit.tva_pct,
      ordre: prev.length,
      produit,
    }])
  }

  function modifierQuantite(id: number, delta: number) {
    setLignes(prev => prev.map(l => {
      if (l._id !== id) return l
      const q = Math.max(0, l.quantite + delta)
      return { ...l, quantite: q }
    }).filter(l => l.quantite > 0))
  }

  function supprimerLigne(id: number) {
    setLignes(prev => prev.filter(l => l._id !== id))
  }

  const client = clients.find(c => c.id === clientId)
  const totalHT = lignes.reduce((s, l) => s + l.prix_ht * l.quantite, 0)
  const totalTTC = lignes.reduce((s, l) => s + l.prix_ht * l.quantite * (1 + l.tva_pct / 100), 0)

  async function valider(sendEmail: boolean) {
    if (!clientId || lignes.length === 0) return
    setSaving(true)

    // Generer numero BL
    const { data: params } = await supabase.from('parametres_production').select('id, prochain_numero_bl').single()
    const numero = String(params?.prochain_numero_bl || 1777).padStart(7, '0')

    // Creer BL
    const { data: bl, error } = await supabase.from('bons_livraison').insert({
      numero,
      client_id: clientId,
      date_livraison: dateLivraison,
      statut: 'brouillon',
    }).select().single()

    if (error || !bl) { setSaving(false); alert('Erreur creation BL'); return }

    // Lignes
    await supabase.from('bl_lignes').insert(
      lignes.map((l, i) => ({
        bl_id: bl.id,
        produit_id: l.produit_id,
        designation: l.designation,
        reference: l.reference,
        quantite: l.quantite,
        prix_ht: l.prix_ht,
        tva_pct: l.tva_pct,
        ordre: i,
      }))
    )

    // Incrementer prochain numero
    if (params) {
      await supabase.from('parametres_production')
        .update({ prochain_numero_bl: (params.prochain_numero_bl || 1777) + 1 })
        .eq('id', params.id)
    }

    // Envoyer email si demande
    if (sendEmail && client?.email) {
      await fetch(`/api/commandes/${bl.id}/email`, { method: 'POST' }).catch(() => {})
      await supabase.from('bons_livraison').update({ statut: 'envoye' }).eq('id', bl.id)
    }

    setSaving(false)
    router.push(`/commandes/${bl.id}`)
  }

  const produitsFiltres = produits.filter(p =>
    recherche === '' ||
    p.designation.toLowerCase().includes(recherche.toLowerCase()) ||
    (p.reference || '').toLowerCase().includes(recherche.toLowerCase())
  )
  const categories = Array.from(new Set(produitsFiltres.map(p => p.categorie))) as ProduitCategorie[]

  // ── Etape 1 : Client + Date ──
  if (etape === 1) return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">
          ←
        </button>
        <h1 className="text-xl font-bold text-green-900">Nouveau BL</h1>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Client *</label>
        {clients.length === 0 ? (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700">
            Aucun client — ajoutez-en depuis Commandes &gt; Clients
          </div>
        ) : (
          <div className="space-y-2">
            {clients.map(c => (
              <button key={c.id} onClick={() => setClientId(c.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all
                  ${clientId === c.id
                    ? 'border-green-600 bg-green-50'
                    : 'border-gray-200 bg-white'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-gray-900">{c.nom}</div>
                    {c.ville && <div className="text-sm text-gray-500">{c.code_postal} {c.ville}</div>}
                    {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                  </div>
                  {clientId === c.id && <span className="text-green-600 text-xl">✓</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Date de livraison</label>
        <input type="date" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)}
          className="w-full border-2 border-gray-200 rounded-xl p-3 text-base focus:border-green-500 focus:outline-none" />
      </div>

      <button onClick={() => setEtape(2)} disabled={!clientId || clients.length === 0}
        className="w-full bg-green-700 text-white py-4 rounded-xl font-bold text-base disabled:opacity-40">
        Choisir les produits →
      </button>
    </div>
  )

  // ── Etape 2 : Produits ──
  if (etape === 2) return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setEtape(1)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">←</button>
        <div>
          <h1 className="text-lg font-bold text-green-900">{client?.nom}</h1>
          <div className="text-xs text-gray-500">
            {format(new Date(dateLivraison + 'T12:00:00'), 'dd/MM/yyyy')}
          </div>
        </div>
      </div>

      {/* Bandeau recap sticky */}
      {lignes.length > 0 && (
        <div className="sticky top-0 z-10 bg-green-900 text-white rounded-xl p-3 shadow-lg">
          <div className="text-xs text-green-200 mb-1">{lignes.length} produit(s) selectionne(s)</div>
          <div className="flex flex-wrap gap-2">
            {lignes.map(l => (
              <div key={l._id} className="flex items-center gap-1.5 bg-green-800 rounded-lg px-2 py-1 text-xs">
                <span className="text-green-200">{l.quantite}×</span>
                <span className="truncate max-w-[100px]">{l.designation.replace(' BIO*','')}</span>
                <button onClick={() => supprimerLigne(l._id)} className="text-green-400 hover:text-white ml-1">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recherche */}
      <input
        type="text" value={recherche} onChange={e => setRecherche(e.target.value)}
        placeholder="Rechercher un produit..."
        className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-500 focus:outline-none" />

      {/* Catalogue */}
      <div className="space-y-3">
        {categories.map(cat => (
          <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 font-semibold text-xs border-b border-gray-100 uppercase tracking-wide text-gray-500">
              {CAT_LABEL[cat]}
            </div>
            <div className="divide-y divide-gray-50">
              {produitsFiltres.filter(p => p.categorie === cat).map(p => {
                const ligne = lignes.find(l => l.produit_id === p.id)
                return (
                  <div key={p.id} className="px-3 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {p.designation}{p.bio && <span className="text-xs text-green-600 ml-1">BIO*</span>}
                      </div>
                      <div className="text-xs text-gray-400">
                        {p.reference && `Ref. ${p.reference} · `}
                        {p.prix_ht > 0 ? `${p.prix_ht.toFixed(2)}€ HT` : 'Prix libre'}
                      </div>
                    </div>
                    {ligne ? (
                      <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden">
                        <button onClick={() => modifierQuantite(ligne._id, -1)}
                          className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 text-lg leading-none">−</button>
                        <span className="w-8 text-center text-sm font-bold text-green-800">{ligne.quantite}</span>
                        <button onClick={() => modifierQuantite(ligne._id, 1)}
                          className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 text-lg leading-none">+</button>
                      </div>
                    ) : (
                      <button onClick={() => ajouterProduit(p)}
                        className="w-9 h-9 flex items-center justify-center bg-green-700 text-white rounded-xl text-xl font-bold shadow-sm">
                        +
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setEtape(3)} disabled={lignes.length === 0}
        className="w-full bg-green-700 text-white py-4 rounded-xl font-bold text-base disabled:opacity-40 shadow-sm sticky bottom-20">
        Valider ({lignes.reduce((s, l) => s + l.quantite, 0)} produits) →
      </button>
    </div>
  )

  // ── Etape 3 : Recap + Envoi ──
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setEtape(2)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">←</button>
        <h1 className="text-xl font-bold text-green-900">Recapitulatif</h1>
      </div>

      {/* Preview BL */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-green-50">
          <div className="font-bold text-green-900">{client?.nom}</div>
          {client?.ville && <div className="text-sm text-gray-600">{client.code_postal} {client.ville}</div>}
          <div className="text-sm text-gray-500 mt-1">
            Livraison : {format(new Date(dateLivraison + 'T12:00:00'), 'dd/MM/yyyy')}
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          <div className="px-4 py-2 grid grid-cols-12 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <div className="col-span-6">Designation</div>
            <div className="col-span-2 text-center">Ref.</div>
            <div className="col-span-2 text-right">PU HT</div>
            <div className="col-span-2 text-right">Qte</div>
          </div>
          {lignes.map(l => (
            <div key={l._id} className="px-4 py-2.5 grid grid-cols-12 items-center text-sm">
              <div className="col-span-6 font-medium truncate pr-2">{l.designation}</div>
              <div className="col-span-2 text-center text-gray-400 text-xs">{l.reference || '—'}</div>
              <div className="col-span-2 text-right text-gray-600">{l.prix_ht > 0 ? `${l.prix_ht.toFixed(2)}€` : '—'}</div>
              <div className="col-span-2 text-right font-bold text-green-800">{l.quantite}</div>
            </div>
          ))}
        </div>

        {totalHT > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total HT</span>
              <span className="font-medium">{totalHT.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span>Total TTC</span>
              <span className="text-green-800">{totalTTC.toFixed(2)} €</span>
            </div>
          </div>
        )}
      </div>

      {client?.email ? (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700">
          Email : <strong>{client.email}</strong>
        </div>
      ) : (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700">
          Pas d&apos;email pour ce client — le BL sera sauvegarde sans envoi.
        </div>
      )}

      <div className="space-y-3">
        {client?.email && (
          <button onClick={() => valider(true)} disabled={saving}
            className="w-full bg-green-700 text-white py-4 rounded-xl font-bold text-base disabled:opacity-50 shadow-sm">
            {saving ? 'Envoi...' : 'Enregistrer et envoyer par email'}
          </button>
        )}
        <button onClick={() => valider(false)} disabled={saving}
          className="w-full border-2 border-green-700 text-green-700 py-4 rounded-xl font-bold text-base disabled:opacity-50">
          {saving ? 'Sauvegarde...' : 'Enregistrer (sans envoyer)'}
        </button>
      </div>
    </div>
  )
}
