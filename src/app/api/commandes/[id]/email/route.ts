import { NextRequest, NextResponse } from 'next/server'
import { EMAIL_FROM } from '@/lib/email'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import BLDocument from '@/lib/pdf/bl-document'
import { ParamsDocs, BLPDF } from '@/lib/pdf/types'

const PARAMS_FALLBACK: ParamsDocs = {
  nom: 'GAEC Les Petites Herbes',
  adresse: '15 rue François Arago',
  code_postal: '83310',
  ville: 'Cogolin',
  telephone: '06 09 93 75 89 / 07 71 63 16 53',
  email: 'petitesherbes@gmail.com',
  activite: 'Producteur de micro pousses, plantes aromatiques et médicinales',
  siret: '983 294 703 00019',
  rcs: 'FREJUS',
  capital: '2000',
  tva_intra: 'FR 49 983 294 703',
  ape_naf: '7010Z',
  certification_bio: 'FR-BIO-01',
  iban: 'FR76 1027 8091 1400 0203 1770 467',
  bic: 'CMCIFR2A',
  titulaire_iban: 'GAEC Les Petites Herbes',
  logo_url: null,
  mention_reserve_propriete: "En application de la loi n° 80335 du 12 mai 1980 relative aux clauses de réserve de propriété dans les contrats de vente, les produits vendus restent notre propriété jusqu'à paiement complet de la facture.",
  mention_article_441: "Article D 441-5 du code de commerce : le montant de l'indemnité forfaitaire pour frais de recouvrement due au créancier en cas de retard de paiement est fixée à 40 €.",
  conditions_reglement: 'Comptant à réception de facture',
  delai_paiement_jours: 0,
  prochain_numero_facture: 485,
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: bl, error }, { data: paramsData }] = await Promise.all([
    supabase
      .from('bons_livraison')
      .select('*, client:clients(*), bl_lignes(*)')
      .eq('id', id)
      .single(),
    supabase.from('parametres_documents').select('*').limit(1).single(),
  ])

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

  // Génération du PDF à joindre
  const params_docs: ParamsDocs = paramsData || PARAMS_FALLBACK
  const blPDF: BLPDF = {
    id: bl.id,
    numero: bl.numero,
    date_livraison: bl.date_livraison,
    client: bl.client as BLPDF['client'],
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
    const pdfBuffer = await renderToBuffer(React.createElement(BLDocument, { bl: blPDF, params: params_docs }) as any)

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: EMAIL_FROM,
      to: [client.email],
      cc: [process.env.EMAIL_DESTINATION || 'petitesherbes@gmail.com'],
      subject: `Bon de livraison N° ${bl.numero} — ${dateFormatee}`,
      html,
      attachments: [{
        filename: `BL-${bl.numero}.pdf`,
        content: Buffer.from(pdfBuffer),
      }],
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Email BL error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
