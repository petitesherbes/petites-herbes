-- Suivi des rappels envoyés par WhatsApp / SMS
-- Permet de savoir, pour un créneau et une semaine donnés, qui a déjà été contacté.
CREATE TABLE IF NOT EXISTS rappels_suivi (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid REFERENCES clients(id) ON DELETE CASCADE,
  jour_livraison text NOT NULL,
  semaine        date NOT NULL,          -- date de livraison visée (ancre par semaine)
  canal          text DEFAULT 'whatsapp',-- 'whatsapp' | 'sms'
  created_at     timestamp DEFAULT now(),
  UNIQUE(client_id, jour_livraison, semaine)
);

ALTER TABLE rappels_suivi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON rappels_suivi;
CREATE POLICY "allow all" ON rappels_suivi FOR ALL USING (true) WITH CHECK (true);
