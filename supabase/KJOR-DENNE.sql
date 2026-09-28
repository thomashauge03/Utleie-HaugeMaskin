-- ============================================================
-- Migrasjoner etter 0002, samlet.
-- Lim inn hele fila i Supabase SQL Editor og trykk Run.
-- Trygg a kjore flere ganger - alt er idempotent.
--
-- ADVARSEL: fila fjerner ogsa data. Disse migrasjonene river:
--   0010_fjern_kjoretoy.sql
-- Idempotent betyr lik sluttilstand, ikke at ingenting gar tapt.
-- Sjekk at det som droppes er tatt vare pa for du kjorer.
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

-- >>>>>>>>>>  0007_delmal.sql  <<<<<<<<<<
-- ═══════════════════════════════════════════════════════════
--  Mål per del
--
--  Regnearket har en dimensjon under hver delkolonne, ikke bare
--  en avkrysning. Servicearbeideren trenger målet for å bestille
--  riktig del – en status alene sier bare at noe må byttes.
-- ═══════════════════════════════════════════════════════════

alter table maskin_delstatus
  add column if not exists mal text;

comment on column maskin_delstatus.mal is
  'Mål eller spesifikasjon for delen, f.eks. tannstørrelse. Fritekst, '
  'siden formatet varierer mellom deltyper.';

-- Delstatus opprettes først når noen setter en status. Skal målet
-- kunne fylles ut uten at noe er galt med delen, må raden kunne
-- eksistere med status ok – den er allerede standardverdien.

-- >>>>>>>>>>  0008_bytt_passord.sql  <<<<<<<<<<
-- ═══════════════════════════════════════════════════════════
--  Midlertidig passord
--
--  Admin oppretter bruker med et engangspassord. Ved første
--  innlogging må brukeren sette sitt eget, slik at admin ikke
--  sitter med et passord som fortsatt virker.
-- ═══════════════════════════════════════════════════════════

alter table admin_brukere
  add column if not exists ma_bytte_passord boolean not null default false;

comment on column admin_brukere.ma_bytte_passord is
  'Satt når admin har gitt et midlertidig passord. Brukeren slipper '
  'ikke videre i systemet før det er byttet.';

-- >>>>>>>>>>  0009_kjoretoy.sql  <<<<<<<<<<
-- ═══════════════════════════════════════════════════════════
--  Kjøretøy med EU-kontroll og andre frister
--
--  UTFASET – registeret er flyttet ut av appen, og 0010 river
--  både tabellen og kolonnen på innstillinger. Fila beholdes
--  for historikk. Ikke kjør den alene.
--
--  Egen tabell framfor kolonner på maskiner: et kjøretøy har
--  skilt og en offentlig frist, ikke QR-kode og døgnpris. Å
--  presse begge inn i maskiner ville gitt en tabell der halve
--  kolonnene alltid er tomme, og en utleiekatalog full av
--  objekter som ikke kan leies.
--
--  Feltene merket «Vegvesen» overskrives av oppslaget mot
--  Statens vegvesen når nøkkelen finnes. Fram til da er de
--  manuelle. svv_hentet skiller de to tilfellene.
-- ═══════════════════════════════════════════════════════════

create table if not exists kjoretoy (
  id                  uuid primary key default gen_random_uuid(),
  reg_nr              text not null unique,
  internt_navn        text,
  ansvarlig_navn      text,
  ansvarlig_epost     text,

  -- Vegvesen, med manuell fallback
  merke               text,
  modell              text,
  arsmodell           integer,
  kjoretoy_klasse     text,
  eu_frist            date,
  eu_sist_godkjent    date,
  reg_status          text,
  svv_hentet          timestamptz,

  -- Manuelle frister
  km                  integer,
  forsikring_selskap  text,
  forsikring_forfall  date,
  neste_service       date,
  neste_dekkskift     date,

  status              text not null default 'i_drift'
                      check (status in ('i_drift', 'avskiltet', 'solgt')),
  notat               text,
  opprettet           timestamptz not null default now(),
  oppdatert           timestamptz not null default now()
);

