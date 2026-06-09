-- Migration 007 : description produits + catalogue complet depuis tarif

-- Colonne description pour la boutique
ALTER TABLE produits ADD COLUMN IF NOT EXISTS description text;

-- ── FLEURS COMESTIBLES ───────────────────────────────────────────
INSERT INTO produits (reference, designation, categorie, prix_ht, tva_pct, unite, bio, actif) VALUES
('3000', 'Fleurs Ail', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3001', 'Fleurs Bourrache', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3002', 'Fleurs de Petit pois', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3003', 'Fleurs de Capucine', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3004', 'Fleurs de Calendula', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3005', 'Fleurs de Cosmos', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3006', 'Fleurs Oeillet d''Inde', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3007', 'Fleurs Zinnia', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3008', 'Fleurs Monarde', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3009', 'Fleurs d''Aneth', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3010', 'Fleurs de Bleuet', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3011', 'Fleurs de Coriandre', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3012', 'Fleurs de Pensee', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3013', 'Fleurs d''Alysse', 'FLEUR', 6.00, 5.5, 'barquette', true, true),
('3099', 'Fleurs MIX', 'FLEUR', 6.00, 5.5, 'barquette', true, true);

-- ── TAPIS MICRO-POUSSES ──────────────────────────────────────────
INSERT INTO produits (reference, designation, categorie, prix_ht, tva_pct, unite, bio, actif) VALUES
('0001', 'Colis mix 12 Tapis', 'TAPIS', 24.00, 5.5, 'colis', true, true),
('0002', 'Colis mix 16 Tapis', 'TAPIS', 32.00, 5.5, 'colis', true, true),
('0004', 'Colis mix 6 Tapis', 'TAPIS', 12.00, 5.5, 'colis', true, true),
('0005', 'Tapis Micropousse', 'TAPIS', 2.00, 5.5, 'tapis', true, true),
('0006', 'Tapis Cresson', 'TAPIS', 2.00, 5.5, 'tapis', true, true),
('0007', 'Tapis Amarante', 'TAPIS', 2.00, 5.5, 'tapis', true, true),
('0008', 'Tapis Chou rouge', 'TAPIS', 2.00, 5.5, 'tapis', true, true),
('00091', 'Tapis Radis Rose & Pourpre', 'TAPIS', 2.00, 5.5, 'tapis', true, true),
('0010', 'Tapis Mizuna', 'TAPIS', 2.00, 5.5, 'tapis', true, true),
('0011', 'Tapis Radis Daikon', 'TAPIS', 2.00, 5.5, 'tapis', true, true),
('0012', 'Tapis Pak choi', 'TAPIS', 2.00, 5.5, 'tapis', true, true),
('0013', 'Tapis Moutarde', 'TAPIS', 2.00, 5.5, 'tapis', true, true),
('0014', 'Tapis Roquette', 'TAPIS', 2.00, 5.5, 'tapis', true, true),
('0015', 'Tapis Brocoli', 'TAPIS', 2.00, 5.5, 'tapis', true, true);

-- ── BARQUETTES 10g ───────────────────────────────────────────────
INSERT INTO produits (reference, designation, categorie, prix_ht, tva_pct, unite, bio, actif) VALUES
('0100', 'Barquette 10g Coriandre', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0102', 'Barquette 10g Basilic Vert', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0103', 'Barquette 10g Basilic Pourpre', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0104', 'Barquette 10g Aneth', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('01045', 'Barquette 10g Fenouil', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0105', 'Barquette 10g Tagete', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0106', 'Barquette 10g Persil', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0107', 'Barquette 10g Carotte', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0108', 'Barquette 10g Anis', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0111', 'Barquette 10g Poireau', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0112', 'Barquette 10g Thym', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0113', 'Barquette 10g Trefle', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0114', 'Barquette 10g Blette', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0115', 'Barquette 10g Epinard', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true);

-- ── BARQUETTES 30g ───────────────────────────────────────────────
INSERT INTO produits (reference, designation, categorie, prix_ht, tva_pct, unite, bio, actif) VALUES
('0300', 'Barquette 30g Roquette', 'BARQUETTE', 5.00, 5.5, 'barquette', true, true),
('0301', 'Barquette 30g Moutarde', 'BARQUETTE', 5.00, 5.5, 'barquette', true, true),
('0302', 'Barquette 30g Mizuna', 'BARQUETTE', 5.00, 5.5, 'barquette', true, true),
('0303', 'Barquette 30g Pak choi', 'BARQUETTE', 5.00, 5.5, 'barquette', true, true),
('0304', 'Barquette 30g Radis R/P', 'BARQUETTE', 5.00, 5.5, 'barquette', true, true),
('0305', 'Barquette 30g Radis Daikon', 'BARQUETTE', 5.00, 5.5, 'barquette', true, true),
('0306', 'Barquette 30g Amarante', 'BARQUETTE', 5.00, 5.5, 'barquette', true, true),
('0307', 'Barquette 30g Brocoli', 'BARQUETTE', 5.00, 5.5, 'barquette', true, true),
('0308', 'Barquette 30g Cresson', 'BARQUETTE', 5.00, 5.5, 'barquette', true, true);

-- ── BARQUETTES 50g / 100g ────────────────────────────────────────
INSERT INTO produits (reference, designation, categorie, prix_ht, tva_pct, unite, bio, actif) VALUES
('0500', 'Barquette 50g Mix epice', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0500.1', 'Barquette 50g Mix doux', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0501', 'Barquette 50g Amaranthe/Brocoli', 'BARQUETTE', 10.00, 5.5, 'barquette', true, true),
('0502', 'Barquette 100g Petit pois', 'BARQUETTE', 10.00, 5.5, 'barquette', false, true),
('0502.1', 'Barquette 50g Petit pois', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0503', 'Barquette 50g Tournesol', 'BARQUETTE', 5.00, 5.5, 'barquette', false, true),
('0504', 'Barquette 50g Melange vitalite', 'BARQUETTE', 5.00, 5.5, 'barquette', true, true),
('0505', 'Barquette 50g Coriandre', 'BARQUETTE', 25.00, 5.5, 'barquette', false, true),
('5000', 'Bouquet de fleurs', 'BARQUETTE', 5.00, 5.5, 'bouquet', true, true);

-- ── GODETS EXISTANTS ─────────────────────────────────────────────
INSERT INTO produits (reference, designation, categorie, prix_ht, tva_pct, unite, bio, actif) VALUES
('4000', 'Colis mix 6 Godets', 'GODET', 30.00, 5.5, 'colis', true, true),
('4000.1', 'Colis mix 3 Godets', 'GODET', 15.00, 5.5, 'colis', true, true),
('4018', 'Godet Bourrache', 'GODET', 5.00, 5.5, 'godet', true, true),
('4051', 'Godet Oseille sanguine', 'GODET', 5.00, 5.5, 'godet', true, true),
('4070', 'Godet Capucine', 'GODET', 5.00, 5.5, 'godet', true, true),
('4071', 'Godet Melisse', 'GODET', 5.00, 5.5, 'godet', true, true),
('4072', 'Godet Shizo', 'GODET', 5.00, 5.5, 'godet', true, true),
('4073', 'Godet Basilic', 'GODET', 5.00, 5.5, 'godet', true, true);

-- ── GODETS G06–G23 avec descriptions boutique ────────────────────
INSERT INTO produits (reference, designation, description, categorie, prix_ht, tva_pct, unite, bio, actif) VALUES
('G06', 'Oseille Bio', 'Une saveur franchement acidulée, presque vinaigrée naturellement, qui réveille immédiatement le palais. Petites feuilles tendres en forme de coeur, d''un vert pomme lumineux. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G07', 'Melisse Bio', 'Parfum citronné délicat et apaisant, avec une légère note mentholée en finale. Petites feuilles ovales d''un vert tendre, légèrement gaufrées. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G08', 'Coriandre Bio', 'La signature aromatique caractéristique de la coriandre dans une version concentrée : notes herbacées fraîches, agrumes et touche poivrée. Feuilles fines et finement découpées, d''un vert clair. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G09', 'Pois Bio', 'Saveur franchement sucrée évoquant le petit pois frais à peine éclaté, avec un croquant juteux remarquable. Tiges tendres surmontées de vrilles fines et de larges feuilles d''un vert profond. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G10', 'Persil Bio', 'Le profil franc et herbacé du persil dans une version plus concentrée et plus tendre. Petites feuilles découpées d''un vert profond, parfum immédiatement reconnaissable. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G11', 'Agastache Bio', 'Une signature aromatique singulière entre anis, fenouil et réglisse, avec une fraîcheur mentholée en finale. Feuilles allongées et légèrement duveteuses d''un vert grisé. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G12', 'Mizuna Bio', 'Une note de moutarde tout en délicatesse, avec un piquant subtil et frais. Feuilles finement dentelées d''un vert vif, qui ressemblent à de minuscules fougères. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G13', 'Cerfeuil Bio', 'Note anisée fine et subtile, herbacée et fraîche, jamais lourde. Feuilles finement ciselées et légèrement ondulées, d''un vert tendre. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G14', 'Blette Bio', 'Saveur végétale douce et tendre, légèrement terreuse, qui rappelle l''épinard jeune. Tiges colorées (rose, jaune, rouge ou blanche) surmontées de petites feuilles ovales d''un vert profond. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G15', 'Poireau Bio', 'Un profil alliacé tout en finesse, plus doux que la ciboulette, avec la signature reconnaissable du poireau jeune. Longues tiges effilées d''un vert tendre. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G16', 'Basilic Vert Bio', 'Le parfum caractéristique du basilic vert dans une version concentrée et particulièrement tendre. Feuilles charnues et brillantes, d''un vert lumineux. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G17', 'Basilic Pourpre Bio', 'Profil aromatique plus complexe que le basilic vert, avec des notes épicées évoquant le clou de girofle. Magnifiques feuilles bordeaux aux reflets pourpres. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G18', 'Tagete Patula Bio', 'Profil aromatique surprenant entre mandarine, fruit de la passion et menthe douce. Feuilles finement découpées d''un vert vif délicatement aromatique. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G19', 'Tagete Lemon Bio', 'Une explosion d''arôme citronné franc et lumineux, plus intense que le citron lui-même. Petites feuilles finement découpées d''un vert tendre. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G20', 'Trefle Vert Bio', 'Saveur fraîche et douce, légèrement sucrée avec une finale végétale tendre. Feuilles caractéristiques en trois lobes d''un vert tendre. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G21', 'Carotte Bio', 'Parfum très reconnaissable des fanes de carotte fraîches, légèrement sucré et herbacé. Feuilles finement découpées d''un vert plumeux. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G22', 'Aneth Bio', 'Profil aromatique anisé délicat avec une touche citronnée et herbacée. Feuilles ultrafines et plumeuses d''un vert bleuté. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true),
('G23', 'Fenouil Bio', 'Saveur anisée douce et légèrement sucrée évoquant le fenouil bulbe en plus tendre. Feuilles fines et plumeuses d''un vert lumineux. 💧 Produit vivant ! Maintenir le substrat humide en arrosant par dessous. Trempage recommandé 1 à 2 fois par jour.', 'GODET', 5.00, 5.5, 'godet', true, true);

-- ── BOTTES ───────────────────────────────────────────────────────
INSERT INTO produits (reference, designation, categorie, prix_ht, tva_pct, unite, bio, actif) VALUES
('10010', 'Botte Basilic Vert', 'BOTTE', 2.00, 5.5, 'botte', false, true),
('10011', 'Botte Basilic Pourpre', 'BOTTE', 2.00, 5.5, 'botte', false, true),
('10012', 'Botte Aneth', 'BOTTE', 2.00, 5.5, 'botte', false, true),
('10013', 'Botte Coriandre', 'BOTTE', 2.00, 5.5, 'botte', false, true),
('10014', 'Botte Menthe verte', 'BOTTE', 1.50, 5.5, 'botte', true, true),
('10015', 'Botte Menthe poivree', 'BOTTE', 1.50, 5.5, 'botte', true, true),
('10016', 'Botte Menthe Bergamotte', 'BOTTE', 1.50, 5.5, 'botte', true, true),
('10017', 'Botte Sauge Ananas', 'BOTTE', 2.00, 5.5, 'botte', true, true),
('10018', 'Botte Ciboule de Chine', 'BOTTE', 1.50, 5.5, 'botte', true, true),
('10019', 'Botte Mizuna', 'BOTTE', 1.50, 5.5, 'botte', true, true);

-- ── MARAICHAGE / CHAMP ───────────────────────────────────────────
INSERT INTO produits (reference, designation, categorie, prix_ht, tva_pct, unite, bio, actif) VALUES
('7000', 'Courgette de Nice', 'CHAMP', 4.00, 5.5, 'unite', true, true),
('7001', 'Betteraves botte', 'CHAMP', 2.00, 5.5, 'botte', true, true),
('7002', 'Courge de Nice', 'CHAMP', 2.50, 5.5, 'unite', true, true),
('7003', 'Aubergine', 'CHAMP', 5.50, 5.5, 'unite', true, true),
('10020', 'Mizuna au kilo', 'CHAMP', 9.00, 5.5, 'kg', true, true),
('11000', 'Rougette', 'CHAMP', 1.20, 5.5, 'unite', true, true),
('11001', 'Batavia', 'CHAMP', 1.20, 5.5, 'unite', true, true);

-- ── LIVRAISONS supplementaires ───────────────────────────────────
INSERT INTO produits (reference, designation, categorie, prix_ht, tva_pct, unite, bio, actif) VALUES
('1002', 'Livraison 2€', 'LIVRAISON', 2.00, 5.5, 'forfait', false, true),
('1003', 'Livraison 3€', 'LIVRAISON', 3.00, 5.5, 'forfait', false, true);
