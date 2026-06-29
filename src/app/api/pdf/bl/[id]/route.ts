import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import BLDocument from '@/lib/pdf/bl-document'
import { ParamsDocs, BLPDF } from '@/lib/pdf/types'
import { PARAMS_FALLBACK } from '@/lib/pdf/params-fallback'

export const dynamic = 'force-dynamic'

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
