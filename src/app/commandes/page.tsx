'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { fetchWithCache } from '@/lib/offline'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { Client, Produit, BonLivraison, ProduitCategorie, BLStatut, MessageTemplate } from '@/types'
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
  const [onglet, setOnglet] = useState<'bls' | 'catalogue' | 'clients' | 'messages'>('bls')
  const [bls, setBls] = useState<BonLivraison[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { charger() }, [])

  async function charger() {
    const [b, p, c] = await Promise.all([
      fetchWithCache('commandes', async () => {
        const { data } = await supabase.from('bons_livraison')
          .select('*, client:clients(nom, email)')
          .order('created_at', { ascending: false }).limit(50)
        return data
      }).then(r => r.data),
      fetchWithCache('produits', async () => {
        const { data } = await supabase.from('produits').select('*').eq('actif', true).order('categorie,designation')
        return data
      }).then(r => r.data),
      fetchWithCache('clients', async () => {
        const { data } = await supabase.from('clients').select('*').eq('actif', true).order('nom')
        return data
      }).then(r => r.data),
    ])
    if (b?.length) setBls(b as BonLivraison[])
    if (p?.length) setProduits(p)
    if (c?.length) setClients(c)
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
          { val: 'bls',       label: '📦 BL' },
          { val: 'catalogue', label: '🛍 Catalogue' },
          { val: 'clients',   label: '👥 Clients' },
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
      {onglet === 'messages'  && <MessagesTab clients={clients} />}
    </div>
  )
}

// ─── Liste des BLs ───────────────────────────────────────────

// ─── Feuille de préparation ───────────────────────────────────

const JOURS_NUM: Record<string, number> = { mardi: 2, jeudi: 4, vendredi: 5 }

