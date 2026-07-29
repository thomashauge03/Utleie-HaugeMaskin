-- ═══════════════════════════════════════════════════════════
--  Kategorier som admin selv kan styre
--
--  maskiner.kategori beholdes som tekst. Denne tabellen er
--  plukklista admin vedlikeholder, ikke en fremmednøkkel – da
--  slipper vi å migrere eksisterende rader, og en maskin med en
--  kategori som senere slettes blir ikke stående uten verdi.
--  Endres navnet på en kategori, oppdaterer appen maskinene som
--  bruker den i samme operasjon.
-- ═══════════════════════════════════════════════════════════

create table kategorier (
  id         uuid primary key default gen_random_uuid(),
  navn       text not null unique,
  rekkefolge integer not null default 0,
  opprettet  timestamptz not null default now()
);

create index kategorier_rekkefolge_idx on kategorier (rekkefolge, navn);

-- Ta vare på det som allerede er skrevet inn på maskinene.
insert into kategorier (navn)
select distinct trim(kategori)
from maskiner
where kategori is not null and trim(kategori) <> ''
on conflict (navn) do nothing;

alter table kategorier enable row level security;

create policy admin_alt on kategorier
  for all using (er_admin()) with check (er_admin());
