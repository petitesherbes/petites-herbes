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

// ─── Commandes / BL ──────────────────────────────────────────

export type ProduitCategorie = 'TAPIS' | 'BARQUETTE' | 'GODET' | 'BOTTE' | 'FLEUR' | 'LIVRAISON' | 'CHAMP' | 'AUTRE'
export type BLStatut = 'brouillon' | 'envoye' | 'livre' | 'facture'

export type JourLivraison = 'mardi' | 'jeudi' | 'vendredi'

export interface Client {
  id: string
  nom: string
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string
  email: string | null
  telephone: string | null
  siret: string | null
  tva_intra: string | null
  order_token: string | null
  jours_livraison: JourLivraison[]
  actif: boolean
  created_at: string
}

export interface Produit {
  id: string
  reference: string | null
  designation: string
  categorie: ProduitCategorie
  prix_ht: number
  tva_pct: number
  unite: string
  bio: boolean
  description: string | null
  photo_url: string | null
  actif: boolean
  disponible: boolean
  quantite_dispo: number | null
  created_at: string
}

export interface BLLigne {
  id: string
  bl_id: string
  produit_id: string | null
  designation: string
  reference: string | null
  quantite: number
  prix_ht: number
  tva_pct: number
  ordre: number
  produit?: Produit
}

export interface BonLivraison {
  id: string
  numero: string
  client_id: string | null
  date_livraison: string
  statut: BLStatut
  note: string | null
  created_at: string
  client?: Client
  bl_lignes?: BLLigne[]
}

// ─────────────────────────────────────────────────────────────

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

export interface MessageTemplate {
  id: string
  nom: string
  sujet: string
  corps: string
  ordre: number
  created_at: string
}