function prochainJour(num: number): string {
  const today = new Date()
  const diff = (num - today.getDay() + 7) % 7
  const d = new Date(today)
  d.setDate(today.getDate() + (diff === 0 ? 0 : diff))
  return d.toISOString().slice(0, 10)
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// ─── WhatsApp helpers ─────────────────────────────────────────

function formatWaPhone(tel: string): string | null {
  // Nettoyer: garder uniquement les chiffres
  const digits = tel.replace(/\D/g, '')
  if (!digits) return null
  // Déjà un numéro international (33...)
  if (digits.startsWith('33') && digits.length >= 11) return digits
  // Numéro FR commençant par 0
  if (digits.startsWith('0') && digits.length === 10) return '33' + digits.slice(1)
  // Sinon on renvoie tel quel (pays étranger possible)
  return digits.length >= 8 ? digits : null
}

function buildWaMessageDiffusion(
  jourLabel: string,
  produits: { designation: string; bio: boolean; quantite_dispo: number | null }[],
  messageLibre?: string
): string {
  const lignes = [
    `Bonjour 👋`,
    ``,
    `Votre livraison du *${jourLabel}* approche !`,
  ]
  if (messageLibre) {
    lignes.push(``, messageLibre)
  }
  if (produits.length > 0) {
    lignes.push(``, `🛒 *Disponible cette semaine :*`)
    for (const p of produits) {
      const bio   = p.bio ? ' 🌿' : ''
      const stock = p.quantite_dispo != null && p.quantite_dispo <= 3 ? ` ⚡${p.quantite_dispo} restant` : ''
      lignes.push(`• ${p.designation}${bio}${stock}`)
    }
  }
  lignes.push(``, `📱 Répondez à ce message pour passer votre commande ou consultez votre lien habituel.`)
  return lignes.join('\n')
}

function buildWaMessage(
  clientNom: string,
  jourLabel: string,
  lien: string,
  produits: { designation: string; bio: boolean; quantite_dispo: number | null }[],
  messageLibre?: string
): string {
  const lignes = [
    `Bonjour ${clientNom} 👋`,
    ``,
    `Votre livraison du *${jourLabel}* approche !`,
  ]
  if (messageLibre) {
    lignes.push(``, messageLibre)
  }
  if (produits.length > 0) {
    lignes.push(``, `🛒 *Disponible cette semaine :*`)
    for (const p of produits) {
      const bio   = p.bio ? ' 🌿' : ''
      const stock = p.quantite_dispo != null && p.quantite_dispo <= 3 ? ` ⚡${p.quantite_dispo} restant` : ''
      lignes.push(`• ${p.designation}${bio}${stock}`)
    }
  }
  lignes.push(``, `👉 Commander : ${lien}`)
  return lignes.join('\n')
}

// ─── Modal rappels (WhatsApp / SMS, avec suivi) ───────────────

// Prochaine date de livraison pour un jour donné (ancre par semaine)
const JOUR_IDX_RAPPEL: Record<string, number> = { mardi: 2, jeudi: 4, vendredi: 5 }
function prochaineDateLivraison(jour: string): string {
  const d = new Date()
  const ecart = ((JOUR_IDX_RAPPEL[jour] ?? 2) - d.getDay() + 7) % 7
  d.setDate(d.getDate() + ecart)
  return d.toISOString().slice(0, 10)
}

type ClientRappel = { id: string; nom: string; email: string | null; telephone: string | null; order_token: string | null }

function RappelsModal({ jour, onClose }: { jour: string; onClose: () => void }) {
  const [clients, setClients] = useState<ClientRappel[]>([])
  const [produits, setProduits] = useState<{ designation: string; categorie: string; bio: boolean; quantite_dispo: number | null }[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [message, setMessage] = useState('')
  const [canal, setCanal] = useState<'whatsapp' | 'sms'>('whatsapp')
  const [contactes, setContactes] = useState<Set<string>>(new Set())
  const [waCopie, setWaCopie] = useState<string | null>(null)
  const [diffusionCopie, setDiffusionCopie] = useState(false)
  const jourLabel = jour.charAt(0).toUpperCase() + jour.slice(1)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://petites-herbes.vercel.app'
  const semaine = prochaineDateLivraison(jour)

  useEffect(() => {
    async function charger() {
      const [rappel, { data: suivi }] = await Promise.all([
        fetch(`/api/rappels?jour=${jour}`).then(r => r.json()),
        supabase.from('rappels_suivi').select('client_id')
          .eq('jour_livraison', jour).eq('semaine', semaine),
      ])
      setClients(rappel.clients || [])
      setProduits(rappel.produits || [])
      setContactes(new Set((suivi || []).map((s: { client_id: string }) => s.client_id)))
      setLoadingClients(false)
    }
    charger()
  }, [jour, semaine])

  async function marquerContacte(clientId: string, viaCanal: 'whatsapp' | 'sms') {
    setContactes(prev => new Set(prev).add(clientId))
    await supabase.from('rappels_suivi').upsert(
      { client_id: clientId, jour_livraison: jour, semaine, canal: viaCanal },
      { onConflict: 'client_id,jour_livraison,semaine' }
    )
  }

  async function basculerContacte(clientId: string) {
    if (contactes.has(clientId)) {
      setContactes(prev => { const n = new Set(prev); n.delete(clientId); return n })
      await supabase.from('rappels_suivi').delete()
        .eq('client_id', clientId).eq('jour_livraison', jour).eq('semaine', semaine)
    } else {
      await marquerContacte(clientId, canal)
    }
  }

  const avecTel  = clients.filter(c => c.telephone && formatWaPhone(c.telephone))
  const nbFaits  = clients.filter(c => contactes.has(c.id)).length
  const restants = avecTel.filter(c => !contactes.has(c.id))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 pb-10 space-y-4 max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">📨 Rappels {jourLabel}</h2>
            <div className="text-xs text-gray-400">Livraison du {new Date(semaine + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        {loadingClients ? (
          <div className="text-sm text-gray-400 text-center py-4">Chargement…</div>
        ) : (
          <>
            {/* Suivi global */}
            {clients.length > 0 && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-xl py-2">
                  <div className="text-lg font-bold text-gray-700">{avecTel.length}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">à contacter</div>
                </div>
                <div className="bg-green-50 rounded-xl py-2">
                  <div className="text-lg font-bold text-green-700">{nbFaits}</div>
                  <div className="text-[10px] text-green-600 uppercase tracking-wide">contactés</div>
                </div>
                <div className="bg-amber-50 rounded-xl py-2">
                  <div className="text-lg font-bold text-amber-600">{restants.length}</div>
                  <div className="text-[10px] text-amber-500 uppercase tracking-wide">restants</div>
                </div>
              </div>
            )}

            {/* Choix canal */}
            <div className="grid grid-cols-2 rounded-lg overflow-hidden border border-gray-200">
              <button onClick={() => setCanal('whatsapp')}
                className={`py-2 text-sm font-semibold transition-colors
                  ${canal === 'whatsapp' ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}>
                💬 WhatsApp
              </button>
              <button onClick={() => setCanal('sms')}
                className={`py-2 text-sm font-semibold transition-colors
                  ${canal === 'sms' ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}>
                💬 SMS
              </button>
            </div>

            {/* Message du moment */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
                Message du moment (optionnel)
              </label>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                placeholder={`ex: Cette semaine : pois gourmands et cresson frais ! Livraison ${jourLabel} comme prévu. 🌿`}
                rows={3}
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:border-green-400" />
            </div>

            {/* Produits inclus */}
            {produits.length > 0 && (
              <div className="bg-green-50 border border-green-100 rounded-lg p-2.5 flex flex-wrap gap-1.5">
                {produits.map((p, i) => (
                  <span key={i} className="text-xs bg-white border border-green-200 text-green-800 px-2 py-0.5 rounded-full font-medium">
                    {p.designation}{p.bio ? ' 🌿' : ''}{p.quantite_dispo != null && p.quantite_dispo <= 3 ? ' ⚡' : ''}
                  </span>
                ))}
              </div>
            )}

            {clients.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                Aucun client assigné au créneau {jourLabel} — configurez les créneaux dans la fiche client.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {avecTel.length} client{avecTel.length > 1 ? 's' : ''} joignable{avecTel.length > 1 ? 's' : ''}
                  </div>
                  {nbFaits > 0 && (
                    <button
                      onClick={async () => {
                        setContactes(new Set())
                        await supabase.from('rappels_suivi').delete()
                          .eq('jour_livraison', jour).eq('semaine', semaine)
                      }}
                      className="text-xs text-gray-400 underline">Réinitialiser</button>
                  )}
                </div>

                {clients.map(c => {
                  const lien  = c.order_token ? `${baseUrl}/commander/${c.order_token}` : null
                  const phone = c.telephone ? formatWaPhone(c.telephone) : null
                  const fait  = contactes.has(c.id)
                  const texteWa  = lien ? buildWaMessage(c.nom, jourLabel, lien, produits, message.trim() || undefined) : ''
                  const texteSms = texteWa.replace(/\*/g, '')
                  const waUrl  = phone && lien ? `https://wa.me/${phone}?text=${encodeURIComponent(texteWa)}` : null
                  const smsUrl = phone && lien ? `sms:+${phone}?body=${encodeURIComponent(texteSms)}` : null
                  const lienAction = canal === 'whatsapp' ? waUrl : smsUrl

                  return (
                    <div key={c.id}
                      className={`flex items-center gap-2 rounded-xl p-2.5 border transition-colors
                        ${fait ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-transparent'}`}>
                      {/* Pastille statut cliquable */}
                      <button onClick={() => basculerContacte(c.id)}
                        className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold border-2
                          ${fait ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-300 text-transparent'}`}
                        aria-label="Marquer contacté">✓</button>

                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold text-sm truncate ${fait ? 'text-green-800' : ''}`}>{c.nom}</div>
                        <div className="text-xs text-gray-400 truncate">{c.telephone || 'Pas de numéro'}</div>
                      </div>

                      {lienAction ? (
                        <a href={lienAction} target="_blank" rel="noopener noreferrer"
                          onClick={() => marquerContacte(c.id, canal)}
                          className={`shrink-0 text-white text-xs font-bold px-3 py-2 rounded-xl
                            ${canal === 'whatsapp' ? 'bg-[#25D366]' : 'bg-blue-500'}`}>
                          {canal === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                        </a>
                      ) : lien ? (
                        <button
                          onClick={() => { navigator.clipboard.writeText(texteWa); setWaCopie(c.id); setTimeout(() => setWaCopie(null), 2000) }}
                          className="shrink-0 bg-gray-200 text-gray-600 text-xs font-bold px-3 py-2 rounded-xl">
                          {waCopie === c.id ? '✓ Copié' : 'Copier'}
                        </button>
                      ) : (
                        <span className="shrink-0 text-xs text-gray-300">—</span>
                      )}
                    </div>
                  )
                })}
                <p className="text-xs text-gray-400 pt-1">
                  Chaque bouton ouvre {canal === 'whatsapp' ? 'WhatsApp' : 'l\'app SMS'} avec le message pré-rédigé et coche le client. La pastille verte se synchronise entre votre téléphone et celui de Lucas.
                </p>

                {/* ── Liste de diffusion WhatsApp ── */}
                <div className="mt-3 bg-[#f0fdf4] border border-green-200 rounded-xl p-3 space-y-2">
                  <div className="text-sm font-semibold text-green-800">📢 Envoi groupé (liste de diffusion)</div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Une <strong>liste de diffusion</strong> WhatsApp envoie le même message à tous vos clients
                    d&apos;un coup, en privé — chacun le reçoit individuellement, sans groupe visible.
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    ⚠️ <em>Condition :</em> chaque contact doit avoir votre numéro enregistré, sinon il ne recevra pas le message.
                  </p>
                  <div className="text-xs text-gray-600 space-y-0.5">
                    <div className="font-semibold">Comment faire :</div>
                    <div>1. WhatsApp → ✏️ → <em>Nouvelle liste de diffusion</em></div>
                    <div>2. Ajoutez vos clients du {jourLabel}</div>
                    <div>3. Collez le message ci-dessous et envoyez</div>
                  </div>
                  <button
                    onClick={() => {
                      const txt = buildWaMessageDiffusion(jourLabel, produits, message.trim() || undefined)
                      navigator.clipboard.writeText(txt)
                      setDiffusionCopie(true)
                      setTimeout(() => setDiffusionCopie(false), 2500)
                    }}
                    className="w-full bg-green-700 text-white text-sm font-bold py-2.5 rounded-xl">
                    {diffusionCopie ? '✓ Message copié !' : '📋 Copier le message groupé'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Boutons préparation + rappels ────────────────────────────

// ─── Modal flux livraison ─────────────────────────────────────

type ClientFlux = {
  id: string; nom: string; telephone: string | null; email: string | null
  jours_livraison: string[]; order_token: string | null
  dernierBL?: { id: string; numero: string; date_livraison: string; bl_lignes: { designation: string; reference: string | null; quantite: number; prix_ht: number; tva_pct: number }[] } | null
}

function FluxLivraisonModal({ jour, onClose }: { jour: string; onClose: () => void }) {
  const router = useRouter()
  const [clients, setClients] = useState<ClientFlux[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [dateLivraison, setDateLivraison] = useState(prochainJour(JOURS_NUM[jour] || 2))
  const jourLabel = jour.charAt(0).toUpperCase() + jour.slice(1)

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    const { data: clientsRaw } = await supabase
      .from('clients')
      .select('id, nom, telephone, email, jours_livraison, order_token')
      .eq('actif', true)
      .contains('jours_livraison', [jour])
      .order('nom')

    if (!clientsRaw) { setLoading(false); return }

    const enrichis = await Promise.all(
      clientsRaw.map(async (c) => {
        const { data: bls } = await supabase
          .from('bons_livraison')
          .select('id, numero, date_livraison, bl_lignes(designation, reference, quantite, prix_ht, tva_pct)')
          .eq('client_id', c.id)
          .order('date_livraison', { ascending: false })
          .limit(1)
        return { ...c, dernierBL: bls?.[0] || null }
      })
    )
    setClients(enrichis as ClientFlux[])
    setLoading(false)
  }

  async function recreerBL(client: ClientFlux) {
    setCreating(client.id)
    const { data: params } = await supabase.from('parametres_production').select('id, prochain_numero_bl').single()
    const numero = String(params?.prochain_numero_bl || 1777).padStart(7, '0')

    const { data: newBl, error } = await supabase.from('bons_livraison').insert({
      numero, client_id: client.id, date_livraison: dateLivraison, statut: 'brouillon',
    }).select().single()

    if (!error && newBl) {
      const lignes = client.dernierBL?.bl_lignes ?? []
      if (lignes.length > 0) {
        await supabase.from('bl_lignes').insert(
          lignes.map((l, i) => ({
            bl_id: newBl.id, produit_id: null,
            designation: l.designation, reference: l.reference,
            quantite: l.quantite, prix_ht: l.prix_ht, tva_pct: l.tva_pct, ordre: i,
          }))
        )
      }
      if (params) {
        await supabase.from('parametres_production')
          .update({ prochain_numero_bl: (params.prochain_numero_bl || 1777) + 1 })
          .eq('id', params.id)
      }
      router.push(`/commandes/${newBl.id}`)
    }
    setCreating(null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 pb-10 space-y-4 max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">🚚 Flux livraison — {jourLabel}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Crée les BL de tous vos clients du {jourLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1.5">Date de livraison</label>
          <input type="date" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400" />
        </div>

        {loading ? (
          <div className="text-sm text-gray-400 text-center py-6">Chargement…</div>
        ) : clients.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
            Aucun client assigné au {jourLabel}. Ajoutez un créneau dans la fiche client.
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map(c => {
              const lignes = c.dernierBL?.bl_lignes || []
              const isBusy = creating === c.id
              const phone = c.telephone?.replace(/\D/g, '')
              const waNum = phone?.startsWith('0') ? '33' + phone.slice(1) : phone
              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50">
                    <div>
                      <div className="font-semibold text-sm text-gray-800">{c.nom}</div>
                      {c.dernierBL && (
                        <div className="text-xs text-gray-400">
                          Dernier BL : {c.dernierBL.numero} du {fmtDate(c.dernierBL.date_livraison)}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {waNum && (
                        <a href={`https://wa.me/${waNum}`} target="_blank" rel="noopener noreferrer"
                          className="w-8 h-8 flex items-center justify-center bg-[#25D366] text-white rounded-lg text-sm">
                          💬
                        </a>
                      )}
                      <button onClick={() => recreerBL(c)} disabled={isBusy}
                        className="px-3 py-1.5 bg-green-700 text-white text-xs font-bold rounded-lg disabled:opacity-50">
                        {isBusy ? '…' : c.dernierBL ? '🔁 Recréer BL' : '+ Nouveau BL'}
                      </button>
                    </div>
                  </div>
                  {lignes.length > 0 && (
                    <div className="divide-y divide-gray-50">
                      {lignes.map((l, i) => (
                        <div key={i} className="px-3 py-1.5 flex justify-between text-xs text-gray-600">
                          <span>{l.designation}</span>
                          <span className="font-semibold text-gray-700">× {l.quantite}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!c.dernierBL && (
                    <div className="px-3 py-2 text-xs text-gray-400 italic">Pas de BL précédent — un BL vide sera créé</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function PrepaButtons() {
  const [loadingPrepa, setLoadingPrepa] = useState<string | null>(null)
  const [autreDate, setAutreDate] = useState(false)
  const [dateChoisie, setDateChoisie] = useState('')
  const [rappelJour, setRappelJour] = useState<string | null>(null)
  const [fluxJour, setFluxJour] = useState<string | null>(null)

  async function genererPrepa(date: string) {
    const jourLabel = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long' })
    setLoadingPrepa(date)
    try {
      const res = await fetch('/api/pdf/preparation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Aucune commande pour cette date')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Preparation-${jourLabel}-${date.replace(/-/g, '')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoadingPrepa(null)
    }
  }

  const creneaux = [
    { nom: 'mardi',    num: JOURS_NUM.mardi    },
    { nom: 'jeudi',    num: JOURS_NUM.jeudi    },
    { nom: 'vendredi', num: JOURS_NUM.vendredi },
  ]

  return (
    <>
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-3">
        <div className="text-xs font-semibold text-green-800">📋 Feuille de préparation</div>
        <div className="grid grid-cols-3 gap-2">
          {creneaux.map(({ nom, num }) => {
            const date = prochainJour(num)
            return (
              <button key={nom}
                onClick={() => genererPrepa(date)}
                disabled={loadingPrepa !== null}
                className="py-2 rounded-lg bg-green-700 text-white text-xs font-semibold disabled:opacity-50 capitalize">
                {loadingPrepa === date ? '…' : `${nom.charAt(0).toUpperCase() + nom.slice(1)} ${fmtDate(date)}`}
              </button>
            )
          })}
        </div>
        <button onClick={() => setAutreDate(o => !o)} className="text-xs text-green-700 underline">
          {autreDate ? 'Masquer' : 'Autre date…'}
        </button>
        {autreDate && (
          <div className="flex gap-2 items-center">
            <input type="date" value={dateChoisie} onChange={e => setDateChoisie(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-400" />
            <button onClick={() => { if (dateChoisie) genererPrepa(dateChoisie) }}
              disabled={!dateChoisie || loadingPrepa !== null}
              className="py-1.5 px-3 rounded-lg bg-green-700 text-white text-xs font-semibold disabled:opacity-40">
              {loadingPrepa ? '…' : 'PDF'}
            </button>
          </div>
        )}

        <div className="border-t border-green-200 pt-2 space-y-1">
          <div className="text-xs font-semibold text-green-800">📨 Envoyer rappels de commande</div>
          <div className="grid grid-cols-3 gap-2">
            {creneaux.map(({ nom }) => (
              <button key={nom}
                onClick={() => setRappelJour(nom)}
                className="py-2 rounded-lg bg-white border border-green-300 text-green-800 text-xs font-semibold capitalize hover:bg-green-100 transition-colors">
                {nom.charAt(0).toUpperCase() + nom.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-green-200 pt-2 space-y-1">
          <div className="text-xs font-semibold text-green-800">🚚 Flux livraison — recréer tous les BL</div>
          <div className="grid grid-cols-3 gap-2">
            {creneaux.map(({ nom }) => (
              <button key={nom}
                onClick={() => setFluxJour(nom)}
                className="py-2 rounded-lg bg-green-700 text-white text-xs font-semibold capitalize">
                {nom.charAt(0).toUpperCase() + nom.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 pt-0.5">
            Recrée les BL de vos clients à partir de leur dernière commande.
          </p>
        </div>
      </div>

      {rappelJour && (
        <RappelsModal jour={rappelJour} onClose={() => setRappelJour(null)} />
      )}
      {fluxJour && (
        <FluxLivraisonModal jour={fluxJour} onClose={() => setFluxJour(null)} />
      )}
    </>
  )
}

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
      <PrepaButtons />

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
  const [dispoEdit, setDispoEdit] = useState<string | null>(null) // id du produit en cours d'édition dispo
  const [qteSaisie, setQteSaisie] = useState('')
  const categories = Array.from(new Set(produits.map(p => p.categorie))) as ProduitCategorie[]

  async function setDispo(p: Produit, etat: 'dispo' | 'qte' | 'indispo', qte?: number) {
    if (etat === 'indispo') {
      await supabase.from('produits').update({ disponible: false, quantite_dispo: null }).eq('id', p.id)
    } else if (etat === 'dispo') {
      await supabase.from('produits').update({ disponible: true, quantite_dispo: null }).eq('id', p.id)
    } else if (etat === 'qte') {
      await supabase.from('produits').update({ disponible: true, quantite_dispo: qte ?? null }).eq('id', p.id)
    }
    setDispoEdit(null)
    onRefresh()
  }

  function getDispoInfo(p: Produit) {
    if (!p.disponible) return { label: 'Indispo', color: 'bg-red-100 text-red-600', dot: '🔴' }
    if (p.quantite_dispo != null) return { label: `Qté: ${p.quantite_dispo}`, color: 'bg-amber-100 text-amber-700', dot: '🟡' }
    return { label: 'Dispo', color: 'bg-green-100 text-green-700', dot: '🟢' }
  }

  return (
    <div className="space-y-3">
      {/* Légende */}
      <div className="flex gap-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        <span>🟢 Dispo</span>
        <span>🟡 Qté limitée</span>
        <span>🔴 Indisponible</span>
        <span className="ml-auto text-gray-400">Appuyer sur le badge pour modifier</span>
      </div>

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
            {produits.filter(p => p.categorie === cat).map(p => {
              const dispo = getDispoInfo(p)
              const editing = dispoEdit === p.id
              return (
                <div key={p.id}>
                  <div className={`flex items-center gap-3 px-3 py-2.5 ${!p.disponible ? 'opacity-50' : ''}`}>
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
                    {/* Badge disponibilité cliquable */}
                    <button
                      onClick={() => { setDispoEdit(editing ? null : p.id); setQteSaisie(p.quantite_dispo?.toString() || '') }}
                      className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${dispo.color}`}>
                      {dispo.dot} {dispo.label}
                    </button>
                    <button onClick={() => setModal(p)}
                      className="text-xs text-blue-600 px-2 py-1 rounded border border-blue-200 shrink-0">
                      Edit
                    </button>
                  </div>
                  {/* Panel édition disponibilité */}
                  {editing && (
                    <div className="bg-gray-50 border-t border-gray-100 px-3 py-3 space-y-2">
                      <div className="text-xs font-semibold text-gray-600 mb-2">Disponibilité de {p.designation}</div>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => setDispo(p, 'dispo')}
                          className="py-2 rounded-lg bg-green-700 text-white text-xs font-semibold">
                          🟢 Disponible
                        </button>
                        <button onClick={() => setDispo(p, 'indispo')}
                          className="py-2 rounded-lg bg-red-500 text-white text-xs font-semibold">
                          🔴 Indisponible
                        </button>
                        <button
                          onClick={() => {
                            const q = parseInt(qteSaisie)
                            if (q > 0) setDispo(p, 'qte', q)
                          }}
                          className="py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold">
                          🟡 Avec quantité
                        </button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          min="1"
                          placeholder="Quantité disponible (ex: 5)"
                          value={qteSaisie}
                          onChange={e => setQteSaisie(e.target.value)}
                          className="flex-1 border border-amber-300 rounded-lg p-2 text-sm text-center"
                        />
                        <span className="text-xs text-gray-400">{p.unite}s</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        💡 La quantité s&apos;affiche dans la boutique et limite les commandes.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
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
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 pb-24 space-y-3 max-h-[90vh] overflow-y-auto"
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
  const [factureModal, setFactureModal] = useState<Client | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setModal('nouveau')}
          className="flex-1 py-3 rounded-xl border-2 border-dashed border-green-300 text-green-700 text-sm font-semibold">
          + Ajouter un client
        </button>
        <a href="/parametres-documents"
          className="py-3 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium flex items-center gap-1.5">
          ⚙️ <span className="text-xs">Docs</span>
        </a>
      </div>

      {clients.map(c => {
        const lien = c.order_token
          ? `${typeof window !== 'undefined' ? window.location.origin : 'https://petites-herbes.vercel.app'}/commander/${c.order_token}`
          : null
        const joursLiv = c.jours_livraison || []
        return (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div onClick={() => setModal(c)} className="p-4 cursor-pointer active:bg-gray-50">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-sm">{c.nom}</div>
                {joursLiv.length > 0 && (
                  <div className="flex gap-1 flex-wrap justify-end">
                    {joursLiv.map(j => (
                      <span key={j} className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium capitalize">
                        {j}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                {c.ville && <div>{c.code_postal} {c.ville}</div>}
                {c.email && <div>{c.email}</div>}
                {c.telephone && <div>{c.telephone}</div>}
              </div>
            </div>
            {lien && (
              <div className="px-4 pb-3 pt-0 border-t border-gray-50 space-y-2">
                <div className="text-xs text-gray-400">Lien de commande personnel</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-50 rounded-lg px-2 py-1.5 text-xs text-gray-600 font-mono truncate">
                    {lien}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(lien); alert('Lien copié !') }}
                    className="shrink-0 bg-gray-100 text-gray-700 text-xs px-3 py-1.5 rounded-lg font-semibold">
                    Copier
                  </button>
                  <a href={lien} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 bg-green-50 text-green-700 text-xs px-3 py-1.5 rounded-lg font-semibold border border-green-200">
                    👁 Voir
                  </a>
                </div>
                {c.telephone && formatWaPhone(c.telephone) ? (
                  <a
                    href={`https://wa.me/${formatWaPhone(c.telephone)}?text=${encodeURIComponent(
                      `Bonjour ${c.nom} 👋\n\nVoici votre lien personnel pour commander vos micro-pousses Les Petites Herbes :\n${lien}\n\nMettez-le en favori : vous y retrouvez nos disponibilités et passez commande en quelques clics. 🌿`
                    )}`}
                    target="_blank" rel="noopener noreferrer"
                    className="block text-center bg-[#25D366] text-white text-xs px-3 py-2.5 rounded-lg font-semibold">
                    💬 Inviter par WhatsApp
                  </a>
                ) : (
                  <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    ⚠️ Pas de numéro — ajoutez-en un pour inviter ce chef par WhatsApp
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFactureModal(c)}
                    className="flex items-center justify-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-2 py-2.5 rounded-lg font-semibold">
                    📑 Récap mensuel
                  </button>
                  <BLsClientButton client={c} />
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
      {factureModal && (
        <FactureModal
          client={factureModal}
          onClose={() => setFactureModal(null)}
        />
      )}
    </div>
  )
}

const JOURS_OPTIONS: { val: string; label: string; emoji: string }[] = [
  { val: 'mardi',    label: 'Mardi',    emoji: '📅' },
  { val: 'jeudi',    label: 'Jeudi',    emoji: '📅' },
  { val: 'vendredi', label: 'Vendredi', emoji: '📅' },
]

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
  const [jours, setJours] = useState<string[]>(client?.jours_livraison || [])
  const [saving, setSaving] = useState(false)

  function toggleJour(j: string) {
    setJours(prev => prev.includes(j) ? prev.filter(x => x !== j) : [...prev, j])
  }

  async function sauvegarder() {
    setSaving(true)
    const data = {
      nom:              form.nom,
      adresse:          form.adresse || null,
      code_postal:      form.code_postal || null,
      ville:            form.ville || null,
      pays:             form.pays,
      email:            form.email || null,
      telephone:        form.telephone || null,
      siret:            form.siret || null,
      tva_intra:        form.tva_intra || null,
      jours_livraison:  jours,
    }
    if (client) {
      await supabase.from('clients').update(data).eq('id', client.id)
    } else {
      const order_token = crypto.randomUUID()
      await supabase.from('clients').insert({ ...data, actif: true, order_token })
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
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 pb-24 space-y-3 max-h-[90vh] overflow-y-auto"
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

        {/* Créneaux de livraison */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">Créneau(x) de livraison</label>
          <div className="grid grid-cols-3 gap-2">
            {JOURS_OPTIONS.map(({ val, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => toggleJour(val)}
                className={`py-2.5 rounded-lg text-sm font-medium border-2 transition-colors
                  ${jours.includes(val)
                    ? 'bg-green-700 text-white border-green-700'
                    : 'bg-white text-gray-600 border-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
          {jours.length === 0 && (
            <p className="text-xs text-amber-600 mt-1.5">
              ⚠️ Sans créneau ce client ne recevra pas les rappels automatiques
            </p>
          )}
        </div>

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

// ─── Onglet Messages ──────────────────────────────────────────

type MessageHistorique = {
  id: string
  type: 'invitation' | 'diffusion' | 'individuel'
  sujet: string
  corps: string | null
  destinataires_count: number
  destinataire_id: string | null
  created_at: string
}

function MessagesTab({ clients }: { clients: Client[] }) {
  const [mode, setMode]           = useState<'compose' | 'historique' | 'modeles'>('compose')
  const [sujet, setSujet]         = useState('')
  const [corps, setCorps]         = useState('')
  const [cibleTous, setCibleTous] = useState(true)
  const [destId, setDestId]       = useState('')
  const [envoi, setEnvoi]         = useState(false)
  const [resultat, setResultat]   = useState<{ ok: boolean; envoyes?: number; total?: number; error?: string } | null>(null)
  const [historique, setHistorique] = useState<MessageHistorique[]>([])
  const [loadHist, setLoadHist]   = useState(false)
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loadTemplates, setLoadTemplates] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const [nomTemplate, setNomTemplate] = useState('')
  const [sauvegardeOuverte, setSauvegardeOuverte] = useState(false)

  const avecEmail = clients.filter(c => c.email)

  useEffect(() => {
    chargerTemplates()
  }, [])

  useEffect(() => {
    if (mode === 'historique') chargerHistorique()
  }, [mode])

  // Templates intégrés — utilisés en fallback si la table n'existe pas encore
  const TEMPLATES_FALLBACK: MessageTemplate[] = [
    { id: 'f1', nom: '🌻 Disponibilités hebdomadaires', ordre: 1, created_at: '',
      sujet: '🌻 Production disponible cette semaine — commandez avant lundi 15h',
      corps: `Bonjour,\n\nVotre production de la semaine est disponible ! Rendez-vous sur votre espace personnel pour découvrir nos disponibilités du moment et passer commande en quelques clics.\n\n⏰ Pensez à commander avant lundi 15h, c'est très arrangeant pour nous 🫶\n\nCette semaine vous retrouverez nos tapis de micro-pousses, barquettes, godets, fleurs comestibles et aromates en bottes.\n\nN'oubliez pas de mettre nos cagettes de côté — ou si vous souhaitez vous en débarrasser, nous sommes preneurs !\n\nBonne journée,\nVégétalement 🌱\nLes Petites Herbes` },
    { id: 'f2', nom: '🛒 Message boutique — offre de la semaine', ordre: 2, created_at: '',
      sujet: '🌿 Nos disponibilités de la semaine — votre boutique est à jour !',
      corps: `Bonjour,\n\nUn petit mot de la ferme pour vous donner des nouvelles de la production cette semaine !\n\nVotre boutique personnelle est mise à jour en temps réel : vous y trouverez exactement ce qui est disponible aujourd'hui.\n\nCette semaine au programme :\n• 🌱 Tapis de micro-pousses (tournesol, radis, pois, lentille, basilic...)\n• 🧺 Barquettes fraîches\n• 🪴 Godets d'herbes aromatiques\n• 🌸 Fleurs comestibles de saison\n• 🌿 Bottes d'aromates fraîches\n\n⏰ Pour qu'on puisse préparer les commandes dans les meilleures conditions, merci de commander avant lundi 15h !\n\nÀ très bientôt,\nVégétalement 🌱\nLes Petites Herbes · Cogolin` },
    { id: 'f3', nom: '⚠️ Rupture de stock', ordre: 3, created_at: '',
      sujet: '⚠️ Rupture temporaire sur certaines variétés',
      corps: `Bonjour,\n\nNous vous informons d'une rupture temporaire sur certaines de nos variétés cette semaine.\n\nNotre catalogue en ligne est mis à jour en temps réel — les produits disponibles sont bien visibles sur votre espace personnel.\n\nMerci pour votre compréhension, nous faisons notre maximum pour réapprovisionner rapidement.\n\nÀ très bientôt,\nVégétalement 🌱\nLes Petites Herbes` },
    { id: 'f4', nom: '📅 Fermeture / Congés', ordre: 4, created_at: '',
      sujet: '📅 Fermeture exceptionnelle — informations importantes',
      corps: `Bonjour,\n\nNous vous informons que notre exploitation sera fermée du ___ au ___.\n\nAucune commande ne pourra être traitée pendant cette période. Nous reprendrons les livraisons normalement à partir du ___.\n\nLes commandes passées avant notre fermeture seront bien honorées.\n\nMerci de votre fidélité et à très bientôt !\n\nVégétalement 🌱\nLes Petites Herbes` },
    { id: 'f5', nom: '🎉 Nouveauté / Arrivage', ordre: 5, created_at: '',
      sujet: '🎉 Nouveauté à la ferme — découvrez notre dernière arrivée !',
      corps: `Bonjour,\n\nBonne nouvelle : nous avons une nouveauté à vous proposer cette semaine !\n\n___ [Décrivez ici la nouveauté : nouvelle variété, nouveau produit, nouvelle présentation...]\n\nComme toujours, retrouvez-le directement dans votre espace boutique personnel.\n\nN'hésitez pas à nous faire part de vos retours — vos avis guident vraiment notre production !\n\nÀ bientôt,\nVégétalement 🌱\nLes Petites Herbes` },
  ]

  async function chargerTemplates() {
    setLoadTemplates(true)
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .order('ordre')
    if (error) {
      // Table pas encore créée — utiliser les templates intégrés
      setTemplates(TEMPLATES_FALLBACK)
      setTableMissing(true)
    } else {
      setTemplates(data?.length ? (data as MessageTemplate[]) : TEMPLATES_FALLBACK)
      setTableMissing(false)
    }
    setLoadTemplates(false)
  }

  async function chargerHistorique() {
    setLoadHist(true)
    const { data } = await supabase
      .from('messages_envoyes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setHistorique(data as MessageHistorique[])
    setLoadHist(false)
  }

  function chargerTemplate(t: MessageTemplate) {
    setSujet(t.sujet)
    setCorps(t.corps)
    setMode('compose')
  }

  async function sauvegarderTemplate() {
    if (!nomTemplate.trim() || !sujet.trim() || !corps.trim()) return
    const maxOrdre = templates.reduce((m, t) => Math.max(m, t.ordre), 0)
    await supabase.from('message_templates').insert({
      nom: nomTemplate,
      sujet,
      corps,
      ordre: maxOrdre + 1,
    })
    setNomTemplate('')
    setSauvegardeOuverte(false)
    chargerTemplates()
  }

  async function supprimerTemplate(id: string) {
    if (!confirm('Supprimer ce modèle ?')) return
    await supabase.from('message_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function envoyer() {
    if (!sujet.trim() || !corps.trim()) return
    setEnvoi(true)
    setResultat(null)
    try {
      const body: Record<string, string> = { sujet, corps }
      if (!cibleTous && destId) body.destinataire_id = destId
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setResultat(data)
      if (data.ok) {
        setSujet('')
        setCorps('')
        setDestId('')
        setCibleTous(true)
      }
    } catch {
      setResultat({ ok: false, error: 'Erreur réseau' })
    }
    setEnvoi(false)
  }

  const TYPE_BADGE: Record<string, string> = {
    invitation: 'bg-blue-100 text-blue-700',
    diffusion:  'bg-purple-100 text-purple-700',
    individuel: 'bg-amber-100 text-amber-700',
  }
  const TYPE_LABEL: Record<string, string> = {
    invitation: '🔗 Invitation',
    diffusion:  '📢 Diffusion',
    individuel: '👤 Individuel',
  }

  return (
    <div className="space-y-4">
      {/* Onglets internes */}
      <div className="flex rounded-lg overflow-hidden border border-gray-200">
        {[
          { val: 'compose',    label: '✏️ Composer' },
          { val: 'modeles',    label: '📌 Modèles' },
          { val: 'historique', label: '📋 Historique' },
        ].map(o => (
          <button key={o.val} onClick={() => setMode(o.val as typeof mode)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors
              ${mode === o.val ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}>
            {o.label}
          </button>
        ))}
      </div>

      {/* ── Modèles ── */}
      {mode === 'modeles' && (
        <div className="space-y-3">
          {tableMissing && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
              <div className="font-semibold">⚠️ Modèles intégrés (lecture seule)</div>
              <div>La table <code className="font-mono">message_templates</code> n&apos;existe pas encore dans Supabase. Les modèles ci-dessous sont intégrés dans l&apos;app. Pour pouvoir en créer de nouveaux, collez le fichier <code className="font-mono">supabase/migrations/012_message_templates.sql</code> dans l&apos;éditeur SQL de Supabase.</div>
            </div>
          )}
          <p className="text-xs text-gray-500">Cliquez sur un modèle pour le charger dans le composer.</p>
          {loadTemplates ? (
            <div className="flex justify-center py-8 text-gray-400 text-sm">Chargement…</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              Aucun modèle — composez un message et sauvegardez-le.
            </div>
          ) : (
            templates.map(t => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <div>
                  <div className="font-semibold text-sm text-gray-800">{t.nom}</div>
                  <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{t.sujet}</div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2 whitespace-pre-line">{t.corps}</div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => chargerTemplate(t)}
                    className="flex-1 py-2 rounded-lg bg-green-700 text-white text-xs font-semibold">
                    ✏️ Utiliser ce modèle
                  </button>
                  {!tableMissing && (
                    <button
                      onClick={() => supprimerTemplate(t.id)}
                      className="px-3 py-2 rounded-lg border border-red-200 text-red-500 text-xs">
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Composer ── */}
      {mode === 'compose' && (
        <div className="space-y-4">
          {/* Destinataires */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-700">Destinataires</div>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button onClick={() => setCibleTous(true)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors
                  ${cibleTous ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}>
                📢 Tous les chefs ({avecEmail.length})
              </button>
              <button onClick={() => setCibleTous(false)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors
                  ${!cibleTous ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}>
                👤 Un seul chef
              </button>
            </div>
            {!cibleTous && (
              <select value={destId} onChange={e => setDestId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white">
                <option value="">— Choisir un chef —</option>
                {avecEmail.map(c => (
                  <option key={c.id} value={c.id}>{c.nom} ({c.email})</option>
                ))}
              </select>
            )}
            {avecEmail.length === 0 && (
              <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                ⚠️ Aucun client n&apos;a d&apos;adresse email enregistrée
              </div>
            )}
          </div>

          {/* Sujet + Corps */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">Message</div>
              <button onClick={() => setMode('modeles')}
                className="text-xs text-green-700 border border-green-200 rounded-lg px-2 py-1 bg-green-50">
                📌 Charger un modèle
              </button>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Sujet</label>
              <input value={sujet} onChange={e => setSujet(e.target.value)}
                placeholder="ex: 🌻 Production disponible cette semaine"
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Contenu du message</label>
              <textarea value={corps} onChange={e => setCorps(e.target.value)}
                placeholder={"Bonjour,\n\nNous avons de belles nouveautés cette semaine...\n\nÀ bientôt !"}
                rows={8}
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm resize-none" />
              <div className="text-xs text-gray-400 mt-1">
                💡 Un bouton &quot;Passer ma commande&quot; avec le lien personnel de chaque chef sera ajouté automatiquement.
              </div>
            </div>
          </div>

          {/* Sauvegarder comme modèle */}
          {(sujet || corps) && !tableMissing && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
              {!sauvegardeOuverte ? (
                <button onClick={() => setSauvegardeOuverte(true)}
                  className="text-xs text-gray-600 w-full text-center">
                  💾 Sauvegarder comme modèle réutilisable
                </button>
              ) : (
                <div className="space-y-2">
                  <input value={nomTemplate} onChange={e => setNomTemplate(e.target.value)}
                    placeholder="Nom du modèle (ex: Disponibilités semaine)"
                    className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => setSauvegardeOuverte(false)}
                      className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 text-xs">
                      Annuler
                    </button>
                    <button onClick={sauvegarderTemplate}
                      disabled={!nomTemplate.trim()}
                      className="flex-1 py-2 rounded-lg bg-green-700 text-white text-xs font-semibold disabled:opacity-40">
                      💾 Sauvegarder
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Résultat */}
          {resultat && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium
              ${resultat.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {resultat.ok
                ? `✅ ${resultat.envoyes} email${(resultat.envoyes || 0) > 1 ? 's' : ''} envoyé${(resultat.envoyes || 0) > 1 ? 's' : ''} sur ${resultat.total}`
                : `❌ Erreur : ${resultat.error}`}
            </div>
          )}

          {/* Bouton envoyer */}
          <button onClick={envoyer}
            disabled={envoi || !sujet.trim() || !corps.trim() || (!cibleTous && !destId)}
            className="w-full py-3.5 rounded-xl bg-green-700 text-white font-bold text-sm disabled:opacity-50 active:bg-green-800">
            {envoi ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Envoi en cours…
              </span>
            ) : (
              cibleTous
                ? `✉️ Envoyer à tous les chefs (${avecEmail.length})`
                : `✉️ Envoyer à ${avecEmail.find(c => c.id === destId)?.nom || 'ce chef'}`
            )}
          </button>
        </div>
      )}

      {/* ── Historique ── */}
      {mode === 'historique' && (
        <div className="space-y-2">
          {loadHist ? (
            <div className="flex justify-center py-8 text-gray-400 text-sm">Chargement…</div>
          ) : historique.length === 0 ? (
            <div className="text-center py-10 text-gray-400 space-y-2">
              <div className="text-4xl">📭</div>
              <div className="text-sm">Aucun message envoyé pour l&apos;instant</div>
            </div>
          ) : (
            historique.map(msg => {
              const d = new Date(msg.created_at)
              const dateStr = format(d, "d MMM yyyy 'à' HH:mm", { locale: fr })
              return (
                <div key={msg.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm text-gray-800 flex-1">{msg.sujet}</div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[msg.type]}`}>
                      {TYPE_LABEL[msg.type]}
                    </span>
                  </div>
                  {msg.corps && (
                    <div className="text-xs text-gray-500 line-clamp-2 whitespace-pre-line">{msg.corps}</div>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{dateStr}</span>
                    <span>{msg.destinataires_count} destinataire{msg.destinataires_count > 1 ? 's' : ''}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ─── Récapitulatif mensuel (brouillon pour JLogiciels) ────────

function FactureModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const now = new Date()
  const moisCourant = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [mois, setMois] = useState(moisCourant)
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState('')

  async function generer() {
    setLoading(true)
    setErreur('')
    try {
      const res = await fetch('/api/pdf/facture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id, mois }),
      })
      if (!res.ok) {
        const d = await res.json()
        setErreur(d.error || 'Erreur inconnue')
        setLoading(false)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const nom = client.nom.replace(/[^a-z0-9]/gi, '_')
      a.download = `Recap-${mois}-${nom}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch {
      setErreur('Erreur réseau')
    }
    setLoading(false)
  }

  const moisDispos = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    return { val, label }
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-4 pb-12 space-y-4"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">📑 Récapitulatif mensuel</h2>
        <p className="text-sm text-gray-600">
          Client : <strong>{client.nom}</strong>
        </p>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Mois à facturer</label>
          <select value={mois} onChange={e => setMois(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm bg-white">
            {moisDispos.map(m => (
              <option key={m.val} value={m.val}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-indigo-700 bg-indigo-50 rounded-xl p-3">
          📋 Tous les BL du mois regroupés avec sous-totaux HT/TVA/TTC.
          À utiliser comme brouillon pour saisir dans JLogiciels.
        </div>

        {erreur && (
          <div className="text-xs text-red-600 bg-red-50 rounded-xl p-3">❌ {erreur}</div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm">
            Annuler
          </button>
          <button onClick={generer} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Génération…
              </span>
            ) : '📥 Télécharger le récapitulatif'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Bouton "Tous les BLs en PDF" ────────────────────────────

function BLsClientButton({ client }: { client: Client }) {
  const [loading, setLoading] = useState(false)

  async function telecharger() {
    setLoading(true)
    try {
      const res = await fetch('/api/pdf/bls-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Aucun BL trouvé pour ce client')
        setLoading(false)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const nom = client.nom.replace(/[^a-z0-9]/gi, '_')
      a.download = `BLs-${nom}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Erreur réseau')
    }
    setLoading(false)
  }

  return (
    <button onClick={telecharger} disabled={loading}
      className="flex items-center justify-center gap-1.5 bg-green-50 text-green-700 border border-green-200 text-xs px-2 py-2.5 rounded-lg font-semibold disabled:opacity-50">
      {loading ? (
        <span className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      ) : '📚 Tous les BLs'}
    </button>
  )
}
