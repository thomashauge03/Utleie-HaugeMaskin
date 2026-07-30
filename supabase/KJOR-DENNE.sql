-- ============================================================
-- Migrasjoner etter 0002, samlet.
-- Lim inn hele fila i Supabase SQL Editor og trykk Run.
-- Trygg a kjore flere ganger - alt er idempotent.
-- ============================================================

-- >>>>>>>>>>  0003_varsling.sql  <<<<<<<<<<
-- ═══════════════════════════════════════════════════════════
--  E-postvarsling
--
--  Mottakere lagres som kommaseparert tekst framfor egen tabell.
--  Det er typisk to–tre adresser hos et firma i denne størrelsen,
--  og en tabell ville kostet mer i vedlikehold enn den ga.
-- ═══════════════════════════════════════════════════════════

alter table innstillinger
  add column if not exists varsel_kopi        text,
  add column if not exists avsender_navn      text not null default 'HM Utleie',
  -- Til admin
  add column if not exists varsle_ny_leie     boolean not null default true,
  add column if not exists varsle_retur       boolean not null default true,
  add column if not exists varsle_forfalt     boolean not null default true,
  -- Til kunden
  add column if not exists kvittering_start   boolean not null default true,
  add column if not exists kvittering_retur   boolean not null default true,
  add column if not exists purring_forfalt    boolean not null default false;

comment on column innstillinger.varsel_epost is
  'Hovedmottaker(e) for varsler til admin. Kommaseparert.';
comment on column innstillinger.varsel_kopi is
  'Kopimottaker(e). Kommaseparert.';
comment on column innstillinger.purring_forfalt is
  'Av som standard – en purring til kunden bør være et bevisst valg.';


-- ═══ Logg over sendt e-post ════════════════════════════════
-- Uten denne vet ingen om et varsel faktisk gikk ut, og en
-- forfallspurring kan bli sendt om igjen hver eneste dag.

create table if not exists epost_logg (
  id        uuid primary key default gen_random_uuid(),
  leie_id   uuid references leier(id) on delete cascade,
  type      text not null,
  mottaker  text not null,
  emne      text,
  status    text not null default 'sendt',   -- sendt | feilet
  feilmelding text,
  sendt     timestamptz not null default now(),
  -- Egen datokolonne fordi (sendt::date) ikke kan brukes i en indeks:
  -- Postgres krever IMMUTABLE, og cast fra timestamptz til date er
  -- STABLE – den avhenger av tidssoneinnstillingen. Med eksplisitt
  -- UTC blir uttrykket immutable og kan indekseres.
  sendt_dato date generated always as ((sendt at time zone 'UTC')::date) stored
);

create index if not exists epost_logg_leie_idx on epost_logg (leie_id, type);
create index if not exists epost_logg_sendt_idx on epost_logg (sendt desc);

-- Én forfallspurring per leie per dag, håndhevet i databasen framfor
-- i kode – da kan ikke to samtidige kjøringer sende dobbelt opp.
create unique index if not exists epost_logg_daglig_unik
  on epost_logg (leie_id, type, sendt_dato)
  where status = 'sendt' and type in ('forfalt_admin', 'forfalt_kunde');

alter table epost_logg enable row level security;

drop policy if exists admin_alt on epost_logg;
create policy admin_alt on epost_logg
  for all using (er_admin()) with check (er_admin());

-- >>>>>>>>>>  0004_prisenhet.sql  <<<<<<<<<<
-- ═══════════════════════════════════════════════════════════
--  Time- eller døgnpris per maskin
--
--  Kolonnen dogn_pris beholder navnet sitt selv om den nå kan
--  inneholde en timepris. Å døpe den om ville blanket ut alle
--  priser i systemet fram til migrasjonen faktisk er kjørt, og
--  dette er en base i drift. Kommentaren under står som
--  forklaring til den som leser skjemaet senere.
-- ═══════════════════════════════════════════════════════════

alter table maskiner
  add column if not exists pris_enhet text not null default 'dogn'
    check (pris_enhet in ('dogn', 'time'));

comment on column maskiner.dogn_pris is
  'Pris per enhet. Enheten står i pris_enhet – kan være døgn eller time.';

comment on column maskiner.pris_enhet is
  'dogn eller time. Styrer både visning og hvordan beløp foreslås.';

comment on column leier.antall_dogn is
  'Antall enheter – døgn eller timer, avhengig av maskinens pris_enhet.';

-- >>>>>>>>>>  0005_verksted.sql  <<<<<<<<<<
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
  add column if not exists underkategori text,
  add column if not exists verksted_status text
    check (verksted_status in ('ma_sveises', 'deler_bestilt', 'klar'));

comment on column maskiner.underkategori is
  'Type innenfor kategorien, f.eks. Graveskuff eller Pusseskuff. '
  'Brukes til gruppering i verkstedlista.';

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

create index if not exists maskin_delstatus_maskin_idx
  on maskin_delstatus (maskin_id);


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

create index if not exists verksted_logg_maskin_idx
  on verksted_logg (maskin_id, tid desc);


-- ── Etterslep i kategorilista ──────────────────────────────
-- Kategori er fritekst på maskinen, så maskiner lagt inn etter at
-- 0002 kjørte har kategorier som aldri havnet i plukklista. Da var
-- de umulige å velge som verkstedkategori. Denne henter dem inn.
insert into kategorier (navn)
select distinct trim(kategori)
from maskiner
where kategori is not null and trim(kategori) <> ''
on conflict (navn) do nothing;


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

-- >>>>>>>>>>  0006_flere_verkstedkategorier.sql  <<<<<<<<<<
-- ═══════════════════════════════════════════════════════════
--  Flere verkstedkategorier
--
--  Var én tekstverdi i innstillinger. Et flagg per kategori er
--  riktigere: verkstedet kan ha både Skuffer og Klyper, og en
--  kategori tas ut ved å fjerne haken framfor å skrive over en
--  felles verdi.
-- ═══════════════════════════════════════════════════════════

alter table kategorier
  add column if not exists er_verksted boolean not null default false;

comment on column kategorier.er_verksted is
  'Kategorien følger verkstedflyten i stedet for utleie.';

-- Ta vare på valget som allerede er gjort.
update kategorier k
set er_verksted = true
from innstillinger i
where i.verksted_kategori is not null
  and trim(i.verksted_kategori) = k.navn
  and k.er_verksted = false;

-- Kategorien kan ha vært valgt uten å finnes i plukklista, siden
-- kategori er fritekst på maskinen.
insert into kategorier (navn, er_verksted)
select distinct trim(i.verksted_kategori), true
from innstillinger i
where i.verksted_kategori is not null and trim(i.verksted_kategori) <> ''
on conflict (navn) do update set er_verksted = true;

comment on column innstillinger.verksted_kategori is
  'Utfaset – erstattet av kategorier.er_verksted. Beholdes for historikk.';
