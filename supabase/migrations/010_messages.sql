-- Migration 010 : historique des messages envoyés aux chefs

CREATE TABLE IF NOT EXISTS messages_envoyes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                 text NOT NULL CHECK (type IN ('invitation', 'diffusion', 'individuel')),
  sujet                text NOT NULL,
  corps                text,
  destinataires_count  integer DEFAULT 0,
  destinataire_id      uuid REFERENCES clients(id) ON DELETE SET NULL,
  created_at           timestamp DEFAULT now()
);

ALTER TABLE messages_envoyes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON messages_envoyes FOR ALL USING (true) WITH CHECK (true);
