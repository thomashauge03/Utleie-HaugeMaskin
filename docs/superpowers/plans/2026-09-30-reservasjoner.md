# Reservasjoner, del 1 – implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin legger inn framtidige utleier; kunder får returdato-sperre, ansatte får varsel, og kunden med reservasjonen kjennes igjen på mobilnummeret.

**Architecture:** Reglene er rene funksjoner i `src/lib/reservasjon.ts` (testet). `src/lib/reservasjon-data.ts` henter aktive reservasjoner med service role og gir tom liste når tabellen mangler. Kunde- og ansattflyten spør reglene; admin skriver med sin egen sesjon (RLS). Migrasjon 0012 lager tabellen og en offentlig lesevisning for hovedsida.

**Tech Stack:** Next.js 16, React 19.2, Supabase (Postgres, `btree_gist`), zod, PGlite for migrasjonstesten.

**Spec:** `docs/superpowers/specs/2026-09-30-reservasjoner-design.md`

## Global Constraints

- Datoer er norske kalenderdager `yyyy-mm-dd`; «i dag» er `osloDag(new Date())`.
- Kunde: levering senest **dagen før** `fra_dato` til en annen kundes reservasjon; sperret fra `fra_dato` til og med `til_dato`. Egen reservasjon (samme normaliserte mobil) sperrer ikke, og merkes `hentet` med `leie_id`.
- Ansatt: varsel, aldri sperre.
- Aldri kundenavn eller mobil utenfor admin. Tekster: «Reservert fra 14.10. – lever innen 13.10.», «Reservert for en kunde til 16.10.», «Maskinen er reservert for en annen kunde nå. Ta kontakt med utleier.»
- Tabellen kan mangle (`PGRST205`, `42P01`): da er det ingen reservasjoner, og admin får beskjed om migrasjon 0012.
- Worktree `.claude/worktrees/reservasjoner`, gren `reservasjoner`. Kommentarer og commit-meldinger på bokmål. Ingen push før ja, og migrasjonen kjøres av Thomas.

---

### Task 1: Reglene

**Files:** Create `src/lib/reservasjon.ts`, `src/lib/reservasjon.test.mjs`

**Interfaces – Produces:** `Reservasjon`, `ReservasjonStatus`, `dagFør(dag)`, `kortDag(dag)`, `nesteReservasjon(liste, iDag, unntatt?)`, `KundeGrense`, `kundeGrense(liste, iDag, telefon?)`, `reservasjonTekst(r, iDag)`, `ansattVarsel(liste, iDag, sluttDag | null)`, `egneReservasjoner(liste, telefon, iDag, sluttDag): string[]`.

- [ ] **Step 1: Testene**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ansattVarsel,
  dagFør,
  egneReservasjoner,
  kortDag,
  kundeGrense,
  nesteReservasjon,
  reservasjonTekst,
} from './reservasjon.ts'

const r = (fra, til, mer = {}) => ({
  id: fra,
  maskin_id: 'm',
  fra_dato: fra,
  til_dato: til,
  kunde_navn: 'Ola',
  kunde_telefon: '90000000',
  status: 'aktiv',
  ...mer,
})

test('dagen før, over måneds- og årsskifte og skuddår', () => {
  assert.equal(dagFør('2026-10-14'), '2026-10-13')
  assert.equal(dagFør('2026-11-01'), '2026-10-31')
  assert.equal(dagFør('2027-01-01'), '2026-12-31')
  assert.equal(dagFør('2028-03-01'), '2028-02-29')
})

test('kort dag', () => {
  assert.equal(kortDag('2026-10-04'), '04.10.')
})

test('neste reservasjon er den tidligste aktive som ikke er over', () => {
  const liste = [
    r('2026-11-01', '2026-11-02'),
    r('2026-10-14', '2026-10-16'),
    r('2026-09-01', '2026-09-05'),
    r('2026-10-10', '2026-10-11', { status: 'avlyst' }),
    r('2026-10-12', '2026-10-12', { status: 'hentet' }),
    r('2026-10-05', '2026-10-06', { status: 'forespurt' }),
  ]
  assert.equal(nesteReservasjon(liste, '2026-10-01')?.fra_dato, '2026-10-14')
  assert.equal(nesteReservasjon([], '2026-10-01'), null)
})

