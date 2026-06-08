export type Section = 'TAPIS' | 'TERREAU' | 'GODETS'
export type Format = 'TAPIS' | 'TERREAU' | 'GODET'
export type MouvementType = 'semis' | 'reappro' | 'ajustement'
export type ContenantType = 'TAPIS' | 'GODET' | 'TERREAU'

export interface Espece {
  id: string
  nom: string
  section: Section
  g_tapis: number | null
  g_godet: number | null
  g_caisse: number | null
  pct_perte: number | null
  jours_pousse: number | null
  jours_conserv: number | null
  rendement: number | null
  stock_actuel_g: number
  prix_graine_kg: number | null
  actif: boolean
  created_at: string
}

export interface Contenant {
  id: string
  type: ContenantType
  nom: string
  cout_unitaire: number
  description: string | null
  actif: boolean
}

export interface ParametresProduction {
  id: string
  cout_terreau_litre: number
  litres_par_caisse: number
  litres_par_tapis: number
  litres_par_godet: number
  prix_plateau: number | null     // €/plateau individuel (TAPIS, 67×96×8mm)
  prix_godet: number | null       // €/plaque godets (TEKU TK914S)
  tapis_par_caisse: number | null // nombre de plateaux par caisse (defaut 24)
  godets_par_serie: number | null // nombre de godets par plaque/serie (defaut 14)
  cout_eau_m3: number | null
  cout_electricite_kwh: number | null
  updated_at: string
}

export interface Semis {
  id: string
  date_semis: string
  nom_template: string | null
  cout_total: number | null
  created_at: string
  semis_lignes?: SemisLigne[]
}

export interface SemisLigne {
  id: string
  semis_id: string
  espece_id: string
  format: Format
  quantite: number
  poids_graines_g: number | null
  prod_estimee: number | null
  date_dispo: string | null
  date_peremption: string | null
  cout_graines: number | null
  cout_contenant: number | null
  cout_terreau: number | null
  cout_total_ligne: number | null
  espece?: Espece
}

export interface Template {
  id: string
  nom: string
  description: string | null
  created_at: string
  templates_lignes?: TemplateLigne[]
}

export interface TemplateLigne {
  id: string
  template_id: string
  espece_id: string
  format: Format
  quantite: number
  ordre: number
  espece?: Espece
}

export interface StockMouvement {
  id: string
  espece_id: string
  type: MouvementType
  quantite_g: number
  prix_kg: number | null
  semis_id: string | null
  note: string | null
  created_at: string
  espece?: Espece
}

export interface SemisLigneForm {
  espece_id: string
  format: Format
  quantite: number
  espece?: Espece
}