comment on column kjoretoy.reg_nr is
  'Normalisert i applikasjonen: store bokstaver, uten mellomrom og bindestrek.';
comment on column kjoretoy.eu_frist is
  'Kalenderdato, ikke tidspunkt. Fristen er en dag i Statens vegvesens '
  'register, derfor date og ikke timestamptz som resten av skjemaet.';
comment on column kjoretoy.svv_hentet is
  'Null betyr at ingen vellykket oppslag mot Vegvesen har skjedd, og at '
  'feltene over er skrevet inn for hånd.';
comment on column kjoretoy.reg_status is
  'Kodeverdi fra Vegvesen: REGISTRERT, AVREGISTRERT, UREGISTRERT, UTFORT, '
  'VRAKET. Lagres rått framfor som check-constraint, siden kodeverket eies '
  'av Vegvesen og kan utvides uten forvarsel.';

-- Varsellista er «kjøretøy i drift med frist før dato X».
create index if not exists kjoretoy_frist_idx
  on kjoretoy (eu_frist) where status = 'i_drift';

-- Cron-jobben plukker de som er lengst siden oppfrisket.
create index if not exists kjoretoy_hentet_idx
  on kjoretoy (svv_hentet) where status = 'i_drift';

alter table kjoretoy enable row level security;

drop policy if exists admin_alt on kjoretoy;
create policy admin_alt on kjoretoy
  for all using (er_admin()) with check (er_admin());

-- ── Bryter for fristvarselet ─────────────────────────────
alter table innstillinger
  add column if not exists varsle_eu_kontroll boolean not null default true;

comment on column innstillinger.varsle_eu_kontroll is
  'Slår av og på samle-e-posten om frister på kjøretøy.';

-- >>>>>>>>>>  0010_fjern_kjoretoy.sql  <<<<<<<<<<
-- ═══════════════════════════════════════════════════════════
--  Fjerner kjøretøyregisteret
--
--  Registeret er flyttet ut av denne appen. Alt som hørte til
--  det er borte fra koden, og da skal det ikke bli stående
--  igjen et skjema ingen skriver til.
--
--  Tre ting rives, ikke bare tabellen: 0009 la også en kolonne
--  på innstillinger, og e-postloggen har rader av en type som
--  ikke lenger finnes. Lot vi kolonnen stå, ville den ligget
--  der for alltid som et felt uten skjerm.
--
--  MERK: kjør denne FØR koden deployes er feil vei. Koden må ut
--  først. Fram til den er det lagreVarsling som skriver
--  varsle_eu_kontroll, og forsvinner kolonnen under beina på
--  den, feiler hele lagringen av varslingsinnstillinger – også
--  bryterne for utleie.
-- ═══════════════════════════════════════════════════════════

-- Indeksene, RLS-policyen og kolonnekommentarene følger tabellen.
-- Ingen fremmednøkkel, view eller funksjon peker hit.
drop table if exists kjoretoy;

alter table innstillinger
  drop column if exists varsle_eu_kontroll;

-- «Siste utsendinger» i adminpanelet henter de fem nyeste uten filter
-- på type, så gamle fristvarsler ville dukket opp lenge etter at
-- funksjonen var borte.
delete from epost_logg where type = 'eu_kontroll_admin';

-- >>>>>>>>>>  0011_ansatt.sql  <<<<<<<<<<
-- ═══════════════════════════════════════════════════════════
--  Ansatt-rollen og prosjekter
--
--  Egne folk tar ut utstyr til firmaets prosjekter uten å fylle
--  ut kundeskjemaet. Leien føres på prosjektet med internpris.
--  Se docs/superpowers/specs/2026-09-28-ansatt-rolle-design.md.
--
--  Trygg å kjøre mot koden som ligger ute før denne: nye kolonner
--  er valgfrie, eksisterende leier oppfyller sjekken, og
--  tilgangsendringen treffer ingen kodevei som trenger den gamle.
-- ═══════════════════════════════════════════════════════════


