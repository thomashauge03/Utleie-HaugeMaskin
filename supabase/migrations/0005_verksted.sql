-- ═══════════════════════════════════════════════════════════
--  Verkstedmodul
--
--  Skuffer leies ikke ut som motorsager. QR-koden henger ett
--  sted, viser hele lista, og brukes til å holde styr på hva
--  som må fikses. Kategorien velges i innstillingene, så det
--  ikke er låst til navnet «Skuffer».
-- ═══════════════════════════════════════════════════════════

-- ── Roller ─────────────────────────────────────────────────
-- Fram til nå kunne alle innloggede alt. Servicearbeidere skal
-- kunne styre verkstedet, men ikke se kundedata eller slette
-- maskiner. Eksisterende brukere blir admin.
alter table admin_brukere
  add column if not exists rolle text not null default 'admin'
    check (rolle in ('admin', 'service'));

comment on column admin_brukere.rolle is
  'admin = full tilgang. service = kun verkstedmodulen.';


-- ── Hvilken kategori er verkstedkategori ───────────────────
alter table innstillinger
  add column if not exists verksted_kategori text;

comment on column innstillinger.verksted_kategori is
  'Navnet på kategorien som bruker verkstedflyten framfor utleie.';


-- ── Felter på maskinen ─────────────────────────────────────
alter table maskiner
  add column if not exists kjeft_dimensjon text,
  add column if not exists verksted_status text
    check (verksted_status in ('ma_sveises', 'deler_bestilt', 'klar'));

comment on column maskiner.verksted_status is
  'null = ingen sak registrert. Ellers ma_sveises / deler_bestilt / klar.';


-- ── Deler det kan være noe galt med ────────────────────────
-- Egen tabell framfor faste kolonner, slik at verkstedet kan
-- legge til f.eks. «Sideskjær» uten en ny migrasjon.
create table if not exists verksted_deler (
  id         uuid primary key default gen_random_uuid(),
  navn       text not null unique,
  rekkefolge integer not null default 0,
  opprettet  timestamptz not null default now()
);

insert into verksted_deler (navn, rekkefolge) values
  ('Tenner', 1),
  ('Tannholder', 2),
  ('Slitestål', 3),
  ('Bunn', 4)
on conflict (navn) do nothing;


-- ── Tilstand per del per maskin ────────────────────────────
create table if not exists maskin_delstatus (
  maskin_id  uuid not null references maskiner(id) on delete cascade,
  del_id     uuid not null references verksted_deler(id) on delete cascade,
  status     text not null default 'ok'
             check (status in ('ok', 'ma_byttes', 'bestilt', 'byttet')),
  oppdatert  timestamptz not null default now(),
  primary key (maskin_id, del_id)
);

create index maskin_delstatus_maskin_idx on maskin_delstatus (maskin_id);


-- ── Logg over utført arbeid ────────────────────────────────
-- Uten denne ser man bare hva som gjenstår, ikke hva som er
-- gjort før – og da mister man slitasjehistorikken.
create table if not exists verksted_logg (
  id          uuid primary key default gen_random_uuid(),
  maskin_id   uuid not null references maskiner(id) on delete cascade,
  del_navn    text,
  beskrivelse text not null,
  aktor       text not null,
  tid         timestamptz not null default now()
);

create index verksted_logg_maskin_idx on verksted_logg (maskin_id, tid desc);


-- ── Radsikkerhet ───────────────────────────────────────────
-- Lesing for anonyme skjer gjennom server-ruter med service
-- role, som i resten av kundeflyten. Her låser vi til admin.
alter table verksted_deler    enable row level security;
alter table maskin_delstatus  enable row level security;
alter table verksted_logg     enable row level security;

drop policy if exists admin_alt on verksted_deler;
drop policy if exists admin_alt on maskin_delstatus;
drop policy if exists admin_alt on verksted_logg;

create policy admin_alt on verksted_deler
  for all using (er_admin()) with check (er_admin());
create policy admin_alt on maskin_delstatus
  for all using (er_admin()) with check (er_admin());
create policy admin_alt on verksted_logg
  for all using (er_admin()) with check (er_admin());
