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
