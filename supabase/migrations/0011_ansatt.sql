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
