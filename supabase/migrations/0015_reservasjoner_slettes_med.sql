-- ═══════════════════════════════════════════════════════════
--  Reservasjoner slettes med leien og maskinen
--
--  0012 laget begge fremmednøklene uten «on delete». Da stoppet
--  databasen slettingen av en leie med en hentet reservasjon (23503),
--  og en maskin med reservasjoner kunne ikke slettes i det hele tatt.
--  Se docs/superpowers/specs/2026-10-01-sletting-med-reservasjoner-design.md.
--
--  Trygg å kjøre før koden: ingen kolonner endres, og den gamle koden
--  sletter i samme rekkefølge – det som feilet, går nå. Trygg å kjøre
--  flere ganger: en nøkkel byttes bare når den mangler cascade.
-- ═══════════════════════════════════════════════════════════


-- ── Den hentede reservasjonen følger leien ─────────────────
-- Avklart med Thomas 01.10.2026. «Slett leien» lover «for godt, med
-- bilder og historikk», og reservasjonen hører til leiens historikk.
-- Med «set null» ville navn og mobil blitt liggende uten leie – og
-- rydde-jobben lar hentede reservasjoner stå.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid    = 'public.reservasjoner'::regclass
       and conname     = 'reservasjoner_leie_id_fkey'
       and confdeltype = 'c'
  ) then
    alter table public.reservasjoner
      drop constraint if exists reservasjoner_leie_id_fkey,
      add  constraint reservasjoner_leie_id_fkey
           foreign key (leie_id) references public.leier(id) on delete cascade;
  end if;
end $$;


-- ── Reservasjonene følger maskinen ─────────────────────────
-- maskin_id er påkrevd, så «set null» er ikke et valg. Leiene sperrer
-- fortsatt: leier.maskin_id er urørt, så en maskin med historikk går
-- bare når appen har slettet leiene først.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid    = 'public.reservasjoner'::regclass
       and conname     = 'reservasjoner_maskin_id_fkey'
       and confdeltype = 'c'
  ) then
    alter table public.reservasjoner
      drop constraint if exists reservasjoner_maskin_id_fkey,
      add  constraint reservasjoner_maskin_id_fkey
           foreign key (maskin_id) references public.maskiner(id) on delete cascade;
  end if;
end $$;


-- ── Kontroll ───────────────────────────────────────────────
-- En nøkkel uten cascade stopper slettingen uansett navn. Finnes det en
-- ekstra en (lagt til for hånd, med et annet navn), skal det sies her –
-- ikke først når admin trykker «Slett».
do $$
declare
  uten_cascade text;
begin
  select string_agg(c.conname, ', ' order by c.conname)
    into uten_cascade
    from pg_constraint c
   where c.conrelid = 'public.reservasjoner'::regclass
     and c.contype  = 'f'
     and c.confrelid in ('public.leier'::regclass, 'public.maskiner'::regclass)
     and c.confdeltype <> 'c';
  if uten_cascade is not null then
    raise exception 'Disse nøklene fra reservasjoner mangler on delete cascade: %', uten_cascade;
  end if;
end $$;
