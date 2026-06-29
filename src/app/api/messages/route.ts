import { NextRequest, NextResponse } from 'next/server'
import { EMAIL_FROM, escapeHtml } from '@/lib/email'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { sujet, corps, destinataire_id } = await req.json()

  if (!sujet || !corps) {
    return NextResponse.json({ error: 'Sujet et corps requis' }, { status: 400 })
  }

  const sujetEsc = escapeHtml(sujet)
  const corpsEsc = escapeHtml(corps)

  // Charger les destinataires
  let query = supabase.from('clients').select('id, nom, email, order_token').eq('actif', true)
  if (destinataire_id) {
    query = query.eq('id', destinataire_id)
  }
  const { data: clients } = await query

  const avecEmail = (clients || []).filter(c => c.email)

  if (avecEmail.length === 0) {
    return NextResponse.json({ error: 'Aucun destinataire avec email' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://petites-herbes.vercel.app'
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Envois en parallèle (Promise.allSettled = continue même si l'un échoue)
  const resultats = await Promise.allSettled(avecEmail.map(client => {
    const lien = `${baseUrl}/commander/${client.order_token}`
    const nomEsc = escapeHtml(client.nom)

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);padding:28px 32px;color:white;">
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:24px;">🌿</span>
      <div>
        <div style="font-size:17px;font-weight:bold;">GAEC Les Petites Herbes</div>
        <div style="font-size:12px;opacity:0.7;">Message pour vous</div>
      </div>
    </div>
    <h1 style="font-size:20px;font-weight:bold;margin:16px 0 0 0;">${sujetEsc}</h1>
  </div>

  <!-- Corps -->
  <div style="padding:28px 32px;">
    <p style="color:#555;font-size:14px;line-height:1.7;white-space:pre-line;margin:0 0 24px 0;">Bonjour ${nomEsc},\n\n${corpsEsc}</p>

    <!-- CTA -->
    <div style="text-align:center;margin:24px 0;">
      <a href="${lien}"
        style="display:inline-block;background:#1B5E20;color:white;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:bold;text-decoration:none;">
        🛒 Passer ma commande
      </a>
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f0f0f0;text-align:center;">
    <div style="font-size:11px;color:#9ca3af;">
      GAEC Les Petites Herbes · 15 rue François Arago · 83310 Cogolin<br>
      06 09 93 75 89 · petitesherbes@gmail.com · SIRET 983 294 703 00019
    </div>
  </div>
</div>
</body>
</html>`

    return resend.emails.send({ from: EMAIL_FROM, to: [client.email!], subject: sujet, html })
  }))

  const envoyes = resultats.filter(r => r.status === 'fulfilled').length
  resultats.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`Erreur envoi à ${avecEmail[i].email}:`, r.reason)
  })

  // Historique
  await supabase.from('messages_envoyes').insert({
    type: destinataire_id ? 'individuel' : 'diffusion',
    sujet,
    corps,
    destinataires_count: envoyes,
    destinataire_id: destinataire_id || null,
  })

  return NextResponse.json({ ok: true, envoyes, total: avecEmail.length })
}
