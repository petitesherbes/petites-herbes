-- Migration 012 : table des templates de messages pré-enregistrés

CREATE TABLE IF NOT EXISTS message_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        text NOT NULL,
  sujet      text NOT NULL,
  corps      text NOT NULL,
  ordre      integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON message_templates FOR ALL USING (true) WITH CHECK (true);

-- Templates par défaut
INSERT INTO message_templates (nom, sujet, corps, ordre) VALUES

('🌻 Disponibilités hebdomadaires',
 '🌻 Production disponible cette semaine — commandez avant lundi 15h',
 'Bonjour,

Votre production de la semaine est disponible ! Rendez-vous sur votre espace personnel pour découvrir nos disponibilités du moment et passer commande en quelques clics.

⏰ Pensez à commander avant lundi 15h, c''est très arrangeant pour nous 🫶

Cette semaine vous retrouverez nos tapis de micro-pousses, barquettes, godets, fleurs comestibles et aromates en bottes.

N''oubliez pas de mettre nos cagettes de côté — ou si vous souhaitez vous en débarrasser, nous sommes preneurs !

Bonne journée,
Végétalement 🌱
Les Petites Herbes',
1),

('🛒 Message boutique — offre de la semaine',
 '🌿 Nos disponibilités de la semaine — votre boutique est à jour !',
 'Bonjour,

Un petit mot de la ferme pour vous donner des nouvelles de la production cette semaine !

Votre boutique personnelle est mise à jour en temps réel : vous y trouverez exactement ce qui est disponible aujourd''hui, avec les quantités restantes quand c''est limité.

Cette semaine au programme :
• 🌱 Tapis de micro-pousses (tournesol, radis, pois, lentille, basilic...)
• 🧺 Barquettes fraîches
• 🪴 Godets d''herbes aromatiques
• 🌸 Fleurs comestibles de saison
• 🌿 Bottes d''aromates fraîches

⏰ Pour qu''on puisse préparer les commandes dans les meilleures conditions, merci de commander avant lundi 15h — c''est vraiment utile pour nous !

À très bientôt,
Végétalement 🌱
Les Petites Herbes · Cogolin',
2),

('⚠️ Rupture de stock',
 '⚠️ Rupture temporaire sur certaines variétés',
 'Bonjour,

Nous vous informons d''une rupture temporaire sur certaines de nos variétés cette semaine.

Notre catalogue en ligne est mis à jour en temps réel — les produits disponibles sont bien visibles sur votre espace personnel.

Merci pour votre compréhension, nous faisons notre maximum pour réapprovisionner rapidement.

À très bientôt,
Végétalement 🌱
Les Petites Herbes',
3),

('📅 Fermeture / Congés',
 '📅 Fermeture exceptionnelle — informations importantes',
 'Bonjour,

Nous vous informons que notre exploitation sera fermée du ___ au ___.

Aucune commande ne pourra être traitée pendant cette période. Nous reprendrons les livraisons normalement à partir du ___.

Les commandes passées avant notre fermeture seront bien honorées.

Merci de votre fidélité et à très bientôt !

Végétalement 🌱
Les Petites Herbes',
4),

('🎉 Nouveauté / Arrivage',
 '🎉 Nouveauté à la ferme — découvrez notre dernière arrivée !',
 'Bonjour,

Bonne nouvelle : nous avons une nouveauté à vous proposer cette semaine !

___ [Décrivez ici la nouveauté : nouvelle variété, nouveau produit, nouvelle présentation...]

Comme toujours, retrouvez-le directement dans votre espace boutique personnel.

N''hésitez pas à nous faire part de vos retours — vos avis guident vraiment notre production !

À bientôt,
Végétalement 🌱
Les Petites Herbes',
5);
