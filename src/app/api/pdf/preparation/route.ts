import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import PreparationDocument, { ClientPrepa } from '@/lib/pdf/preparation-document'

export const dynamic = 'force-dynamic'

// POST /api/pdf/preparation
// body: { date: "2026-06-13" }
// Retourne PDF de toutes les commandes pour cette date
export async function POST(req: NextRequest) {
  const { date } = await req.json()

  if (!date) {
    return NextResponse.json({ error: 'date requise (format YYYY-MM-DD)' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: blsData, error } = await supabase
    .from('bons_livraison')
    .select('*, client:clients(nom), bl_lignes(*)')
    .eq('date_livraison', date)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!blsData || blsData.length === 0) {
    return NextResponse.json({ error: 'Aucune commande pour cette date' }, { status: 404 })
  }

  // Paramètres GAEC (optionnel, juste pour le nom)
  const { data: paramsData } = await supabase
    .from('parametres_documents')
    .select('nom')
    .limit(1)
    .single()

  type BLRow = {
    note: string | null
    client: { nom: string } | null
    bl_lignes: Array<{
      reference: string | null
      designation: string
      quantite: number
      prix_ht: number
      ordre: number
    }>
  }

  const clients: ClientPrepa[] = (blsData as unknown as BLRow[])
    .filter(bl => bl.client)
    .map(bl => ({
      nom: bl.client!.nom,
      note: bl.note,
      lignes: [...(bl.bl_lignes || [])]
        .sort((a, b) => a.ordre - b.ordre)
        .filter(l => l.prix_ht >= 0) // exclure rien, livraison incluse
        .map(l => ({
          reference: l.reference,
          designation: l.designation,
          quantite: l.quantite,
        })),
    }))
    .filter(c => c.lignes.length > 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    React.createElement(PreparationDocument, {
      date,
      clients,
      nomGaec: paramsData?.nom || 'GAEC Les Petites Herbes',
    }) as any
  )

  const dateStr = date.replace(/-/g, '')

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Preparation-${dateStr}.pdf"`,
    },
  })
}
