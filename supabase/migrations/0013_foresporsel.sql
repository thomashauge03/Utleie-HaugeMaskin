-- ═══════════════════════════════════════════════════════════
--  Leieforespørsler fra haugemaskin.no
--
--  Kunden ber om datoer på nettsida, og forespørselen lagres som en
--  reservasjon med status «forespurt» (fra 0012). Det eneste som mangler,
--  er stedet for kundens e-post, som er valgfri i skjemaet.
--  Se docs/superpowers/specs/2026-09-30-leieforesporsel-design.md.
--
--  Bare et tillegg: koden som ligger ute, leser ikke kolonnen.
-- ═══════════════════════════════════════════════════════════

alter table reservasjoner add column if not exists kunde_epost text;

comment on column reservasjoner.kunde_epost is
  'Valgfri, fra forespørselsskjemaet på haugemaskin.no. Slettes med '
  'forespørselen 30 dager etter perioden hvis det ikke blir leie.';
