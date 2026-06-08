import { Espece, Format, ParametresProduction, Contenant } from '@/types'
import { addDays, format } from 'date-fns'

export function calculerPoidsGraines(espece: Espece, format: Format, quantite: number): number {
  if (format === 'TAPIS') return (espece.g_tapis ?? 0) * 24 * quantite
  if (format === 'GODET') return (espece.g_godet ?? 0) * 14 * quantite
  if (format === 'TERREAU') return (espece.g_caisse ?? 0) * quantite
  return 0
}

export function calculerProdEstimee(espece: Espece, poidsG: number): number {
  return poidsG * (espece.rendement ?? 0) * (1 - (espece.pct_perte ?? 0))
}

export function calculerDates(dateSemis: Date, espece: Espece) {
  const dispo = addDays(dateSemis, espece.jours_pousse ?? 0)
  const peremption = addDays(dispo, espece.jours_conserv ?? 0)
  return {
    date_dispo: format(dispo, 'yyyy-MM-dd'),
    date_peremption: format(peremption, 'yyyy-MM-dd'),
  }
}

export function calculerCoutGraines(poidsG: number, prixKg: number | null): number {
  if (!prixKg) return 0
  return (poidsG / 1000) * prixKg
}

/**
 * Calcule le coût du substrat/terreau selon le format :
 * - TAPIS   : 0€  (utilise des plateaux de culture, pas de terreau)
 * - TERREAU : quantite × litres_par_caisse × cout_terreau_litre
 * - GODET   : quantite × litres_par_godet  × cout_terreau_litre
 */
export function calculerCoutTerreau(
  format: Format,
  quantite: number,
  params: ParametresProduction
): number {
  if (format === 'TAPIS') return 0
  if (format === 'TERREAU') return quantite * params.litres_par_caisse * params.cout_terreau_litre
  if (format === 'GODET') return quantite * params.litres_par_godet * params.cout_terreau_litre
  return 0
}

/**
 * Calcule le coût des contenants selon le format :
 * - TAPIS  : quantite × 24 plateaux × prix_plateau  (Growing medium 67×96×8mm)
 * - GODET  : quantite × prix_godet                  (Plaque TEKU TK914S, 14 godets)
 * - TERREAU: quantite × cout_unitaire (table contenants)
 */
export function calculerCoutContenant(
  format: Format,
  quantite: number,
  contenants: Contenant[],
  params?: ParametresProduction | null
): number {
  if (format === 'TAPIS') {
    const prix = params?.prix_plateau ?? null
    if (prix != null) return quantite * 24 * prix
  }
  if (format === 'GODET') {
    const prix = params?.prix_godet ?? null
    if (prix != null) return quantite * prix
  }
  // Fallback : table contenants (pour TERREAU ou si params non disponible)
  const type = format === 'GODET' ? 'GODET' : format === 'TAPIS' ? 'TAPIS' : 'TERREAU'
  const contenant = contenants.find(c => c.type === type && c.actif)
  if (!contenant) return 0
  return quantite * contenant.cout_unitaire
}

export function recapSemis(lignes: { format: Format; quantite: number }[]) {
  const tapis = lignes.filter(l => l.format === 'TAPIS').reduce((s, l) => s + l.quantite, 0)
  const terreau = lignes.filter(l => l.format === 'TERREAU').reduce((s, l) => s + l.quantite, 0)
  const godets = lignes.filter(l => l.format === 'GODET').reduce((s, l) => s + l.quantite, 0)
  return { tapis, terreau, godets }
}
