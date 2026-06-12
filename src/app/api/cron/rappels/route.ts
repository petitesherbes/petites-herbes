import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { envoyerRappelsEmail, JOURS_LIVRAISON, JOUR_INDEX } from '@/lib/rappels'

export const dynamic = 'force-dynamic'

// GET /api/cron/rappels — appelé chaque jour par Vercel Cron (voir vercel.json).
// Détermine si aujourd'hui est à N jours d'un créneau de livraison
// (N = rappel_jours_avant, défaut 2) et envoie les rappels correspondants.
// Dédupliqué via la table rappels_envoyes (un envoi max par jour et par créneau).
export async function GET(req: NextRequest) {
  // Vercel envoie automatiquement "Authorization: Bearer ${CRON_SECRET}"
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: params } = await supabase
    .from('parametres_production')
    .select('rappel_jours_avant')
    .limit(1)
    .single()
  const joursAvant = params?.rappel_jours_avant ?? 2

  // Date du jour en heure de Paris (le cron tourne en UTC)
  const maintenant = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' })
  )
  const todayDow = maintenant.getDay()
  const todayStr = maintenant.toISOString().slice(0, 10)

  const resultats: Record<string, unknown> = {}

  for (const jour of JOURS_LIVRAISON) {
    const ecart = (JOUR_INDEX[jour] - todayDow + 7) % 7
    if (ecart !== joursAvant) continue

    // Déjà envoyé aujourd'hui pour ce créneau ?
    const { data: deja } = await supabase
      .from('rappels_envoyes')
      .select('id')
      .eq('jour_livraison', jour)
      .eq('date_envoi', todayStr)
      .limit(1)
    if (deja && deja.length > 0) {
      resultats[jour] = 'déjà envoyé aujourd\'hui'
      continue
    }

    resultats[jour] = await envoyerRappelsEmail(jour)
  }

  if (Object.keys(resultats).length === 0) {
    return NextResponse.json({ ok: true, message: `Aucun créneau à J−${joursAvant} aujourd'hui` })
  }
  return NextResponse.json({ ok: true, resultats })
}