test('egen mobil teller ikke som neste reservasjon', () => {
  const liste = [r('2026-10-14', '2026-10-16', { kunde_telefon: '41111111' }), r('2026-10-20', '2026-10-21')]
  assert.equal(nesteReservasjon(liste, '2026-10-01', '41111111')?.fra_dato, '2026-10-20')
})

test('kundegrensen: fri, frist og sperret', () => {
  const liste = [r('2026-10-14', '2026-10-16')]
  assert.deepEqual(kundeGrense([], '2026-10-01'), { type: 'fri' })
  assert.deepEqual(kundeGrense(liste, '2026-10-01'), { type: 'frist', fra: '2026-10-14', sisteDag: '2026-10-13' })
  assert.deepEqual(kundeGrense(liste, '2026-10-14'), { type: 'sperret', til: '2026-10-16' })
  assert.deepEqual(kundeGrense(liste, '2026-10-16'), { type: 'sperret', til: '2026-10-16' })
  assert.deepEqual(kundeGrense(liste, '2026-10-17'), { type: 'fri' })
})

test('starter reservasjonen i morgen, må kunden levere i dag', () => {
  assert.deepEqual(kundeGrense([r('2026-10-02', '2026-10-03')], '2026-10-01'), {
    type: 'frist',
    fra: '2026-10-02',
    sisteDag: '2026-10-01',
  })
})

test('kunden med reservasjonen sperres av neste, ikke av sin egen', () => {
  const liste = [r('2026-10-14', '2026-10-16', { kunde_telefon: '41111111' }), r('2026-10-20', '2026-10-21')]
  assert.deepEqual(kundeGrense(liste, '2026-10-14', '41111111'), {
    type: 'frist',
    fra: '2026-10-20',
    sisteDag: '2026-10-19',
  })
})

test('tekstene nevner aldri kunden', () => {
  assert.equal(reservasjonTekst(r('2026-10-14', '2026-10-16'), '2026-10-01'), 'Reservert fra 14.10. – lever innen 13.10.')
  assert.equal(reservasjonTekst(r('2026-10-14', '2026-10-16'), '2026-10-15'), 'Reservert for en kunde til 16.10.')
})

test('ansattvarsel bare når returen går inn i reservasjonen', () => {
  const liste = [r('2026-10-14', '2026-10-16')]
  assert.equal(ansattVarsel(liste, '2026-10-01', '2026-10-13'), null)
  assert.equal(ansattVarsel(liste, '2026-10-01', '2026-10-14'), 'Reservert fra 14.10. – lever innen 13.10.')
  assert.equal(ansattVarsel(liste, '2026-10-01', null), 'Reservert fra 14.10. – lever innen 13.10.')
  assert.equal(ansattVarsel([], '2026-10-01', null), null)
})

test('egne reservasjoner som leien dekker', () => {
  const liste = [
    r('2026-10-14', '2026-10-16', { id: 'a', kunde_telefon: '41111111' }),
    r('2026-10-20', '2026-10-21', { id: 'b', kunde_telefon: '41111111' }),
    r('2026-10-14', '2026-10-16', { id: 'c' }),
  ]
  assert.deepEqual(egneReservasjoner(liste, '41111111', '2026-10-14', '2026-10-16'), ['a'])
  assert.deepEqual(egneReservasjoner(liste, '41111111', '2026-10-14', '2026-10-25'), ['a', 'b'])
})
```

- [ ] **Step 2:** `npm test` – FAIL, modulen mangler.

- [ ] **Step 3: Implementer**

```ts
/**
 * Reglene for reservasjoner, som rene funksjoner.
 *
 * Datoene er norske kalenderdager som yyyy-mm-dd (kolonnetypen date), og
 * slike datoer kan sammenlignes som tekst. Se
 * docs/superpowers/specs/2026-09-30-reservasjoner-design.md.
 */

export type ReservasjonStatus = 'forespurt' | 'aktiv' | 'hentet' | 'avlyst'

export type Reservasjon = {
  id: string
  maskin_id: string
  fra_dato: string
  til_dato: string
  kunde_navn: string
  kunde_telefon: string
  status: ReservasjonStatus
}

/** «2026-10-14» → «2026-10-13». I UTC, så sommertid ikke spiller inn. */
export function dagFør(dag: string): string {
  const [år, mnd, d] = dag.split('-').map(Number)
  return new Date(Date.UTC(år, mnd - 1, d - 1)).toISOString().slice(0, 10)
}

