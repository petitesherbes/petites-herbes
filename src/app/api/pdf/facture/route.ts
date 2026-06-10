import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import FactureDocument from '@/lib/pdf/facture-document'
import { ParamsDocs, ClientPDF, GroupeBLFacture } from '@/lib/pdf/types'

export const dynamic = 'force-dynamic'

const PARAMS_FALLBACK: ParamsDocs = {
  nom: 'GAEC Les Petites Herbes',
  adresse: '15 rue François Arago',
  code_postal: '83310',
  ville: 'Cogolin',
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
  logo_url: null,
  mention_reserve_propriete: "En application de la loi n° 80335 du 12 mai 1980 relative aux clauses de réserve de propriété dans les contrats de vente, les produits vendus restent notre propriété jusqu'à paiement complet de la facture.",
  mention_article_441: "Article D 441-5 du code de commerce : le montant de l'indemnité forfaitaire pour frais de recouvrement due au créancier en cas de retard de paiement est fixée à 40 €. Cette indemnité sera due de plein droit et sans formalités par le professionnel en situation de retard. Escompte pour paiement anticipé : néant.",
  conditions_reglement: 'Comptant à réception de facture',
  delai_paiement_jours: 0,
  prochain_numero_facture: 485,
}

// POST /api/pdf/facture
// body: { client_id: string, mois: string }  // mois = "2026-05"
export async function POST(req: NextRequest) {
  const { client_id, mois } = await req.json()

  if (!client_id || !mois) {
    return NextResponse.json({ error: 'client_id et mois requis' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Dates du mois
  const [annee, moisNum] = mois.split('-').map(Number)
  const debut = `${mois}-01`
  const fin = new Date(annee, moisNum, 0).toISOString().slice(0, 10) // dernier jour du mois

  const [{ data: clientData }, { data: blsData }, { data: paramsData }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', client_id).single(),
    supabase
      .from('bons_livraison')
      .select('*, bl_lignes(*)')
      .eq('client_id', client_id)
      .gte('date_livraison', debut)
      .lte('date_livraison', fin)
      .order('date_livraison', { ascending: true }),
    supabase.from('parametres_documents').select('*').limit(1).single(),
  ])

  if (!clientData) {
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  if (!blsData || blsData.length === 0) {
    return NextResponse.json({ error: 'Aucun BL ce mois-ci' }, { status: 404 })
  }

  const params_docs: ParamsDocs = paramsData || PARAMS_FALLBACK

  const client: ClientPDF = {
    nom: clientData.nom,
    adresse: clientData.adresse,
    code_postal: clientData.code_postal,
    ville: clientData.ville,
    pays: clientData.pays || 'FRANCE',
    email: clientData.email,
    siret: clientData.siret,
    tva_intra: clientData.tva_intra,
  }

  const groupes: GroupeBLFacture[] = blsData.map((bl: {
    numero: string
    date_livraison: string
    bl_lignes: Array<{ reference: string | null; designation: string; quantite: number; prix_ht: number; tva_pct: number; ordre: number }>
  }) => ({
    numero: bl.numero,
    date: bl.date_livraison,
    lignes: [...(bl.bl_lignes || [])]
      .sort((a, b) => a.ordre - b.ordre)
      .map(l => ({
        reference: l.reference,
        designation: l.designation,
        quantite: l.quantite,
        prix_ht: l.prix_ht,
        tva_pct: l.tva_pct,
      })),
  }))

  // Numéro de facture + incrément
  const numeroFacture = String(params_docs.prochain_numero_facture).padStart(7, '0')
  const dateFacture = fin // dernier jour du mois

  // Incrémenter le compteur si la table existe
  if (paramsData) {
    await supabase
      .from('parametres_documents')
      .update({ prochain_numero_facture: params_docs.prochain_numero_facture + 1 })
      .eq('id', paramsData.id)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    React.createElement(FactureDocument, {
      numero: numeroFacture,
      date: dateFacture,
      client,
      groupes,
      params: params_docs,
    }) as any
  )

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Facture-${numeroFacture}-${clientData.nom.replace(/[^a-z0-9]/gi, '_')}.pdf"`,
    },
  })
}
