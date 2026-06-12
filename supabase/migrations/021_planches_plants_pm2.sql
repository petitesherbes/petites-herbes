-- ══════════════════════════════════════════════════════════════════
-- Migration 021 — Planches : dimensions + densite plants/m²
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE zone_planches
  ADD COLUMN IF NOT EXISTS longueur_m   numeric(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS largeur_m    numeric(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plants_par_m2 int         DEFAULT NULL;
