-- Photos produits + portail commande clients

-- Photo sur les produits
ALTER TABLE produits ADD COLUMN IF NOT EXISTS photo_url text;

-- Token unique pour le lien personnel de chaque client
ALTER TABLE clients ADD COLUMN IF NOT EXISTS order_token uuid DEFAULT gen_random_uuid();

-- Index pour retrouver client par token rapidement
CREATE UNIQUE INDEX IF NOT EXISTS clients_order_token_idx ON clients(order_token);

-- Regenerer les tokens manquants
UPDATE clients SET order_token = gen_random_uuid() WHERE order_token IS NULL;
