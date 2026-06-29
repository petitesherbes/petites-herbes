import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import FactureDocument from '@/lib/pdf/facture-document'
import { ParamsDocs, ClientPDF, GroupeBLFacture } from '@/lib/pdf/types'
import { PARAMS_FALLBACK } from '@/lib/pdf/params-fallback'

export const dynamic = 'force-dynamic'

// POST /api/pdf/facture
// body: { client_id: string, mois: string }  // mois = "2026-05"
export async function POST(req: NextRequest) {
  const { client_id, mois } = await req.json()

  if (!client_id || !mois) {
    return NextResponse.json({ error: 'client_id et mois requis' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}$/.test(mois)) {
    return NextResponse.json({ error: 'mois invalide, format attendu : YYYY-MM' }, { status: 400 })
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

  const numeroFacture = String(params_docs.prochain_numero_facture).padStart(7, '0')
  const dateFacture = fin // dernier jour du mois

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

  // Incrémenter le compteur seulement si le PDF a été généré avec succès
  if (paramsData) {
    await supabase
      .from('parametres_documents')
      .update({ prochain_numero_facture: params_docs.prochain_numero_facture + 1 })
      .eq('id', paramsData.id)
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Recap-${mois}-${clientData.nom.replace(/[^a-z0-9]/gi, '_')}.pdf"`,
    },
  })
}
