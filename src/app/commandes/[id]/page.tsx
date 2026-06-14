'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BonLivraison, BLStatut } from '@/types'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATUT_NEXT: Record<BLStatut, BLStatut | null> = {
  brouillon: 'envoye',
  envoye:    'livre',
  livre:     'facture',
  facture:   null,
}
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

type BLComplet = BonLivraison & {
  client: { nom: string; adresse: string | null; code_postal: string | null; ville: string | null; pays: string; email: string | null; siret: string | null; tva_intra: string | null } | null
  bl_lignes: Array<{ id: string; designation: string; reference: string | null; quantite: number; prix_ht: number; tva_pct: number; ordre: number }>
}

export default function BLDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [bl, setBl] = useState<BLComplet | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [dupliquerDate, setDupliquerDate] = useState('')
  const [dupliquerOpen, setDupliquerOpen] = useState(false)
  const [dupliquerSaving, setDupliquerSaving] = useState(false)

  useEffect(() => { charger() }, [id])

  async function charger() {
    const { data } = await supabase
      .from('bons_livraison')
      .select('*, client:clients(*), bl_lignes(*)')
      .eq('id', id)
      .single()
    if (data) {
      const d = data as unknown as BLComplet
      if (d.bl_lignes) {
        d.bl_lignes = [...d.bl_lignes].sort((a, b) => a.ordre - b.ordre)
      }
      setBl(d)
    }
    setLoading(false)
  }

  async function changerStatut(statut: BLStatut) {
    await supabase.from('bons_livraison').update({ statut }).eq('id', id)
    charger()
  }

  async function envoyerEmail() {
    if (!bl?.client?.email) return
    setSending(true)
    const res = await fetch(`/api/commandes/${id}/email`, { method: 'POST' })
    setSending(false)
    if (res.ok) {
      await changerStatut('envoye')
      alert(`BL envoye a ${bl.client.email}`)
    } else {
      alert('Erreur envoi email — verifiez la configuration Resend')
    }
  }

  async function supprimer() {
    if (!confirm('Supprimer ce BL ?')) return
    await supabase.from('bons_livraison').delete().eq('id', id)
    router.push('/commandes')
  }

  async function dupliquer() {
    if (!bl || !dupliquerDate) return
    setDupliquerSaving(true)
    const { data: params } = await supabase.from('parametres_production').select('id, prochain_numero_bl').single()
    const numero = String(params?.prochain_numero_bl || 1777).padStart(7, '0')
    const { data: newBl, error } = await supabase.from('bons_livraison').insert({
      numero,
      client_id: bl.client_id,
      date_livraison: dupliquerDate,
      statut: 'brouillon',
    }).select().single()
    if (!error && newBl) {
      await supabase.from('bl_lignes').insert(
        bl.bl_lignes.map((l, i) => ({
          bl_id: newBl.id,
          produit_id: null,
          designation: l.designation,
          reference: l.reference,
          quantite: l.quantite,
          prix_ht: l.prix_ht,
          tva_pct: l.tva_pct,
          ordre: i,
        }))
      )
      if (params) {
        await supabase.from('parametres_production')
          .update({ prochain_numero_bl: (params.prochain_numero_bl || 1777) + 1 })
          .eq('id', params.id)
      }
      router.push(`/commandes/${newBl.id}`)
    }
    setDupliquerSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>
  if (!bl) return <div className="p-4 text-gray-500">BL introuvable</div>

  const totalHT  = bl.bl_lignes.reduce((s, l) => s + l.prix_ht * l.quantite, 0)
  const totalTTC = bl.bl_lignes.reduce((s, l) => s + l.prix_ht * l.quantite * (1 + l.tva_pct / 100), 0)
  const prochainStatut = STATUT_NEXT[bl.statut]

  return (
    <>
      {/* ── CSS impression ── */}
      <style jsx global>{`
        @media print {
          nav, .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { padding: 0; margin: 0; }
          .bl-print { padding: 20mm; font-family: Arial, sans-serif; font-size: 10pt; }
        }
        .print-only { display: none; }
      `}</style>

      {/* ── Actions (masquees a l'impression) ── */}
      <div className="no-print p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/commandes')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">←</button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-green-900">BL {bl.numero}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLOR[bl.statut]}`}>
                {STATUT_LABEL[bl.statut]}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              {bl.client?.nom} · {format(parseISO(bl.date_livraison), 'dd MMMM yyyy', { locale: fr })}
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={envoyerEmail} disabled={sending || !bl.client?.email}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40">
            {sending ? 'Envoi...' : '✉️ Email'}
          </button>
          <a href={`/api/pdf/bl/${id}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-700 text-white text-sm font-semibold text-center">
            📄 Télécharger PDF
          </a>
        </div>
        <button onClick={() => window.print()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">
          🖨️ Imprimer
        </button>

        {prochainStatut && (
          <button onClick={() => changerStatut(prochainStatut)}
            className="w-full py-3 rounded-xl border-2 border-green-600 text-green-700 text-sm font-semibold">
            Marquer comme : {STATUT_LABEL[prochainStatut]}
          </button>
        )}
      </div>

      {/* ── BL visuel (visible app + impression) ── */}
      <div className="bl-print mx-4 mb-4 bg-white rounded-xl border border-gray-200 overflow-hidden print:rounded-none print:border-none print:mx-0">

        {/* En-tete GAEC */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold text-lg text-green-900">GAEC Les Petites Herbes</div>
              <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                <div>15 rue Francois Arago</div>
                <div>83310 Cogolin</div>
                <div>Tel : 06 09 93 75 89 / 07 71 63 16 53</div>
                <div>Email : petitesherbes@gmail.com</div>
              </div>
              <div className="text-xs text-gray-400 mt-1 italic">
                Producteur de micro pousses, plantes aromatiques et medicinales
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-sm text-gray-500 uppercase tracking-wide">
                Bon de livraison
              </div>
              <div className="font-bold text-xl text-green-900 mt-1">N° {bl.numero}</div>
              <div className="text-sm text-gray-600 mt-0.5">
                Le : {format(parseISO(bl.date_livraison), 'dd/MM/yy')}
              </div>
            </div>
          </div>
        </div>

        {/* Adresse client */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="font-bold text-sm text-gray-700">{bl.client?.nom}</div>
          {bl.client?.adresse && <div className="text-sm text-gray-600">{bl.client.adresse}</div>}
          <div className="text-sm text-gray-600">
            {bl.client?.code_postal} {bl.client?.ville} {bl.client?.pays && bl.client.pays !== 'FRANCE' ? bl.client.pays : ''}
          </div>
          {bl.client?.tva_intra && <div className="text-xs text-gray-400 mt-1">{bl.client.tva_intra}</div>}
        </div>

        {/* Adresse livraison */}
        <div className="px-6 py-2 text-xs text-gray-500 border-b border-gray-100">
          Adresse de livraison : {bl.client?.nom} {bl.client?.adresse} {bl.client?.code_postal} {bl.client?.ville}
        </div>

        {/* Tableau lignes */}
        <div className="px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="text-left py-1.5 font-bold w-20">Ref.</th>
                <th className="text-left py-1.5 font-bold">Designation</th>
                <th className="text-right py-1.5 font-bold w-16">Qte</th>
              </tr>
            </thead>
            <tbody>
              {bl.bl_lignes.map((l, i) => (
                <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="py-1.5 text-gray-500 text-xs">{l.reference || ''}</td>
                  <td className="py-1.5">{l.designation}</td>
                  <td className="py-1.5 text-right font-semibold">{l.quantite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totaux (si prix renseignes) */}
        {totalHT > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total HT</span>
              <span>{totalHT.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total TTC (TVA 5,5%)</span>
              <span>{totalTTC.toFixed(2)} €</span>
            </div>
          </div>
        )}

        {/* Pied de page legal */}
        <div className="px-6 py-4 border-t border-gray-200 text-xs text-gray-400 space-y-1">
          <div>GAEC Les Petites Herbes - 15 rue Francois Arago - 83310 COGOLIN.</div>
          <div>Au capital de 2000€ - RCS FREJUS N°SIRET : 983 294 703 00019 - TVA Intra. : FR 49 983 294 703 - APE/NAF : 7010Z.</div>
          <div>* Certifie par FR-BIO-01</div>
        </div>
      </div>

      {/* ── Actions secondaires ── */}
      <div className="no-print px-4 pb-24 space-y-2">
        <button onClick={() => { setDupliquerDate(format(new Date(), 'yyyy-MM-dd')); setDupliquerOpen(true) }}
          className="w-full py-3 rounded-xl border-2 border-green-200 text-green-700 text-sm font-semibold bg-green-50">
          🔁 Dupliquer ce BL (nouvelle date)
        </button>
        <button onClick={supprimer}
          className="w-full py-3 rounded-xl border border-red-200 text-red-400 text-sm">
          Supprimer ce BL
        </button>
      </div>

      {/* ── Modal dupliquer ── */}
      {dupliquerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setDupliquerOpen(false)}>
          <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl p-5 space-y-4 pb-10"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">🔁 Dupliquer le BL</h2>
              <button onClick={() => setDupliquerOpen(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-600">
              Un nouveau BL sera créé pour <strong>{bl?.client?.nom}</strong> avec les mêmes lignes.
            </p>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Date de livraison</label>
              <input type="date" value={dupliquerDate} onChange={e => setDupliquerDate(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl p-3 text-base focus:border-green-500 focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDupliquerOpen(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm">
                Annuler
              </button>
              <button onClick={dupliquer} disabled={!dupliquerDate || dupliquerSaving}
                className="flex-1 py-3 rounded-xl bg-green-700 text-white font-semibold text-sm disabled:opacity-50">
                {dupliquerSaving ? 'Création...' : 'Créer le BL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
