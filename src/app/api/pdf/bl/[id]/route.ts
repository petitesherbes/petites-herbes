import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import BLDocument from '@/lib/pdf/bl-document'
import { ParamsDocs, BLPDF } from '@/lib/pdf/types'

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
  mention_article_441: "Article D 441-5 du code de commerce : le montant de l'indemnité forfaitaire pour frais de recouvrement due au créancier en cas de retard de paiement est fixée à 40 €.",
  conditions_reglement: 'Comptant à réception de facture',
  delai_paiement_jours: 0,
  adresse_exploitation: '270 avenue du Caucadis',
  code_postal_exploitation: '83310',
  ville_exploitation: 'Grimaud',
  couleur_principale: '#1B5E20',
  prochain_numero_facture: 485,
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: blData }, { data: paramsData }] = await Promise.all([
    supabase
      .from('bons_livraison')
      .select('*, client:clients(*), bl_lignes(*)')
      .eq('id', id)
      .single(),
    supabase.from('parametres_documents').select('*').limit(1).single(),
  ])

  if (!blData) {
    return NextResponse.json({ error: 'BL introuvable' }, { status: 404 })
  }

  const params_docs: ParamsDocs = paramsData || PARAMS_FALLBACK

  const lignes = [...(blData.bl_lignes || [])].sort(
    (a: { ordre: number }, b: { ordre: number }) => a.ordre - b.ordre
  )

  const bl: BLPDF = {
    id: blData.id,
    numero: blData.numero,
    date_livraison: blData.date_livraison,
    client: blData.client as BLPDF['client'],
    lignes: lignes.map((l: { reference: string | null; designation: string; quantite: number; prix_ht: number; tva_pct: number }) => ({
      reference: l.reference,
      designation: l.designation,
      quantite: l.quantite,
      prix_ht: l.prix_ht,
      tva_pct: l.tva_pct,
    })),
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(React.createElement(BLDocument, { bl, params: params_docs }) as any)

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="BL-${bl.numero}.pdf"`,
      },
    })
  } catch (e) {
    console.error('PDF BL generation error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
