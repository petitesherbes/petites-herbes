import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import BLsClientDocument from '@/lib/pdf/bls-client-document'
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
  mention_reserve_propriete: '',
  mention_article_441: '',
  conditions_reglement: 'Comptant à réception de facture',
  delai_paiement_jours: 0,
  adresse_exploitation: '270 avenue du Caucadis',
  code_postal_exploitation: '83310',
  ville_exploitation: 'Grimaud',
  couleur_principale: '#1B5E20',
  prochain_numero_facture: 485,
}

// POST /api/pdf/bls-client
// body: { client_id: string, debut?: string, fin?: string }
export async function POST(req: NextRequest) {
  const { client_id, debut, fin } = await req.json()

  if (!client_id) {
    return NextResponse.json({ error: 'client_id requis' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = supabase
    .from('bons_livraison')
    .select('*, client:clients(*), bl_lignes(*)')
    .eq('client_id', client_id)
    .order('date_livraison', { ascending: true })

  if (debut) query = query.gte('date_livraison', debut)
  if (fin)   query = query.lte('date_livraison', fin)

  const [{ data: blsData }, { data: paramsData }] = await Promise.all([
    query,
    supabase.from('parametres_documents').select('*').limit(1).single(),
  ])

  if (!blsData || blsData.length === 0) {
    return NextResponse.json({ error: 'Aucun BL trouvé pour ce client' }, { status: 404 })
  }

  const params_docs: ParamsDocs = paramsData || PARAMS_FALLBACK

  type BLRow = {
    id: string
    numero: string
    date_livraison: string
    client: BLPDF['client']
    bl_lignes: Array<{
      reference: string | null
      designation: string
      quantite: number
      prix_ht: number
      tva_pct: number
      ordre: number
    }>
  }

  const bls: BLPDF[] = (blsData as unknown as BLRow[]).map(bl => ({
    id: bl.id,
    numero: bl.numero,
    date_livraison: bl.date_livraison,
    client: bl.client,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    React.createElement(BLsClientDocument, { bls, params: params_docs }) as any
  )

  const nomClient = bls[0].client.nom.replace(/[^a-z0-9]/gi, '_')

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="BLs-${nomClient}.pdf"`,
    },
  })
}
