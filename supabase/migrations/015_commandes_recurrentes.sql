-- Commandes récurrentes : modèle de commande habituelle par client
CREATE TABLE IF NOT EXISTS commandes_recurrentes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid REFERENCES clients(id) ON DELETE CASCADE,
  produit_id uuid REFERENCES produits(id) ON DELETE CASCADE,
  designation text NOT NULL,
  reference   text,
  quantite    decimal NOT NULL DEFAULT 1,
  prix_ht     decimal NOT NULL DEFAULT 0,
  tva_pct     decimal DEFAULT 5.5,
  ordre       int DEFAULT 0,
  actif       boolean DEFAULT true,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now(),
  UNIQUE(client_id, produit_id)
);

ALTER TABLE commandes_recurrentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON commandes_recurrentes FOR ALL USING (true) WITH CHECK (true);
