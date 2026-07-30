-- ============================================================
-- Alle ukjorte migrasjoner samlet: 0003, 0004, 0005
-- Lim inn hele fila i Supabase SQL Editor og trykk Run.
-- Trygg a kjore flere ganger.
-- ============================================================

-- >>>>>>>>>>>>>>>>  0003_varsling.sql  <<<<<<<<<<<<<<<<
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  E-postvarsling
--
--  Mottakere lagres som kommaseparert tekst framfor egen tabell.
--  Det er typisk toâ€“tre adresser hos et firma i denne stÃ¸rrelsen,
--  og en tabell ville kostet mer i vedlikehold enn den ga.
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
  'Av som standard â€“ en purring til kunden bÃ¸r vÃ¦re et bevisst valg.';


-- â•â•â• Logg over sendt e-post â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Uten denne vet ingen om et varsel faktisk gikk ut, og en
-- forfallspurring kan bli sendt om igjen hver eneste dag.

create table epost_logg (
  id        uuid primary key default gen_random_uuid(),
  leie_id   uuid references leier(id) on delete cascade,
  type      text not null,
  mottaker  text not null,
  emne      text,
  status    text not null default 'sendt',   -- sendt | feilet
  feilmelding text,
  sendt     timestamptz not null default now()
);

create index epost_logg_leie_idx on epost_logg (leie_id, type);
create index epost_logg_sendt_idx on epost_logg (sendt desc);

-- Ã‰n forfallspurring per leie per dag, hÃ¥ndhevet i databasen framfor
-- i kode â€“ da kan ikke to samtidige kjÃ¸ringer sende dobbelt opp.
create unique index epost_logg_daglig_unik
  on epost_logg (leie_id, type, (sendt::date))
  where status = 'sendt' and type in ('forfalt_admin', 'forfalt_kunde');

alter table epost_logg enable row level security;

create policy admin_alt on epost_logg
  for all using (er_admin()) with check (er_admin());


-- >>>>>>>>>>>>>>>>  0004_prisenhet.sql  <<<<<<<<<<<<<<<<
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  Time- eller dÃ¸gnpris per maskin
--
--  Kolonnen dogn_pris beholder navnet sitt selv om den nÃ¥ kan
--  inneholde en timepris. Ã… dÃ¸pe den om ville blanket ut alle
--  priser i systemet fram til migrasjonen faktisk er kjÃ¸rt, og
--  dette er en base i drift. Kommentaren under stÃ¥r som
--  forklaring til den som leser skjemaet senere.
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

alter table maskiner
  add column if not exists pris_enhet text not null default 'dogn'
    check (pris_enhet in ('dogn', 'time'));

comment on column maskiner.dogn_pris is
  'Pris per enhet. Enheten stÃ¥r i pris_enhet â€“ kan vÃ¦re dÃ¸gn eller time.';

comment on column maskiner.pris_enhet is
  'dogn eller time. Styrer bÃ¥de visning og hvordan belÃ¸p foreslÃ¥s.';

comment on column leier.antall_dogn is
  'Antall enheter â€“ dÃ¸gn eller timer, avhengig av maskinens pris_enhet.';


-- >>>>>>>>>>>>>>>>  0005_verksted.sql  <<<<<<<<<<<<<<<<
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  Verkstedmodul
--
--  Skuffer leies ikke ut som motorsager. QR-koden henger ett
--  sted, viser hele lista, og brukes til Ã¥ holde styr pÃ¥ hva
--  som mÃ¥ fikses. Kategorien velges i innstillingene, sÃ¥ det
--  ikke er lÃ¥st til navnet Â«SkufferÂ».
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€ Roller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Fram til nÃ¥ kunne alle innloggede alt. Servicearbeidere skal
-- kunne styre verkstedet, men ikke se kundedata eller slette
-- maskiner. Eksisterende brukere blir admin.
alter table admin_brukere
  add column if not exists rolle text not null default 'admin'
    check (rolle in ('admin', 'service'));

comment on column admin_brukere.rolle is
  'admin = full tilgang. service = kun verkstedmodulen.';


-- â”€â”€ Hvilken kategori er verkstedkategori â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table innstillinger
  add column if not exists verksted_kategori text;

comment on column innstillinger.verksted_kategori is
  'Navnet pÃ¥ kategorien som bruker verkstedflyten framfor utleie.';


-- â”€â”€ Felter pÃ¥ maskinen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- â”€â”€ Deler det kan vÃ¦re noe galt med â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Egen tabell framfor faste kolonner, slik at verkstedet kan
-- legge til f.eks. Â«SideskjÃ¦rÂ» uten en ny migrasjon.
create table if not exists verksted_deler (
  id         uuid primary key default gen_random_uuid(),
  navn       text not null unique,
  rekkefolge integer not null default 0,
  opprettet  timestamptz not null default now()
);

insert into verksted_deler (navn, rekkefolge) values
  ('Tenner', 1),
  ('Tannholder', 2),
  ('SlitestÃ¥l', 3),
  ('Bunn', 4)
on conflict (navn) do nothing;


-- â”€â”€ Tilstand per del per maskin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table if not exists maskin_delstatus (
  maskin_id  uuid not null references maskiner(id) on delete cascade,
  del_id     uuid not null references verksted_deler(id) on delete cascade,
  status     text not null default 'ok'
             check (status in ('ok', 'ma_byttes', 'bestilt', 'byttet')),
  oppdatert  timestamptz not null default now(),
  primary key (maskin_id, del_id)
);

create index maskin_delstatus_maskin_idx on maskin_delstatus (maskin_id);


-- â”€â”€ Logg over utfÃ¸rt arbeid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Uten denne ser man bare hva som gjenstÃ¥r, ikke hva som er
-- gjort fÃ¸r â€“ og da mister man slitasjehistorikken.
create table if not exists verksted_logg (
  id          uuid primary key default gen_random_uuid(),
  maskin_id   uuid not null references maskiner(id) on delete cascade,
  del_navn    text,
  beskrivelse text not null,
  aktor       text not null,
  tid         timestamptz not null default now()
);

create index verksted_logg_maskin_idx on verksted_logg (maskin_id, tid desc);


-- â”€â”€ Radsikkerhet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Lesing for anonyme skjer gjennom server-ruter med service
-- role, som i resten av kundeflyten. Her lÃ¥ser vi til admin.
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