/** «2026-10-14» → «14.10.» */
export function kortDag(dag: string): string {
  const [, mnd, d] = dag.split('-')
  return `${d}.${mnd}.`
}

/**
 * Den aktive reservasjonen som kommer først og ikke er over. `unntatt` er
 * et mobilnummer: kundens egen reservasjon skal ikke sperre kunden.
 */
export function nesteReservasjon(
  liste: Reservasjon[],
  iDag: string,
  unntatt?: string,
): Reservasjon | null {
  return (
    liste
      .filter((r) => r.status === 'aktiv' && r.til_dato >= iDag && r.kunde_telefon !== unntatt)
      .sort((a, b) => a.fra_dato.localeCompare(b.fra_dato))[0] ?? null
  )
}

export type KundeGrense =
  | { type: 'fri' }
  | { type: 'sperret'; til: string }
  | { type: 'frist'; fra: string; sisteDag: string }

/** Hvor lenge en kunde kan leie maskinen fra i dag. */
export function kundeGrense(liste: Reservasjon[], iDag: string, telefon?: string): KundeGrense {
  const r = nesteReservasjon(liste, iDag, telefon)
  if (!r) return { type: 'fri' }
  if (r.fra_dato <= iDag) return { type: 'sperret', til: r.til_dato }
  return { type: 'frist', fra: r.fra_dato, sisteDag: dagFør(r.fra_dato) }
}

/** Det ansatte og kunder får se. Aldri kundens navn. */
export function reservasjonTekst(r: Reservasjon, iDag: string): string {
  return r.fra_dato <= iDag
    ? `Reservert for en kunde til ${kortDag(r.til_dato)}`
    : `Reservert fra ${kortDag(r.fra_dato)} – lever innen ${kortDag(dagFør(r.fra_dato))}`
}

/**
 * Varsel etter et uttak, bare når returen går inn i reservasjonen.
 * `sluttDag` null er «til videre», som alltid gjør det.
 */
export function ansattVarsel(
  liste: Reservasjon[],
  iDag: string,
  sluttDag: string | null,
): string | null {
  const r = nesteReservasjon(liste, iDag)
  if (!r) return null
  if (sluttDag !== null && sluttDag < r.fra_dato) return null
  return reservasjonTekst(r, iDag)
}

/** Kundens egne aktive reservasjoner som en leie fra i dag til sluttDag dekker. */
export function egneReservasjoner(
  liste: Reservasjon[],
  telefon: string,
  iDag: string,
  sluttDag: string,
): string[] {
  return liste
    .filter(
      (r) =>
        r.status === 'aktiv' &&
        r.kunde_telefon === telefon &&
        r.fra_dato <= sluttDag &&
        r.til_dato >= iDag,
    )
    .map((r) => r.id)
}
```

- [ ] **Step 4:** `npm test` – alt består.
- [ ] **Step 5:** Commit `src/lib/reservasjon.ts src/lib/reservasjon.test.mjs` – «Reglene for reservasjoner, med tester».

---

### Task 2: Migrasjon 0012, testet mot ekte Postgres

**Files:** Create `supabase/migrations/0012_reservasjoner.sql`. Testskript i scratchpad (ikke i repoet).

- [ ] **Step 1: Migrasjonen**

```sql
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
create or replace view public.hm_offentleg_opptatt as
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
```

- [ ] **Step 2: Test mot PGlite** (i scratchpad: `npm install @electric-sql/pglite`). Skriptet lager stubber for Supabase (`anon`, `authenticated`, skjema `auth` med `users` og `uid()`, skjema `extensions`), gir anon alt på nye tabeller slik Supabase gjør, og kjører 0001–0012 i rekkefølge. Så, forventet:
  1. Aktiv 01.–03.10 lagres. Aktiv 03.–05.10 samme maskin → feil `23P01`. Aktiv 04.–05.10 lagres. Avlyst og forespurt 02.10 lagres.
  2. `til_dato < fra_dato` → feil `23514`.
  3. Visningen gir `maskin_id, fra_dato, til_dato` for de aktive, og ingen andre kolonner.
  4. Som `anon`: `select` på visningen virker; `delete` på visningen → `42501`; `select` på `reservasjoner` → 0 rader (RLS).
  5. 0012 kjørt to ganger feiler ikke.

- [ ] **Step 3:** Commit `supabase/migrations/0012_reservasjoner.sql` – «Migrasjon 0012: reservasjoner og hm_offentleg_opptatt».

---

### Task 3: Kundeflyten

**Files:** Create `src/lib/reservasjon-data.ts`. Modify `src/app/m/[qr]/page.tsx`, `src/app/m/[qr]/leie-skjema.tsx`, `src/app/m/[qr]/actions.ts`.

**Interfaces – Produces:** `hentReservasjoner(maskinIder?: string[]): Promise<Reservasjon[]>`, `merkHentet(ider: string[], leieId: string): Promise<void>`.

- [ ] **Step 1: `reservasjon-data.ts`**

```ts
import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { osloDag } from '@/lib/dato'
import type { Reservasjon } from '@/lib/reservasjon'

