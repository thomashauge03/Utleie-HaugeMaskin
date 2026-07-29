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

-- Én forfallspurring per leie per dag, håndhevet i databasen framfor
-- i kode – da kan ikke to samtidige kjøringer sende dobbelt opp.
create unique index epost_logg_daglig_unik
  on epost_logg (leie_id, type, (sendt::date))
  where status = 'sendt' and type in ('forfalt_admin', 'forfalt_kunde');

alter table epost_logg enable row level security;

create policy admin_alt on epost_logg
  for all using (er_admin()) with check (er_admin());
