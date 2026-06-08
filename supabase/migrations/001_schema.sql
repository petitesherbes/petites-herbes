-- Espèces
create table especes (
  id             uuid primary key default gen_random_uuid(),
  nom            text unique not null,
  section        text not null check (section in ('TAPIS','TERREAU','GODETS')),
  g_tapis        decimal,
  g_godet        decimal,
  g_caisse       decimal,
  pct_perte      decimal,
  jours_pousse   int,
  jours_conserv  int,
  rendement      decimal,
  stock_actuel_g decimal default 0,
  prix_graine_kg decimal,
  actif          boolean default true,
  created_at     timestamp default now()
);

-- Contenants
create table contenants (
  id             uuid primary key default gen_random_uuid(),
  type           text check (type in ('TAPIS','GODET','TERREAU')),
  nom            text,
  cout_unitaire  decimal,
  description    text,
  actif          boolean default true
);

-- Paramètres production
create table parametres_production (
  id                    uuid primary key default gen_random_uuid(),
  cout_terreau_litre    decimal default 0.15,
  litres_par_caisse     decimal default 15,
  litres_par_tapis      decimal default 3,
  litres_par_godet      decimal default 0.3,
  cout_eau_m3           decimal,
  cout_electricite_kwh  decimal,
  updated_at            timestamp default now()
);

-- Semis
create table semis (
  id             uuid primary key default gen_random_uuid(),
  date_semis     date not null,
  nom_template   text,
  cout_total     decimal,
  created_at     timestamp default now()
);

-- Semis lignes
create table semis_lignes (
  id               uuid primary key default gen_random_uuid(),
  semis_id         uuid references semis(id) on delete cascade,
  espece_id        uuid references especes(id),
  format           text check (format in ('TAPIS','TERREAU','GODET')),
  quantite         int not null,
  poids_graines_g  decimal,
  prod_estimee     decimal,
  date_dispo       date,
  date_peremption  date,
  cout_graines     decimal,
  cout_contenant   decimal,
  cout_terreau     decimal,
  cout_total_ligne decimal
);

-- Templates
create table templates (
  id          uuid primary key default gen_random_uuid(),
  nom         text unique not null,
  description text,
  created_at  timestamp default now()
);

-- Templates lignes
create table templates_lignes (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid references templates(id) on delete cascade,
  espece_id   uuid references especes(id),
  format      text,
  quantite    int,
  ordre       int
);

-- Stock mouvements
create table stock_mouvements (
  id          uuid primary key default gen_random_uuid(),
  espece_id   uuid references especes(id),
  type        text check (type in ('semis','reappro','ajustement')),
  quantite_g  decimal,
  prix_kg     decimal,
  semis_id    uuid references semis(id),
  note        text,
  created_at  timestamp default now()
);

-- RLS désactivé pour usage interne (pas d'auth utilisateur)
alter table especes enable row level security;
alter table contenants enable row level security;
alter table parametres_production enable row level security;
alter table semis enable row level security;
alter table semis_lignes enable row level security;
alter table templates enable row level security;
alter table templates_lignes enable row level security;
alter table stock_mouvements enable row level security;

-- Policies permissives (accès total via anon key pour usage interne)
create policy "allow all" on especes for all using (true) with check (true);
create policy "allow all" on contenants for all using (true) with check (true);
create policy "allow all" on parametres_production for all using (true) with check (true);
create policy "allow all" on semis for all using (true) with check (true);
create policy "allow all" on semis_lignes for all using (true) with check (true);
create policy "allow all" on templates for all using (true) with check (true);
create policy "allow all" on templates_lignes for all using (true) with check (true);
create policy "allow all" on stock_mouvements for all using (true) with check (true);
