import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { EMAIL_FROM } from '@/lib/email'

export const JOURS_LIVRAISON = ['mardi', 'jeudi', 'vendredi'] as const
export type JourRappel = (typeof JOURS_LIVRAISON)[number]

// getDay() : dimanche=0 lundi=1 mardi=2 mercredi=3 jeudi=4 vendredi=5
export const JOUR_INDEX: Record<JourRappel, number> = {
  mardi: 2,
  jeudi: 4,
  vendredi: 5,
}

const CAT_EMOJI: Record<string, string> = {
  TAPIS:     '🌱',
  BARQUETTE: '🥗',
  GODET:     '🪴',
  BOTTE:     '🌿',
  FLEUR:     '🌸',
  CHAMP:     '🌾',
  AUTRE:     '📦',
}
const CAT_LABEL: Record<string, string> = {
  TAPIS:     'Micro-pousses tapis',
  BARQUETTE: 'Barquettes',
  GODET:     'Godets',
  BOTTE:     'Bottes & bouquets',
  FLEUR:     'Fleurs comestibles',
  CHAMP:     'Produits du champ',
  AUTRE:     'Divers',
}

type Produit = {
  designation: string
  reference: string | null
  categorie: string
  prix_ht: number
  unite: string
  bio: boolean
  description: string | null
  photo_url: string | null
  quantite_dispo: number | null
}

export type ResultatRappels = {
  ok: boolean
  envoyes: number
  total: number
  nb_produits: number
  errors?: string[]
  error?: string
}

function buildProductsSection(produits: Produit[]): string {
  if (produits.length === 0) return ''

  const parCat = new Map<string, Produit[]>()
  for (const p of produits) {
    if (!parCat.has(p.categorie)) parCat.set(p.categorie, [])
    parCat.get(p.categorie)!.push(p)
  }

  const sections = Array.from(parCat.entries()).map(([cat, prods]) => {
    const lignes = prods.map(p => {
      const prix = p.prix_ht > 0 ? `<span style="color:#16a34a;font-size:12px;font-weight:bold;">${p.prix_ht.toFixed(2)} €/${p.unite}</span>` : ''
      const bio = p.bio ? '<span style="background:#16a34a;color:white;font-size:10px;font-weight:bold;padding:1px 6px;border-radius:20px;margin-left:6px;">BIO</span>' : ''
      const stock = p.quantite_dispo != null && p.quantite_dispo <= 3
        ? `<span style="color:#ef4444;font-size:11px;margin-left:4px;">⚡ Plus que ${p.quantite_dispo}</span>`
        : ''
      const desc = p.description
        ? `<div style="color:#6b7280;font-size:12px;margin-top:2px;line-height:1.5;">${p.description.split('💧')[0].trim().substring(0, 80)}${p.description.length > 80 ? '…' : ''}</div>`
        : ''

      if (p.photo_url) {
        return `
        <tr>
          <td style="padding:8px 0;vertical-align:top;width:56px;">
            <img src="${p.photo_url}" alt="${p.designation}"
              style="width:52px;height:52px;object-fit:cover;border-radius:8px;display:block;" />
          </td>
          <td style="padding:8px 0 8px 10px;vertical-align:top;">
            <div style="font-size:14px;font-weight:600;color:#111827;">${p.designation}${bio}${stock}</div>
            ${desc}
            ${prix}
          </td>
        </tr>`
      }
      return `
        <tr>
          <td style="padding:8px 0;vertical-align:middle;width:36px;font-size:24px;text-align:center;">${CAT_EMOJI[cat] || '🌿'}</td>
          <td style="padding:8px 0 8px 10px;vertical-align:top;">
            <div style="font-size:14px;font-weight:600;color:#111827;">${p.designation}${bio}${stock}</div>
            ${desc}
            ${prix}
          </td>
        </tr>`
    }).join('<tr><td colspan="2"><div style="border-bottom:1px solid #f3f4f6;"></div></td></tr>')

    return `
    <div style="margin-bottom:16px;">
      <div style="font-size:13px;font-weight:700;color:#1B5E20;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #dcfce7;">
        ${CAT_EMOJI[cat] || '🌿'} ${CAT_LABEL[cat] || cat}
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${lignes}
      </table>
    </div>`
  })

  return `
  <div style="margin:20px 0;padding:16px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;">
    <div style="font-size:16px;font-weight:bold;color:#1B5E20;margin-bottom:12px;">
      🛒 Disponible cette semaine
    </div>
    ${sections.join('')}
  </div>`
}

