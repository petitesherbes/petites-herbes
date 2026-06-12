-- Suivi de la récolte réelle par ligne de semis (en grammes)
-- Permet de comparer production réelle vs estimée et d'affiner les rendements.
ALTER TABLE semis_lignes ADD COLUMN IF NOT EXISTS recolte_reelle decimal;
