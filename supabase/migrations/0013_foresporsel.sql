-- ═══════════════════════════════════════════════════════════
--  Leieforespørsler fra haugemaskin.no
--
--  Kunden ber om datoer på nettsida, og forespørselen lagres som en
--  reservasjon med status «forespurt» (fra 0012). Det eneste som mangler,
--  er stedet for kundens e-post, som er valgfri i skjemaet.
--  Se docs/superpowers/specs/2026-09-30-leieforesporsel-design.md.
--
--  I tillegg får hovedsida vite om en maskin er levert (nederst).
--
--  Bare tillegg: koden som ligger ute, leser verken kolonnen eller
--  flagget, og hovedsida leser visningen med select=*.
-- ═══════════════════════════════════════════════════════════

alter table reservasjoner add column if not exists kunde_epost text;

comment on column reservasjoner.kunde_epost is
  'Valgfri, fra forespørselsskjemaet på haugemaskin.no. Slettes med '
  'forespørselen 30 dager etter perioden hvis det ikke blir leie.';


-- ── Hovedsida: er maskinen levert? ─────────────────────────
-- Hovedsida skriver «Ute nå – skulle vært levert 12. september» om en
-- leie på overtid. En leie som venter på godkjenning, er levert – maskinen
-- står i gården – men planlagt slutt er ofte passert før admin rekker å
-- godkjenne. Uten flagget ville den sett ut som den var på overtid.
--
-- Samme visning som i 0012, med levert bakerst: create or replace godtar
-- bare nye kolonner etter de gamle.
create or replace view public.hm_offentleg_opptatt as
  select r.maskin_id, r.fra_dato, r.til_dato, false as levert
    from reservasjoner r
    join maskiner m on m.id = r.maskin_id
   where r.status = 'aktiv'
     and r.til_dato >= (now() at time zone 'Europe/Oslo')::date
     and m.aktiv and m.status <> 'utrangert'
  union all
  select l.maskin_id,
         (l.start_tid at time zone 'Europe/Oslo')::date,
         (l.planlagt_slutt at time zone 'Europe/Oslo')::date,
         l.status = 'venter_godkjenning'
    from leier l
    join maskiner m on m.id = l.maskin_id
   where l.status in ('aktiv', 'venter_godkjenning')
     and m.aktiv and m.status <> 'utrangert';

comment on view public.hm_offentleg_opptatt is
  'Dager maskinene er opptatt, for hovedsida. Ingen kunde-, leie- eller '
  'internopplysninger. til_dato null betyr til videre. levert betyr at '
  'leia venter på godkjenning – maskinen er tilbake.';

-- Som i 0012: revoke før grant.
revoke all    on public.hm_offentleg_opptatt from anon, authenticated;
grant  select on public.hm_offentleg_opptatt to   anon, authenticated;


-- ── Kontroll ───────────────────────────────────────────────
do $$
declare
  for_mye text;
begin
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
