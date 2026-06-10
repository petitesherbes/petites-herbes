import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://gnkaccwrphysykjxlgjr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdua2FjY3dycGh5c3lranhsZ2pyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDkzNzY1OCwiZXhwIjoyMDk2NTEzNjU4fQ.Pa4kjUpGrBPrYhVlii8ETttFS9ku5Ok3wPoezvSX3eU'
)

const clients = [
  { nom: 'AFTER BEACH',                  adresse: '56 CHEMIN DE LA RINE',            ville: 'GRIMAUD',              code_postal: '83310', siret: '85032741200019', tva_intra: 'FR 06 850 327 412', telephone: '06 19 86 06 11', email: 'comptabilite@afterbeach.fr' },
  { nom: 'AFTERBIS',                     adresse: '56 CHEMIN DE LA RINE',            ville: 'GRIMAUD',              code_postal: '83310', siret: '92537917400012', tva_intra: 'FR 56 925 379 174', telephone: '06 19 86 06 11', email: 'comptabilite@afterbeach.fr' },
  { nom: 'AGATHA Les Moulins de Ramatuelle', adresse: 'PAMPELONNE',                  ville: 'RAMATUELLE',           code_postal: '83350', siret: '83187867300027', tva_intra: 'FR 49 831 878 673', telephone: '06 43 93 97 96', email: 'moulinscuisine@gmail.com' },
  { nom: 'AMAP Grimaud',                 adresse: '',                                ville: 'GRIMAUD',              code_postal: '83310', siret: null, tva_intra: null, telephone: null, email: null },
  { nom: 'BLUE HORIZONS EVENTS',         adresse: '733 AVENUE FREDERIC MISTRAL',     ville: 'CAVALAIRE-SUR-MER',    code_postal: '83240', siret: '93047042200013', tva_intra: 'FR 83 930 470 422', telephone: null, email: 'Contact@blue-horizons-events.com' },
  { nom: 'BRAISE & COW',                 adresse: '24 Bd du Mal de Lattre de Tassigny', ville: 'COGOLIN',           code_postal: '83310', siret: '83922513300017', tva_intra: 'FR 59 839 225 133', telephone: '06 82 64 41 08', email: 'yohan.aup@hotmail.fr' },
  { nom: 'CAFOUTCHE FAMEL',              adresse: '13 RUE DES TEMPLIERS',            ville: 'GRIMAUD',              code_postal: '83310', siret: '83403764000010', tva_intra: 'FR 66 834 037 640', telephone: '07 86 04 44 68', email: null },
  { nom: 'CAV HOT',                      adresse: '148 ALLEE DE LA PLAGE',           ville: 'CAVALAIRE-SUR-MER',    code_postal: '83240', siret: '89189435400010', tva_intra: 'FR 57 891 894 354', telephone: '06 10 59 77 36', email: 'nsanchez@lamenado.com' },
  { nom: 'CAVES D\'ESCLANS',             adresse: '4005 ROUTE DE CALLAS',            ville: 'LA MOTTE',             code_postal: '83920', siret: '49059874500027', tva_intra: 'FR 18 490 598 745', telephone: null, email: 'accounting@chateaudesclans.com' },
  { nom: 'CB - Cabane Bambou',           adresse: 'CHEMIN DE TRAS BARRY',            ville: 'GASSIN',               code_postal: '83580', siret: '45201478000020', tva_intra: 'FR 66 452 014 780', telephone: '06 01 18 30 63', email: 'economat@cabanebambouplage.com' },
  { nom: 'CDL - La Petite Maison',       adresse: '34 Bd du Mal de Lattre de Tassigny', ville: 'COGOLIN',           code_postal: '83310', siret: '98389379300015', tva_intra: 'FR 06 983 893 793', telephone: '06 35 41 90 14', email: 'contact@petite-maison-cogolin.fr' },
  { nom: 'CHATEAU D\'ESCLANS',           adresse: 'CHATEAU D\'ESCLANS',              ville: 'LA MOTTE',             code_postal: '83920', siret: '48956247000026', tva_intra: 'FR 43 489 562 470', telephone: null, email: 'accounting@chateaudesclans.com' },
  { nom: 'CHEZ NOUS',                    adresse: '9 RUE NATIONALE',                 ville: 'COGOLIN',              code_postal: '83310', siret: '80043406000011', tva_intra: 'FR 68 800 434 060', telephone: '06 21 37 02 48', email: null },
  { nom: 'COCOA CHOCOLATERIE',           adresse: '5172 CORNICHE DES ISSAMBRES',     ville: 'ROQUEBRUNE-SUR-ARGENS',code_postal: '83520', siret: '83793533700019', tva_intra: 'FR 01 837 935 337', telephone: null, email: 'contact@cocoachocolaterie.fr' },
  { nom: 'COMMUNE DE GASSIN',            adresse: 'PLACE DE LA MAIRIE',              ville: 'GASSIN',               code_postal: '83580', siret: '21830065500014', tva_intra: 'FR 75 218 300 655', telephone: null, email: null },
  { nom: 'DIOR Paris',                   adresse: '30 AVENUE MONTAIGNE',             ville: 'PARIS',                code_postal: '75008', siret: '58211098700010', tva_intra: 'FR 69 582 110 987', telephone: null, email: 'Nonstocked-invoicesCD@christiandior.com' },
  { nom: 'DOMAINE DU BAILLI',            adresse: '15 AVENUE DES AMERICAINS',        ville: 'RAYOL-CANADEL-SUR-MER',code_postal: '83820', siret: '43515222800027', tva_intra: 'FR 44 435 152 228', telephone: null, email: 'adm@lebaillidesuffren.com' },
  { nom: 'DOMAINE DU MAGNAN',            adresse: 'ROUTE DEPARTEMENTALE D98',        ville: 'LA MOLE',              code_postal: '83310', siret: '52352377700010', tva_intra: 'FR 14 523 523 777', telephone: '07 81 64 87 59', email: 'christine@lemagnan.fr' },
  { nom: 'E.VENT PROD (L\'ENVIE)',       adresse: '177 Route de Sainte-Maxime',      ville: 'GRIMAUD',              code_postal: '83310', siret: '43985184100064', tva_intra: 'FR 30 439 851 841', telephone: '06 83 63 33 19', email: 'philippe.fadcompany@gmail.com' },
  { nom: 'FLAVIO GIGARO',                adresse: '566 CHEMIN DE LA TOUR',           ville: 'GRIMAUD',              code_postal: '83310', siret: '84978887200034', tva_intra: 'FR 18 849 788 872', telephone: null, email: null },
  { nom: 'HOSTELLERIE DE LA BELLE AURORE', adresse: '4 BOULEVARD JEAN MOULIN',      ville: 'SAINTE-MAXIME',        code_postal: '83120', siret: '59548010400016', tva_intra: 'FR 54 595 480 104', telephone: '07 88 13 96 63', email: 'info@belleaurore.com' },
  { nom: 'HOSTELLERIE DES GORGES DE PENNAFORT', adresse: 'PENNAFORT',               ville: 'CALLAS',               code_postal: '83830', siret: '38028007300012', tva_intra: 'FR 48 380 280 073', telephone: '06 86 41 23 96', email: 'info@hostellerie-pennafort.com' },
  { nom: 'HOTEL DE LA CALANQUE SUR MER', adresse: '20 CAP CAVALAIRE',               ville: 'CAVALAIRE-SUR-MER',    code_postal: '83240', siret: '59598014500014', tva_intra: 'FR 72 595 980 145', telephone: '06 85 70 50 90', email: 'allaire.juliette1@gmail.com' },
  { nom: 'HOTEL LA VILLA',               adresse: '8 CORNICHE DE PARIS',             ville: 'RAYOL-CANADEL-SUR-MER',code_postal: '83820', siret: '82179072200028', tva_intra: 'FR 02 821 790 722', telephone: '06 75 81 70 33', email: 'cuisine@lavilladouce.com' },
  { nom: 'ISABELLE FERRARI',             adresse: '15 AVENUE DU COLONEL RUYSSEN',    ville: 'RAYOL-CANADEL-SUR-MER',code_postal: '83820', siret: '94256886600019', tva_intra: 'FR 52 942 568 866', telephone: '06 30 29 11 91', email: 'isaferrari@hotmail.com' },
  { nom: 'JUST 4 YACHT',                 adresse: '',                                ville: '',                     code_postal: null, siret: null, tva_intra: null, telephone: null, email: null },
  { nom: 'L\'ECRIN',                     adresse: 'RES LE PARADOU BAT A APPART 102', ville: 'RAYOL-CANADEL-SUR-MER',code_postal: '83820', siret: '51231143200037', tva_intra: 'FR 57 512 311 432', telephone: null, email: 'direction@miragesalaplage.fr' },
  { nom: 'L\'ERMITAGE',                  adresse: '14 AVENUE PAUL SIGNAC',           ville: 'SAINT-TROPEZ',         code_postal: '83990', siret: '82309578100030', tva_intra: 'FR 65 823 095 781', telephone: '06 03 10 22 17', email: 'Clemble@00f.fr' },
  { nom: 'L\'OLIVE NOIRE',               adresse: '36 BD MAL DE LATTRE DE TASSIGNY', ville: 'COGOLIN',              code_postal: '83310', siret: '91192043700017', tva_intra: 'FR 95 911 920 437', telephone: '06 60 46 29 15', email: null },
  { nom: 'LA BAIE DES VOILES',           adresse: 'ROUTE DU PLAN DE LA TOUR',        ville: 'GRIMAUD',              code_postal: '83310', siret: '94859611900016', tva_intra: 'FR 41 948 596 119', telephone: null, email: 'direction@hotelchateaurose.com' },
  { nom: 'LA BASTIDE DE ST TROPEZ',      adresse: 'LA BASTIDE DE SAINT-TROPEZ',      ville: 'SAINT-TROPEZ',         code_postal: '83990', siret: '89493100500033', tva_intra: 'FR 61 894 931 005', telephone: null, email: null },
  { nom: 'LA CAPITAINERIE',              adresse: 'LE PORT',                         ville: 'SAINTE-MAXIME',        code_postal: '83120', siret: '34238109200010', tva_intra: 'FR 06 342 381 092', telephone: null, email: null },
  { nom: 'LA FARIGOULETTE',              adresse: 'CHEMIN DE LA CASCADE',            ville: 'LE LAVANDOU',          code_postal: '83980', siret: '89853910100011', tva_intra: 'FR 22 898 539 101', telephone: null, email: 'restaurantlafarigoulette@orange.fr' },
  { nom: 'LA FINE EQUIPE',               adresse: '14 PLACE AUX HERBES',             ville: 'SAINT-TROPEZ',         code_postal: '83990', siret: '88008079100010', tva_intra: 'FR 64 880 080 791', telephone: null, email: 'contact@chez-madeleine.fr' },
  { nom: 'LA PATISSERIE D\'OCTAVE',      adresse: 'ZONE ARTISANALE DU GOURBENET',    ville: 'LA CROIX-VALMER',      code_postal: '83420', siret: '97820045900011', tva_intra: 'FR 55 978 200 459', telephone: '06 43 74 87 73', email: 'octave@lapatisseriedoctave.com' },
  { nom: 'LA TARTE TROPEZIENNE',         adresse: '420 AVENUE DES NARCISSES',        ville: 'COGOLIN',              code_postal: '83310', siret: '39474770300236', tva_intra: 'FR 94 394 747 703', telephone: null, email: 'fournisseur@latartetropezienne.fr' },
  { nom: 'LAURENT PRIMEURS',             adresse: 'LE COLOMBIER',                    ville: 'RAMATUELLE',           code_postal: '83350', siret: '39533832000017', tva_intra: 'FR 46 395 338 320', telephone: null, email: null },
  { nom: 'LE 1051',                      adresse: '741 CHEMIN DES MOULINS',          ville: 'RAMATUELLE',           code_postal: '83350', siret: '83869776100016', tva_intra: 'FR 13 838 697 761', telephone: '07 61 07 94 25', email: 'info@le1051.com' },
  { nom: 'LE CHAI',                      adresse: '7677 ROUTE DES PLAGES',           ville: 'RAMATUELLE',           code_postal: '83350', siret: '95073384000017', tva_intra: 'FR 49 950 733 840', telephone: '06 45 95 40 53', email: 'compta@fondugues.com' },
  { nom: 'LE PRAO',                      adresse: '39 AVENUE DU GENERAL TOUZET DU VIGIER', ville: 'SAINTE-MAXIME', code_postal: '83120', siret: '59648012900011', tva_intra: 'FR 16 596 480 129', telephone: '06 62 57 56 33', email: 'prao@orange.fr' },
  { nom: 'LES EMBRUNS',                  adresse: 'QUAI DE LA GALIOTE',              ville: 'COGOLIN',              code_postal: '83310', siret: '90882256200017', tva_intra: 'FR 40 908 822 562', telephone: '06 82 39 56 75', email: 'claragilly2@gmail.com' },
  { nom: 'LES SAISONNIERS',              adresse: 'BOULEVARD DE TAHITI',             ville: 'LA CROIX-VALMER',      code_postal: '83420', siret: '98066908900024', tva_intra: 'FR 92 980 669 089', telephone: '06 65 61 17 56', email: 'florent.manini@gmail.com' },
  { nom: 'MAISON ARFEUILLERE Open Bistro', adresse: '811 CHEMIN DU CARRY',           ville: 'COGOLIN',              code_postal: '83310', siret: '80845879800010', tva_intra: 'FR 46 808 458 798', telephone: '06 45 63 93 20', email: 'openbistro@orange.fr' },
  { nom: 'MAISON DEL GUSTO',             adresse: '9 RUE LOUIS AUREGLIA',            ville: 'MONACO',               code_postal: '98000', siret: '89750041900014', tva_intra: 'FR 04 897 500 419', telephone: '+377 97 70 87 11', email: 'melanie@maisondelgusto.com' },
  { nom: 'MARGUERITE CATERING',          adresse: '21 CANDEOU',                      ville: 'NICE',                 code_postal: '06000', siret: '93989741900015', tva_intra: 'FR 45 939 897 419', telephone: null, email: 'contact@marguerite-agency.com' },
  { nom: 'MARGUERITE EVENTS',            adresse: '7 AVENUE SIGISMOND COULET',       ville: 'COGOLIN',              code_postal: '83310', siret: '91990505900011', tva_intra: 'FR 05 919 905 059', telephone: '06 84 75 02 61', email: 'margueritebarevents@gmail.com' },
  { nom: 'MARINA VIVA',                  adresse: '21 CHEMIN DES COLLIERES',         ville: 'CAVALAIRE-SUR-MER',    code_postal: '83240', siret: '50049128700016', tva_intra: 'FR 09 500 491 287', telephone: '06 26 39 75 73', email: 'meier.flo@wanadoo.fr' },
  { nom: 'MAURES EVENEMENTS',            adresse: '109 AVENUE GABRIEL PERI',         ville: 'CAVALAIRE-SUR-MER',    code_postal: '83240', siret: '92529129600018', tva_intra: 'FR 68 925 291 296', telephone: '06 79 98 44 48', email: 'direction@lusine.org' },
  { nom: 'MPJ',                          adresse: '24 RUE DE L\'AUDIGUIER',          ville: 'COGOLIN',              code_postal: '83310', siret: '91845724300015', tva_intra: 'FR 23 918 457 243', telephone: '07 86 95 08 74', email: null },
  { nom: 'MR VEGGIE',                    adresse: '80 PLACE AUX HERBES',             ville: 'SAINT-TROPEZ',         code_postal: '83990', siret: '84845436900028', tva_intra: 'FR 87 848 454 369', telephone: '07 68 00 94 00', email: 'mrveggie12@gmail.com' },
  { nom: 'PEANUTS CAFE',                 adresse: '30 AVENUE CHARLES DE GAULLE',     ville: 'SAINTE-MAXIME',        code_postal: '83120', siret: '84014944700012', tva_intra: 'FR 62 840 149 447', telephone: null, email: 'peanutscafe83120@gmail.com' },
  { nom: 'PULPE',                        adresse: '3 BOULEVARD GEORGES CLEMENCEAU',  ville: 'DRAGUIGNAN',           code_postal: '83300', siret: '92167296000017', tva_intra: 'FR 39 921 672 960', telephone: null, email: 'Pulpemathilde@gmail.com' },
  { nom: 'QUI L\'EUT CRU',              adresse: '24 RUE DU CENTRE',               ville: 'RAMATUELLE',           code_postal: '83350', siret: '85214169600025', tva_intra: 'FR 91 852 141 696', telephone: '06 51 34 55 80', email: 'quilucru.ramatuelle@gmail.com' },
  { nom: 'REMER - La Réserve',           adresse: 'AV DE RAMATUELLE',               ville: 'RAMATUELLE',           code_postal: '83350', siret: '84466558800019', tva_intra: 'FR 10 844 665 588', telephone: '06 58 55 67 08', email: 'administration@lareserve-ramatuelle.com' },
  { nom: 'RESIDENCE DES LICES',          adresse: 'AVENUE AUGUSTIN GRANGEON',        ville: 'SAINT-TROPEZ',         code_postal: '83990', siret: '59728063500017', tva_intra: 'FR 08 597 280 635', telephone: '06 38 40 99 01', email: 'florence@hoteldeslices.com' },
  { nom: 'RESIDENCE HOTELIERE LES MIMOSAS', adresse: 'AVENUE LOU MISTRAOU',         ville: 'BORMES-LES-MIMOSAS',   code_postal: '83230', siret: '53156658600016', tva_intra: 'FR 79 531 566 586', telephone: null, email: null },
  { nom: 'SARL LA PLAGE',                adresse: '55 AV DU GENERAL TOUZET DU VIGIER', ville: 'SAINTE-MAXIME',     code_postal: '83120', siret: '48216413400025', tva_intra: 'FR 90 482 164 134', telephone: null, email: 'compta@auroragroupe.com' },
  { nom: 'SARL LA REINE JEANNE',         adresse: 'LA NARTELLE',                     ville: 'SAINTE-MAXIME',        code_postal: '83120', siret: '32754646100010', tva_intra: 'FR 04 327 546 461', telephone: '06 62 08 47 63', email: 'damsuils.83@gmail.com' },
  { nom: 'SCI STELLA MARIS',             adresse: '12 ROUTE DES SALINS',             ville: 'SAINT-TROPEZ',         code_postal: '83990', siret: '49853220900026', tva_intra: 'FR 05 498 532 209', telephone: null, email: 'philippabobi@gmail.com' },
  { nom: 'SEZZ',                         adresse: '151 ROUTE DES SALINS',            ville: 'SAINT-TROPEZ',         code_postal: '83990', siret: '35396515500040', tva_intra: 'FR 05 353 965 155', telephone: '06 74 59 02 95', email: 'comptabilite@hotelsezz.com' },
  { nom: 'SNC LE REFUGE',                adresse: 'PLAGE DE GIGARO',                 ville: 'LA CROIX-VALMER',      code_postal: '83420', siret: '38244683900013', tva_intra: 'FR 85 382 446 839', telephone: '06 45 95 10 53', email: 'lerefugegigarolodges.lcv@gmail.com' },
  { nom: 'SOCIETE FONCIERE PLM',         adresse: '736 CHEMIN DES CRETES',           ville: 'RAMATUELLE',           code_postal: '83350', siret: '37751843600078', tva_intra: 'FR 04 377 518 436', telephone: '06 16 24 25 78', email: 'economat@lareserve-ramatuelle.com' },
  { nom: 'SOGECO',                       adresse: '820 AVENUE DU CAP NEGRE',         ville: 'LE LAVANDOU',          code_postal: '83980', siret: '48185801700025', tva_intra: 'FR 38 481 858 017', telephone: '06 89 21 24 14', email: 'yd.sogecosas@orange.fr' },
  { nom: 'TAGETE & BERGAMOTE',           adresse: '571 CHEMIN DE LA CALADE',         ville: 'TOULON',               code_postal: '83000', siret: '92510867200039', tva_intra: 'FR 52 925 108 672', telephone: null, email: null },
  { nom: 'TPR',                          adresse: '18 QUAI FREDERIC MISTRAL',        ville: 'SAINT-TROPEZ',         code_postal: '83990', siret: '53092349900012', tva_intra: 'FR 51 530 923 499', telephone: '06 73 43 59 66', email: 'claudinevme@gmail.com' },
  { nom: 'VAROTEL Lily of Valley',       adresse: 'QUA GIGARO COLLINE SAINT MICHEL', ville: 'LA CROIX-VALMER',      code_postal: '83420', siret: '31816675800058', tva_intra: 'FR 13 318 166 758', telephone: '06 27 99 69 72', email: 'comptabilite@lilyofthevalley.com' },
  { nom: 'YTL HOTEL MANAGEMENT',         adresse: '364 CHEMIN DE VAL DE RIAN',       ville: 'RAMATUELLE',           code_postal: '83350', siret: '50229358200016', tva_intra: 'FR 17 502 293 582', telephone: '07 85 36 52 09', email: 'compta@muse-hotels.com' },
  { nom: 'YVON-JACQUES Petit Jacques',   adresse: 'PLACE DES PENITENTS',             ville: 'GRIMAUD',              code_postal: '83310', siret: '94970484500021', tva_intra: 'FR 89 949 704 845', telephone: '06 76 32 89 03', email: 'francis.paul.jacques@gmail.com' },
]

