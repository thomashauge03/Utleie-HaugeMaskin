# Sletting av bilder og posisjon etter 24 måneder – implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En daglig jobb i `/api/rydd` sletter bilder og posisjon som er eldre enn 24 måneder, styrt av en bryter under Innstillinger → Personvern, og personvernsida sier «automatisk» bare når bryteren står på.

**Architecture:** Migrasjon 0014 legger til bryteren og SQL-funksjonen `slett_utlopte_bilder`, som sletter utløpte bilderader, logger én hendelse per leie og returnerer stiene, pluss foreldreløse filer fra `storage.objects`. `src/lib/bildesletting.ts` kaller funksjonen og sletter filene via Storage-API-et. `/api/rydd` (fra greina `foresporsel`) kjører det etter reservasjonsslettingen.

**Tech Stack:** Next.js 16 (route handler, server action, `useActionState`), Supabase (PostgREST `rpc`, Storage `remove`), Postgres plpgsql, PGlite for test av SQL, `node --test` for rene funksjoner.

**Spec:** `docs/superpowers/specs/2026-09-30-bildesletting-design.md`

## Global Constraints

- 24 måneder regnes fra `bilder.mottatt_tid`. Bilder på leier med status `aktiv` eller `venter_godkjenning` røres ikke.
- Foreldreløse filer: bøtta `bilder`, `storage.objects.created_at` eldre enn 24 måneder, ingen rad i `bilder` med samme `fil_sti`.
- Grensa er streng: `< tidspunkt - interval '24 months'`. Akkurat 24 måneder blir stående.
- Bryter: `innstillinger.slett_gamle_bilder boolean not null default true`. Den styrer bare bildeslettingen; reservasjonsslettingen i `/api/rydd` går uansett.
- Ingen sletting eller anonymisering av leier, kunder, hendelser, e-postlogg eller reservasjoner (utover det `foresporsel` allerede gjør).
- Hendelse per berørt leie: type `bilder_slettet`, aktor `system`, beskrivelse `Bilder slettet etter 24 måneder: <typer sortert, skilt med « og »>`.
- Funksjonen kan bare kalles av `service_role`.
- Aldri test mot produksjon. SQL testes i PGlite i scratchpad.
- eslint og tsc med binærene i `C:\Users\thoma\utleie-app\node_modules`, aldri `npx`.
- Ingen push, og hovedsjekkouten (`C:\Users\thoma\utleie-app`) røres ikke.
- Bokmål i kode, kommentarer og tekst. SQL-identifikatorer er ASCII (`foreldrelos`, `utlopte`, `tidspunkt`).
- Commit-meldinger slutter med `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

Stier under er relative til worktreen
`C:\Users\thoma\utleie-app\.claude\worktrees\suspicious-galileo-98d8c2`.
Scratchpad (`$SP`):
`C:\Users\thoma\AppData\Local\Temp\claude\C--Users-thoma-utleie-app--claude-worktrees-suspicious-galileo-98d8c2\086207fb-6e51-4a7d-8003-6587aeb1ae7b\scratchpad`.

---

### Task 1: Migrasjon 0014 med PGlite-test

**Files:**
- Create: `supabase/migrations/0014_bildesletting.sql`
- Modify: `scripts/sjekk-migrasjoner.mjs:36` (lista `MIGRASJONER`)
- Regenerate: `supabase/KJOR-DENNE.sql`
- Test (scratchpad, ikke commitet): `$SP/pglite/test-bildesletting.mjs`

**Interfaces:**
- Produces: `public.slett_utlopte_bilder(tidspunkt timestamptz default now(), maks integer default 1000) returns table (sti text, foreldrelos boolean)`; kolonnen `innstillinger.slett_gamle_bilder`; hendelsestypen `bilder_slettet`.

- [ ] **Step 1: Installer PGlite i scratchpad**

```bash
mkdir -p "$SP/pglite" && cd "$SP/pglite" && npm init -y >/dev/null && npm install @electric-sql/pglite
```

- [ ] **Step 2: Skriv testen**

`$SP/pglite/test-bildesletting.mjs`:

```js
/**
 * Migrasjon 0014 mot ekte Postgres (PGlite) – aldri mot produksjon.
 *
 *   node --test test-bildesletting.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const ROT = 'C:/Users/thoma/utleie-app/.claude/worktrees/suspicious-galileo-98d8c2'
const MAPPE = path.join(ROT, 'supabase', 'migrations')

const NÅ = '2028-09-01T07:30:00.000Z'
const GRENSE = '2026-09-01T07:30:00.000Z' // NÅ minus 24 måneder
const GAMMEL = '2026-08-03T16:32:37.000Z'
const NY = '2026-10-01T12:00:00.000Z'

/** Tom database med det Supabase har, og alle migrasjonene. */
async function nyBase({ medStorage = true } = {}) {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } })
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create schema extensions;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `)
  if (medStorage) {
    await db.exec(`
      create schema storage;
      create table storage.objects (
        bucket_id  text not null,
        name       text not null,
        created_at timestamptz not null default now()
      );
    `)
  }
  for (const fil of readdirSync(MAPPE).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(MAPPE, fil), 'utf8'))
  }
  return db
}

let nr = 0

/** Leie med egen maskin og kunde, så den unike indeksen for aktive ikke slår inn. */
async function leie(db, status) {
  nr++
  const {
    rows: [m],
  } = await db.query(`insert into maskiner (navn) values ($1) returning id`, [`Maskin ${nr}`])
  const {
    rows: [k],
  } = await db.query(
    `insert into kunder (navn, telefon, adresse, epost)
     values ('Ola', $1, 'Vei 1', 'ola@eksempel.no') returning id`,
    [String(90000000 + nr)],
  )
  const {
    rows: [l],
  } = await db.query(
    `insert into leier (maskin_id, kunde_id, planlagt_slutt, status)
     values ($1, $2, now(), $3) returning id`,
    [m.id, k.id, status],
  )
  return l.id
}

async function fil(db, sti, laget, bøtte = 'bilder') {
  await db.query(
    `insert into storage.objects (bucket_id, name, created_at) values ($1, $2, $3::timestamptz)`,
    [bøtte, sti, laget],
  )
}

/** Bilderad med posisjon, og fila i bøtta med samme tidspunkt. */
async function bilde(db, leieId, type, mottatt, { medFil = true } = {}) {
  const sti = `2026-08/${type}-${crypto.randomUUID()}.jpg`
  await db.query(
    `insert into bilder (leie_id, type, fil_sti, lat, lng, noyaktighet_m, mottatt_tid)
     values ($1, $2, $3, 59.9, 10.7, 12, $4::timestamptz)`,
    [leieId, type, sti, mottatt],
  )
  if (medFil) await fil(db, sti, mottatt)
  return sti
}

async function kjør(db, maks) {
  const { rows } =
    maks === undefined
      ? await db.query(`select * from slett_utlopte_bilder($1::timestamptz)`, [NÅ])
      : await db.query(`select * from slett_utlopte_bilder($1::timestamptz, $2)`, [NÅ, maks])
  return rows
}

async function bildeStier(db) {
  const { rows } = await db.query(`select fil_sti from bilder order by fil_sti`)
  return rows.map((r) => r.fil_sti)
}

async function hendelser(db, leieId) {
  const { rows } = await db.query(
    `select type, beskrivelse, aktor from hendelser where leie_id = $1`,
    [leieId],
  )
  return rows
}

test('gamle bilder på avsluttet leie slettes, og leien får én hendelse', async () => {
  const db = await nyBase()
  const leieId = await leie(db, 'avsluttet')
  const henting = await bilde(db, leieId, 'henting', GAMMEL)
  const levering = await bilde(db, leieId, 'levering', '2026-08-10T09:00:00.000Z')

  const rader = await kjør(db)

  assert.deepEqual(
    rader.map((r) => `${r.sti} ${r.foreldrelos}`).sort(),
    [`${henting} false`, `${levering} false`].sort(),
  )
  assert.deepEqual(await bildeStier(db), [])
  assert.deepEqual(await hendelser(db, leieId), [
    {
      type: 'bilder_slettet',
      beskrivelse: 'Bilder slettet etter 24 måneder: henting og levering',
      aktor: 'system',
    },
  ])
})

test('bilder på leier som pågår, blir stående', async () => {
  const db = await nyBase()
  const aktiv = await leie(db, 'aktiv')
  const venter = await leie(db, 'venter_godkjenning')
  const a = await bilde(db, aktiv, 'henting', GAMMEL)
  const v = await bilde(db, venter, 'henting', GAMMEL)

  assert.deepEqual(await kjør(db), [])
  assert.deepEqual(await bildeStier(db), [a, v].sort())
  assert.deepEqual(await hendelser(db, aktiv), [])
  assert.deepEqual(await hendelser(db, venter), [])
})

test('grensa: akkurat 24 måneder blir stående, ett sekund over slettes', async () => {
  const db = await nyBase()
  const leieId = await leie(db, 'avsluttet')
  const påGrensa = await bilde(db, leieId, 'levering', GRENSE)
  const over = await bilde(db, leieId, 'henting', '2026-09-01T07:29:59.000Z')
  const ny = await bilde(db, leieId, 'levering', NY)

  const rader = await kjør(db)

  assert.deepEqual(rader, [{ sti: over, foreldrelos: false }])
  assert.deepEqual(await bildeStier(db), [påGrensa, ny].sort())
  assert.deepEqual(await hendelser(db, leieId), [
    { type: 'bilder_slettet', beskrivelse: 'Bilder slettet etter 24 måneder: henting', aktor: 'system' },
  ])
})

test('foreldreløse filer over 24 måneder kommer med, andre ikke', async () => {
  const db = await nyBase()
  const aktiv = await leie(db, 'aktiv')
  const medRad = await bilde(db, aktiv, 'henting', GAMMEL)
  await fil(db, '2026-07/henting-gammel.jpg', '2026-07-27T15:24:29.000Z')
  await fil(db, '2026-10/henting-ny.jpg', NY)
  await fil(db, '2026-07/annen-botte.jpg', GAMMEL, 'annet')

  assert.deepEqual(await kjør(db), [{ sti: '2026-07/henting-gammel.jpg', foreldrelos: true }])
  assert.deepEqual(await bildeStier(db), [medRad])
})

test('retter seg selv: en fil som ikke ble slettet, kommer med neste gang', async () => {
  const db = await nyBase()
  const leieId = await leie(db, 'avsluttet')
  const sti = await bilde(db, leieId, 'henting', GAMMEL)

  assert.deepEqual(await kjør(db), [{ sti, foreldrelos: false }])
  // Appen fikk ikke slettet fila – storage.objects er urørt.
  assert.deepEqual(await kjør(db), [{ sti, foreldrelos: true }])
  assert.equal((await hendelser(db, leieId)).length, 1)
})

test('maks begrenser både rader og foreldreløse filer', async () => {
  const db = await nyBase()
  const leieId = await leie(db, 'avsluttet')
  for (let i = 0; i < 3; i++) await bilde(db, leieId, 'henting', GAMMEL)
  for (let i = 0; i < 3; i++) await fil(db, `2026-07/foreldrelos-${i}.jpg`, GAMMEL)

  const rader = await kjør(db, 2)

  assert.equal(rader.filter((r) => r.foreldrelos).length, 2)
  assert.equal(rader.filter((r) => !r.foreldrelos).length, 2)
  assert.equal((await bildeStier(db)).length, 1)
})

test('bare service_role kan kjøre funksjonen', async () => {
  const db = await nyBase()
  const kan = async (rolle) =>
    (
      await db.query(
        `select has_function_privilege($1, 'public.slett_utlopte_bilder(timestamptz, integer)', 'execute') as ja`,
        [rolle],
      )
    ).rows[0].ja

  assert.equal(await kan('anon'), false)
  assert.equal(await kan('authenticated'), false)
  assert.equal(await kan('service_role'), true)

  await db.exec('set role anon')
  await assert.rejects(db.query('select * from slett_utlopte_bilder()'), /permission denied/)
  await db.exec('reset role')
})

test('migrasjonen kan kjøres to ganger, og bryteren står på', async () => {
  const db = await nyBase()
  await db.exec(readFileSync(path.join(MAPPE, '0014_bildesletting.sql'), 'utf8'))
  const { rows } = await db.query('select slett_gamle_bilder from innstillinger')
  assert.deepEqual(rows, [{ slett_gamle_bilder: true }])
})

test('uten storage.objects slettes radene likevel', async () => {
  const db = await nyBase({ medStorage: false })
  const leieId = await leie(db, 'avsluttet')
  const sti = await bilde(db, leieId, 'henting', GAMMEL, { medFil: false })
  assert.deepEqual(await kjør(db), [{ sti, foreldrelos: false }])
})
```

