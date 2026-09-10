-- ═══════════════════════════════════════════════════════════
--  Kjøretøy med EU-kontroll og andre frister
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
