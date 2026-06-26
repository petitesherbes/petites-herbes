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
  const [ficheId, setFicheId]         = useState<string | null>(null)
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

  async function commanderHabituelle() {
    if (!client || recurrentes.length === 0 || sending) return
    setSending(true)
    const res = await fetch(`/api/commander/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lignes: recurrentes.map(l => ({
          produit_id: l.produit_id, designation: l.designation,
          reference: l.reference, quantite: l.quantite,
          prix_ht: l.prix_ht, tva_pct: l.tva_pct,
        })),
        message: '',
        date_livraison: jourChoisi
          ? prochaineDate(jourChoisi).toISOString().slice(0, 10)
          : null,
      }),
    })
    const data = await res.json()
    setSending(false)
    if (res.ok) {
      setBlNumero(data.numero)
      const p: Panier = {}
      recurrentes.forEach(l => { p[l.produit_id] = l.quantite })
      setPanier(p)
      setEcran('confirmation')
    } else {
      alert('Erreur lors de la commande. Veuillez réessayer.')
    }
  }

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
          <button onClick={() => { window.location.href = '/commandes' }}
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
            {categories.map(cat => {
              const catQte = produits.filter(p => p.categorie === cat).reduce((s, p) => s + (panier[p.id] || 0), 0)
              const actif  = catActive === cat
              return (
                <button key={cat} data-cat={cat} onClick={() => scrollTocat(cat)}
                  className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
                    ${actif ? 'bg-green-700 text-white' : 'bg-white text-green-800 border border-green-100 active:bg-green-50'}`}>
                  <span>{CAT_EMOJI[cat]}</span>
                  <span>{CAT_LABEL[cat]}</span>
                  {catQte > 0 && (
                    <span className={`ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center
                      ${actif ? 'bg-white/30 text-white' : 'bg-green-700 text-white'}`}>
                      {catQte}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Bouton 1 clic commande habituelle ── */}
      {hasHabituelle && (
        <div className="max-w-lg mx-auto px-4 pt-4">
          <button onClick={commanderHabituelle} disabled={sending}
            className="w-full bg-green-800 text-white rounded-2xl shadow-lg active:bg-green-900 disabled:opacity-60 transition-colors overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-2xl shrink-0">🔁</span>
              <div className="flex-1 text-left">
                <div className="font-bold text-sm leading-tight">
                  {sending ? 'Envoi en cours…' : 'Commander ma commande habituelle'}
                </div>
                <div className="text-green-300 text-xs mt-0.5">
                  {recurrentes.length} produit{recurrentes.length > 1 ? 's' : ''}
                  {jourChoisi && ` · livraison ${jourChoisi}`}
                </div>
              </div>
              <span className="text-green-400 text-xl shrink-0">›</span>
            </div>
            <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
              {recurrentes.map((l, i) => (
                <span key={i} className="shrink-0 bg-green-700/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                  {l.designation} ×{l.quantite}
                </span>
              ))}
            </div>
          </button>
          <button onClick={() => setPanier({})}
            className="w-full py-2 text-xs text-green-600/60 text-center mt-1">
            Ou personnaliser ma commande ↓
          </button>
        </div>
      )}

      {/* ── Produits par catégorie — liste compacte ── */}
      <div className="max-w-lg mx-auto pt-2">
        {categories.map(cat => {
          const prods = produits.filter(p => p.categorie === cat)
          if (prods.length === 0) return null
          return (
            <div key={cat} data-cat={cat} ref={el => { sectionRefs.current[cat] = el }}>
              {/* Titre section sticky */}
              <div className="sticky z-10 flex items-center gap-2 px-4 py-2.5 bg-cream/95 backdrop-blur border-b border-green-100"
                style={{ top: categories.length > 1 ? '88px' : '56px' }}>
                <span className="text-base">{CAT_EMOJI[cat]}</span>
                <h2 className="font-serif text-green-900 text-lg flex-1">{CAT_LABEL[cat]}</h2>
                <span className="text-xs text-green-600/50">{prods.length}</span>
              </div>

              {/* Lignes produits */}
              <div className="divide-y divide-green-50/80">
                {prods.map(p => {
                  const qte    = panier[p.id] || 0
                  const epuise = p.quantite_dispo != null && p.quantite_dispo <= 0
                  return (
                    <div key={p.id} className={`flex items-center gap-3 px-4 py-3 transition-colors
                      ${qte > 0 ? 'bg-green-50/60' : ''} ${epuise ? 'opacity-50' : ''}`}>

                      {/* Thumbnail — tap = fiche */}
                      <button onClick={() => p.description && setFicheId(p.id)}
                        className={`relative w-[60px] h-[60px] rounded-2xl overflow-hidden bg-gradient-to-br from-green-50 to-green-100 shrink-0 ${p.description ? 'active:scale-95 transition-transform' : ''}`}>
                        {p.photo_url ? (
                          <Image src={p.photo_url} alt={p.designation} fill
                            className="object-cover" sizes="60px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-3xl opacity-20">{CAT_EMOJI[cat]}</span>
                          </div>
                        )}
                        {qte > 0 && (
                          <div className="absolute -top-1 -right-1 bg-green-700 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                            {qte}
                          </div>
                        )}
                        {epuise && (
                          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-gray-400">Épuisé</span>
                          </div>
                        )}
                      </button>

                      {/* Infos — tap nom = fiche */}
                      <button onClick={() => p.description && setFicheId(p.id)}
                        className="flex-1 min-w-0 text-left">
                        <div className="text-sm font-semibold text-green-900 leading-snug">
                          {p.designation}
                          {p.bio && <span className="ml-1.5 text-[9px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">BIO</span>}
                          {p.description && <span className="ml-1 text-green-400 text-[10px]">ℹ</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {p.prix_ht > 0 && (
                            <span className="text-xs text-green-700 font-semibold">
                              {p.prix_ht.toFixed(2)} €<span className="text-green-500/70 font-normal">/{p.unite}</span>
                            </span>
                          )}
                          {p.quantite_dispo != null && p.quantite_dispo > 0 && p.quantite_dispo <= 5 && (
                            <span className="text-[10px] font-bold text-orange-500">⚡{p.quantite_dispo} restant{p.quantite_dispo > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </button>

                      {/* Contrôles */}
                      <div className="shrink-0">
                        {epuise ? (
                          <span className="text-[10px] text-gray-400 font-semibold px-2">N/D</span>
                        ) : qte === 0 ? (
                          <button onClick={() => setQte(p.id, 1)}
                            className="w-10 h-10 bg-green-700 text-white rounded-2xl text-2xl font-light flex items-center justify-center shadow-sm active:scale-90 transition-transform leading-none">
                            +
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setQte(p.id, -1)}
                              className="w-9 h-9 bg-white border border-green-200 rounded-xl text-green-800 text-xl font-bold flex items-center justify-center active:scale-90 transition-transform shadow-sm">
                              −
                            </button>
                            <span className="w-6 text-center font-bold text-green-900 text-sm">{qte}</span>
                            <button onClick={() => setQte(p.id, 1)}
                              className="w-9 h-9 bg-green-700 rounded-xl text-white text-xl font-bold flex items-center justify-center active:scale-90 transition-transform shadow-sm">
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
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-6">

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

      {/* ── Fiche produit ── */}
      {ficheId && (() => {
        const p = produits.find(x => x.id === ficheId)
        if (!p) return null
        const qte = panier[p.id] || 0
        const epuise = p.quantite_dispo != null && p.quantite_dispo <= 0
        const conservation = p.description?.match(/[💧❄️][\s\S]+/)?.[0] ?? null
        const descBody = p.description?.replace(/\n*[💧❄️][\s\S]+/, '').trim() ?? ''
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setFicheId(null)}>
            <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl overflow-hidden shadow-2xl max-h-[88vh] flex flex-col"
              onClick={e => e.stopPropagation()}>
              {/* Photo */}
              <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-green-50 to-green-100 shrink-0">
                {p.photo_url
                  ? <Image src={p.photo_url} alt={p.designation} fill className="object-cover" sizes="512px" />
                  : <div className="w-full h-full flex items-center justify-center text-7xl opacity-15">{CAT_EMOJI[p.categorie]}</div>
                }
                <button onClick={() => setFicheId(null)}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center text-lg leading-none">
                  ×
                </button>
                {p.bio && (
                  <div className="absolute top-3 left-3 bg-white/95 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full shadow">BIO</div>
                )}
              </div>

              {/* Contenu scrollable */}
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                <div>
                  <h2 className="font-serif text-green-900 text-xl leading-snug">{p.designation}</h2>
                  {p.prix_ht > 0 && (
                    <p className="text-green-700 font-semibold mt-1">
                      {p.prix_ht.toFixed(2)} €<span className="text-green-500 font-normal text-sm">/{p.unite}</span>
                    </p>
                  )}
                </div>

                {descBody && (
                  <p className="text-sm text-gray-700 leading-relaxed">{descBody}</p>
                )}

                {conservation && (
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                    <p className="text-xs text-blue-800 leading-relaxed">{conservation}</p>
                  </div>
                )}
              </div>

              {/* Contrôles fixes en bas */}
              <div className="px-5 py-4 border-t border-gray-100 shrink-0" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                {epuise ? (
                  <div className="w-full py-4 rounded-2xl bg-gray-100 text-gray-400 text-sm font-semibold text-center">Indisponible</div>
                ) : qte === 0 ? (
                  <button onClick={() => { setQte(p.id, 1); setFicheId(null) }}
                    className="w-full py-4 rounded-2xl bg-green-700 text-white font-bold text-base active:bg-green-800 shadow-lg">
                    + Ajouter au panier
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button onClick={() => setQte(p.id, -1)}
                      className="w-14 h-14 bg-gray-100 rounded-2xl text-green-800 text-2xl font-bold flex items-center justify-center active:scale-90 transition-transform">
                      −
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-2xl font-bold text-green-900">{qte}</span>
                      <span className="text-sm text-gray-400 ml-1">{qte > 1 ? p.unite + 's' : p.unite}</span>
                    </div>
                    <button onClick={() => setQte(p.id, 1)}
                      className="w-14 h-14 bg-green-700 rounded-2xl text-white text-2xl font-bold flex items-center justify-center active:scale-90 transition-transform">
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

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
