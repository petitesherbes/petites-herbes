import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Charger le BL complet
  const { data: bl, error } = await supabase
    .from('bons_livraison')
    .select('*, client:clients(*), bl_lignes(*)')
    .eq('id', params.id)
    .single()

  if (error || !bl) {
    return NextResponse.json({ error: 'BL introuvable' }, { status: 404 })
  }

  const client = bl.client as { nom: string; email: string | null; adresse: string | null; code_postal: string | null; ville: string | null }
  if (!client?.email) {
    return NextResponse.json({ error: 'Pas d\'email client' }, { status: 400 })
  }

  const lignes = [...(bl.bl_lignes || [])].sort((a: { ordre: number }, b: { ordre: number }) => a.ordre - b.ordre)
  const dateFormatee = format(parseISO(bl.date_livraison), 'dd MMMM yyyy', { locale: fr })
  const totalHT  = lignes.reduce((s: number, l: { prix_ht: number; quantite: number }) => s + l.prix_ht * l.quantite, 0)
  const totalTTC = lignes.reduce((s: number, l: { prix_ht: number; quantite: number; tva_pct: number }) => s + l.prix_ht * l.quantite * (1 + l.tva_pct / 100), 0)

  const lignesHTML = lignes.map((l: { reference: string | null; designation: string; quantite: number }) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;color:#888;font-size:12px;">${l.reference || ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${l.designation}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;">${l.quantite}</td>
    </tr>
  `).join('')

  const totauxHTML = totalHT > 0 ? `
    <tr>
      <td colspan="2" style="padding:8px;text-align:right;color:#666;">Total HT :</td>
      <td style="padding:8px;text-align:right;">${totalHT.toFixed(2)} €</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:8px;text-align:right;font-weight:bold;">Total TTC :</td>
      <td style="padding:8px;text-align:right;font-weight:bold;color:#1B5E20;">${totalTTC.toFixed(2)} €</td>
    </tr>
  ` : ''

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

  <!-- En-tete vert -->
  <div style="background:#1B5E20;padding:24px 32px;color:white;">
    <div style="font-size:20px;font-weight:bold;">GAEC Les Petites Herbes</div>
    <div style="font-size:13px;opacity:0.8;margin-top:4px;">15 rue François Arago · 83310 Cogolin</div>
    <div style="font-size:13px;opacity:0.8;">06 09 93 75 89 · petitesherbes@gmail.com</div>
    <div style="font-size:11px;opacity:0.6;margin-top:4px;font-style:italic;">
      Producteur de micro pousses, plantes aromatiques et médicinales
    </div>
  </div>

  <!-- Info BL -->
  <div style="padding:20px 32px;border-bottom:2px solid #e8f5e9;">
    <table width="100%">
      <tr>
        <td>
          <div style="font-weight:bold;font-size:14px;color:#333;">${client.nom}</div>
          ${client.adresse ? `<div style="font-size:13px;color:#666;">${client.adresse}</div>` : ''}
          <div style="font-size:13px;color:#666;">${client.code_postal || ''} ${client.ville || ''}</div>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Bon de livraison</div>
          <div style="font-size:22px;font-weight:bold;color:#1B5E20;">N° ${bl.numero}</div>
          <div style="font-size:13px;color:#666;">Le ${dateFormatee}</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Tableau produits -->
  <div style="padding:20px 32px;">
    <table width="100%" style="border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid #1B5E20;">
          <th style="padding:8px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;">Ref.</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;">Designation</th>
          <th style="padding:8px;text-align:right;font-size:11px;color:#666;text-transform:uppercase;">Qte</th>
        </tr>
      </thead>
      <tbody>
        ${lignesHTML}
        ${totauxHTML}
      </tbody>
    </table>
  </div>

  <!-- Pied -->
  <div style="padding:16px 32px;background:#f9f9f9;border-top:1px solid #eee;">
    <div style="font-size:10px;color:#aaa;line-height:1.6;">
      GAEC Les Petites Herbes · 15 rue François Arago · 83310 COGOLIN<br>
      Au capital de 2000€ · SIRET : 983 294 703 00019 · TVA Intra. : FR 49 983 294 703<br>
      * Certifié par FR-BIO-01
    </div>
  </div>

</div>
</body>
</html>`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'GAEC Les Petites Herbes <onboarding@resend.dev>',
      to: [client.email],
      cc: [process.env.EMAIL_DESTINATION || 'petitesherbes@gmail.com'],
      subject: `Bon de livraison N° ${bl.numero} — ${dateFormatee}`,
      html,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Resend error:', e)
    return NextResponse.json({ error: 'Echec envoi email' }, { status: 500 })
  }
}
