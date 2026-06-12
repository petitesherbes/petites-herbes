-- ══════════════════════════════════════════════════════════════════
-- Migration 022 — Feuilles d'heures (pointages)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pointages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date        NOT NULL DEFAULT CURRENT_DATE,
  auteur          text        NOT NULL,
  heure_arrivee   time        DEFAULT NULL,
  heure_depart    time        DEFAULT NULL,
  pause_minutes   int         NOT NULL DEFAULT 0,
  notes           text        DEFAULT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pointages_date_auteur_key UNIQUE (date, auteur)
);

ALTER TABLE pointages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON pointages FOR ALL USING (true) WITH CHECK (true);
