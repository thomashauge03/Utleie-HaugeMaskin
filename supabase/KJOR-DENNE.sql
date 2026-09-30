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

-- >>>>>>>>>>  0012_reservasjoner.sql  <<<<<<<<<<
-- ═══════════════════════════════════════════════════════════
--  Reservasjoner
--
--  Framtidige utleier, lagt inn av admin. En annen kunde kan leie
--  maskinen fram til dagen før, ansatte får varsel, og kunden med
--  reservasjonen kjennes igjen på mobilnummeret når den hentes.
--  Se docs/superpowers/specs/2026-09-30-reservasjoner-design.md.
--
--  Trygg å kjøre mot koden som ligger ute: ingen eksisterende tabell
--  endres, og koden tåler at denne ikke er kjørt.
-- ═══════════════════════════════════════════════════════════

create extension if not exists btree_gist with schema extensions;


-- ── Tabellen ───────────────────────────────────────────────
create table if not exists reservasjoner (
  id            uuid primary key default gen_random_uuid(),
  maskin_id     uuid not null references maskiner(id),
  fra_dato      date not null,
  til_dato      date not null,
  kunde_navn    text not null,
  kunde_telefon text not null,
  notat         text,
  status        text not null default 'aktiv'
                check (status in ('forespurt', 'aktiv', 'hentet', 'avlyst')),
  leie_id       uuid references leier(id),
  opprettet_av  uuid references admin_brukere(id),
  opprettet     timestamptz not null default now(),

  constraint reservasjoner_datoer check (til_dato >= fra_dato),

  -- To aktive reservasjoner på samme maskin kan ikke overlappe. En
  -- forespørsel (del 3) sperrer ingenting før admin har godkjent den.
  constraint reservasjoner_uten_overlapp exclude using gist (
    maskin_id with =,
    daterange(fra_dato, til_dato, '[]') with &&
  ) where (status = 'aktiv')
);

comment on table reservasjoner is
  'Framtidige utleier. Datoene er norske kalenderdager, begge med.';
comment on column reservasjoner.kunde_telefon is
  'Åtte siffer, som kunder.telefon. Slik kjennes kunden igjen ved henting.';

create index if not exists reservasjoner_maskin_idx
  on reservasjoner (maskin_id, fra_dato) where status = 'aktiv';


-- ── Radsikkerhet ───────────────────────────────────────────
alter table reservasjoner enable row level security;

drop policy if exists admin_alt on reservasjoner;
create policy admin_alt on reservasjoner
  for all using (er_admin()) with check (er_admin());


-- ── Offentlig: når maskinene er opptatt (hovedsida, del 2) ─
-- Bare datoer. Ingen navn, ingen telefon, ingen referanser.
--
-- Lages bare når den ikke finnes. 0013 legger til kolonnen levert, og
-- create or replace kan ikke fjerne kolonner: kjørt på nytt etter 0013
-- (KJOR-DENNE.sql en gang til) stoppet denne hele fila med «cannot drop
-- columns from view», før senere migrasjoner var kjørt.
do $$
begin
  if to_regclass('public.hm_offentleg_opptatt') is null then
    create view public.hm_offentleg_opptatt as
      select r.maskin_id, r.fra_dato, r.til_dato
        from reservasjoner r
        join maskiner m on m.id = r.maskin_id
       where r.status = 'aktiv'
         and r.til_dato >= (now() at time zone 'Europe/Oslo')::date
         and m.aktiv and m.status <> 'utrangert'
      union all
      select l.maskin_id,
             (l.start_tid at time zone 'Europe/Oslo')::date,
             (l.planlagt_slutt at time zone 'Europe/Oslo')::date
        from leier l
        join maskiner m on m.id = l.maskin_id
       where l.status in ('aktiv', 'venter_godkjenning')
         and m.aktiv and m.status <> 'utrangert';

    comment on view public.hm_offentleg_opptatt is
      'Dager maskinene er opptatt, for hovedsida. Ingen kunde-, leie- eller '
      'internopplysninger. til_dato null betyr til videre.';
  end if;
end $$;

-- REKKEFØLGEN ER IKKE VALGFRI: revoke før grant. Supabase gir anon alt på
-- nye visninger, og en visning uten security_invoker kjører med eierens
-- rettigheter – en anonym DELETE ville gått rett til grunntabellen.
-- Se hm-web-craft/speiling/01-utleie.sql.
revoke all    on public.hm_offentleg_opptatt from anon, authenticated;
grant  select on public.hm_offentleg_opptatt to   anon, authenticated;


-- ── Kontroll ───────────────────────────────────────────────
do $$
declare
  uten_rls text;
  for_mye  text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into uten_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relname in ('reservasjoner', 'maskiner', 'leier')
     and not c.relrowsecurity;
  if uten_rls is not null then
    raise exception 'Disse tabellene mangler RLS: %', uten_rls;
  end if;

  select string_agg(distinct privilege_type, ', ')
    into for_mye
    from information_schema.table_privileges
   where grantee in ('anon', 'authenticated')
     and table_schema = 'public'
     and table_name = 'hm_offentleg_opptatt'
     and privilege_type <> 'SELECT';
  if for_mye is not null then
    raise exception 'hm_offentleg_opptatt gir anon mer enn SELECT: %', for_mye;
  end if;