- [ ] **Step 3: Kjør testen – den skal feile**

Run: `cd "$SP/pglite" && node --test test-bildesletting.mjs`
Expected: FAIL på alle, med `function slett_utlopte_bilder(...) does not exist` / `column "slett_gamle_bilder" does not exist` / `ENOENT ... 0014_bildesletting.sql`.

- [ ] **Step 4: Skriv migrasjonen**

`supabase/migrations/0014_bildesletting.sql`:

```sql
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
```

- [ ] **Step 5: Kjør testen – den skal bestå**

Run: `cd "$SP/pglite" && node --test test-bildesletting.mjs`
Expected: `# pass 9`, `# fail 0`.

- [ ] **Step 6: Sjekkskriptet og samlefila**

I `scripts/sjekk-migrasjoner.mjs`, etter linja med `0011_ansatt.sql`:

```js
  { fil: '0012_reservasjoner.sql', tabell: 'reservasjoner', kolonne: 'id' },
  { fil: '0013_foresporsel.sql', tabell: 'reservasjoner', kolonne: 'kunde_epost' },
  { fil: '0014_bildesletting.sql', tabell: 'innstillinger', kolonne: 'slett_gamle_bilder' },
```

Run: `node scripts/lag-samlemigrasjon.mjs`
Expected: `Skrev 12 migrasjoner til supabase/KJOR-DENNE.sql` med 0003–0014. Sjekk at advarselen øverst bare nevner `0010_fjern_kjoretoy.sql`:

