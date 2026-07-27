-- ═══════════════════════════════════════════════════════════
--  Utleiesystem for anleggsfirma – initielt skjema
--  Se docs/TEKNISK-PLAN.md for begrunnelse bak valgene
-- ═══════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";


-- ═══ Admin-brukere ═══════════════════════════════════════════
-- Kobles mot Supabase Auth. Alle har lik, full tilgang – ingen roller.
create table admin_brukere (
  id         uuid primary key references auth.users(id) on delete cascade,
  navn       text not null,
  epost      text not null unique,
  aktiv      boolean not null default true,
  opprettet  timestamptz not null default now()
);

-- Hjelpefunksjon brukt av alle RLS-policyer under.
create or replace function er_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_brukere
    where id = auth.uid() and aktiv = true
  );
$$;


-- ═══ Innstillinger ═══════════════════════════════════════════
-- Én enkelt rad. Låst med en check slik at det ikke kan bli flere.
create table innstillinger (
  id                  boolean primary key default true check (id),
  firmanavn           text not null default '',
  vilkar_tekst        text not null default '',
  vis_pris_standard   boolean not null default true,
  varsel_epost        text,
  ical_token          text not null default encode(gen_random_bytes(24), 'hex'),
  oppdatert           timestamptz not null default now()
);

insert into innstillinger (id) values (true);


-- ═══ Kunder ══════════════════════════════════════════════════
create table kunder (
  id          uuid primary key default gen_random_uuid(),
  navn        text not null,
  telefon     text not null unique,
  adresse     text not null,                -- fakturaadresse
  epost       text not null,
  status      text not null default 'ny'
              check (status in ('ny', 'godkjent', 'sperret')),
  admin_notat text,                         -- varig merknad, kun for admin
  opprettet   timestamptz not null default now()
);

create index kunder_telefon_idx on kunder (telefon);


-- ═══ Maskiner ════════════════════════════════════════════════
create sequence maskin_nr_seq;

create table maskiner (
  id                 uuid primary key default gen_random_uuid(),
  qr_kode            text not null unique
                     default 'M-' || lpad(nextval('maskin_nr_seq')::text, 4, '0'),
  navn               text not null,
  kategori           text,
  internnummer       text,
  dogn_pris          numeric(10,2),
  vis_pris           boolean not null default true,
  status             text not null default 'ledig'
                     check (status in ('ledig', 'utleid', 'service', 'utrangert')),
  bilde_sti          text,
  bruksanvisning_sti text,
  notat              text,
  aktiv              boolean not null default true,
  opprettet          timestamptz not null default now()
);

create index maskiner_qr_idx on maskiner (qr_kode);


-- ═══ Leier ═══════════════════════════════════════════════════
create sequence leie_nr_seq;

create table leier (
  id              uuid primary key default gen_random_uuid(),
  referanse       text not null unique
                  default 'L-' || to_char(now(), 'YYMM') || '-'
                          || lpad(nextval('leie_nr_seq')::text, 4, '0'),
  maskin_id       uuid not null references maskiner(id),
  kunde_id        uuid not null references kunder(id),
  enhets_id       text,                      -- UUID fra kundens telefon

  status          text not null default 'aktiv'
                  check (status in ('aktiv', 'venter_godkjenning',
                                    'avsluttet', 'avvist')),

  planlagt_slutt  timestamptz not null,      -- kundens forventede leveringsdato
  start_tid       timestamptz not null default now(),
  slutt_tid       timestamptz,               -- servertid da returbildet kom inn
  godkjent_tid    timestamptz,
  godkjent_av     uuid references admin_brukere(id),

  -- Forslag fra systemet. Admin kan alltid overstyre – se plan pkt. 4.
  antall_dogn     numeric(6,2),
  belop           numeric(10,2),
  manuelt_justert boolean not null default false,
  fakturert       boolean not null default false,

  kommentar_start text,                      -- kundens kommentar ved henting
  kommentar_retur text,                      -- kundens kommentar ved levering
  admin_notat     text,
  avvik           text,                      -- skade registrert av admin

  opprettet       timestamptz not null default now()
);

-- Én maskin kan bare ha én leie om gangen. Håndhevet i databasen slik at
-- to samtidige skanninger ikke kan dobbeltlease samme maskin.
create unique index leier_en_aktiv_per_maskin
  on leier (maskin_id)
  where status in ('aktiv', 'venter_godkjenning');

create index leier_status_idx    on leier (status);
create index leier_kunde_idx     on leier (kunde_id);
create index leier_enhet_idx     on leier (enhets_id);
create index leier_forfall_idx   on leier (planlagt_slutt) where status = 'aktiv';


-- ═══ Bilder ══════════════════════════════════════════════════
create table bilder (
  id            uuid primary key default gen_random_uuid(),
  leie_id       uuid not null references leier(id) on delete cascade,
  type          text not null check (type in ('henting', 'levering')),
  fil_sti       text not null,
  lat           double precision,
  lng           double precision,
  noyaktighet_m double precision,
  mottatt_tid   timestamptz not null default now(),  -- servertid, ikke EXIF
  ip            inet
);

create index bilder_leie_idx on bilder (leie_id);


-- ═══ Hendelseslogg ═══════════════════════════════════════════
create table hendelser (
  id          bigserial primary key,
  leie_id     uuid references leier(id) on delete cascade,
  type        text not null,
  beskrivelse text,
  aktor       text,                          -- 'kunde:<enhets_id>' | 'admin:<epost>'
  tid         timestamptz not null default now()
);

create index hendelser_leie_idx on hendelser (leie_id, tid desc);


-- ═══ Row Level Security ══════════════════════════════════════
-- Ingen tabell er åpen for anon. Kundeflyten går utelukkende gjennom
-- server-ruter i Next.js som bruker service role-nøkkelen og validerer
-- tilgang selv (enhets-ID / referanse). Det holder angrepsflaten liten.

alter table admin_brukere  enable row level security;
alter table innstillinger  enable row level security;
alter table kunder         enable row level security;
alter table maskiner       enable row level security;
alter table leier          enable row level security;
alter table bilder         enable row level security;
alter table hendelser      enable row level security;

create policy admin_alt on admin_brukere for all using (er_admin()) with check (er_admin());
create policy admin_alt on innstillinger for all using (er_admin()) with check (er_admin());
create policy admin_alt on kunder        for all using (er_admin()) with check (er_admin());
create policy admin_alt on maskiner      for all using (er_admin()) with check (er_admin());
create policy admin_alt on leier         for all using (er_admin()) with check (er_admin());
create policy admin_alt on bilder        for all using (er_admin()) with check (er_admin());
create policy admin_alt on hendelser     for all using (er_admin()) with check (er_admin());
