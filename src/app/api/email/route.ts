import { NextRequest, NextResponse } from 'next/server'
import { EMAIL_FROM } from '@/lib/email'
import { Resend } from 'resend'

interface LigneEmail {
  espece?: { nom: string }
  format: string
  quantite: number
  calc: { poids: number; coutG: number; coutT: number; coutC: number; total: number }
}

function tableauSection(lignes: LigneEmail[], titre: string, fmt: string) {
  const filtered = lignes.filter(l => l.format === fmt)
  if (filtered.length === 0) return ''
  const total_poids = filtered.reduce((s, l) => s + l.calc.poids, 0)
  const total_cout = filtered.reduce((s, l) => s + l.calc.total, 0)

  const rows = filtered.map(l => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${l.espece?.nom || '—'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${l.quantite}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${l.calc.poids.toFixed(1)}g</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${l.calc.total.toFixed(2)}€</td>
    </tr>`).join('')

  return `
    <h3 style="margin:20px 0 8px;color:#333;font-size:14px;text-transform:uppercase;letter-spacing:1px">
      ${titre}
    </h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:8px 12px;text-align:left;font-weight:600">Espèce</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600">Qté</th>
          <th style="padding:8px 12px;text-align:right;font-weight:600">Poids</th>
          <th style="padding:8px 12px;text-align:right;font-weight:600">Coût</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f9f9f9;font-weight:bold">
          <td style="padding:8px 12px" colspan="2">TOTAL</td>
          <td style="padding:8px 12px;text-align:right">${total_poids.toFixed(1)}g</td>
          <td style="padding:8px 12px;text-align:right">${total_cout.toFixed(2)}€</td>
        </tr>
      </tfoot>
    </table>`
}

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const body = await req.json()
    const { dateSemis, templateNom, lignes, recap, totalPoids, totalCout } = body

    if (!lignes || !dateSemis) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    const dateFormatted = new Date(dateSemis).toLocaleDateString('fr-FR', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    })

    const totalGraines = lignes.reduce((s: number, l: LigneEmail) => s + l.calc.coutG, 0)
    const totalTerreau = lignes.reduce((s: number, l: LigneEmail) => s + l.calc.coutT, 0)
    const totalContenants = lignes.reduce((s: number, l: LigneEmail) => s + l.calc.coutC, 0)

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f4f0;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto">

    <!-- Header -->
    <div style="background:#1B5E20;color:white;padding:20px 24px;border-radius:12px 12px 0 0">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:0.7">GAEC Les Petites Herbes</div>
      <div style="font-size:22px;font-weight:bold;margin:4px 0">BON DE PRODUCTION</div>
      <div style="font-size:16px;opacity:0.9;text-transform:capitalize">${dateFormatted}</div>
      ${templateNom ? `<div style="margin-top:6px;font-size:13px;opacity:0.7">Template : ${templateNom}</div>` : ''}
    </div>

    <!-- Récap -->
    <div style="background:#2E7D32;color:white;padding:16px 24px;display:flex;gap:16px;flex-wrap:wrap">
      ${recap?.tapis > 0 ? `<span>🟩 <strong>${recap.tapis}</strong> caisses tapis (${recap.tapis * 24} tapis)</span>` : ''}
      ${recap?.terreau > 0 ? `<span>🟫 <strong>${recap.terreau}</strong> caisses terreau</span>` : ''}
      ${recap?.godets > 0 ? `<span>🟧 <strong>${recap.godets}</strong> séries godets (${recap.godets * 14} godets)</span>` : ''}
    </div>
    <div style="background:#388E3C;color:white;padding:10px 24px;font-size:13px;display:flex;gap:20px">
      <span>⚖️ ${Number(totalPoids || 0).toFixed(0)}g graines</span>
      <span>💶 Coût estimé : <strong>${Number(totalCout || 0).toFixed(2)}€</strong></span>
    </div>

    <!-- Contenu -->
    <div style="background:#fafafa;padding:16px 20px">
      ${tableauSection(lignes, '🟩 TAPIS', 'TAPIS')}
      ${tableauSection(lignes, '🟫 TERREAU', 'TERREAU')}
      ${tableauSection(lignes, '🟧 GODETS', 'GODET')}

      <!-- Récap coûts -->
      <div style="margin-top:20px;background:#fff;border:1px solid #eee;border-radius:8px;overflow:hidden">
        <div style="background:#f5f5f5;padding:10px 16px;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:1px">
          Récapitulatif coûts
        </div>
        <div style="padding:12px 16px;font-size:13px">
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0">
            <span>Graines</span><span>${totalGraines.toFixed(2)}€</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0">
            <span>Terreau</span><span>${totalTerreau.toFixed(2)}€</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0">
            <span>Contenants</span><span>${totalContenants.toFixed(2)}€</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:bold;font-size:15px">
            <span>TOTAL</span><span style="color:#1B5E20">${Number(totalCout || 0).toFixed(2)}€</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#eee;padding:12px 20px;border-radius:0 0 12px 12px;font-size:11px;color:#888;text-align:center">
      Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — GAEC Les Petites Herbes
    </div>
  </div>
</body>
</html>`

    await resend.emails.send({
      from: EMAIL_FROM,
      to: process.env.EMAIL_DESTINATION || 'petitesherbes@gmail.com',
      subject: `[Semis] Bon de production — ${new Date(dateSemis).toLocaleDateString('fr-FR')}${templateNom ? ` (${templateNom})` : ''}`,
      html,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Email error:', err)
    return NextResponse.json({ error: 'Erreur envoi email' }, { status: 500 })
  }
}
