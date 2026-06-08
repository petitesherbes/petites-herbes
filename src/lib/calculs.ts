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

export function calculerCoutTerreau(
  format: Format,
  quantite: number,
  params: ParametresProduction
): number {
  let litres = 0
  if (format === 'TAPIS') litres = quantite * params.litres_par_tapis
  else if (format === 'TERREAU') litres = quantite * params.litres_par_caisse
  else if (format === 'GODET') litres = quantite * params.litres_par_godet
  return litres * params.cout_terreau_litre
}

export function calculerCoutContenant(
  format: Format,
  quantite: number,
  contenants: Contenant[]
): number {
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
