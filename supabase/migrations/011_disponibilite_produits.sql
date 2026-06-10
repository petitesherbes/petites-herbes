-- Migration 011 : Disponibilité hebdomadaire des produits
-- Ajoute deux colonnes à la table produits :
--   disponible     : boolean (true = visible dans la boutique, false = masqué)
--   quantite_dispo : integer nullable (null = pas de limite, N = max commandable)

ALTER TABLE produits ADD COLUMN IF NOT EXISTS disponible boolean NOT NULL DEFAULT true;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS quantite_dispo integer DEFAULT NULL;

-- Commentaires
COMMENT ON COLUMN produits.disponible IS 'Si false, le produit est masqué de la boutique de commande';
COMMENT ON COLUMN produits.quantite_dispo IS 'Quantité max commandable cette semaine, null = illimité';
