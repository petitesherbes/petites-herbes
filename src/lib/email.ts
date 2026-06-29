// Expéditeur des emails.
// En production, définir EMAIL_FROM dans Vercel avec un domaine vérifié sur Resend,
// ex: "GAEC Les Petites Herbes <contact@petites-herbes.fr>".
// L'adresse de test onboarding@resend.dev ne peut envoyer qu'à votre propre adresse.
export const EMAIL_FROM =
  process.env.EMAIL_FROM || 'GAEC Les Petites Herbes <onboarding@resend.dev>'

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}