Run: `grep -n "^--   0" supabase/KJOR-DENNE.sql`
Expected: `--   0010_fjern_kjoretoy.sql` og ingenting annet.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0014_bildesletting.sql supabase/KJOR-DENNE.sql scripts/sjekk-migrasjoner.mjs
git commit -m "Migrasjon 0014: bryter og funksjon for sletting av bilder etter 24 måneder

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Jobben i /api/rydd

**Files:**
- Create: `src/lib/bildesletting.ts`
- Modify: `src/app/api/rydd/route.ts` (hele fila)

**Interfaces:**
- Consumes: `slett_utlopte_bilder()` fra Task 1 (PostgREST-svar `{ sti: string; foreldrelos: boolean }[]`), kolonnen `slett_gamle_bilder`.
- Produces: `BILDE_MANEDER = 24`; `type Bildesletting = 'av' | 'ikke satt opp' | { rader: number; foreldrelose: number; filer: number; feil?: string }`; `slettGamleBilder(): Promise<Bildesletting>`.

- [ ] **Step 1: Skriv `src/lib/bildesletting.ts`**

```ts
import { supabaseAdmin } from '@/lib/supabase/admin'
import 'server-only'

/** Samme frist som i migrasjon 0014 og på personvernsida. */
export const BILDE_MANEDER = 24

/**
 * Resultatet av én kjøring. `rader` er bilder som hadde passert 24
 * måneder, `foreldrelose` filer i bøtta uten rad, og `filer` hvor mange
 * Storage faktisk fjernet.
 */
export type Bildesletting =
  | 'av'
  | 'ikke satt opp'
  | { rader: number; foreldrelose: number; filer: number; feil?: string }

/** Kolonnen eller funksjonen finnes ikke – migrasjon 0014 er ikke kjørt. */
const FINNES_IKKE = ['42703', 'PGRST204', 'PGRST202', '42883']

/**
 * Sletter bilder og posisjon eldre enn 24 måneder, slik personvernsida
 * lover. Kalles hver morgen fra /api/rydd, og bare når bryteren under
 * Innstillinger → Personvern står på.
 *
 * Databasen sletter radene og skriver hendelsene (slett_utlopte_bilder),
 * og gir tilbake stiene. Filene slettes her, etterpå. Feiler det, er
 * filene foreldreløse og eldre enn 24 måneder – og kommer med neste
 * morgen.
 */
export async function slettGamleBilder(): Promise<Bildesletting> {
  const { data: innst, error: innstFeil } = await supabaseAdmin
    .from('innstillinger')
    .select('slett_gamle_bilder')
    .maybeSingle()

  if (innstFeil) {
    return FINNES_IKKE.includes(innstFeil.code)
      ? 'ikke satt opp'
      : { rader: 0, foreldrelose: 0, filer: 0, feil: innstFeil.message }
  }
  if (!innst?.slett_gamle_bilder) return 'av'

  const { data, error } = await supabaseAdmin.rpc('slett_utlopte_bilder')
  if (error) {
    return FINNES_IKKE.includes(error.code)
      ? 'ikke satt opp'
      : { rader: 0, foreldrelose: 0, filer: 0, feil: error.message }
  }

  const utlopte = (data ?? []) as { sti: string; foreldrelos: boolean }[]
  const resultat = {
    rader: utlopte.filter((u) => !u.foreldrelos).length,
    foreldrelose: utlopte.filter((u) => u.foreldrelos).length,
    filer: 0,
  }

  const stier = utlopte.map((u) => u.sti)
  for (let i = 0; i < stier.length; i += 100) {
    const { data: fjernet, error: feil } = await supabaseAdmin.storage
      .from('bilder')
      .remove(stier.slice(i, i + 100))
    if (feil) return { ...resultat, feil: `Storage: ${feil.message}` }
    resultat.filer += fjernet?.length ?? 0
  }

  return resultat
}
```

