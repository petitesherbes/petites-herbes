-- Paramètres production par défaut
insert into parametres_production (cout_terreau_litre, litres_par_caisse, litres_par_tapis, litres_par_godet)
values (0.15, 15, 3, 0.3);

-- Contenants par défaut
insert into contenants (type, nom, cout_unitaire, description) values
  ('TAPIS',   'Plateau 40×60',     0.80, 'Plateau tapis microgreens'),
  ('TERREAU', 'Caisse terreau',    0.50, 'Caisse production terreau'),
  ('GODET',   'Série 14 godets',   1.20, 'Série de 14 godets 6cm');

-- Espèces TAPIS
insert into especes (nom, section, g_tapis, pct_perte, jours_pousse, jours_conserv, rendement, stock_actuel_g) values
  ('AMARANTE',        'TAPIS', 0.8,  0.10, 11, 5, 1, 5535),
  ('BROCOLI',         'TAPIS', 0.8,  0.10, 11, 5, 1, 1615),
  ('CHOU ROUGE',      'TAPIS', 0.85, 0.10, 11, 5, 1, 459),
  ('CRESSON',         'TAPIS', 1.0,  0.10, 11, 5, 1, 1423),
  ('MIZUNA RED',      'TAPIS', null, null, null, null, null, 4600),
  ('MOUTARDE',        'TAPIS', 1.0,  0.10, 11, 5, 1, 2506),
  ('PAK CHOI',        'TAPIS', 1.1,  0.10, 11, 5, 1, 2540),
  ('RADIS DAIKON',    'TAPIS', 1.7,  0.10, 11, 5, 1, 42),
  ('RADIS POURPRE',   'TAPIS', 1.6,  0.10, 11, 5, 1, 940),
  ('RADIS ROSE',      'TAPIS', 1.5,  0.10, 11, 5, 1, 603),
  ('ROQUETTE',        'TAPIS', 0.8,  0.10, 11, 5, 1, 803),
  ('ROQUETTE WASABI', 'TAPIS', null, null, null, null, null, 261);

-- Espèces TERREAU
insert into especes (nom, section, g_caisse, pct_perte, jours_pousse, jours_conserv, rendement, stock_actuel_g) values
  ('AGASTACHE',       'TERREAU', null,  null, null, null, null, 256),
  ('ANETH',           'TERREAU', 13.0,  0.10, 20, 5, 50,  0),
  ('BASILIC Pourpre', 'TERREAU', 3.5,   0.10, 12, 5, 100, 352),
  ('BASILIC Vert',    'TERREAU', 3.5,   0.10, 12, 5, 150, 804),
  ('BLETTE',          'TERREAU', 31.8,  0.10, 20, 5, 70,  446),
  ('CAROTTE',         'TERREAU', 9.9,   0.10, 20, 10, 50, 63),
  ('CERFEUIL',        'TERREAU', null,  null, null, null, null, 1057),
  ('CORIANDRE',       'TERREAU', 40.0,  0.10, 25, 5, 80,  6758),
  ('ÉPINARD',         'TERREAU', 51.6,  0.10, 0,  5, 80,  475),
  ('FENOUIL',         'TERREAU', null,  null, null, null, null, 973),
  ('PERSIL',          'TERREAU', 11.0,  0.10, 25, 10, 60, 457),
  ('POIS',            'TERREAU', 175.0, 0.10, 12, 10, 700, 30000),
  ('POIREAU',         'TERREAU', 47.2,  0.10, 15, 10, 150, 935),
  ('TAGETE LEMONI',   'TERREAU', 7.0,   0.10, 12, 5, 80,  851),
  ('TAGETE PATULA',   'TERREAU', 14.0,  0.10, 12, 5, 80,  341),
  ('THYM',            'TERREAU', 10.0,  0.10, 15, 10, 60, 225),
  ('TOURNESOL',       'TERREAU', 104.7, 0.10, 12, 3, 700, 15000),
  ('TRÈFLE',          'TERREAU', 25.9,  0.10, 12, 10, 80, 575);

-- Espèces GODETS
insert into especes (nom, section, g_godet, pct_perte, jours_pousse, jours_conserv, rendement, stock_actuel_g) values
  ('BOURRACHE', 'GODETS', 2.8, 0.10, 0, 5,  1, 205),
  ('CAPUCINE',  'GODETS', 2.5, 0.10, 0, 10, 1, 6088),
  ('MÉLISSE',   'GODETS', 0.3, 0.10, 0, 10, 1, 1132),
  ('OSEILLE',   'GODETS', 0.3, 0.10, 0, 10, 1, 1231),
  ('SHIZO',     'GODETS', 0.7, 0.10, 0, 10, 1, 429);

-- Template "Lundi type"
with t as (
  insert into templates (nom, description) values ('Lundi type', 'Semis du lundi') returning id
),
esp as (select id, nom, section from especes)
insert into templates_lignes (template_id, espece_id, format, quantite, ordre)
select t.id, esp.id,
  case when esp.section = 'TAPIS' then 'TAPIS'
       when esp.section = 'TERREAU' then 'TERREAU'
       else 'GODET' end,
  case esp.nom
    when 'AGASTACHE' then 1
    when 'BASILIC Pourpre' then 2
    when 'BASILIC Vert' then 2
    when 'BLETTE' then 2
    when 'CAROTTE' then 2
    when 'CORIANDRE' then 6
    when 'FENOUIL' then 2
    when 'PERSIL' then 6
    when 'POIS' then 8
    when 'POIREAU' then 1
    when 'TAGETE LEMONI' then 3
    when 'TAGETE PATULA' then 3
    when 'THYM' then 1
    when 'TRÈFLE' then 1
    when 'BOURRACHE' then 1
    when 'CAPUCINE' then 2
    when 'MÉLISSE' then 2
    when 'OSEILLE' then 2
    else 1
  end,
  row_number() over (order by esp.section, esp.nom)
from t, esp
where esp.nom in (
  'AMARANTE','BROCOLI','CHOU ROUGE','CRESSON','MIZUNA RED','MOUTARDE','RADIS ROSE','ROQUETTE',
  'AGASTACHE','BASILIC Pourpre','BASILIC Vert','BLETTE','CAROTTE','CORIANDRE','FENOUIL',
  'PERSIL','POIS','POIREAU','TAGETE LEMONI','TAGETE PATULA','THYM','TRÈFLE',
  'BOURRACHE','CAPUCINE','MÉLISSE','OSEILLE'
);

-- Template "Vendredi type"
with t as (
  insert into templates (nom, description) values ('Vendredi type', 'Semis du vendredi') returning id
),
esp as (select id, nom, section from especes)
insert into templates_lignes (template_id, espece_id, format, quantite, ordre)
select t.id, esp.id,
  case when esp.section = 'TAPIS' then 'TAPIS' else 'GODET' end,
  case esp.nom when 'BOURRACHE' then 1 else 1 end,
  row_number() over (order by esp.section, esp.nom)
from t, esp
where esp.nom in (
  'AMARANTE','BROCOLI','CHOU ROUGE','CRESSON','MIZUNA RED','MOUTARDE','RADIS ROSE','ROQUETTE',
  'BOURRACHE'
);
