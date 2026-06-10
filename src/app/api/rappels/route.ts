import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const JOURS_FR: Record<string, string> = {
  mardi:    'mardi',
  jeudi:    'jeudi',
  vendredi: 'vendredi',
}

// POST /api/rappels
// body: { jour: 'mardi'|'jeudi'|'vendredi', message?: string }
// Envoie le lien de commande à tous les clients assignés à ce créneau
export async function POST(req: NextRequest) {
  const { jour, message } = await req.json() as { jour: string; message?: string }

  if (!jour || !JOURS_FR[jour]) {
    return NextResponse.json({ error: 'jour invalide (mardi | jeudi | vendredi)' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Récupérer tous les clients actifs de ce créneau avec un email
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, nom, email, order_token')
    .eq('actif', true)
    .contains('jours_livraison', [jour])
    .not('email', 'is', null)
    .not('order_token', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({ error: 'Aucun client avec email pour ce créneau' }, { status: 404 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://petites-herbes.vercel.app'
  const jourLabel = jour.charAt(0).toUpperCase() + jour.slice(1)

  // Paramètres GAEC pour personnaliser
  const { data: paramsData } = await supabase
    .from('parametres_documents')
    .select('nom, telephone, email, adresse, code_postal, ville, certification_bio')
    .limit(1)
    .single()

  const gaec = {
    nom: paramsData?.nom || 'GAEC Les Petites Herbes',
    telephone: paramsData?.telephone || '06 09 93 75 89',
    email: paramsData?.email || 'petitesherbes@gmail.com',
    adresse: paramsData?.adresse || '15 rue François Arago',
    cp_ville: `${paramsData?.code_postal || '83310'} ${paramsData?.ville || 'Cogolin'}`,
    bio: paramsData?.certification_bio || 'FR-BIO-01',
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const errors: string[] = []
  let nbOk = 0

  for (const client of clients) {
    const lien = `${baseUrl}/commander/${client.order_token}`

    const msgPersonnalise = message
      ? `<div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 20px 0;font-size:14px;color:#166534;line-height:1.6;">
          ${message.replace(/\n/g, '<br>')}
        </div>`
      : ''

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

  <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);padding:32px;text-align:center;color:white;">
    <div style="font-size:36px;margin-bottom:6px;">🌿</div>
    <div style="font-size:20px;font-weight:bold;">${gaec.nom}</div>
    <div style="font-size:12px;opacity:0.75;margin-top:4px;">Micro-pousses · Herbes aromatiques · Fleurs comestibles</div>
  </div>

  <div style="padding:28px 32px;">
    <h2 style="font-size:18px;color:#1B5E20;margin:0 0 6px 0;">Bonjour ${client.nom} 👋</h2>
    <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 20px 0;">
      Votre livraison du <strong>${jourLabel}</strong> approche — n&apos;oubliez pas de passer votre commande !
    </p>

    ${msgPersonnalise}

    <div style="text-align:center;margin:24px 0;">
      <a href="${lien}"
        style="display:inline-block;background:#1B5E20;color:white;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:bold;text-decoration:none;">
        🛒 Commander maintenant
      </a>
    </div>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin:0 0 20px 0;">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;">Votre lien personnel</div>
      <div style="font-size:12px;color:#374151;font-family:monospace;word-break:break-all;">${lien}</div>
    </div>

    <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;">
      💡 Ce lien vous est personnel — mettez-le en favori pour un accès rapide.
    </p>
  </div>

  <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f0f0f0;text-align:center;">
    <div style="font-size:12px;color:#374151;font-weight:600;">${gaec.nom}</div>
    <div style="font-size:11px;color:#9ca3af;margin-top:3px;">
      ${gaec.adresse} · ${gaec.cp_ville}<br>
      ${gaec.telephone} · ${gaec.email}
    </div>
    ${gaec.bio ? `<div style="font-size:10px;color:#d1d5db;margin-top:6px;">Certifié ${gaec.bio}</div>` : ''}
  </div>
</div>
</body>
</html>`

    try {
      await resend.emails.send({
        from: `${gaec.nom} <onboarding@resend.dev>`,
        to: [client.email!],
        subject: `🌿 Rappel commande ${jourLabel} — ${gaec.nom}`,
        html,
      })
      nbOk++
    } catch (e) {
      errors.push(`${client.nom}: ${e}`)
    }
  }

  // Historique (non bloquant, ignorer les erreurs si table absente)
  void supabase.from('rappels_envoyes').insert({
    jour_livraison: jour,
    nb_envoyes: nbOk,
  })

  return NextResponse.json({
    ok: true,
    envoyes: nbOk,
    total: clients.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}

// GET /api/rappels?jour=mardi
// Retourne la liste des clients du créneau (pour aperçu avant envoi)
export async function GET(req: NextRequest) {
  const jour = req.nextUrl.searchParams.get('jour')

  if (!jour || !JOURS_FR[jour]) {
    return NextResponse.json({ error: 'jour invalide' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('clients')
    .select('id, nom, email, order_token, jours_livraison')
    .eq('actif', true)
    .contains('jours_livraison', [jour])
    .order('nom')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ clients: data || [] })
}