/** «Tabellen finnes ikke» – migrasjon 0012 er ikke kjørt. */
const FINNES_IKKE = ['PGRST205', '42P01']

/**
 * Aktive reservasjoner som ikke er over. Service role, som resten av
 * kunde- og ansattflyten. Mangler tabellen, er svaret tomt, så appen
 * virker som før til migrasjonen er kjørt. Andre feil kastes – en feil
 * skal aldri se ut som «ingen reservasjoner».
 */
export async function hentReservasjoner(maskinIder?: string[]): Promise<Reservasjon[]> {
  let spørring = supabaseAdmin
    .from('reservasjoner')
    .select('id, maskin_id, fra_dato, til_dato, kunde_navn, kunde_telefon, status')
    .eq('status', 'aktiv')
    .gte('til_dato', osloDag(new Date()))
    .order('fra_dato')
  if (maskinIder) spørring = spørring.in('maskin_id', maskinIder)

  const { data, error } = await spørring
  if (error) {
    if (FINNES_IKKE.includes(error.code)) return []
    throw new Error(`Kunne ikke hente reservasjoner: ${error.message}`)
  }
  return (data ?? []) as Reservasjon[]
}

/** Kundens egne reservasjoner er hentet – knyttes til leien som startet. */
export async function merkHentet(ider: string[], leieId: string): Promise<void> {
  if (ider.length === 0) return
  await supabaseAdmin
    .from('reservasjoner')
    .update({ status: 'hentet', leie_id: leieId })
    .in('id', ider)
    .eq('status', 'aktiv')
}
```

- [ ] **Step 2: `startLeie`** – etter verkstedsjekken, før kunden lagres:

```ts
  // En annen kundes reservasjon: levering senest dagen før, og ingen leie
  // mens den pågår. Kundens egen reservasjon teller ikke.
  let reservasjoner: Reservasjon[]
  try {
    reservasjoner = await hentReservasjoner([maskin.id])
  } catch {
    return { feil: 'Kunne ikke sjekke reservasjonene. Prøv igjen.' }
  }
  const iDag = osloDag(new Date())
  const grense = kundeGrense(reservasjoner, iDag, telefon)
  if (grense.type === 'sperret') {
    return { feil: 'Maskinen er reservert for en annen kunde nå. Ta kontakt med utleier.' }
  }
  if (grense.type === 'frist' && felter.data.planlagt_slutt > grense.sisteDag) {
    return {
      feil: `Maskinen er reservert fra ${kortDag(grense.fra)} Velg levering senest ${kortDag(grense.sisteDag)}`,
    }
  }
