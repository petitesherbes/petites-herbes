-- Module Commandes / BL
-- Clients, Catalogue produits, Bons de livraison

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom          text NOT NULL,
  adresse      text,
  code_postal  text,
  ville        text,
  pays         text DEFAULT 'FRANCE',
  email        text,
  telephone    text,
  siret        text,
  tva_intra    text,
  actif        boolean DEFAULT true,
  created_at   timestamp DEFAULT now()
);

-- Catalogue produits vendus
CREATE TABLE IF NOT EXISTS produits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference   text,
  designation text NOT NULL,
  categorie   text CHECK (categorie IN ('TAPIS','BARQUETTE','GODET','BOTTE','FLEUR','LIVRAISON','CHAMP','AUTRE')) DEFAULT 'AUTRE',
  prix_ht     decimal DEFAULT 0,
  tva_pct     decimal DEFAULT 5.5,
  unite       text DEFAULT 'unite',
  bio         boolean DEFAULT false,
  actif       boolean DEFAULT true,
  created_at  timestamp DEFAULT now()
);

-- Bons de livraison
CREATE TABLE IF NOT EXISTS bons_livraison (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         text UNIQUE NOT NULL,
  client_id      uuid REFERENCES clients(id),
  date_livraison date NOT NULL DEFAULT CURRENT_DATE,
  statut         text CHECK (statut IN ('brouillon','envoye','livre','facture')) DEFAULT 'brouillon',
  note           text,
  created_at     timestamp DEFAULT now()
);

-- Lignes BL
CREATE TABLE IF NOT EXISTS bl_lignes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bl_id       uuid REFERENCES bons_livraison(id) ON DELETE CASCADE,
  produit_id  uuid REFERENCES produits(id),
  designation text NOT NULL,
  reference   text,
  quantite    decimal NOT NULL DEFAULT 1,
  prix_ht     decimal NOT NULL DEFAULT 0,
  tva_pct     decimal DEFAULT 5.5,
  ordre       int DEFAULT 0
);

-- RLS
ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE produits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bons_livraison   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_lignes        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all" ON clients          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON produits         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON bons_livraison   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON bl_lignes        FOR ALL USING (true) WITH CHECK (true);

-- Produits de base (livraison standard)
INSERT INTO produits (reference, designation, categorie, prix_ht, tva_pct, unite) VALUES
  ('1005', 'Livraison', 'LIVRAISON', 5.00, 5.5, 'forfait')
ON CONFLICT DO NOTHING;

-- Configurer le prochain numero BL dans parametres_production
ALTER TABLE parametres_production
  ADD COLUMN IF NOT EXISTS prochain_numero_bl integer DEFAULT 1777;
