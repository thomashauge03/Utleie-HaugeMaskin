-- ═══════════════════════════════════════════════════════════
--  Tripletex
--
--  Kontoret kan opprette en ordre i Tripletex fra en avsluttet
--  kundeleie: én linje, «Pris ihht vedlegg», med fakturagrunnlagets
--  PDF lagt ved. Appen lager bare ordren. Fakturering og utsending
--  gjør et menneske i Tripletex.
--
--  Bare id-er og vår egen tekst lagres her, aldri det Tripletex
--  svarer (utviklervilkårene, punkt 2.2.4).
-- ═══════════════════════════════════════════════════════════

-- Kundenummeret kontoret skrev inn sist, så det står ferdig neste gang.
alter table kunder
  add column if not exists tripletex_kundenr integer
    check (tripletex_kundenr is null or tripletex_kundenr > 0);

comment on column kunder.tripletex_kundenr is
  'Kundenummeret i Tripletex, slik kontoret skrev det inn sist.';


alter table leier
  -- Null = ikke forsøkt.
  --   oppretter  et kall er hos Tripletex. Over fem minutter: kallet
  --              døde, og ordren KAN finnes.
  --   opprettet  ordren finnes, og id-en står i tripletex_ordre_id.
  --   ukjent     ingen svar eller serverfeil: ordren KAN finnes.
  --              Opprettes ikke på nytt før kontoret har sjekket.
  --   feilet     Tripletex avviste, eller vi kom aldri så langt.
  --              Ingenting er opprettet.
  add column if not exists tripletex_status text
    check (tripletex_status in ('oppretter', 'opprettet', 'ukjent', 'feilet')),
  -- Den interne id-en, som vedlegget trenger.
  add column if not exists tripletex_ordre_id bigint,
  -- Ordrenummeret kontoret ser i Tripletex.
  add column if not exists tripletex_ordrenr text,
  add column if not exists tripletex_kundenr integer,
  --   laster_opp  et kall er hos Tripletex. Over fem minutter: PDF-en
  --               KAN være lagt ved.
  --   lagt_ved    PDF-en ligger på ordren.
  --   ukjent      ingen svar eller serverfeil: den KAN være lagt ved.
  --   feilet      ingenting er lagt ved.
  add column if not exists tripletex_vedlegg text
    check (tripletex_vedlegg in ('laster_opp', 'lagt_ved', 'ukjent', 'feilet')),
  -- Vår egen melding om siste feil. Aldri teksten fra Tripletex.
  add column if not exists tripletex_feil text,
  add column if not exists tripletex_endret timestamptz;

comment on column leier.tripletex_status is
  'Null, oppretter, opprettet, ukjent eller feilet. Se 0017_tripletex.sql.';
comment on column leier.tripletex_feil is
  'Vår egen melding om siste feil. Aldri svarteksten fra Tripletex.';

-- Samme ordre kan ikke stå på to leier.
create unique index if not exists leier_tripletex_ordre_idx
  on leier (tripletex_ordre_id) where tripletex_ordre_id is not null;