-- ── Prosjekter ─────────────────────────────────────────────
create table if not exists prosjekter (
  id        uuid primary key default gen_random_uuid(),
  navn      text not null unique,
  nummer    text,
  aktiv     boolean not null default true,
  opprettet timestamptz not null default now()
);

comment on table prosjekter is
  'Firmaets egne prosjekter. Internleier føres på dem.';
comment on column prosjekter.aktiv is
  'false = avsluttet. Forsvinner fra de ansattes liste, men historikken består.';


-- ── Rollen ansatt ──────────────────────────────────────────
-- Sjekken fra 0005 ble laget inline på kolonnen, så Postgres valgte
-- navnet. Vi finner den på innholdet i stedet for å gjette.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.admin_brukere'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%rolle%'
  loop
    execute format('alter table admin_brukere drop constraint %I', c.conname);
  end loop;
end $$;

alter table admin_brukere
  add constraint admin_brukere_rolle_check
  check (rolle in ('admin', 'service', 'ansatt'));

comment on column admin_brukere.rolle is
  'admin = full tilgang. service = verkstedet, og kan ta ut utstyr. '
  'ansatt = kan bare ta ut utstyr til prosjekter.';

alter table admin_brukere
  add column if not exists telefon text;

comment on column admin_brukere.telefon is
  'Valgfritt mobilnummer, åtte siffer. Vises for admin på internleier.';


-- ── Leier: enten kunde eller ansatt ────────────────────────
alter table leier alter column kunde_id drop not null;
alter table leier alter column planlagt_slutt drop not null;

alter table leier
  add column if not exists ansatt_id uuid references admin_brukere(id),
  add column if not exists prosjekt_id uuid references prosjekter(id);

-- antall_dogn var numeric(6,2) – maks 9999,99. En internleie uten
-- sluttdato («til videre») kan stå ute svært lenge, og med timepris er
-- taket brukt opp etter rundt 10 000 timer (~417 dager): update ville
-- feile på overflow, og leien kunne aldri avsluttes. Idempotent: samme
-- type to ganger er ufarlig.
alter table leier alter column antall_dogn type numeric(10,2);

-- To former, og bare to. En kundeleie ser ut akkurat som før. En
-- internleie har ansatt og prosjekt, og kan stå «til videre».
alter table leier drop constraint if exists leier_leietaker_check;
alter table leier add constraint leier_leietaker_check check (
  (kunde_id is not null and ansatt_id is null and prosjekt_id is null
     and planlagt_slutt is not null)
  or
  (kunde_id is null and ansatt_id is not null and prosjekt_id is not null)
);

create index if not exists leier_prosjekt_idx
  on leier (prosjekt_id) where prosjekt_id is not null;
create index if not exists leier_ansatt_idx
  on leier (ansatt_id) where ansatt_id is not null;


-- ── Radsikkerhet ───────────────────────────────────────────
alter table prosjekter enable row level security;

drop policy if exists admin_alt on prosjekter;
create policy admin_alt on prosjekter
  for all using (er_admin()) with check (er_admin());

-- er_admin() sjekket bare at brukeren var aktiv. Alle policyene bygger
-- på den, så en servicebruker – og nå alle ansatte – kunne lese og
-- endre kundedata rett mot databasen med sin egen sesjon. Alt de andre
-- rollene gjør i appen, går gjennom server actions med service role,
-- så ingenting i koden trenger den gamle bredden.
create or replace function er_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_brukere
    where id = auth.uid() and aktiv = true and rolle = 'admin'
  );
$$;

-- Innloggingen (hentAdmin, loggInn) leser brukerens egen rad med
-- brukerens egen sesjon. Det må alle roller få lov til.
drop policy if exists egen_rad on admin_brukere;
create policy egen_rad on admin_brukere
  for select using (id = auth.uid());
