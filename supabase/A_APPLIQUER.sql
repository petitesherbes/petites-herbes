-- ════════════════════════════════════════════════════════════════
-- FICHIER CONSOLIDÉ — migrations 012 à 016
-- À coller dans Supabase → SQL Editor → Run
-- Sans risque : peut être exécuté plusieurs fois (idempotent).
-- ════════════════════════════════════════════════════════════════

-- ─── 012 : templates de messages ────────────────────────────────
CREATE TABLE IF NOT EXISTS message_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        text NOT NULL,
  sujet      text NOT NULL,
  corps      text NOT NULL,
  ordre      integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON message_templates;
CREATE POLICY "allow all" ON message_templates FOR ALL USING (true) WITH CHECK (true);

-- Templates par défaut (uniquement si la table est vide)
INSERT INTO message_templates (nom, sujet, corps, ordre)
SELECT * FROM (VALUES
  ('🌻 Disponibilités hebdomadaires',
   '🌻 Production disponible cette semaine — commandez avant lundi 15h',
   'Bonjour,

Votre production de la semaine est disponible ! Rendez-vous sur votre espace personnel pour découvrir nos disponibilités du moment et passer commande en quelques clics.

⏰ Pensez à commander avant lundi 15h, c''est très arrangeant pour nous 🫶

Cette semaine vous retrouverez nos tapis de micro-pousses, barquettes, godets, fleurs comestibles et aromates en bottes.

N''oubliez pas de mettre nos cagettes de côté — ou si vous souhaitez vous en débarrasser, nous sommes preneurs !

Bonne journée,
Végétalement 🌱
Les Petites Herbes', 1),
  ('⚠️ Rupture de stock',
   '⚠️ Rupture temporaire sur certaines variétés',
   'Bonjour,

Nous vous informons d''une rupture temporaire sur certaines de nos variétés cette semaine.

Notre catalogue en ligne est mis à jour en temps réel — les produits disponibles sont bien visibles sur votre espace personnel.

Merci pour votre compréhension, nous faisons notre maximum pour réapprovisionner rapidement.

À très bientôt,
Végétalement 🌱
Les Petites Herbes', 3),
  ('📅 Fermeture / Congés',
   '📅 Fermeture exceptionnelle — informations importantes',
   'Bonjour,

Nous vous informons que notre exploitation sera fermée du ___ au ___.

Aucune commande ne pourra être traitée pendant cette période. Nous reprendrons les livraisons normalement à partir du ___.

Les commandes passées avant notre fermeture seront bien honorées.

Merci de votre fidélité et à très bientôt !

Végétalement 🌱
Les Petites Herbes', 4)
) AS t(nom, sujet, corps, ordre)
WHERE NOT EXISTS (SELECT 1 FROM message_templates);

-- ─── 013 : paramètres documents ─────────────────────────────────
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
DROP POLICY IF EXISTS "allow all" ON parametres_documents;
CREATE POLICY "allow all" ON parametres_documents FOR ALL USING (true) WITH CHECK (true);

INSERT INTO parametres_documents (nom)
SELECT 'GAEC Les Petites Herbes'
WHERE NOT EXISTS (SELECT 1 FROM parametres_documents);

-- ─── 014 : jours de livraison + rappels ─────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS jours_livraison text[] DEFAULT '{}';
ALTER TABLE parametres_production
  ADD COLUMN IF NOT EXISTS rappel_jours_avant integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS rappel_heure integer DEFAULT 8;

CREATE TABLE IF NOT EXISTS rappels_envoyes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jour_livraison text NOT NULL,
  date_envoi date NOT NULL DEFAULT CURRENT_DATE,
  nb_envoyes int DEFAULT 0,
  created_at timestamp DEFAULT now()
);

ALTER TABLE rappels_envoyes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON rappels_envoyes;
CREATE POLICY "allow all" ON rappels_envoyes FOR ALL USING (true) WITH CHECK (true);

-- ─── 015 : commandes récurrentes (habituelles) ──────────────────
CREATE TABLE IF NOT EXISTS commandes_recurrentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  produit_id uuid REFERENCES produits(id) ON DELETE CASCADE,
  designation text NOT NULL,
  reference text,
  quantite decimal NOT NULL DEFAULT 1,
  prix_ht decimal NOT NULL DEFAULT 0,
  tva_pct decimal DEFAULT 5.5,
  ordre int DEFAULT 0,
  actif boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(client_id, produit_id)
);

ALTER TABLE commandes_recurrentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON commandes_recurrentes;
CREATE POLICY "allow all" ON commandes_recurrentes FOR ALL USING (true) WITH CHECK (true);

-- ─── 016 : récolte réelle ───────────────────────────────────────
ALTER TABLE semis_lignes ADD COLUMN IF NOT EXISTS recolte_reelle decimal;

-- ─── 017 : suivi des rappels WhatsApp / SMS ─────────────────────
CREATE TABLE IF NOT EXISTS rappels_suivi (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid REFERENCES clients(id) ON DELETE CASCADE,
  jour_livraison text NOT NULL,
  semaine        date NOT NULL,
  canal          text DEFAULT 'whatsapp',
  created_at     timestamp DEFAULT now(),
  UNIQUE(client_id, jour_livraison, semaine)
);
ALTER TABLE rappels_suivi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON rappels_suivi;
CREATE POLICY "allow all" ON rappels_suivi FOR ALL USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════
-- ✅ Terminé ! Vérification rapide :
-- ════════════════════════════════════════════════════════════════
SELECT
  (SELECT count(*) FROM message_templates)      AS templates,
  (SELECT count(*) FROM parametres_documents)   AS params_docs,
  (SELECT count(*) FROM commandes_recurrentes)  AS cmds_recurrentes,
  (SELECT count(*) FROM rappels_suivi)          AS suivi_rappels;
