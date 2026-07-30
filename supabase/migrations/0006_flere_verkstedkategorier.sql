-- ═══════════════════════════════════════════════════════════
--  Flere verkstedkategorier
--
--  Var én tekstverdi i innstillinger. Et flagg per kategori er
--  riktigere: verkstedet kan ha både Skuffer og Klyper, og en
--  kategori tas ut ved å fjerne haken framfor å skrive over en
--  felles verdi.
-- ═══════════════════════════════════════════════════════════

alter table kategorier
  add column if not exists er_verksted boolean not null default false;

comment on column kategorier.er_verksted is
  'Kategorien følger verkstedflyten i stedet for utleie.';

-- Ta vare på valget som allerede er gjort.
update kategorier k
set er_verksted = true
from innstillinger i
where i.verksted_kategori is not null
  and trim(i.verksted_kategori) = k.navn
  and k.er_verksted = false;

-- Kategorien kan ha vært valgt uten å finnes i plukklista, siden
-- kategori er fritekst på maskinen.
insert into kategorier (navn, er_verksted)
select distinct trim(i.verksted_kategori), true
from innstillinger i
where i.verksted_kategori is not null and trim(i.verksted_kategori) <> ''
on conflict (navn) do update set er_verksted = true;

comment on column innstillinger.verksted_kategori is
  'Utfaset – erstattet av kategorier.er_verksted. Beholdes for historikk.';