- [ ] **Step 2: Skriv om `src/app/api/rydd/route.ts`**

```ts
import { supabaseAdmin } from '@/lib/supabase/admin'
import { osloDag } from '@/lib/dato'
import { slettGamleBilder } from '@/lib/bildesletting'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** «Tabellen finnes ikke» – migrasjon 0012 ikke kjørt; da er det ingenting å rydde. */
const FINNES_IKKE = ['PGRST205', '42P01']

/**
 * Daglig opprydding. Kjøres av Vercel Cron (vercel.json), autentisert med
 * CRON_SECRET som /api/varsler/forfalt.
 *
 * 1. Reservasjoner som ikke ble til leie – forespurt, avlyst, eller aktiv
 *    men aldri hentet – slettes 30 dager etter at perioden er over.
 *    Personvernsida på haugemaskin.no lover det. Hentede reservasjoner
 *    hører til en leie og blir stående.
 * 2. Bilder og posisjon eldre enn 24 måneder slettes, som personvernsida
 *    her lover – så lenge bryteren under Innstillinger → Personvern står
 *    på. Se slettGamleBilder.
 *
 * Stegene er uavhengige: feiler det ene, kjøres det andre likevel, og
 * svaret får status 500 så kjøringen står som feilet i Vercel.
 */
export async function GET(request: Request) {
  const hemmelighet = process.env.CRON_SECRET
  if (!hemmelighet || request.headers.get('authorization') !== `Bearer ${hemmelighet}`) {
    return new Response(null, { status: 401 })
  }

  const grense = osloDag(new Date(Date.now() - 30 * 86_400_000))
  const { count, error } = await supabaseAdmin
    .from('reservasjoner')
    .delete({ count: 'exact' })
    .in('status', ['forespurt', 'avlyst', 'aktiv'])
    .lt('til_dato', grense)
  const reservasjonFeil = error && !FINNES_IKKE.includes(error.code) ? error.message : undefined

  const bilder = await slettGamleBilder()
  const bildeFeil = typeof bilder === 'object' ? bilder.feil : undefined

  const feil = reservasjonFeil ?? bildeFeil
  return Response.json(
    { slettet: count ?? 0, grense, bilder, ...(feil ? { feil } : {}), tid: new Date().toISOString() },
    { status: feil ? 500 : 200 },
  )
}
```

