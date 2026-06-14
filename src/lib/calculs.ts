import { Espece, Format, ParametresProduction, Contenant } from '@/types'
import { addDays, format } from 'date-fns'

/** Nombre de plateaux par caisse (configurable, defaut 24) */
export function tapisParCaisse(params?: ParametresProduction | null): number {
  return params?.tapis_par_caisse ?? 24
}

/** Nombre de godets par serie/plaque (configurable, defaut 14) */
export function godetsParSerie(params?: ParametresProduction | null): number {
  return params?.godets_par_serie ?? 14
}

export function calculerPoidsGraines(
  espece: Espece,
  format: Format,
  quantite: number,
  params?: ParametresProduction | null
): number {
  if (format === 'TAPIS')   return (espece.g_tapis ?? 0) * tapisParCaisse(params) * quantite
  if (format === 'GODET')   return (espece.g_godet ?? 0) * godetsParSerie(params) * quantite
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
 * Calcule le cout du substrat/terreau selon le format :
 * - TAPIS   : 0€ (utilise des plateaux de culture, pas de terreau)
 * - TERREAU : quantite x cout_caisse (depuis achat sac, ou litres x prix/L)
 * - GODET   : quantite x litres_par_godet x cout_terreau_litre
 */
export function calculerCoutTerreau(
  format: Format,
  quantite: number,
  params: ParametresProduction
): number {
  if (format === 'TAPIS') return 0
  if (format === 'TERREAU') {
    if (params.cout_sac_terreau && params.caisses_par_sac_terreau) {
      return quantite * params.cout_sac_terreau / params.caisses_par_sac_terreau
    }
    return quantite * params.litres_par_caisse * params.cout_terreau_litre
  }
  if (format === 'GODET') return quantite * params.litres_par_godet * params.cout_terreau_litre
  return 0
}

/**
 * Calcule le cout des contenants selon le format :
 * - TAPIS  : quantite x tapis_par_caisse x prix_plateau
 * - GODET  : quantite x prix_godet (1 plaque = 1 serie)
 * - TERREAU: quantite x cout_unitaire (table contenants)
 */
export function calculerCoutContenant(
  format: Format,
  quantite: number,
  contenants: Contenant[],
  params?: ParametresProduction | null
): number {
  if (format === 'TAPIS' && params?.prix_plateau != null) {
    return quantite * tapisParCaisse(params) * params.prix_plateau
  }
  if (format === 'GODET' && params?.prix_godet != null) {
    return quantite * params.prix_godet
  }
  // Fallback : table contenants
  const type = format === 'GODET' ? 'GODET' : format === 'TAPIS' ? 'TAPIS' : 'TERREAU'
  const contenant = contenants.find(c => c.type === type && c.actif)
  if (!contenant) return 0
  return quantite * contenant.cout_unitaire
}

export function recapSemis(lignes: { format: Format; quantite: number }[]) {
  const tapis   = lignes.filter(l => l.format === 'TAPIS').reduce((s, l) => s + l.quantite, 0)
  const terreau = lignes.filter(l => l.format === 'TERREAU').reduce((s, l) => s + l.quantite, 0)
  const godets  = lignes.filter(l => l.format === 'GODET').reduce((s, l) => s + l.quantite, 0)
  return { tapis, terreau, godets }
}
