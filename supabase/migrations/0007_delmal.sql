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
