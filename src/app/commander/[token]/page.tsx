'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Client, Produit, ProduitCategorie } from '@/types'
import Image from 'next/image'

const CAT_EMOJI: Record<ProduitCategorie, string> = {
  TAPIS:     '🌱',
  BARQUETTE: '🥗',
  GODET:     '🪴',
  BOTTE:     '🌿',
  FLEUR:     '🌸',
  LIVRAISON: '🚚',
  CHAMP:     '🌾',
  AUTRE:     '📦',
}

type Panier = Record<string, number> // produit_id → quantite

type Ecran = 'chargement' | 'commande' | 'confirmation' | 'erreur'

export default function CommanderPage() {
  const { token } = useParams<{ token: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [produits, setProduits] = useState<Produit[]>([])
  const [panier, setPanier] = useState<Panier>({})
  const [message, setMessage] = useState('')
  const [ecran, setEcran] = useState<Ecran>('chargement')
  const [sending, setSending] = useState(false)
  const [blNumero, setBlNumero] = useState('')

  const charger = useCallback(async () => {
    const { data: c } = await supabase
      .from('clients')
      .select('*')
      .eq('order_token', token)
      .eq('actif', true)
      .single()

    if (!c) { setEcran('erreur'); return }
    setClient(c)

    const { data: p } = await supabase
      .from('produits')
      .select('*')
      .eq('actif', true)
      .neq('categorie', 'LIVRAISON')
      .order('categorie,designation')

    if (p) setProduits(p)
    setEcran('commande')
  }, [token])

  useEffect(() => { charger() }, [charger])

  function setQte(produitId: string, delta: number) {
    setPanier(prev => {
      const actuel = prev[produitId] || 0
      const nouveau = Math.max(0, actuel + delta)
      if (nouveau === 0) {
        const { [produitId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [produitId]: nouveau }
    })
  }

  const lignesPanier = produits.filter(p => (panier[p.id] || 0) > 0)
  const totalHT = lignesPanier.reduce((s, p) => s + p.prix_ht * (panier[p.id] || 0), 0)
  const nbArticles = Object.values(panier).reduce((s, q) => s + q, 0)

  async function commander() {
    if (!client || lignesPanier.length === 0) return
    setSending(true)

    const res = await fetch(`/api/commander/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lignes: lignesPanier.map(p => ({
          produit_id: p.id,
          designation: p.designation + (p.bio ? ' BIO*' : ''),
          reference: p.reference,
          quantite: panier[p.id],
          prix_ht: p.prix_ht,
          tva_pct: p.tva_pct,
        })),
        message,
      }),
    })

    const data = await res.json()
    setSending(false)

    if (res.ok) {
      setBlNumero(data.numero)
      setEcran('confirmation')
    } else {
      alert('Erreur lors de la commande. Veuillez reessayer.')
    }
  }

  // ── Chargement ──
  if (ecran === 'chargement') return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F5F0]">
      <div className="w-12 h-12 rounded-full border-4 border-green-800 border-t-transparent animate-spin mb-4" />
      <p className="text-green-900 font-medium">Chargement...</p>
    </div>
  )

  // ── Erreur / lien invalide ──
  if (ecran === 'erreur') return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F5F0] p-8 text-center">
      <div className="text-5xl mb-4">🌿</div>
      <h1 className="text-2xl font-bold text-green-900 mb-2">Lien invalide</h1>
      <p className="text-gray-600">Ce lien de commande n&apos;existe pas ou a expiré.<br/>Contactez-nous : petitesherbes@gmail.com</p>
    </div>
  )

  // ── Confirmation ──
  if (ecran === 'confirmation') return (
    <div className="min-h-screen bg-[#F7F5F0]">
      {/* Header */}
      <div className="bg-green-900 px-6 pt-12 pb-8 text-white text-center">
        <div className="text-4xl mb-2">✅</div>
        <h1 className="text-2xl font-bold">Commande confirmee !</h1>
        <p className="text-green-200 mt-1 text-sm">Bon de livraison N° {blNumero}</p>
      </div>

      <div className="p-6 space-y-4 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-green-900 mb-3">Votre commande</h2>
          {lignesPanier.map(p => (
            <div key={p.id} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm">{p.designation}{p.bio && <span className="text-green-600 ml-1 text-xs">BIO</span>}</span>
              <span className="text-sm font-semibold text-green-800">× {panier[p.id]}</span>
            </div>
          ))}
        </div>

        <div className="bg-green-50 rounded-2xl p-5">
          <p className="text-sm text-green-800">
            Merci {client?.nom} ! Votre commande a bien ete transmise a GAEC Les Petites Herbes.
            Vous recevrez un email de confirmation.
          </p>
        </div>

        <button
          onClick={() => { setPanier({}); setMessage(''); setEcran('commande') }}
          className="w-full py-4 rounded-2xl border-2 border-green-800 text-green-800 font-semibold">
          Passer une nouvelle commande
        </button>
      </div>
    </div>
  )

  // ── Page commande ──
  const categories = Array.from(new Set(produits.map(p => p.categorie))) as ProduitCategorie[]

  return (
    <div className="min-h-screen bg-[#F7F5F0]" style={{ paddingBottom: nbArticles > 0 ? '120px' : '32px' }}>

      {/* ── Header ── */}
      <div className="bg-green-900 px-6 pt-10 pb-8 text-white">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-green-700 rounded-full flex items-center justify-center text-lg">🌿</div>
            <span className="text-green-200 text-sm font-medium tracking-wide uppercase">Les Petites Herbes</span>
          </div>
          <h1 className="text-2xl font-bold leading-tight">
            Bonjour,<br/>{client?.nom} 👋
          </h1>
          <p className="text-green-300 text-sm mt-2">
            Choisissez vos produits ci-dessous
          </p>
        </div>
      </div>

      {/* ── Produits ── */}
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {categories.map(cat => {
          const prods = produits.filter(p => p.categorie === cat)
          if (prods.length === 0) return null
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{CAT_EMOJI[cat]}</span>
                <h2 className="font-bold text-green-900 text-base">{cat === 'TAPIS' ? 'Micro-pousses tapis' : cat === 'BARQUETTE' ? 'Barquettes' : cat === 'GODET' ? 'Godets' : cat === 'BOTTE' ? 'Bottes & bouquets' : cat === 'FLEUR' ? 'Fleurs comestibles' : cat === 'CHAMP' ? 'Produits du champ' : 'Divers'}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {prods.map(p => {
                  const qte = panier[p.id] || 0
                  return (
                    <div key={p.id}
                      className={`bg-white rounded-2xl overflow-hidden shadow-sm border-2 transition-all ${qte > 0 ? 'border-green-600 shadow-md' : 'border-transparent'}`}>

                      {/* Photo */}
                      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-green-50 to-green-100 overflow-hidden">
                        {p.photo_url ? (
                          <Image
                            src={p.photo_url}
                            alt={p.designation}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 45vw, 200px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-5xl opacity-40">{CAT_EMOJI[cat]}</span>
                          </div>
                        )}
                        {p.bio && (
                          <div className="absolute top-2 left-2 bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            BIO
                          </div>
                        )}
                        {qte > 0 && (
                          <div className="absolute top-2 right-2 bg-green-700 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow">
                            {qte}
                          </div>
                        )}
                      </div>

                      {/* Infos */}
                      <div className="p-3">
                        <div className="text-sm font-semibold text-gray-900 leading-tight mb-0.5">
                          {p.designation}
                        </div>
                        {p.prix_ht > 0 && (
                          <div className="text-xs text-green-700 font-medium mb-2">
                            {p.prix_ht.toFixed(2)} € HT/{p.unite}
                          </div>
                        )}

                        {/* Controles quantite */}
                        {qte === 0 ? (
                          <button onClick={() => setQte(p.id, 1)}
                            className="w-full py-2 rounded-xl bg-green-700 text-white text-sm font-semibold active:bg-green-800 transition-colors">
                            Ajouter
                          </button>
                        ) : (
                          <div className="flex items-center justify-between bg-green-50 rounded-xl p-1">
                            <button onClick={() => setQte(p.id, -1)}
                              className="w-9 h-9 flex items-center justify-center bg-white rounded-lg text-green-800 font-bold text-lg shadow-sm active:bg-gray-50">
                              −
                            </button>
                            <span className="font-bold text-green-900 text-base w-6 text-center">{qte}</span>
                            <button onClick={() => setQte(p.id, 1)}
                              className="w-9 h-9 flex items-center justify-center bg-green-700 rounded-lg text-white font-bold text-lg shadow-sm active:bg-green-800">
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Message libre */}
        <div>
          <label className="block text-sm font-semibold text-green-900 mb-2">
            Message (optionnel)
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Instructions particulieres, heure de livraison prefere..."
            rows={3}
            className="w-full border-2 border-gray-200 rounded-2xl p-3 text-sm focus:border-green-600 focus:outline-none resize-none bg-white"
          />
        </div>

        {produits.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">🌱</div>
            <p className="text-sm">Aucun produit disponible pour le moment.</p>
          </div>
        )}
      </div>

      {/* ── Bandeau panier sticky ── */}
      {nbArticles > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-2 bg-gradient-to-t from-[#F7F5F0] to-transparent">
          <div className="max-w-lg mx-auto">
            <button
              onClick={commander}
              disabled={sending}
              className="w-full bg-green-800 text-white py-4 rounded-2xl font-bold text-base shadow-xl disabled:opacity-50 flex items-center justify-between px-6 active:bg-green-900 transition-colors">
              <span className="bg-green-700 text-white text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center">
                {nbArticles}
              </span>
              <span>{sending ? 'Envoi en cours...' : 'Commander maintenant'}</span>
              {totalHT > 0 ? (
                <span className="text-green-200 font-semibold">{totalHT.toFixed(2)} €</span>
              ) : (
                <span className="w-7" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
