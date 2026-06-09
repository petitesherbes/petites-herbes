import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !client) {
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  if (!client.email) {
    return NextResponse.json({ error: 'Ce client n\'a pas d\'email' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://petites-herbes.vercel.app'
  const lien = `${baseUrl}/commander/${client.order_token}`

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);padding:36px 32px;text-align:center;color:white;">
    <div style="font-size:40px;margin-bottom:8px;">🌿</div>
    <div style="font-size:22px;font-weight:bold;letter-spacing:-0.5px;">GAEC Les Petites Herbes</div>
    <div style="font-size:13px;opacity:0.75;margin-top:4px;">Micro-pousses · Herbes aromatiques · Fleurs comestibles</div>
  </div>

  <!-- Corps -->
  <div style="padding:32px;">
    <h1 style="font-size:20px;color:#1B5E20;margin:0 0 8px 0;">Bonjour ${client.nom} 👋</h1>
    <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
      Nous avons créé votre <strong>espace de commande personnel</strong> sur notre boutique en ligne.<br>
      Depuis votre téléphone ou ordinateur, passez vos commandes directement — simple et rapide.
    </p>

    <!-- CTA Button -->
    <div style="text-align:center;margin:28px 0;">
      <a href="${lien}"
        style="display:inline-block;background:#1B5E20;color:white;padding:16px 32px;border-radius:12px;font-size:16px;font-weight:bold;text-decoration:none;letter-spacing:0.2px;">
        🛒 Accéder à ma boutique
      </a>
    </div>

    <!-- Lien texte -->
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin:0 0 24px 0;">
      <div style="font-size:11px;color:#9ca3af;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Votre lien personnel</div>
      <div style="font-size:13px;color:#374151;font-family:monospace;word-break:break-all;">${lien}</div>
    </div>

    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
      💡 <strong>Ce lien vous est personnel</strong> — gardez-le précieusement.<br>
      Vous pouvez le mettre en favoris sur votre téléphone pour un accès rapide.
    </p>
  </div>

  <!-- Footer -->
  <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #f0f0f0;text-align:center;">
    <div style="font-size:13px;color:#374151;font-weight:600;">GAEC Les Petites Herbes</div>
    <div style="font-size:11px;color:#9ca3af;margin-top:4px;">
      15 rue François Arago · 83310 Cogolin<br>
      06 09 93 75 89 · petitesherbes@gmail.com
    </div>
    <div style="font-size:10px;color:#d1d5db;margin-top:8px;">SIRET 983 294 703 00019 · Certifié FR-BIO-01</div>
  </div>
</div>
</body>
</html>`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'GAEC Les Petites Herbes <onboarding@resend.dev>',
      to: [client.email],
      subject: '🌿 Votre boutique en ligne — GAEC Les Petites Herbes',
      html,
    })

    // Sauvegarder dans l'historique
    await supabase.from('messages_envoyes').insert({
      type: 'invitation',
      sujet: 'Invitation boutique en ligne',
      corps: `Lien envoyé à ${client.nom} (${client.email})`,
      destinataires_count: 1,
      destinataire_id: client.id,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Invitation error:', e)
    return NextResponse.json({ error: 'Echec envoi email' }, { status: 500 })
  }
}