// Envoie les emails de rappel à tous les clients du créneau donné.
// Utilisé par POST /api/rappels (manuel) et GET /api/cron/rappels (automatique).
export async function envoyerRappelsEmail(jour: string, message?: string): Promise<ResultatRappels> {
  if (!JOURS_LIVRAISON.includes(jour as JourRappel)) {
    return { ok: false, envoyes: 0, total: 0, nb_produits: 0, error: 'jour invalide (mardi | jeudi | vendredi)' }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [
    { data: clients, error },
    { data: produitsData },
    { data: paramsData },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, nom, email, order_token')
      .eq('actif', true)
      .contains('jours_livraison', [jour])
      .not('email', 'is', null)
      .not('order_token', 'is', null),
    supabase
      .from('produits')
      .select('designation, reference, categorie, prix_ht, unite, bio, description, photo_url, quantite_dispo')
      .eq('actif', true)
      .eq('disponible', true)
      .neq('categorie', 'LIVRAISON')
      .order('categorie,designation'),
    supabase
      .from('parametres_documents')
      .select('nom, telephone, email, adresse, code_postal, ville, certification_bio')
      .limit(1)
      .single(),
  ])

  if (error) return { ok: false, envoyes: 0, total: 0, nb_produits: 0, error: error.message }
  if (!clients || clients.length === 0) {
    return { ok: false, envoyes: 0, total: 0, nb_produits: 0, error: 'Aucun client avec email pour ce créneau' }
  }

  const gaec = {
    nom:      paramsData?.nom      || 'GAEC Les Petites Herbes',
    telephone:paramsData?.telephone|| '06 09 93 75 89',
    email:    paramsData?.email    || 'petitesherbes@gmail.com',
    adresse:  paramsData?.adresse  || '15 rue François Arago',
    cp_ville: `${paramsData?.code_postal || '83310'} ${paramsData?.ville || 'Cogolin'}`,
    bio:      paramsData?.certification_bio || 'FR-BIO-01',
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://petites-herbes.vercel.app'
  const jourLabel = jour.charAt(0).toUpperCase() + jour.slice(1)
  const produits: Produit[] = produitsData || []
  const produitsHtml = buildProductsSection(produits)
  const nbProduits = produits.length

  const resend = new Resend(process.env.RESEND_API_KEY)
  const errors: string[] = []
  let nbOk = 0

  for (const client of clients) {
    const lien = `${baseUrl}/commander/${client.order_token}`

    const msgPersonnalise = message
      ? `<div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 16px 0;font-size:14px;color:#166534;line-height:1.6;">
          ${message.replace(/\n/g, '<br>')}
        </div>`
      : ''

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @media (max-width:600px) {
      .wrapper { margin: 0 !important; border-radius: 0 !important; }
      .pad { padding: 20px 16px !important; }
      .header { padding: 24px 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div class="wrapper" style="max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

  <div class="header" style="background:linear-gradient(135deg,#1B5E20,#2E7D32);padding:28px 32px;text-align:center;color:white;">
    <div style="font-size:32px;margin-bottom:4px;">🌿</div>
    <div style="font-size:18px;font-weight:bold;letter-spacing:-0.3px;">${gaec.nom}</div>
    <div style="font-size:11px;opacity:0.75;margin-top:3px;">Micro-pousses · Herbes aromatiques · Fleurs comestibles</div>
  </div>

  <div class="pad" style="padding:24px 28px;">

    <h2 style="font-size:17px;color:#1B5E20;margin:0 0 8px 0;">Bonjour ${client.nom} 👋</h2>
    <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 16px 0;">
      Votre livraison du <strong>${jourLabel}</strong> approche !${nbProduits > 0 ? ` Voici ce qui est disponible cette semaine (${nbProduits} produit${nbProduits > 1 ? 's' : ''}) :` : ''}
    </p>

    ${msgPersonnalise}

    ${produitsHtml}

    <div style="text-align:center;margin:20px 0 16px;">
      <a href="${lien}"
        style="display:inline-block;background:#1B5E20;color:white;padding:15px 36px;border-radius:14px;font-size:16px;font-weight:bold;text-decoration:none;letter-spacing:0.2px;">
        🛒 Commander maintenant
      </a>
    </div>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:9px 12px;margin:0 0 16px 0;">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px;">Votre lien personnel</div>
      <div style="font-size:11px;color:#374151;font-family:monospace;word-break:break-all;">${lien}</div>
    </div>

    <p style="color:#9ca3af;font-size:11px;line-height:1.5;margin:0;">
      💡 Mettez ce lien en favori sur votre téléphone pour un accès rapide à tout moment.
    </p>
  </div>

  <div style="padding:14px 28px;background:#f9fafb;border-top:1px solid #f0f0f0;text-align:center;">
    <div style="font-size:12px;color:#374151;font-weight:600;">${gaec.nom}</div>
    <div style="font-size:11px;color:#9ca3af;margin-top:3px;">
      ${gaec.adresse} · ${gaec.cp_ville}<br>
      ${gaec.telephone} · ${gaec.email}
    </div>
    ${gaec.bio ? `<div style="font-size:9px;color:#d1d5db;margin-top:4px;">Certifié ${gaec.bio}</div>` : ''}
  </div>
</div>
</body>
</html>`

    try {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: [client.email!],
        subject: `🌿 ${nbProduits > 0 ? `${nbProduits} produits disponibles` : 'Rappel commande'} — livraison ${jourLabel}`,
        html,
      })
      nbOk++
    } catch (e) {
      errors.push(`${client.nom}: ${e}`)
    }
  }

  await supabase.from('rappels_envoyes').insert({ jour_livraison: jour, nb_envoyes: nbOk })

  return {
    ok: true,
    envoyes: nbOk,
    total: clients.length,
    nb_produits: nbProduits,
    errors: errors.length > 0 ? errors : undefined,
  }
}
