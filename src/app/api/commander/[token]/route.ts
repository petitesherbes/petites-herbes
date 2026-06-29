import { NextRequest, NextResponse } from 'next/server'
import { EMAIL_FROM, escapeHtml } from '@/lib/email'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import BLDocument from '@/lib/pdf/bl-document'
import type { ParamsDocs, BLPDF } from '@/lib/pdf/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Retrouver le client par token
  const { data: client, error: eClient } = await supabase
    .from('clients')
    .select('*')
    .eq('order_token', token)
    .eq('actif', true)
    .single()

  if (eClient || !client) {
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  const { lignes, message, date_livraison } = await req.json()

  if (!lignes || lignes.length === 0) {
    return NextResponse.json({ error: 'Panier vide' }, { status: 400 })
  }

  // Date de livraison choisie par le client (validée), sinon aujourd'hui
  const dateLivraisonValide =
    typeof date_livraison === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date_livraison)
      ? date_livraison
      : null

  // Generer numero BL
  const { data: paramsDB } = await supabase
    .from('parametres_production')
    .select('id, prochain_numero_bl')
    .single()

  const numero = String(paramsDB?.prochain_numero_bl || 1777).padStart(7, '0')
  const aujourd_hui = format(new Date(), 'yyyy-MM-dd')
  const dateLivraison = dateLivraisonValide || aujourd_hui

  // Creer le BL
  const { data: bl, error: eBL } = await supabase
    .from('bons_livraison')
    .insert({
      numero,
      client_id: client.id,
      date_livraison: dateLivraison,
      statut: 'brouillon',
      note: message || null,
    })
    .select()
    .single()

  if (eBL || !bl) {
    return NextResponse.json({ error: 'Erreur creation BL' }, { status: 500 })
  }

  // Ajouter livraison automatiquement si elle existe dans le catalogue
  const { data: livraison } = await supabase
    .from('produits')
    .select('*')
    .eq('categorie', 'LIVRAISON')
    .eq('actif', true)
    .limit(1)
    .single()

  const lignesFinales = [...lignes]
  if (livraison) {
    lignesFinales.push({
      produit_id: livraison.id,
      designation: livraison.designation,
      reference: livraison.reference,
      quantite: 1,
      prix_ht: livraison.prix_ht,
      tva_pct: livraison.tva_pct,
    })
  }

  // Inserer les lignes
  await supabase.from('bl_lignes').insert(
    lignesFinales.map((l: { produit_id: string; designation: string; reference: string | null; quantite: number; prix_ht: number; tva_pct: number }, i: number) => ({
      bl_id: bl.id,
      produit_id: l.produit_id || null,
      designation: l.designation,
      reference: l.reference || null,
      quantite: l.quantite,
      prix_ht: l.prix_ht,
      tva_pct: l.tva_pct,
      ordre: i,
    }))
  )

  // Incrementer le compteur
  if (paramsDB) {
    await supabase
      .from('parametres_production')
      .update({ prochain_numero_bl: (paramsDB.prochain_numero_bl || 1777) + 1 })
      .eq('id', paramsDB.id)
  }

  // Charger les params documents pour le PDF (optionnel, fallback si absent)
  const { data: paramsDocsData } = await supabase
    .from('parametres_documents')
    .select('*')
    .limit(1)
    .single()

  const params_docs: ParamsDocs = paramsDocsData || {
    nom: 'GAEC Les Petites Herbes', adresse: '15 rue François Arago',
    code_postal: '83310', ville: 'Cogolin',
    telephone: '06 09 93 75 89', email: 'petitesherbes@gmail.com',
    activite: 'Producteur de micro pousses, plantes aromatiques et médicinales',
    siret: '983 294 703 00019', rcs: 'FREJUS', capital: '2000',
    tva_intra: 'FR 49 983 294 703', ape_naf: '7010Z', certification_bio: 'FR-BIO-01',
    iban: 'FR76 1027 8091 1400 0203 1770 467', bic: 'CMCIFR2A',
    titulaire_iban: 'GAEC Les Petites Herbes', logo_url: null,
    mention_reserve_propriete: '', mention_article_441: '',
    conditions_reglement: 'Comptant à réception de facture',
    delai_paiement_jours: 0, prochain_numero_facture: 485,
  }

  // Générer le PDF BL
  let blPdfBuffer: Buffer | null = null
  try {
    const blForPDF: BLPDF = {
      id: bl.id, numero, date_livraison: dateLivraison,
      client: {
        nom: client.nom, adresse: client.adresse, code_postal: client.code_postal,
        ville: client.ville, pays: client.pays || 'FRANCE', email: client.email,
        siret: client.siret, tva_intra: client.tva_intra,
      },
      lignes: lignesFinales.map((l) => ({
        reference: l.reference || null,
        designation: l.designation,
        quantite: l.quantite,
        prix_ht: l.prix_ht,
        tva_pct: l.tva_pct,
      })),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blPdfBuffer = Buffer.from(await renderToBuffer(React.createElement(BLDocument, { bl: blForPDF, params: params_docs }) as any))
  } catch (pdfErr) {
    console.error('PDF generation error (non-blocking):', pdfErr)
  }

  // Envoyer emails (confirmation chef + notification GAEC)
  const dateFormatee = format(new Date(), 'dd MMMM yyyy', { locale: fr })
  const dateLivraisonFormatee = format(new Date(dateLivraison + 'T12:00:00'), 'EEEE d MMMM', { locale: fr })

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    const lignesHTML = lignes.map((l: { designation: string; quantite: number; prix_ht: number }) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${l.designation}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;color:#1B5E20;">× ${l.quantite}</td>
        ${l.prix_ht > 0 ? `<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${(l.prix_ht * l.quantite).toFixed(2)} €</td>` : '<td></td>'}
      </tr>
    `).join('')

    const emailHTML = (titre: string, sousTitre: string) => `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:#1B5E20;padding:28px 32px;color:white;text-align:center;">
    <div style="font-size:24px;font-weight:bold;">🌿 Les Petites Herbes</div>
    <div style="font-size:22px;font-weight:bold;margin-top:12px;">${titre}</div>
    <div style="font-size:14px;opacity:0.8;margin-top:4px;">${sousTitre}</div>
  </div>
  <div style="padding:24px 32px;">
    <table style="font-weight:bold;color:#333;margin-bottom:8px;width:100%;">
      <tr>
        <td>Client :</td><td>${client.nom}</td>
      </tr>
      <tr>
        <td>BL N° :</td><td style="color:#1B5E20;">${numero}</td>
      </tr>
      <tr>
        <td>Date :</td><td>${dateFormatee}</td>
      </tr>
      <tr>
        <td>Livraison :</td><td style="color:#1B5E20;text-transform:capitalize;">${dateLivraisonFormatee}</td>
      </tr>
    </table>
    ${message ? `<div style="background:#f9f9f9;border-left:3px solid #1B5E20;padding:10px 14px;margin:12px 0;font-size:13px;color:#555;">Message : ${escapeHtml(String(message))}</div>` : ''}
    <table width="100%" style="border-collapse:collapse;margin-top:16px;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#888;text-transform:uppercase;">Produit</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;text-transform:uppercase;">Qte</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;text-transform:uppercase;">Montant</th>
        </tr>
      </thead>
      <tbody>${lignesHTML}</tbody>
    </table>
  </div>
  <div style="padding:16px 32px;background:#f9f9f9;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center;">
    GAEC Les Petites Herbes · 15 rue François Arago · 83310 Cogolin · SIRET 983 294 703 00019
  </div>
</div>
</body>
</html>`

    // Email au chef (avec BL PDF en pièce jointe)
    if (client.email) {
      const emailPayload: Parameters<typeof resend.emails.send>[0] = {
        from: EMAIL_FROM,
        to: [client.email],
        subject: `Commande confirmee — BL N° ${numero}`,
        html: emailHTML(
          'Commande confirmee !',
          `Votre bon de livraison N° ${numero} a ete transmis`
        ),
      }
      if (blPdfBuffer) {
        emailPayload.attachments = [{
          filename: `BL-${numero}.pdf`,
          content: blPdfBuffer,
        }]
      }
      await resend.emails.send(emailPayload)
    }

    // Notification a GAEC
    const dest = process.env.EMAIL_DESTINATION || 'petitesherbes@gmail.com'
    await resend.emails.send({
      from: EMAIL_FROM,
      to: [dest],
      subject: `Nouvelle commande de ${client.nom} — BL N° ${numero}`,
      html: emailHTML(
        `Nouvelle commande !`,
        `De : ${client.nom}`
      ),
    })
  } catch (e) {
    // Email non bloquant
    console.error('Email error:', e)
  }

  return NextResponse.json({ ok: true, bl_id: bl.id, numero })
}
