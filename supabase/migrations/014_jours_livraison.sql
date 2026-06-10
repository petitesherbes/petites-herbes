-- Créneaux de livraison par client
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS jours_livraison text[] DEFAULT '{}';

-- Config rappels (délai avant livraison pour envoyer le rappel)
ALTER TABLE parametres_production
  ADD COLUMN IF NOT EXISTS rappel_jours_avant integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS rappel_heure       integer DEFAULT 8;

-- Historique des rappels envoyés (pour éviter les doublons)
CREATE TABLE IF NOT EXISTS rappels_envoyes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jour_livraison text NOT NULL,      -- 'mardi' | 'jeudi' | 'vendredi'
  date_envoi   date NOT NULL DEFAULT CURRENT_DATE,
  nb_envoyes   int DEFAULT 0,
  created_at   timestamp DEFAULT now()
);

ALTER TABLE rappels_envoyes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON rappels_envoyes FOR ALL USING (true) WITH CHECK (true);
