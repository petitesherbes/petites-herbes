export interface ParamsDocs {
  nom: string
  adresse: string
  code_postal: string
  ville: string
  telephone: string
  email: string
  activite: string
  siret: string
  rcs: string
  capital: string
  tva_intra: string
  ape_naf: string
  certification_bio: string
  iban: string
  bic: string
  titulaire_iban: string
  logo_url: string | null
  mention_reserve_propriete: string
  mention_article_441: string
  conditions_reglement: string
  delai_paiement_jours: number
  prochain_numero_facture: number
}

export interface LignePDF {
  reference: string | null
  designation: string
  quantite: number
  prix_ht: number
  tva_pct: number
}

export interface ClientPDF {
  nom: string
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string
  email: string | null
  siret: string | null
  tva_intra: string | null
}

export interface BLPDF {
  id: string
  numero: string
  date_livraison: string
  client: ClientPDF
  lignes: LignePDF[]
}

export interface GroupeBLFacture {
  numero: string
  date: string
  lignes: LignePDF[]
}