// Nettoyer les données
const toInsert = clients.map(c => ({
  nom:         c.nom,
  adresse:     c.adresse || null,
  code_postal: c.code_postal || null,
  ville:       c.ville || null,
  pays:        'FRANCE',
  siret:       c.siret || null,
  tva_intra:   c.tva_intra || null,
  telephone:   c.telephone || null,
  email:       c.email || null,
  actif:       true,
}))

console.log(`Prêt à importer ${toInsert.length} clients...`)

// Récupérer les clients existants pour éviter les doublons
const { data: existants } = await sb.from('clients').select('nom')
const nomsExistants = new Set((existants || []).map(c => c.nom.toUpperCase().trim()))

const nouveaux = toInsert.filter(c => !nomsExistants.has(c.nom.toUpperCase().trim()))
const skipped  = toInsert.length - nouveaux.length

console.log(`Déjà en base: ${skipped} | À insérer: ${nouveaux.length}`)

if (nouveaux.length === 0) {
  console.log('Rien à faire !')
  process.exit(0)
}

// Insérer par lots de 20
for (let i = 0; i < nouveaux.length; i += 20) {
  const lot = nouveaux.slice(i, i + 20)
  const { error } = await sb.from('clients').insert(lot)
  if (error) {
    console.error(`Erreur lot ${i}:`, error.message)
    process.exit(1)
  }
  console.log(`  ${i + 1}–${Math.min(i + 20, nouveaux.length)} insérés`)
}

console.log(`\n✅ Import terminé — ${nouveaux.length} nouveaux clients ajoutés`)
console.log(`   (${skipped} clients déjà présents ignorés)`)
