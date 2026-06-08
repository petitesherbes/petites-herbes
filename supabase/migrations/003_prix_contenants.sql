-- Ajout des colonnes prix_plateau et prix_godet dans parametres_production
-- prix_plateau : coût par plateau de culture (tapis 67×96×8mm), ex: 0.08 €/pièce
-- prix_godet   : coût par plaque godets (TEKU TK914S, 14 godets), ex: 0.078 €/plaque

ALTER TABLE parametres_production
  ADD COLUMN IF NOT EXISTS prix_plateau decimal DEFAULT 0.08,
  ADD COLUMN IF NOT EXISTS prix_godet   decimal DEFAULT 0.078;

-- Mise à jour de la ligne existante avec les valeurs réelles
UPDATE parametres_production SET
  prix_plateau = 0.08,
  prix_godet   = 0.078;