- [ ] **Step 3: Typer og lint for de to filene**

Run (fra worktreen):
```bash
node /c/Users/thoma/utleie-app/node_modules/next/dist/bin/next typegen
node /c/Users/thoma/utleie-app/node_modules/typescript/bin/tsc --noEmit
node /c/Users/thoma/utleie-app/node_modules/eslint/bin/eslint.js src/lib/bildesletting.ts src/app/api/rydd/route.ts
```
Expected: ingen feil. (`next typegen` lager `PageProps`/`RouteContext`, som tsc trenger.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/bildesletting.ts src/app/api/rydd/route.ts
git commit -m "Rydd: slett bilder og posisjon eldre enn 24 måneder hver morgen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Bryteren under Innstillinger → Personvern

**Files:**
- Modify: `src/lib/dato.ts` (ny funksjon `leggTilManeder`)
- Test: `src/lib/dato.test.mjs`
- Test (scratchpad): `$SP/pglite/test-bildesletting.mjs` (kryssjekk mot Postgres)
- Modify: `src/app/admin/(panel)/innstillinger/actions.ts` (ny seksjon etter Varsling)
- Modify: `src/app/admin/(panel)/innstillinger/varsel-skjema.tsx:22` (`export function Bryter`)
- Create: `src/app/admin/(panel)/innstillinger/bildesletting-skjema.tsx`
- Modify: `src/app/admin/(panel)/innstillinger/page.tsx`

**Interfaces:**
- Consumes: `BILDE_MANEDER` fra Task 2; kolonnen `slett_gamle_bilder` fra Task 1.
- Produces: `leggTilManeder(iso: string, maneder: number): string`; `lagreBildesletting(_forrige: Tilstand, formData: FormData): Promise<Tilstand>`; `BildeslettingSkjema({ slettGamle, migrasjonKjort, eldste })`.

- [ ] **Step 1: Skriv de feilende testene for `leggTilManeder`**

Legg til i `src/lib/dato.test.mjs` (og `leggTilManeder` i importen fra `./dato.ts`):

```js
test('leggTilManeder: 24 måneder fram, samme klokkeslett', () => {
  assert.equal(leggTilManeder('2026-08-03T16:32:37.759Z', 24), '2028-08-03T16:32:37.759Z')
})

test('leggTilManeder: dag som ikke finnes, blir siste dag i måneden – som i Postgres', () => {
  assert.equal(leggTilManeder('2024-02-29T12:00:00.000Z', 24), '2026-02-28T12:00:00.000Z')
  assert.equal(leggTilManeder('2026-01-31T00:00:00.000Z', 1), '2026-02-28T00:00:00.000Z')
})
```

Og kryssjekken i `$SP/pglite/test-bildesletting.mjs`:

```js
import { leggTilManeder } from 'file:///C:/Users/thoma/utleie-app/.claude/worktrees/suspicious-galileo-98d8c2/src/lib/dato.ts'

test('leggTilManeder gir samme tidspunkt som Postgres', async () => {
  const db = new PGlite()
  await db.exec(`set timezone = 'UTC'`)
  for (const iso of ['2026-08-03T16:32:37.759Z', '2024-02-29T12:00:00.000Z', '2026-12-31T23:30:00.000Z']) {
    const { rows } = await db.query(
      `select to_char(($1::timestamptz + interval '24 months') at time zone 'UTC',
                      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as t`,
      [iso],
    )
    assert.equal(leggTilManeder(iso, 24), rows[0].t)
  }
})
```

- [ ] **Step 2: Kjør – skal feile**

Run: `npm test` og `cd "$SP/pglite" && node --test test-bildesletting.mjs`
Expected: FAIL med `leggTilManeder is not a function` / `does not provide an export named 'leggTilManeder'`.

- [ ] **Step 3: Skriv `leggTilManeder` i `src/lib/dato.ts`** (etter `tidKort`)

```ts
/**
 * Legger til hele måneder slik Postgres gjør med `+ interval 'N months'`:
 * finnes ikke dagen i målmåneden, blir det siste dag i den
 * (29.02.2024 + 24 måneder = 28.02.2026). Viser når et bilde slettes, og
 * må gi samme dag som databasen, som regner i UTC.
 */
export function leggTilManeder(iso: string, maneder: number): string {
  const d = new Date(iso)
  const dag = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + maneder)
  const sisteDag = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(dag, sisteDag))
  return d.toISOString()
}
```

- [ ] **Step 4: Kjør – skal bestå**

Run: `npm test` og `cd "$SP/pglite" && node --test test-bildesletting.mjs`
Expected: alle grønne (PGlite: `# pass 10`).

- [ ] **Step 5: Handlingen i `innstillinger/actions.ts`** (ny seksjon rett etter `lagreVarsling`, før `nyttIcalToken`; bruker `av` fra Varsling-seksjonen)

```ts
/* ═══ Personvern ═══════════════════════════════════════════ */

/**
 * Slår den daglige slettingen av bilder eldre enn 24 måneder av og på
 * (/api/rydd). Personvernsida leser samme bryter og sier «slettes
 * automatisk» bare når den står på.
 */
export async function lagreBildesletting(
  _forrige: Tilstand,
  formData: FormData,
): Promise<Tilstand> {
  await krevAdmin()

  const felt = av.safeParse(formData.get('slett_gamle_bilder'))
  if (!felt.success) return { feil: felt.error.issues[0].message }

  const supabase = await lagServerKlient()
  const { error } = await supabase
    .from('innstillinger')
    .update({ slett_gamle_bilder: felt.data, oppdatert: new Date().toISOString() })
    .eq('id', true)

  if (error) return { feil: `Kunne ikke lagre: ${error.message}` }

  revalidatePath('/admin/innstillinger')
  revalidatePath('/personvern')
  return {
    ok: felt.data
      ? 'Lagret. Bilder eldre enn 24 måneder slettes hver morgen.'
      : 'Lagret. Bildene slettes ikke automatisk lenger.',
  }
}
```

- [ ] **Step 6: Eksporter `Bryter`** i `varsel-skjema.tsx`: `function Bryter({` → `export function Bryter({`.

- [ ] **Step 7: Skjemaet `innstillinger/bildesletting-skjema.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { utenNullstilling } from '@/lib/skjema'
import { lagreBildesletting, type Tilstand } from './actions'
import { Bryter } from './varsel-skjema'

const start: Tilstand = {}

export function BildeslettingSkjema({
  slettGamle,
  migrasjonKjort,
  eldste,
}: {
  slettGamle: boolean
  migrasjonKjort: boolean
  eldste: { dato: string; frist: string } | null
}) {
  const [tilstand, handling, venter] = useActionState(lagreBildesletting, start)

  return (
    <form action={handling} onSubmit={utenNullstilling(handling)} className="space-y-5 p-5">
      {!migrasjonKjort && (
        <div className="border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
          <p className="font-bold">Migrasjon 0014 er ikke kjørt ennå</p>
          <p className="mt-1 text-[var(--blekk-svak)]">
            Ingenting slettes, og bryteren kan ikke lagres før{' '}
            <code className="font-mono text-xs">0014_bildesletting.sql</code> er kjørt i
            Supabase.
          </p>
        </div>
      )}

      <Bryter
        navn="slett_gamle_bilder"
        tittel="Slett bilder og posisjon etter 24 måneder"
        beskrivelse="Sjekkes hver morgen. Bilder fra leier som ikke er avsluttet, venter til leien er ferdig. Personvernsida sier «slettes automatisk» bare når denne er på."
        standard={slettGamle}
      />

      <p className="text-sm text-[var(--blekk-svak)]">
        {eldste
          ? `Eldste bilde er fra ${eldste.dato} og slettes tidligst ${eldste.frist}.`
          : 'Ingen bilder lagret.'}
      </p>

      {migrasjonKjort && !slettGamle && (
        <p className="border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
          Står av: bildene blir liggende til noen sletter dem, og personvernsida sier ikke
          lenger at de slettes automatisk.
        </p>
      )}

      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}
      {tilstand.ok && (
        <p role="status" className="border-l-4 border-hm-green bg-hm-green/10 p-3 text-sm font-semibold text-hm-green">
          {tilstand.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={venter}
        className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-5 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
      >
        {venter ? 'Lagrer …' : 'Lagre'}
      </button>
    </form>
  )
}
```

- [ ] **Step 8: Fanen i `innstillinger/page.tsx`**

Importer:
```ts
import { BILDE_MANEDER } from '@/lib/bildesletting'
import { dato, leggTilManeder } from '@/lib/dato'
import { BildeslettingSkjema } from './bildesletting-skjema'
```
`FANER`: legg til `{ verdi: 'personvern', tekst: 'Personvern' },` etter `kalender`.

`Promise.all`: legg til `{ data: eldsteBilde }` sist i destruktureringen og
```ts
    supabase
      .from('bilder')
      .select('mottatt_tid')
      .order('mottatt_tid')
      .limit(1)
      .maybeSingle(),
```
sist i lista.

Nederst, etter kalender-blokken:
```tsx
      {fane === 'personvern' && (
        <Kort>
          <KortTittel>Sletting av bilder</KortTittel>
          <BildeslettingSkjema
            slettGamle={innst?.slett_gamle_bilder ?? true}
            migrasjonKjort={Boolean(innst) && 'slett_gamle_bilder' in innst}
            eldste={
              eldsteBilde
                ? {
                    dato: dato(eldsteBilde.mottatt_tid),
                    frist: dato(leggTilManeder(eldsteBilde.mottatt_tid, BILDE_MANEDER)),
                  }
                : null
            }
          />
        </Kort>
      )}
```

- [ ] **Step 9: Typer, lint og tester**

Run:
```bash
node /c/Users/thoma/utleie-app/node_modules/next/dist/bin/next typegen
node /c/Users/thoma/utleie-app/node_modules/typescript/bin/tsc --noEmit
node /c/Users/thoma/utleie-app/node_modules/eslint/bin/eslint.js "src/app/admin/(panel)/innstillinger" src/lib/dato.ts
npm test
```
Expected: ingen feil, alle tester grønne.

- [ ] **Step 10: Commit**

```bash
git add src/lib/dato.ts src/lib/dato.test.mjs "src/app/admin/(panel)/innstillinger"
git commit -m "Innstillinger: fanen Personvern med bryter for sletting av bilder

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Leiesida, personvernsida og teknisk plan

**Files:**
- Modify: `src/app/admin/(panel)/leier/[id]/page.tsx:57-62` og `:122-123`
- Modify: `src/app/personvern/page.tsx:7-14` og avsnittet «Hvor lenge vi lagrer»
- Modify: `docs/TEKNISK-PLAN.md:422-423`

**Interfaces:**
- Consumes: hendelsestypen `bilder_slettet` og kolonnen `slett_gamle_bilder` fra Task 1.

- [ ] **Step 1: Leiesida.** Etter hendelsesspørringen:

```ts
  // Jobben i /api/rydd legger igjen en hendelse når den sletter bildene.
  const bilderSlettet = (hendelser ?? []).some((h) => h.type === 'bilder_slettet')
```

og i Bilder-kortet:

```tsx
          {medUrl.length === 0 ? (
            <p className="text-sm text-[var(--blekk-svak)]">
              {bilderSlettet ? 'Bildene er slettet etter 24 måneder.' : 'Ingen bilder ennå.'}
            </p>
```

- [ ] **Step 2: Personvernsida.** Bytt spørringen øverst i `PersonvernSide`:

```ts
  const [{ data }, { data: sletting }] = await Promise.all([
    supabaseAdmin.from('innstillinger').select('firmanavn, varsel_epost').maybeSingle(),
    // Egen spørring: før migrasjon 0014 finnes ikke kolonnen, og da skal
    // bare «automatisk» falle bort – ikke firmanavnet og kontaktadressen.
    supabaseAdmin.from('innstillinger').select('slett_gamle_bilder').maybeSingle(),
  ])

  const firma = data?.firmanavn?.trim() || 'Hauge Maskin'
  const kontakt = data?.varsel_epost?.trim()
  // Står bryteren av, sletter ingenting av seg selv, og da skal sida ikke si det.
  const automatisk = sletting?.slett_gamle_bilder === true
```

og avsnittet:

```tsx
        <Avsnitt tittel="Hvor lenge vi lagrer">
          Bilder og posisjonsdata slettes{automatisk && ' automatisk'} etter 24
          måneder. Opplysninger som inngår i fakturagrunnlaget, oppbevares i fem
          år etter utløpet av regnskapsåret, slik bokføringsloven krever, og
          anonymiseres deretter.
        </Avsnitt>
```

- [ ] **Step 3: `docs/TEKNISK-PLAN.md`**, linje 422–423:

```markdown
  - Bilder og GPS: slettes automatisk etter **24 måneder** – daglig jobb i `/api/rydd` (migrasjon 0014), bryter under Innstillinger → Personvern
  - Leiedata som er fakturagrunnlag: beholdes **5 år** (bokføringsloven), deretter anonymiseres kundedata – ikke bygget ennå
```

- [ ] **Step 4: Typer og lint**

Run:
```bash
node /c/Users/thoma/utleie-app/node_modules/typescript/bin/tsc --noEmit
node /c/Users/thoma/utleie-app/node_modules/eslint/bin/eslint.js "src/app/admin/(panel)/leier/[id]/page.tsx" src/app/personvern/page.tsx
```
Expected: ingen feil.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(panel)/leier/[id]/page.tsx" src/app/personvern/page.tsx docs/TEKNISK-PLAN.md
git commit -m "Personvern sier «automatisk» når bryteren står på, og leiesida forklarer slettede bilder

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Full verifisering og opprydding

- [ ] **Step 1: Bygg med plassholdere** (fra worktreen)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://plassholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=plassholder SUPABASE_SERVICE_ROLE_KEY=plassholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build
```
Expected: `✓ Compiled successfully`, og `/api/rydd` står som dynamisk (ƒ).

- [ ] **Step 2: Hele lint, tsc, tester, PGlite og vercel.json**

```bash
node /c/Users/thoma/utleie-app/node_modules/eslint/bin/eslint.js .
node /c/Users/thoma/utleie-app/node_modules/typescript/bin/tsc --noEmit
npm test
npm run sjekk:vercel
cd "$SP/pglite" && node --test test-bildesletting.mjs
```
Expected: ingen feil; `# fail 0` begge steder; «vercel.json er gyldig».

- [ ] **Step 3: Fjern lenka bygget la i `.next`** (se minnet worktree-verifisering)

```bash
cmd //c "dir /AL /S /B C:\\Users\\thoma\\utleie-app\\.claude\\worktrees\\suspicious-galileo-98d8c2\\.next"
```
For hver lenke under `.next\node_modules`: `cmd //c "rmdir <full Windows-sti>"` (uten `/S`), og kjør `dir /AL /S /B` igjen til den gir «File Not Found».

- [ ] **Step 4: Gjennomgang** med superpowers:requesting-code-review mot spec-en, rett funn, og commit rettelsene.

- [ ] **Step 5: Avslutning** med superpowers:finishing-a-development-branch. Ikke push uten ja fra Thomas. Si fra at `foresporsel` må merges først og at 0014 må kjøres i Supabase.
