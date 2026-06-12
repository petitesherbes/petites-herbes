import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { envoyerRappelsEmail, JOURS_LIVRAISON, JourRappel } from '@/lib/rappels'

export const dynamic = 'force-dynamic'

// POST /api/rappels — envoi manuel depuis le modal
// body: { jour: 'mardi'|'jeudi'|'vendredi', message?: string }
export async function POST(req: NextRequest) {
  const { jour, message } = await req.json() as { jour: string; message?: string }

  const result = await envoyerRappelsEmail(jour, message)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.envoyes === 0 && result.total === 0 ? 400 : 500 })
  }
  return NextResponse.json(result)
}

// GET /api/rappels?jour=mardi — données pour le modal (clients + produits dispo)
export async function GET(req: NextRequest) {
  const jour = req.nextUrl.searchParams.get('jour')
  if (!jour || !JOURS_LIVRAISON.includes(jour as JourRappel)) {
    return NextResponse.json({ error: 'jour invalide' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: clients, error }, { data: produits }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, nom, email, telephone, order_token, jours_livraison')
      .eq('actif', true)
      .contains('jours_livraison', [jour])
      .order('nom'),
    supabase
      .from('produits')
      .select('designation, categorie, bio, quantite_dispo')
      .eq('actif', true)
      .eq('disponible', true)
      .neq('categorie', 'LIVRAISON')
      .order('categorie,designation'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ clients: clients || [], produits: produits || [] })
}
