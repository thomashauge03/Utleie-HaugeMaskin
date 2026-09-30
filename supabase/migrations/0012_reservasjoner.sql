-- ═══════════════════════════════════════════════════════════
--  Reservasjoner
--
--  Framtidige utleier, lagt inn av admin. En annen kunde kan leie
--  maskinen fram til dagen før, ansatte får varsel, og kunden med
--  reservasjonen kjennes igjen på mobilnummeret når den hentes.
--  Se docs/superpowers/specs/2026-09-30-reservasjoner-design.md.
--
--  Trygg å kjøre mot koden som ligger ute: ingen eksisterende tabell
--  endres, og koden tåler at denne ikke er kjørt.
-- ═══════════════════════════════════════════════════════════

create extension if not exists btree_gist with schema extensions;


-- ── Tabellen ───────────────────────────────────────────────
create table if not exists reservasjoner (
  id            uuid primary key default gen_random_uuid(),
  maskin_id     uuid not null references maskiner(id),
  fra_dato      date not null,
  til_dato      date not null,
  kunde_navn    text not null,
  kunde_telefon text not null,
  notat         text,
  status        text not null default 'aktiv'
                check (status in ('forespurt', 'aktiv', 'hentet', 'avlyst')),
  leie_id       uuid references leier(id),
  opprettet_av  uuid references admin_brukere(id),
  opprettet     timestamptz not null default now(),

  constraint reservasjoner_datoer check (til_dato >= fra_dato),

  -- To aktive reservasjoner på samme maskin kan ikke overlappe. En
  -- forespørsel (del 3) sperrer ingenting før admin har godkjent den.
  constraint reservasjoner_uten_overlapp exclude using gist (
    maskin_id with =,
    daterange(fra_dato, til_dato, '[]') with &&
  ) where (status = 'aktiv')
);

comment on table reservasjoner is
  'Framtidige utleier. Datoene er norske kalenderdager, begge med.';
comment on column reservasjoner.kunde_telefon is
  'Åtte siffer, som kunder.telefon. Slik kjennes kunden igjen ved henting.';

create index if not exists reservasjoner_maskin_idx
  on reservasjoner (maskin_id, fra_dato) where status = 'aktiv';


-- ── Radsikkerhet ───────────────────────────────────────────
alter table reservasjoner enable row level security;

drop policy if exists admin_alt on reservasjoner;
create policy admin_alt on reservasjoner
  for all using (er_admin()) with check (er_admin());


-- ── Offentlig: når maskinene er opptatt (hovedsida, del 2) ─
-- Bare datoer. Ingen navn, ingen telefon, ingen referanser.
--
-- Lages bare når den ikke finnes. 0013 legger til kolonnen levert, og
-- create or replace kan ikke fjerne kolonner: kjørt på nytt etter 0013
-- (KJOR-DENNE.sql en gang til) stoppet denne hele fila med «cannot drop
-- columns from view», før senere migrasjoner var kjørt.
do $$
begin
  if to_regclass('public.hm_offentleg_opptatt') is null then
    create view public.hm_offentleg_opptatt as
      select r.maskin_id, r.fra_dato, r.til_dato
        from reservasjoner r
        join maskiner m on m.id = r.maskin_id
       where r.status = 'aktiv'
         and r.til_dato >= (now() at time zone 'Europe/Oslo')::date
         and m.aktiv and m.status <> 'utrangert'
      union all
      select l.maskin_id,
             (l.start_tid at time zone 'Europe/Oslo')::date,
             (l.planlagt_slutt at time zone 'Europe/Oslo')::date
        from leier l
        join maskiner m on m.id = l.maskin_id
       where l.status in ('aktiv', 'venter_godkjenning')
         and m.aktiv and m.status <> 'utrangert';

    comment on view public.hm_offentleg_opptatt is
      'Dager maskinene er opptatt, for hovedsida. Ingen kunde-, leie- eller '
      'internopplysninger. til_dato null betyr til videre.';
  end if;
end $$;

-- REKKEFØLGEN ER IKKE VALGFRI: revoke før grant. Supabase gir anon alt på
-- nye visninger, og en visning uten security_invoker kjører med eierens
-- rettigheter – en anonym DELETE ville gått rett til grunntabellen.
-- Se hm-web-craft/speiling/01-utleie.sql.
revoke all    on public.hm_offentleg_opptatt from anon, authenticated;
grant  select on public.hm_offentleg_opptatt to   anon, authenticated;


-- ── Kontroll ───────────────────────────────────────────────
do $$
declare
  uten_rls text;
  for_mye  text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into uten_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relname in ('reservasjoner', 'maskiner', 'leier')
     and not c.relrowsecurity;
  if uten_rls is not null then
    raise exception 'Disse tabellene mangler RLS: %', uten_rls;
  end if;

  select string_agg(distinct privilege_type, ', ')
    into for_mye
    from information_schema.table_privileges
   where grantee in ('anon', 'authenticated')
     and table_schema = 'public'
     and table_name = 'hm_offentleg_opptatt'
     and privilege_type <> 'SELECT';
  if for_mye is not null then
    raise exception 'hm_offentleg_opptatt gir anon mer enn SELECT: %', for_mye;
  end if;
end $$;
