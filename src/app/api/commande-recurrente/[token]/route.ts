import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// GET  — charge la commande récurrente du client
// POST — sauvegarde (écrase) la commande récurrente
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: client } = await supabase
    .from('clients').select('id').eq('order_token', token).eq('actif', true).single()
  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const { data } = await supabase
    .from('commandes_recurrentes')
    .select('produit_id, designation, reference, quantite, prix_ht, tva_pct, ordre')
    .eq('client_id', client.id)
    .eq('actif', true)
    .order('ordre')

  return NextResponse.json({ lignes: data || [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const { lignes } = await req.json() as {
    lignes: Array<{
      produit_id: string; designation: string; reference: string | null
      quantite: number; prix_ht: number; tva_pct: number; ordre: number
    }>
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: client } = await supabase
    .from('clients').select('id').eq('order_token', token).eq('actif', true).single()
  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  // Supprimer l'ancien modèle puis réinsérer
  await supabase.from('commandes_recurrentes').delete().eq('client_id', client.id)

  if (lignes.length > 0) {
    await supabase.from('commandes_recurrentes').insert(
      lignes.map((l, i) => ({
        client_id:   client.id,
        produit_id:  l.produit_id,
        designation: l.designation,
        reference:   l.reference || null,
        quantite:    l.quantite,
        prix_ht:     l.prix_ht,
        tva_pct:     l.tva_pct,
        ordre:       i,
        updated_at:  new Date().toISOString(),
      }))
    )
  }

  return NextResponse.json({ ok: true, nb: lignes.length })
}
