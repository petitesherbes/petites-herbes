-- ══════════════════════════════════════════════════════════════════
-- Migration 018 — Terrain : zones, cahier de culture, tâches, pertes
-- ══════════════════════════════════════════════════════════════════

-- ── Zones de culture (J1-J5 + jardins) ──────────────────────────
CREATE TABLE IF NOT EXISTS zones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           text NOT NULL,
  type          text NOT NULL DEFAULT 'plein_champ', -- 'plein_champ' | 'serre' | 'jardin'
  superficie_m2 decimal,
  description   text,
  ordre         int NOT NULL DEFAULT 0,
  actif         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON zones;
CREATE POLICY "allow all" ON zones FOR ALL USING (true) WITH CHECK (true);

-- Zones J1-J5 par défaut (idempotent via ON CONFLICT DO NOTHING sur nom unique)
CREATE UNIQUE INDEX IF NOT EXISTS zones_nom_unique ON zones (nom);
INSERT INTO zones (nom, type, ordre) VALUES
  ('J1', 'plein_champ', 1),
  ('J2', 'plein_champ', 2),
  ('J3', 'plein_champ', 3),
  ('J4', 'plein_champ', 4),
  ('J5', 'plein_champ', 5)
ON CONFLICT (nom) DO NOTHING;

-- ── Planches / lignes dans chaque zone ──────────────────────────
CREATE TABLE IF NOT EXISTS zone_planches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id    uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  nom        text NOT NULL,
  longueur_m decimal,
  largeur_m  decimal,
  notes      text,
  ordre      int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE zone_planches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON zone_planches;
CREATE POLICY "allow all" ON zone_planches FOR ALL USING (true) WITH CHECK (true);

-- ── Cahier de culture (journal de terrain) ──────────────────────
CREATE TABLE IF NOT EXISTS cahier_culture (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id        uuid REFERENCES zones(id),
  date_operation date NOT NULL DEFAULT current_date,
  type_operation text NOT NULL, -- 'semis'|'recolte'|'arrosage'|'traitement'|'observation'|'taille'|'autre'
  espece_id      uuid REFERENCES especes(id),
  quantite       decimal,
  unite          text DEFAULT 'barquettes', -- 'kg'|'plateaux'|'barquettes'|'L'|'pièces'
  notes          text,
  auteur         text DEFAULT 'Moi',
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cahier_culture ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON cahier_culture;
CREATE POLICY "allow all" ON cahier_culture FOR ALL USING (true) WITH CHECK (true);

-- ── Tâches (agenda) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre        text NOT NULL,
  description  text,
  type         text NOT NULL DEFAULT 'ponctuelle', -- 'ponctuelle'|'recurrente'
  frequence    text, -- 'quotidien'|'lundi'|'mardi,vendredi' etc.
  date_echeance date,
  zone_id      uuid REFERENCES zones(id),
  priorite     text NOT NULL DEFAULT 'normale', -- 'basse'|'normale'|'haute'
  actif        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE taches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON taches;
CREATE POLICY "allow all" ON taches FOR ALL USING (true) WITH CHECK (true);

-- ── Complétions de tâches ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taches_completions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tache_id        uuid NOT NULL REFERENCES taches(id) ON DELETE CASCADE,
  date_completion date NOT NULL DEFAULT current_date,
  auteur          text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tache_id, date_completion)
);

ALTER TABLE taches_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON taches_completions;
CREATE POLICY "allow all" ON taches_completions FOR ALL USING (true) WITH CHECK (true);

-- ── Pertes et invendus ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pertes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_perte  date NOT NULL DEFAULT current_date,
  espece_id   uuid REFERENCES especes(id),
  designation text NOT NULL,
  quantite    decimal NOT NULL,
  unite       text NOT NULL DEFAULT 'barquettes',
  raison      text NOT NULL, -- 'germination_ratee'|'pourriture'|'surproduction'|'invendu'|'meteo'|'autre'
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pertes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON pertes;
CREATE POLICY "allow all" ON pertes FOR ALL USING (true) WITH CHECK (true);

-- ── Vérification ────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM zones)            AS nb_zones,
  (SELECT count(*) FROM zone_planches)    AS nb_planches,
  (SELECT count(*) FROM cahier_culture)   AS nb_entrees_cahier,
  (SELECT count(*) FROM taches)           AS nb_taches,
  (SELECT count(*) FROM pertes)           AS nb_pertes;
