-- ══════════════════════════════════════════════════════════════════
-- Migration 019 — Serre, espèces terrain, produits de traitement
-- ══════════════════════════════════════════════════════════════════

-- ── Zone Serre (ajout dans zones existantes) ─────────────────────
INSERT INTO zones (nom, type, ordre) VALUES ('Serre', 'serre', 0)
ON CONFLICT (nom) DO NOTHING;

-- ── Espèces pour la serre / terrain (plantes, aromatiques…) ─────
CREATE TABLE IF NOT EXISTS especes_serre (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        text NOT NULL,
  categorie  text NOT NULL DEFAULT 'plante', -- 'plante'|'aromatique'|'legume'|'fleur'|'autre'
  actif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE especes_serre ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON especes_serre;
CREATE POLICY "allow all" ON especes_serre FOR ALL USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS especes_serre_nom ON especes_serre (nom);

INSERT INTO especes_serre (nom, categorie) VALUES
  ('Tomate',        'legume'),
  ('Poivron',       'legume'),
  ('Aubergine',     'legume'),
  ('Courgette',     'legume'),
  ('Menthe',        'aromatique'),
  ('Basilic',       'aromatique'),
  ('Agastache',     'aromatique'),
  ('Thym',          'aromatique'),
  ('Romarin',       'aromatique'),
  ('Sarriette',     'aromatique'),
  ('Ciboulette',    'aromatique'),
  ('Persil',        'aromatique'),
  ('Lavande',       'fleur'),
  ('Bourrache',     'fleur'),
  ('Capucine',      'fleur')
ON CONFLICT (nom) DO NOTHING;

-- ── Produits de traitement (purins, engrais…) ────────────────────
CREATE TABLE IF NOT EXISTS produits_traitement (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        text NOT NULL,
  type       text NOT NULL DEFAULT 'purin', -- 'purin'|'engrais'|'fongicide'|'insecticide'|'autre'
  actif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE produits_traitement ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON produits_traitement;
CREATE POLICY "allow all" ON produits_traitement FOR ALL USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS produits_traitement_nom ON produits_traitement (nom);

INSERT INTO produits_traitement (nom, type) VALUES
  ('Purin d''ortie mel 4',    'purin'),
  ('Purin d''ortie mel 5',    'purin'),
  ('Purin de consoude',       'purin'),
  ('Purin de prêle',          'purin'),
  ('Décoction de prêle',      'purin'),
  ('Compost',                 'engrais'),
  ('Engrais azoté',           'engrais'),
  ('Engrais ternaire',        'engrais'),
  ('Guano',                   'engrais'),
  ('Bicarbonate de soude',    'fongicide'),
  ('Soufre mouillable',       'fongicide'),
  ('Huile essentielle d''ail','insecticide')
ON CONFLICT (nom) DO NOTHING;

-- ── Lier cahier_culture aux produits de traitement ───────────────
ALTER TABLE cahier_culture
  ADD COLUMN IF NOT EXISTS produit_traitement_id uuid REFERENCES produits_traitement(id);

-- ── Vérification ────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM zones)               AS nb_zones,
  (SELECT count(*) FROM especes_serre)       AS nb_especes_serre,
  (SELECT count(*) FROM produits_traitement) AS nb_produits_traitement;
