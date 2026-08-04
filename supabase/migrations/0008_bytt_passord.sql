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