end $$;

-- >>>>>>>>>>  0013_foresporsel.sql  <<<<<<<<<<
-- ═══════════════════════════════════════════════════════════
--  Leieforespørsler fra haugemaskin.no
--
--  Kunden ber om datoer på nettsida, og forespørselen lagres som en
--  reservasjon med status «forespurt» (fra 0012). Det eneste som mangler,
--  er stedet for kundens e-post, som er valgfri i skjemaet.
--  Se docs/superpowers/specs/2026-09-30-leieforesporsel-design.md.
--
--  I tillegg får hovedsida vite om en maskin er levert (nederst).
--
--  Bare tillegg: koden som ligger ute, leser verken kolonnen eller
--  flagget, og hovedsida leser visningen med select=*.
-- ═══════════════════════════════════════════════════════════

alter table reservasjoner add column if not exists kunde_epost text;

comment on column reservasjoner.kunde_epost is
  'Valgfri, fra forespørselsskjemaet på haugemaskin.no. Slettes med '
  'forespørselen 30 dager etter perioden hvis det ikke blir leie.';


-- ── Hovedsida: er maskinen levert? ─────────────────────────
-- Hovedsida skriver «Ute nå – skulle vært levert 12. september» om en
-- leie på overtid. En leie som venter på godkjenning, er levert – maskinen
-- står i gården – men planlagt slutt er ofte passert før admin rekker å
-- godkjenne. Uten flagget ville den sett ut som den var på overtid.
--
-- Samme visning som i 0012, med levert bakerst: create or replace godtar
-- bare nye kolonner etter de gamle.
create or replace view public.hm_offentleg_opptatt as
  select r.maskin_id, r.fra_dato, r.til_dato, false as levert
    from reservasjoner r
    join maskiner m on m.id = r.maskin_id
   where r.status = 'aktiv'
     and r.til_dato >= (now() at time zone 'Europe/Oslo')::date
     and m.aktiv and m.status <> 'utrangert'
  union all
  select l.maskin_id,
         (l.start_tid at time zone 'Europe/Oslo')::date,
         (l.planlagt_slutt at time zone 'Europe/Oslo')::date,
         l.status = 'venter_godkjenning'
    from leier l
    join maskiner m on m.id = l.maskin_id
   where l.status in ('aktiv', 'venter_godkjenning')
     and m.aktiv and m.status <> 'utrangert';

comment on view public.hm_offentleg_opptatt is
  'Dager maskinene er opptatt, for hovedsida. Ingen kunde-, leie- eller '
  'internopplysninger. til_dato null betyr til videre. levert betyr at '
  'leia venter på godkjenning – maskinen er tilbake.';

-- Som i 0012: revoke før grant.
revoke all    on public.hm_offentleg_opptatt from anon, authenticated;
grant  select on public.hm_offentleg_opptatt to   anon, authenticated;


-- ── Kontroll ───────────────────────────────────────────────
do $$
declare
  for_mye text;
begin
  select string_agg(distinct privilege_type, ', ')
    into for_mye
    from information_schema.table_privileges
   where grantee in ('anon', 'authenticated')
     and table_schema = 'public'
     and table_name = 'hm_offentleg_opptatt'
     and privilege_type <> 'SELECT';
  if for_mye is not null then
    raise exception 'hm_offentleg_opptatt gir anon mer enn SELECT: %', for_mye;
  end if;
end $$;

-- >>>>>>>>>>  0014_bildesletting.sql  <<<<<<<<<<
-- ═══════════════════════════════════════════════════════════
--  Sletting av bilder og posisjon etter 24 måneder
--
--  Personvernsida lover at bilder og posisjonsdata slettes etter
--  24 måneder. /api/rydd kaller funksjonen under hver morgen så
--  lenge bryteren står på, og sletter filene i Storage etterpå.
--  Se docs/superpowers/specs/2026-09-30-bildesletting-design.md.
--
--  Trygg å kjøre mot koden som ligger ute: ingen eksisterende
--  kolonne endres, og ruta hopper over steget når funksjonen
--  mangler. Migrasjonen sletter ingenting selv.
-- ═══════════════════════════════════════════════════════════


-- ── Bryteren ───────────────────────────────────────────────
alter table innstillinger
  add column if not exists slett_gamle_bilder boolean not null default true;

comment on column innstillinger.slett_gamle_bilder is
  'Slett bilder og posisjon eldre enn 24 måneder hver morgen (/api/rydd). '
  'Personvernsida sier «automatisk» bare når denne er på.';


