-- ═══════════════════════════════════════════════════════════
--  Sletting av bilder og posisjon etter 24 måneder
--
--  Personvernsida lover at bilder og posisjonsdata slettes etter
--  24 måneder. /api/rydd kaller funksjonen under hver morgen så
--  lenge bryteren står på, og sletter filene i Storage etterpå.
--  Se docs/superpowers/specs/2026-09-30-bildesletting-design.md.
--
--  Trygg å kjøre mot koden som ligger ute: ingen eksisterende
--  kolonne endres, og ruta hopper over steget når funksjonen
--  mangler. Migrasjonen sletter ingenting selv.
-- ═══════════════════════════════════════════════════════════


-- ── Bryteren ───────────────────────────────────────────────
alter table innstillinger
  add column if not exists slett_gamle_bilder boolean not null default true;

comment on column innstillinger.slett_gamle_bilder is
  'Slett bilder og posisjon eldre enn 24 måneder hver morgen (/api/rydd). '
  'Personvernsida sier «automatisk» bare når denne er på.';


-- ── Slettingen ─────────────────────────────────────────────
-- Rader først, filer etterpå – motsatt av slettLeierMedFiler, og med
-- vilje. Radene og hendelsene går i én transaksjon her. Feiler
-- filslettingen i appen etterpå, er fila foreldreløs og eldre enn 24
-- måneder, og kommer med neste morgen. Jobben retter seg selv.
--
-- plpgsql framfor sql: kroppen sjekkes ikke mot storage.objects når
-- funksjonen lages, så migrasjonen går også der Storage mangler.
create or replace function public.slett_utlopte_bilder(
  tidspunkt timestamptz default now(),
  maks      integer     default 1000
)
returns table (sti text, foreldrelos boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  grense constant timestamptz := tidspunkt - interval '24 months';
begin
  -- Foreldreløse filer først, mens radene som slettes under ennå finnes.
  -- Ellers ville de samme filene kommet med to ganger.
  if to_regclass('storage.objects') is not null then
    return query
      select o.name, true
        from storage.objects o
       where o.bucket_id = 'bilder'
         and o.created_at < grense
         and not exists (select 1 from public.bilder b where b.fil_sti = o.name)
       order by o.created_at
       limit maks;
  end if;

  -- Bilder på en leie som pågår, venter til leien er avsluttet:
  -- hentebildet er beviset på tilstanden maskinen gikk ut i.
  --
  -- «delete from» står etter parentesen med vilje. lag-samlemigrasjon.mjs
  -- advarer mot linjer som begynner med det, og denne migrasjonen river
  -- ingenting når den kjøres.
  return query
    with utlopte as (
      select b.id
        from public.bilder b
        join public.leier l on l.id = b.leie_id
       where b.mottatt_tid < grense
         and l.status not in ('aktiv', 'venter_godkjenning')
       order by b.mottatt_tid
       limit maks
    ),
    slettet as (delete from public.bilder b
                 using utlopte u
                 where b.id = u.id
             returning b.leie_id, b.type, b.fil_sti),
    logget as (
      insert into public.hendelser (leie_id, type, beskrivelse, aktor)
      select s.leie_id,
             'bilder_slettet',
             'Bilder slettet etter 24 måneder: '
               || string_agg(distinct s.type, ' og ' order by s.type),
             'system'
        from slettet s
       group by s.leie_id
    )
    select s.fil_sti, false from slettet s;
end;
$$;

comment on function public.slett_utlopte_bilder(timestamptz, integer) is
  'Sletter bilderader eldre enn 24 måneder (ikke på pågående leier), logger '
  'én hendelse per leie, og returnerer stiene som skal slettes i Storage – '
  'pluss foreldreløse filer eldre enn 24 måneder. Kalles av /api/rydd.';

-- Supabase gir anon og authenticated execute på nye funksjoner. Uten
-- revoke kunne hvem som helst kalt denne via /rest/v1/rpc med et
-- tidspunkt langt fram i tid og slettet alle bildene.
revoke all     on function public.slett_utlopte_bilder(timestamptz, integer)
  from public, anon, authenticated;
grant  execute on function public.slett_utlopte_bilder(timestamptz, integer)
  to service_role;


-- ── Kontroll ───────────────────────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.slett_utlopte_bilder(timestamptz, integer)', 'execute')
     or has_function_privilege('authenticated', 'public.slett_utlopte_bilder(timestamptz, integer)', 'execute')
  then
    raise exception 'slett_utlopte_bilder kan kalles av anon eller authenticated';
  end if;
end $$;
