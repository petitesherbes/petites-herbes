-- ══════════════════════════════════════════════════════════════════
-- Migration 020 — Catalogue de tâches maraîcher + matrice zone×tâche
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS taches_catalogue (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre      text NOT NULL,
  categorie  text NOT NULL,
  icone      text NOT NULL DEFAULT '📋',
  active     boolean NOT NULL DEFAULT true,  -- visible dans les suggestions
  ordre      int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE taches_catalogue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON taches_catalogue;
CREATE POLICY "allow all" ON taches_catalogue FOR ALL USING (true) WITH CHECK (true);

-- ── Matrice zone × tâche ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zone_taches_catalogue (
  zone_id      uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  catalogue_id uuid NOT NULL REFERENCES taches_catalogue(id) ON DELETE CASCADE,
  PRIMARY KEY (zone_id, catalogue_id)
);

ALTER TABLE zone_taches_catalogue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON zone_taches_catalogue;
CREATE POLICY "allow all" ON zone_taches_catalogue FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════
-- Catalogue complet : ~70 tâches maraîcher bio + micropousses
-- ══════════════════════════════════════════════════════════════════

INSERT INTO taches_catalogue (titre, categorie, icone, ordre) VALUES

-- 🌱 Semis & démarrage
('Trempage des graines',              'Semis & démarrage', '🌱', 10),
('Préparation des plateaux / godets', 'Semis & démarrage', '🌱', 11),
('Semis micropousses',                'Semis & démarrage', '🌱', 12),
('Mise en germination (obscurité)',   'Semis & démarrage', '🌱', 13),
('Levée de l''obscurité / lumière',   'Semis & démarrage', '🌱', 14),
('Contrôle germination',              'Semis & démarrage', '🌱', 15),
('Semis sous abri / tunnel',          'Semis & démarrage', '🌱', 16),
('Semis en plein champ',              'Semis & démarrage', '🌱', 17),
('Repiquage plants (serre)',          'Semis & démarrage', '🌱', 18),
('Transplantation au champ',          'Semis & démarrage', '🌱', 19),
('Tri et sélection des plants',       'Semis & démarrage', '🌱', 20),
('Préparation terreau / substrat',    'Semis & démarrage', '🌱', 21),

-- 💧 Arrosage & eau
('Arrosage serre / micropousses',     'Arrosage & eau', '💧', 30),
('Arrosage plein champ',              'Arrosage & eau', '💧', 31),
('Arrosage goutte-à-goutte',          'Arrosage & eau', '💧', 32),
('Contrôle humidité plateaux',        'Arrosage & eau', '💧', 33),
('Vérification système irrigation',   'Arrosage & eau', '💧', 34),
('Drainage / ressuyage',              'Arrosage & eau', '💧', 35),
('Remplissage réserve / cuve',        'Arrosage & eau', '💧', 36),

-- ✂️ Récolte & conditionnement
('Récolte micropousses',              'Récolte & ventes', '✂️', 40),
('Récolte légumes de plein champ',    'Récolte & ventes', '✂️', 41),
('Récolte herbes aromatiques',        'Récolte & ventes', '✂️', 42),
('Conditionnement barquettes',        'Récolte & ventes', '✂️', 43),
('Préparation commandes clients',     'Récolte & ventes', '✂️', 44),
('Livraisons clients',                'Récolte & ventes', '✂️', 45),
('Vérification qualité / tri',        'Récolte & ventes', '✂️', 46),
('Étiquetage produits',               'Récolte & ventes', '✂️', 47),
('Mise en chambre froide',            'Récolte & ventes', '✂️', 48),
('Pesée et traçabilité',              'Récolte & ventes', '✂️', 49),

-- 🌿 Entretien des cultures
('Désherbage manuel',                 'Entretien cultures', '🌿', 50),
('Désherbage mécanique',              'Entretien cultures', '🌿', 51),
('Application purin d''ortie',        'Entretien cultures', '🌿', 52),
('Application purin de consoude',     'Entretien cultures', '🌿', 53),
('Application purin de prêle',        'Entretien cultures', '🌿', 54),
('Traitement préventif',              'Entretien cultures', '🌿', 55),
('Taille / écimage',                  'Entretien cultures', '🌿', 56),
('Tutelage / palissage',              'Entretien cultures', '🌿', 57),
('Ébourgeonnage',                     'Entretien cultures', '🌿', 58),
('Effeuillage',                       'Entretien cultures', '🌿', 59),
('Bâchage cultures',                  'Entretien cultures', '🌿', 60),
('Pose filets anti-insectes',         'Entretien cultures', '🌿', 61),
('Retrait filets / bâches',           'Entretien cultures', '🌿', 62),
('Pollinisation manuelle',            'Entretien cultures', '🌿', 63),
('Éclaircissage',                     'Entretien cultures', '🌿', 64),

-- 🪱 Sol & amendements
('Apport de compost',                 'Sol & amendements', '🪱', 70),
('Épandage fumier / BRF',             'Sol & amendements', '🪱', 71),
('Bêchage / labour manuel',           'Sol & amendements', '🪱', 72),
('Travail sol à la grelinette',       'Sol & amendements', '🪱', 73),
('Préparation des planches',          'Sol & amendements', '🪱', 74),
('Buttage',                           'Sol & amendements', '🪱', 75),
('Paillage (paille / BRF)',           'Sol & amendements', '🪱', 76),
('Apport chaux / dolomie',            'Sol & amendements', '🪱', 77),
('Analyse de sol',                    'Sol & amendements', '🪱', 78),

-- 🏠 Matériel & entretien
('Nettoyage plateaux / godets',       'Matériel & entretien', '🏠', 80),
('Nettoyage et désinfection outils',  'Matériel & entretien', '🏠', 81),
('Entretien tunnel / serre',          'Matériel & entretien', '🏠', 82),
('Désinfection espace de travail',    'Matériel & entretien', '🏠', 83),
('Entretien motobineuse / fraise',    'Matériel & entretien', '🏠', 84),
('Nettoyage chambre froide',          'Matériel & entretien', '🏠', 85),
('Affûtage outils tranchants',        'Matériel & entretien', '🏠', 86),
('Réparation / bricolage',            'Matériel & entretien', '🏠', 87),
('Tri et rangement matériel',         'Matériel & entretien', '🏠', 88),

-- 👁 Surveillance & observations
('Tour de parcelles quotidien',       'Surveillance', '👁', 90),
('Relevé température serre',          'Surveillance', '👁', 91),
('Contrôle ravageurs / maladies',     'Surveillance', '👁', 92),
('Prise de photos / documentation',   'Surveillance', '👁', 93),
('Comptage plants / plateaux',        'Surveillance', '👁', 94),
('Observation phénologie',            'Surveillance', '👁', 95),

-- 📋 Administratif & suivi
('Mise à jour cahier de culture',     'Administratif', '📋', 100),
('Inventaire stocks de graines',      'Administratif', '📋', 101),
('Commande fournitures / graines',    'Administratif', '📋', 102),
('Facturation clients',               'Administratif', '📋', 103),
('Contact clients / prospection',     'Administratif', '📋', 104),
('Relevé météo',                      'Administratif', '📋', 105),
('Gestion comptabilité',              'Administratif', '📋', 106),
('Préparation audit bio',             'Administratif', '📋', 107),
('Registre phytosanitaire',           'Administratif', '📋', 108),
('Planification hebdomadaire',        'Administratif', '📋', 109)

ON CONFLICT DO NOTHING;

-- ── Vérification ────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM taches_catalogue)      AS nb_taches_catalogue,
  (SELECT count(*) FROM zone_taches_catalogue) AS nb_associations_zone_tache;
