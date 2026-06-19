'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Client, Produit, ProduitCategorie } from '@/types'
import Image from 'next/image'

const CAT_EMOJI: Record<ProduitCategorie, string> = {
  TAPIS:'🌱', BARQUETTE:'🥗', GODET:'🪴', BOTTE:'🌿',
  FLEUR:'🌸', LIVRAISON:'🚚', CHAMP:'🌾', AUTRE:'📦',
}
const CAT_LABEL: Record<ProduitCategorie, string> = {
  TAPIS:'Micro-pousses', BARQUETTE:'Barquettes', GODET:'Godets',
  BOTTE:'Bottes', FLEUR:'Fleurs', LIVRAISON:'Livraison',
  CHAMP:'Du champ', AUTRE:'Divers',
}

// getDay() : mardi=2 jeudi=4 vendredi=5
const JOUR_IDX: Record<string, number> = { mardi: 2, jeudi: 4, vendredi: 5 }
const TOUS_JOURS = ['mardi', 'jeudi', 'vendredi']

// Prochaine occurrence du jour (si aujourd'hui = ce jour → semaine prochaine)
function prochaineDate(jour: string): Date {
  const d = new Date()
  const ecart = (JOUR_IDX[jour] - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + ecart)
  return d
}
function fmtJour(jour: string): string {
  return prochaineDate(jour).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

type Panier = Record<string, number>
type Ecran  = 'chargement' | 'commande' | 'confirmation' | 'erreur'
type LigneRecurrente = {
  produit_id: string; designation: string; reference: string | null
  quantite: number; prix_ht: number; tva_pct: number; ordre: number
}

export default function CommanderPage() {
  const { token } = useParams<{ token: string }>()
  const router    = useRouter()
  const [apercu, setApercu]     = useState(false)
  const [client, setClient]     = useState<Client | null>(null)
  const [produits, setProduits] = useState<Produit[]>([])
  const [panier, setPanier]     = useState<Panier>({})
  const [message, setMessage]   = useState('')
  const [ecran, setEcran]       = useState<Ecran>('chargement')
  const [sending, setSending]   = useState(false)
  const [blNumero, setBlNumero] = useState('')
  const [catActive, setCatActive] = useState<ProduitCategorie | null>(null)
  const [recurrentes, setRecurrentes] = useState<LigneRecurrente[]>([])
  const [sauvegarde, setSauvegarde]   = useState<'idle'|'saving'|'ok'>('idle')
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [jourChoisi, setJourChoisi]   = useState<string | null>(null)
  const catNavRef    = useRef<HTMLDivElement>(null)
  const sectionRefs  = useRef<Record<string, HTMLDivElement | null>>({})

  const charger = useCallback(async () => {
    const { data: c } = await supabase
      .from('clients').select('*').eq('order_token', token).eq('actif', true).single()
    if (!c) { setEcran('erreur'); return }
    setClient(c)

    // Jour de livraison par défaut : le plus proche parmi ceux du client
    const joursDispo: string[] = (c.jours_livraison?.length ? c.jours_livraison : TOUS_JOURS)
    const plusProche = [...joursDispo].sort((a, b) =>
      prochaineDate(a).getTime() - prochaineDate(b).getTime()
    )[0]
    setJourChoisi(plusProche)

    const [{ data: p }, { lignes }] = await Promise.all([
      supabase.from('produits').select('*')
        .eq('actif', true).eq('disponible', true).neq('categorie', 'LIVRAISON')
        .order('categorie,designation'),
      fetch(`/api/commande-recurrente/${token}`).then(r => r.json()),
    ])

    if (p) setProduits(p)
    const lignesRec: LigneRecurrente[] = lignes || []
    setRecurrentes(lignesRec)

    // Pré-remplir le panier avec la commande habituelle
    if (lignesRec.length > 0) {
      const panierInitial: Panier = {}
      for (const l of lignesRec) {
        panierInitial[l.produit_id] = l.quantite
      }
      setPanier(panierInitial)
    }

    setEcran('commande')
  }, [token])

  useEffect(() => { charger() }, [charger])

  // Mode aperçu (ouvert depuis la gestion via ?apercu=1)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setApercu(new URLSearchParams(window.location.search).get('apercu') === '1')
    }
  }, [])

  // Scroll spy
  useEffect(() => {
    if (ecran !== 'commande') return
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) setCatActive(e.target.getAttribute('data-cat') as ProduitCategorie)
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    )
    Object.values(sectionRefs.current).forEach(el => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [ecran, produits])

  useEffect(() => {
    if (!catActive || !catNavRef.current) return
    const btn = catNavRef.current.querySelector(`[data-cat="${catActive}"]`) as HTMLElement
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [catActive])

  function scrollTocat(cat: ProduitCategorie) {
    const el = sectionRefs.current[cat]
    if (!el) return
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 172, behavior: 'smooth' })
  }

  function setQte(produitId: string, delta: number) {
    const produit = produits.find(p => p.id === produitId)
    const max = produit?.quantite_dispo ?? Infinity
    setPanier(prev => {
      const n = Math.min(max, Math.max(0, (prev[produitId] || 0) + delta))
      if (n === 0) { const { [produitId]: _, ...rest } = prev; return rest }
      return { ...prev, [produitId]: n }
    })
  }

  const lignesPanier = produits.filter(p => (panier[p.id] || 0) > 0)
  const totalHT      = lignesPanier.reduce((s, p) => s + p.prix_ht * (panier[p.id] || 0), 0)
  const nbArticles   = Object.values(panier).reduce((s, q) => s + q, 0)

  // Détecte si le panier diffère de la commande récurrente
  const panierDiffereDeHabituel = (() => {
    if (recurrentes.length === 0 || lignesPanier.length === 0) return false
    for (const r of recurrentes) {
      if ((panier[r.produit_id] || 0) !== r.quantite) return true
    }
    return lignesPanier.some(p => !recurrentes.find(r => r.produit_id === p.id))
  })()

  async function sauvegarderHabituelle() {
    setSauvegarde('saving')
    await fetch(`/api/commande-recurrente/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lignes: lignesPanier.map((p, i) => ({
          produit_id: p.id, designation: p.designation + (p.bio ? ' BIO*' : ''),
          reference: p.reference, quantite: panier[p.id],
          prix_ht: p.prix_ht, tva_pct: p.tva_pct, ordre: i,
        })),
      }),
    })
    setSauvegarde('ok')
    setShowSavePrompt(false)
    setTimeout(() => setSauvegarde('idle'), 3000)
    // Recharger le modèle local
    const r = await fetch(`/api/commande-recurrente/${token}`).then(x => x.json())
    setRecurrentes(r.lignes || [])
  }

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
          reference: p.reference, quantite: panier[p.id],
          prix_ht: p.prix_ht, tva_pct: p.tva_pct,
        })),
        message,
        date_livraison: jourChoisi
          ? prochaineDate(jourChoisi).toISOString().slice(0, 10)
          : null,
      }),
    })
    const data = await res.json()
    setSending(false)
    if (res.ok) {
      setBlNumero(data.numero)
      // Proposer de sauvegarder si commande différente de l'habituelle
      if (panierDiffereDeHabituel || recurrentes.length === 0) setShowSavePrompt(true)
      else setEcran('confirmation')
    } else {
      alert('Erreur lors de la commande. Veuillez réessayer.')
    }
  }

  // ── Chargement ──────────────────────────────────────────────
  if (ecran === 'chargement') return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream">
      <div className="w-12 h-12 rounded-full border-4 border-green-800 border-t-transparent animate-spin mb-4" />
      <p className="text-green-900 font-medium font-serif">Un instant…</p>
    </div>
  )

  if (ecran === 'erreur') return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream p-8 text-center">
      <div className="text-5xl mb-4">🌿</div>
      <h1 className="font-serif text-2xl text-green-900 mb-2">Lien invalide</h1>
      <p className="text-gray-600">Ce lien n&apos;existe pas ou a expiré.<br/>Contactez-nous : petitesherbes@gmail.com</p>
    </div>
  )

  // ── Confirmation + prompt sauvegarde ────────────────────────
  if (ecran === 'confirmation' || showSavePrompt) return (
    <div className="min-h-screen bg-cream">
      <div className="bg-green-900 px-6 pt-14 pb-9 text-white text-center">
        <div className="text-5xl mb-3">🌿</div>
        <h1 className="font-serif text-3xl">Merci {client?.nom} !</h1>
        <p className="text-green-200 mt-2 text-sm">Commande confirmée · Bon N° {blNumero}</p>
        {jourChoisi && (
          <p className="inline-block mt-3 bg-green-800 rounded-full px-4 py-1.5 text-white font-semibold text-sm capitalize">🚚 Livraison {fmtJour(jourChoisi)}</p>
        )}
      </div>

      <div className="p-5 space-y-3 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100/60">
          <h2 className="font-serif text-green-900 mb-3 text-lg">Votre commande</h2>
          {lignesPanier.map(p => (
            <div key={p.id} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-sm">{p.designation}{p.bio && <span className="text-green-600 ml-1 text-xs font-semibold">BIO</span>}</span>
              <span className="text-sm font-bold text-green-800">× {panier[p.id]}</span>
            </div>
          ))}
        </div>

        {/* Prompt sauvegarde commande habituelle */}
        {showSavePrompt && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
            <div className="font-bold text-green-900 text-sm">
              💾 Enregistrer comme commande habituelle ?
            </div>
            <p className="text-xs text-green-700 leading-relaxed">
              La prochaine fois, votre boutique sera pré-remplie avec cette commande. Vous n&apos;aurez qu&apos;à valider ou ajuster.
            </p>
            <div className="flex gap-2">
              <button
                onClick={sauvegarderHabituelle}
                disabled={sauvegarde === 'saving'}
                className="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-bold disabled:opacity-50">
                {sauvegarde === 'saving' ? 'Sauvegarde…' : sauvegarde === 'ok' ? '✅ Sauvegardé !' : 'Oui, enregistrer'}
              </button>
              <button
                onClick={() => { setShowSavePrompt(false); setEcran('confirmation') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">
                Non merci
              </button>
            </div>
          </div>
        )}

        {!showSavePrompt && (
          <div className="bg-green-50 rounded-2xl p-4">
            <p className="text-sm text-green-800 leading-relaxed">
              Merci <strong>{client?.nom}</strong> ! Votre commande a bien été transmise.
            </p>
          </div>
        )}

        <button
          onClick={() => { setPanier({}); setMessage(''); setShowSavePrompt(false); setEcran('commande') }}
          className="w-full py-4 rounded-2xl border-2 border-green-800 text-green-800 font-semibold text-sm active:bg-green-50">
          ↩ Passer une nouvelle commande
        </button>
      </div>
    </div>
  )

  // ── Page commande ───────────────────────────────────────────
  const categories = Array.from(new Set(produits.map(p => p.categorie))) as ProduitCategorie[]
  const hasHabituelle = recurrentes.length > 0

  return (
    <div className="min-h-screen bg-cream" style={{ paddingBottom: nbArticles > 0 ? '100px' : '32px', paddingTop: apercu ? '48px' : undefined }}>

      {/* ── Bandeau aperçu chef (visible seulement depuis la gestion) ── */}
      {apercu && (
        <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2.5"
          style={{ paddingTop: 'calc(0.625rem + env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2">
            <span className="text-base">👁</span>
            <span className="text-xs font-bold text-amber-800">Aperçu boutique client</span>
          </div>
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform">
            ← Retour gestion
          </button>
        </div>
      )}

      {/* ── Hero d'accueil (défile) ── */}
      <div className="bg-green-900 px-5 pt-8 pb-7 text-center">
        <div className="text-3xl mb-1">🌿</div>
        <div className="text-green-300 text-[11px] font-semibold uppercase tracking-[0.2em]">Les Petites Herbes</div>
        <h1 className="font-serif text-white text-2xl mt-2 leading-tight">Bonjour {client?.nom}</h1>
        <p className="text-green-200 text-sm mt-1.5">Votre récolte fraîche, cueillie à la commande.</p>
      </div>

      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-20 shadow-sm">
        <div className="bg-green-900 px-4 py-2.5 flex items-center gap-3">
          <div className="w-7 h-7 bg-green-700 rounded-full flex items-center justify-center text-sm shrink-0">🌿</div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm leading-tight truncate font-serif">{client?.nom}</div>
          </div>
          {nbArticles > 0 && (
            <div className="bg-white text-green-900 text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
              {nbArticles} article{nbArticles > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {categories.length > 1 && (
          <div ref={catNavRef}
            className="bg-cream/95 backdrop-blur border-b border-green-100 flex gap-1.5 overflow-x-auto px-3 py-2 no-scrollbar">
            {categories.map(cat => (
              <button key={cat} data-cat={cat} onClick={() => scrollTocat(cat)}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
                  ${catActive === cat ? 'bg-green-700 text-white' : 'bg-white text-green-800 border border-green-100 active:bg-green-50'}`}>
                <span>{CAT_EMOJI[cat]}</span><span>{CAT_LABEL[cat]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-6">

        {/* ── Bandeau commande habituelle ── */}
        {hasHabituelle && (
          <div className="bg-white rounded-2xl border border-green-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-lg shrink-0">🔁</div>
              <div>
                <div className="font-serif text-green-900 text-lg leading-tight">Votre commande habituelle</div>
                <div className="text-xs text-gray-500">{recurrentes.length} produit{recurrentes.length > 1 ? 's' : ''} enregistré{recurrentes.length > 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {recurrentes.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{l.designation}</span>
                  <span className="font-bold text-green-800 bg-green-50 px-2 py-0.5 rounded-full text-xs">× {l.quantite}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const p: Panier = {}
                recurrentes.forEach(l => { p[l.produit_id] = l.quantite })
                setPanier(p)
                // scroll vers le bas pour confirmer
                setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100)
              }}
              className="w-full py-3 rounded-xl bg-green-700 text-white font-bold text-sm active:bg-green-800">
              ✓ Reprendre cette commande
            </button>
            <button
              onClick={() => setPanier({})}
              className="w-full py-2 rounded-xl text-xs text-gray-400">
              Repartir de zéro
            </button>
          </div>
        )}

        {/* ── Produits par catégorie ── */}
        {categories.map(cat => {
          const prods = produits.filter(p => p.categorie === cat)
          if (prods.length === 0) return null
          return (
            <div key={cat} data-cat={cat} ref={el => { sectionRefs.current[cat] = el }}>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-lg">{CAT_EMOJI[cat]}</span>
                <h2 className="font-serif text-green-900 text-xl">{CAT_LABEL[cat]}</h2>
                <span className="text-xs text-green-600/70 ml-auto">{prods.length} produit{prods.length > 1 ? 's' : ''}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {prods.map(p => {
                  const qte    = panier[p.id] || 0
                  const epuise = p.quantite_dispo != null && p.quantite_dispo <= 0
                  return (
                    <div key={p.id}
                      className={`bg-white rounded-3xl overflow-hidden border transition-all
                        ${qte > 0 ? 'border-green-600 shadow-lg shadow-green-900/5' : epuise ? 'border-gray-100 opacity-60' : 'border-green-100/60 shadow-sm'}`}>

                      <div className="relative w-full aspect-square bg-gradient-to-br from-green-50 to-green-100 overflow-hidden">
                        {p.photo_url ? (
                          <Image src={p.photo_url} alt={p.designation} fill
                            className="object-cover" sizes="(max-width:640px) 45vw, 200px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-6xl opacity-25">{CAT_EMOJI[cat]}</span>
                          </div>
                        )}
                        {p.bio && (
                          <div className="absolute top-2 left-2 bg-white/95 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm tracking-wide">BIO</div>
                        )}
                        {qte > 0 && (
                          <div className="absolute top-2 right-2 bg-green-700 text-white text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-lg">{qte}</div>
                        )}
                        {epuise && (
                          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-500 bg-white/90 px-2 py-0.5 rounded-full">Épuisé</span>
                          </div>
                        )}
                      </div>

                      <div className="p-3">
                        <div className="font-serif text-[15px] text-green-900 leading-snug mb-1">{p.designation}</div>
                        {p.description && (
                          <div className="text-[11px] text-gray-400 leading-snug mb-1.5 line-clamp-2">
                            {p.description.split('💧')[0].trim()}
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-2">
                          {p.prix_ht > 0
                            ? <span className="text-sm text-green-700 font-bold">{p.prix_ht.toFixed(2)} €<span className="text-[11px] font-normal text-green-600/70">/{p.unite}</span></span>
                            : <span />}
                          {p.quantite_dispo != null && p.quantite_dispo > 0 && p.quantite_dispo <= 5 && (
                            <span className="text-[10px] font-bold text-clay">⚡{p.quantite_dispo}</span>
                          )}
                        </div>

                        {epuise ? (
                          <div className="w-full py-2.5 rounded-2xl bg-gray-100 text-gray-400 text-xs font-semibold text-center">Indisponible</div>
                        ) : qte === 0 ? (
                          <button onClick={() => setQte(p.id, 1)}
                            className="w-full py-2.5 rounded-2xl bg-green-700 text-white text-sm font-bold active:bg-green-800 transition-colors">
                            + Ajouter
                          </button>
                        ) : (
                          <div className="flex items-center justify-between bg-green-50 rounded-2xl p-1 gap-1">
                            <button onClick={() => setQte(p.id, -1)}
                              className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-green-800 font-bold text-xl shadow-sm active:scale-95 transition-transform">−</button>
                            <span className="font-bold text-green-900 text-lg min-w-[1.5rem] text-center">{qte}</span>
                            <button onClick={() => setQte(p.id, 1)}
                              className="w-10 h-10 flex items-center justify-center bg-green-700 rounded-xl text-white font-bold text-xl shadow-sm active:bg-green-800 active:scale-95">+</button>
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

        {/* Jour de livraison */}
        {(() => {
          const joursDispo = (client?.jours_livraison?.length ? client.jours_livraison : TOUS_JOURS) as string[]
          return (
            <div>
              <label className="block font-serif text-green-900 text-lg mb-2.5">📅 Jour de livraison</label>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${joursDispo.length}, 1fr)` }}>
                {joursDispo.map(j => (
                  <button key={j} onClick={() => setJourChoisi(j)}
                    className={`py-3 px-2 rounded-2xl border-2 text-center transition-colors
                      ${jourChoisi === j
                        ? 'border-green-600 bg-green-50'
                        : 'border-green-100 bg-white active:bg-green-50'}`}>
                    <div className={`text-sm font-bold capitalize ${jourChoisi === j ? 'text-green-800' : 'text-gray-600'}`}>
                      {j}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${jourChoisi === j ? 'text-green-600' : 'text-gray-400'}`}>
                      {prochaineDate(j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Message libre */}
        <div>
          <label className="block font-serif text-green-900 text-lg mb-2.5">Un mot pour nous ?</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Instructions particulières, heure préférée..."
            rows={3}
            className="w-full border-2 border-green-100 rounded-2xl p-3 text-sm focus:border-green-600 focus:outline-none resize-none bg-white" />
        </div>

        {produits.length === 0 && (
          <div className="text-center py-14 text-gray-400">
            <div className="text-5xl mb-3">🌱</div>
            <p className="font-serif text-lg text-green-900">Le panier se repose…</p>
            <p className="text-xs mt-1 text-gray-400">Aucun produit disponible pour le moment. Revenez bientôt !</p>
          </div>
        )}

        {/* Indicateur sauvegarde */}
        {sauvegarde === 'ok' && (
          <div className="text-center text-sm text-green-700 font-semibold">✅ Commande habituelle mise à jour</div>
        )}
      </div>

      {/* ── Bandeau panier sticky ── */}
      {nbArticles > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-2 bg-gradient-to-t from-cream via-cream/90 to-transparent">
          <div className="max-w-lg mx-auto space-y-2">
            {/* Bouton sauvegarder (subtil, optionnel) */}
            {panierDiffereDeHabituel && sauvegarde !== 'ok' && (
              <button onClick={sauvegarderHabituelle}
                disabled={sauvegarde === 'saving'}
                className="w-full py-2 rounded-xl bg-white border border-green-300 text-green-700 text-xs font-semibold shadow-sm">
                {sauvegarde === 'saving' ? 'Sauvegarde…' : '💾 Mettre à jour ma commande habituelle'}
              </button>
            )}
            <button onClick={commander} disabled={sending}
              className="w-full bg-green-800 text-white py-4 rounded-2xl font-bold text-base shadow-2xl disabled:opacity-60 flex items-center justify-between px-5 active:bg-green-900">
              <span className="bg-green-600 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0">{nbArticles}</span>
              <span className="flex-1 text-center">{sending ? 'Envoi en cours...' : 'Commander maintenant'}</span>
              {totalHT > 0
                ? <span className="text-green-200 font-semibold text-sm shrink-0">{totalHT.toFixed(2)} €</span>
                : <span className="w-8" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