-- ── Slettingen ─────────────────────────────────────────────
-- Rader først, filer etterpå – motsatt av slettLeierMedFiler, og med
-- vilje. Radene og hendelsene går i én transaksjon her. Feiler
-- filslettingen i appen etterpå, er fila foreldreløs og eldre enn 24
-- måneder, og kommer med neste morgen. Jobben retter seg selv.
--
-- plpgsql framfor sql: kroppen sjekkes ikke mot storage.objects når
-- funksjonen lages, så migrasjonen går også der Storage mangler.
--
-- maks gjelder hver av de to delene. 500 + 500 holder svaret under
-- PostgREST sitt tak på 1000 rader; det som ikke rekkes, tas neste dag.
create or replace function public.slett_utlopte_bilder(
  tidspunkt timestamptz default now(),
  maks      integer     default 500
)
returns table (sti text, foreldrelos boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Aldri fram i tid. Et nysgjerrig kall i SQL-editoren med en dato
  -- langt fram skal ikke slette noe som ikke er utløpt i dag.
  grense constant timestamptz := least(tidspunkt, now()) - interval '24 months';
begin
  -- Foreldreløse filer først, mens radene som slettes under ennå finnes.
  -- Ellers ville de samme filene kommet med to ganger. Bare stier av
  -- formen /api/bilder/ny lager (som BILDE_STI i validering.ts): legges
  -- noe annet i bøtta senere, blir det stående.
  if to_regclass('storage.objects') is not null then
    return query
      select o.name, true
        from storage.objects o
       where o.bucket_id = 'bilder'
         and o.name ~ '^\d{4}-\d{2}/(henting|levering)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
         and o.created_at < grense
         and not exists (select 1 from public.bilder b where b.fil_sti = o.name)
       order by o.created_at
       limit maks;
  end if;

  -- Bilder på en leie som pågår, venter til leien er avsluttet:
  -- hentebildet er beviset på tilstanden maskinen gikk ut i.
  --
  -- «delete from» står etter parentesen med vilje. lag-samlemigrasjon.mjs
  -- advarer mot linjer som begynner med det, og denne migrasjonen river
  -- ingenting når den kjøres.
  --
  -- fil_sti er ikke unik. Står en sti fortsatt på en rad som ikke slettes
  -- nå, blir fila liggende til den raden også er utløpt. Hovedspørringen
  -- ser tabellen slik den var før slettingen – derfor unntaket for radene
  -- i utlopte.
  return query
    with utlopte as (
      select b.id
        from public.bilder b
        join public.leier l on l.id = b.leie_id
       where b.mottatt_tid < grense
         and l.status not in ('aktiv', 'venter_godkjenning')
       order by b.mottatt_tid
       limit maks
    ),
    slettet as (delete from public.bilder b
                 using utlopte u
                 where b.id = u.id
             returning b.leie_id, b.type, b.fil_sti),
    logget as (
      insert into public.hendelser (leie_id, type, beskrivelse, aktor)
      select s.leie_id,
             'bilder_slettet',
             'Bilder slettet etter 24 måneder: '
               || string_agg(distinct s.type, ' og ' order by s.type),
             'system'
        from slettet s
       group by s.leie_id
    )
    select distinct s.fil_sti, false
      from slettet s
     where not exists (
       select 1
         from public.bilder b
        where b.fil_sti = s.fil_sti
          and not exists (select 1 from utlopte u where u.id = b.id)
     );
end;
$$;

comment on function public.slett_utlopte_bilder(timestamptz, integer) is
  'Sletter bilderader eldre enn 24 måneder (ikke på pågående leier), logger '
  'én hendelse per leie, og returnerer stiene som skal slettes i Storage – '
  'pluss foreldreløse filer eldre enn 24 måneder. Kalles av /api/rydd. '
  'tidspunkt er for tester og kappes til now().';

-- Supabase gir anon og authenticated execute på nye funksjoner. Uten
-- revoke kunne hvem som helst kalt denne via /rest/v1/rpc.
revoke all     on function public.slett_utlopte_bilder(timestamptz, integer)
  from public, anon, authenticated;
grant  execute on function public.slett_utlopte_bilder(timestamptz, integer)
  to service_role;


-- ── Kontroll: rettigheter ──────────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.slett_utlopte_bilder(timestamptz, integer)', 'execute')
     or has_function_privilege('authenticated', 'public.slett_utlopte_bilder(timestamptz, integer)', 'execute')
  then
    raise exception 'slett_utlopte_bilder kan kalles av anon eller authenticated';
  end if;
end $$;


-- ── Kontroll: Storage ──────────────────────────────────────
-- Funksjonen kjører som den som lager den (postgres i SQL-editoren).
-- Kommer ikke den rollen forbi radsikkerheten på storage.objects, gir
-- søket etter foreldreløse filer bare tomt svar – ingen feil, og ingen
-- ville merket det før i 2028. Da er det bedre å stoppe her.
do $$
declare
  rls     boolean;
  tvunget boolean;
  eier    text;
begin
  select c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner)
    into rls, tvunget, eier
    from pg_class c
   where c.oid = to_regclass('storage.objects');

  if rls
     and (eier <> current_user or tvunget)
     and not exists (
       select 1 from pg_roles
        where rolname = current_user and (rolsuper or rolbypassrls)
     )
  then
    raise exception 'Rollen % kommer ikke forbi radsikkerheten på storage.objects, så foreldreløse filer ville aldri blitt funnet. Kjør migrasjonen som postgres i Supabase SQL Editor.',
      current_user;
  end if;
end $$;
