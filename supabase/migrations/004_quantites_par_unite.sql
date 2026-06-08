-- Quantites configurables par unite
-- tapis_par_caisse : nombre de plateaux par caisse (defaut 24)
-- godets_par_serie : nombre de godets par plaque/serie (defaut 14)

ALTER TABLE parametres_production
  ADD COLUMN IF NOT EXISTS tapis_par_caisse integer DEFAULT 24,
  ADD COLUMN IF NOT EXISTS godets_par_serie integer DEFAULT 14;

UPDATE parametres_production SET
  tapis_par_caisse = 24,
  godets_par_serie = 14;
