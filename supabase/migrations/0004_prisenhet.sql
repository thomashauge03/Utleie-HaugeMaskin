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
