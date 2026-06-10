-- Migration 013 : paramètres documents (en-tête, pied-de-page, mentions légales)

CREATE TABLE IF NOT EXISTS parametres_documents (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom                     text NOT NULL DEFAULT 'GAEC Les Petites Herbes',
  adresse                 text DEFAULT '15 rue François Arago',
  code_postal             text DEFAULT '83310',
  ville                   text DEFAULT 'Cogolin',
  telephone               text DEFAULT '06 09 93 75 89 / 07 71 63 16 53',
  email                   text DEFAULT 'petitesherbes@gmail.com',
  activite                text DEFAULT 'Producteur de micro pousses, plantes aromatiques et médicinales',
  siret                   text DEFAULT '983 294 703 00019',
  rcs                     text DEFAULT 'FREJUS',
  capital                 text DEFAULT '2000',
  tva_intra               text DEFAULT 'FR 49 983 294 703',
  ape_naf                 text DEFAULT '7010Z',
  certification_bio       text DEFAULT 'FR-BIO-01',
  iban                    text DEFAULT 'FR76 1027 8091 1400 0203 1770 467',
  bic                     text DEFAULT 'CMCIFR2A',
  titulaire_iban          text DEFAULT 'GAEC Les Petites Herbes',
  logo_url                text,
  mention_reserve_propriete text DEFAULT 'En application de la loi n° 80335 du 12 mai 1980 relative aux clauses de réserve de propriété dans les contrats de vente, les produits vendus restent notre propriété jusqu''à paiement complet de la facture.',
  mention_article_441     text DEFAULT 'Article D 441-5 du code de commerce : le montant de l''indemnité forfaitaire pour frais de recouvrement due au créancier en cas de retard de paiement est fixée à 40 €. Cette indemnité sera due de plein droit et sans formalités par le professionnel en situation de retard. Escompte pour paiement anticipé : néant.',
  conditions_reglement    text DEFAULT 'Comptant à réception de facture',
  delai_paiement_jours    integer DEFAULT 0,
  prochain_numero_facture integer DEFAULT 485,
  updated_at              timestamp DEFAULT now()
);

ALTER TABLE parametres_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON parametres_documents FOR ALL USING (true) WITH CHECK (true);

-- Ligne de config par défaut
INSERT INTO parametres_documents (
  nom, adresse, code_postal, ville, telephone, email, activite,
  siret, rcs, capital, tva_intra, ape_naf, certification_bio,
  iban, bic, titulaire_iban, prochain_numero_facture
) VALUES (
  'GAEC Les Petites Herbes',
  '15 rue François Arago',
  '83310', 'Cogolin',
  '06 09 93 75 89 / 07 71 63 16 53',
  'petitesherbes@gmail.com',
  'Producteur de micro pousses, plantes aromatiques et médicinales',
  '983 294 703 00019', 'FREJUS', '2000',
  'FR 49 983 294 703', '7010Z', 'FR-BIO-01',
  'FR76 1027 8091 1400 0203 1770 467', 'CMCIFR2A',
  'GAEC Les Petites Herbes', 485
);