```

Etter `hendelser`-innsettingen: `await merkHentet(egneReservasjoner(reservasjoner, telefon, iDag, felter.data.planlagt_slutt), leie.id)`.

- [ ] **Step 3: `LeieSkjema`** får `sisteDag?: string`, satt som `max` på datofeltet.

- [ ] **Step 4: `/m/[qr]`** – `hentReservasjoner([maskin.id])` i `Promise.all`; `iDag`, `grense = kundeGrense(…)`, `neste = nesteReservasjon(…)`. Merket i toppen viser «Reservert» (gul) når grensen er `sperret` og maskinen ikke er utleid. Over kundeskjemaet: `Beskjed` «Reservert fra 14.10.» / «En annen kunde har reservert maskinen. Du kan leie den nå, men må levere senest 13.10.», eller «Reservert nå» / «… Er det deg, fyll ut skjemaet med mobilnummeret du oppga da du reserverte.» `sisteDag` sendes til `LeieSkjema`. Over `UttakEnkel` for ansatte: gul boks med `reservasjonTekst(neste, iDag)`.

- [ ] **Step 5:** eslint, tsc, `npm test`. Commit – «Kunder: reservasjoner gir leveringsfrist, og egen reservasjon merkes hentet».

---

### Task 4: Ansattflyten

**Files:** Modify `src/lib/intern-leie.ts`, `src/app/ansatt/actions.ts`, `src/app/ansatt/uttak-skjema.tsx`.

- [ ] **Step 1:** `UttakMaskin.reservert: string | null`. `hentUttaksside` henter `hentReservasjoner().catch(() => [])` i samme `Promise.all`, grupperer per maskin og setter `reservert = neste ? reservasjonTekst(neste, iDag) : null`.
- [ ] **Step 2:** `taUtUtstyr` henter `hentReservasjoner(maskinIder).catch(() => [])` én gang; etter hvert uttak `ansattVarsel(perMaskin, iDag, planlagtSlutt ? osloDag(planlagtSlutt) : null)` → `varsler.push(`${m.navn}: ${v}`)`. Returnerer `{ tattUt, ikkeTatt, varsler }`.
- [ ] **Step 3:** `UttakTilstand.varsel?: string`; `taUt` setter `varsel: svar.varsler.join(' ') || undefined`.
- [ ] **Step 4:** `Svar` viser varselet i gul ramme; bunnlinja skjules ikke når bare `varsel` er satt. `Navn` viser `reservert` med en gul firkant foran (tekst i vanlig blekk, så kontrasten holder i mørkt tema). `vedSkann`: reservert maskin krysses av og gir `{ tone: 'info', tekst: '✓ Navn – Reservert fra …' }`.
- [ ] **Step 5:** eslint, tsc, `npm test`. Commit – «Ansatte: varsel om reservasjoner i lista, skanneren og etter uttak».

---

### Task 5: Admin

**Files:** Create `src/app/admin/(panel)/kalender/actions.ts`, `src/app/admin/(panel)/kalender/ny-reservasjon.tsx`. Modify `src/app/admin/(panel)/kalender/page.tsx`, `src/app/admin/(panel)/maskiner/[id]/page.tsx`.

- [ ] **Step 1: Handlingene** – `nyReservasjon` (krevAdmin, zod, `normaliserTelefon`, `til >= fra`, `til >= i dag`; insert via `lagServerKlient` med `opprettet_av`; `23P01` → «Maskinen er allerede reservert i den perioden.»; manglende tabell → «Reservasjoner er ikke slått på ennå – kjør migrasjon 0012 i Supabase.»; varsel når maskinen er utleid med retur `>= fra_dato` eller til videre). `avlysReservasjon(id)` setter `avlyst` der status er `aktiv`. Begge `revalidatePath` kalender og maskinside.
- [ ] **Step 2: Skjemaet** – som `NyttProsjekt`: «+ Ny reservasjon» åpner maskin (select), fra, til (`min` i dag), kundens navn, mobil, notat; viser feil, ok og varsel.
- [ ] **Step 3: Kalenderen** – henter reservasjoner som berører måneden og aktive maskiner til skjemaet; manglende tabell → beskjed i stedet for skjema. Rutenettet viser reservasjonene med stiplet gul kant over leiene; tegnforklaringen får «Reservert». Lista «Reservasjoner i <måned>» med datoer, maskin, kunde, mobil, notat og «Avlys».
- [ ] **Step 4: Maskinsida** – kortet «Reservasjoner» med kommende aktive og «Avlys», eller en lenke til kalenderen.
- [ ] **Step 5:** eslint, tsc, `npm test`. Commit – «Admin: reservasjoner i kalenderen og på maskinsida».

---

### Task 6: Prøv i nettleseren og fullfør

- [ ] **Step 1:** Midlertidig prøveside med `UttakListe` (reserverte maskiner, skanneren med falskt kamera), `LeieSkjema` med `sisteDag`, og `NyReservasjon`. 375 px, lyst og mørkt; skjermbilder til Thomas. Slett prøvesida.
- [ ] **Step 2:** eslint, tsc, `npm test`, `next build`.
- [ ] **Step 3:** superpowers:finishing-a-development-branch. Etter ja: slå sammen og push; be Thomas kjøre `0012_reservasjoner.sql` i Supabase SQL Editor; fjern junction-lenka i `.next` før worktreen fjernes.
