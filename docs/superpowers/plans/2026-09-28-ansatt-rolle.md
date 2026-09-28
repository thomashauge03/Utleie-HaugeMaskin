# Ansatt-rollen — implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mål:** Egne folk tar ut utstyr til firmaets prosjekter uten kundeskjemaet,
og internleia føres på prosjektet.

**Arkitektur:** Samme `leier`-tabell som kundene, med `ansatt_id` og
`prosjekt_id` – en leie har enten kunde eller ansatt, og databasen låser det.
Alt de ansatte gjør går gjennom server actions med service role som selv
sjekker eierskap, mens `er_admin()` strammes inn til rollen admin. Ren logikk
(pris, datoer, hvem som vises som leietaker, trygg omdirigering) ligger i små
moduler uten kjøretidsimporter, testet med `node:test`.

**Teknologi:** Next.js 16.2.12 (App Router, server actions), React 19.2.4,
Supabase (`@supabase/ssr`, `@supabase/supabase-js`), zod 4, Tailwind v4,
Resend, Node 24 (`node:test` med innebygd TypeScript-stripping).

**Spec:** `docs/superpowers/specs/2026-09-28-ansatt-rolle-design.md`

## Globale krav

Gjelder **hver** oppgave under.

- **Les `node_modules/next/dist/docs/` før du skriver Next-kode** (AGENTS.md).
  `params` og `searchParams` er Promises. `redirect()` står aldri i en
  `try`-blokk. `revalidatePath` kalles før `redirect`. Sti med dynamisk
  segment krever typen: `revalidatePath('/m/[qr]', 'page')`.
- **Hver side og hver server action** kaller tilgangssjekken som første
  setning: `krevAdmin()` i adminpanelet, `krevAnsatt()` på `/ansatt`.
- **Ingen nye npm-pakker.** Tester er `*.test.mjs` med `node:test`. En modul
  som testes, kan bare ha `import type` fra andre filer – Node løser ikke opp
  `@/`-stier eller filnavn uten endelse.
- **Rollene er `admin | service | ansatt`.** Alle kan ta ut utstyr. `ansatt`
  kommer bare inn på `/ansatt`. Service beholder verkstedet.
- **Kunder ser aldri ansattnavn eller prosjekt. Ansatte ser aldri kundenavn**
  – bare «Utleid».
- **Pris:** `beregnPris()` – påbegynt enhet teller som hel, minst én, hele
  kroner (`Math.round`), maskin uten pris gir `belop: null`.
- **Aktør i `hendelser`:** `ansatt:<epost>` når en innlogget tar ut eller
  leverer, `admin:<epost>` når admin gjør det. Nye hendelsestyper:
  `startet`, `levert`, `justert`.
- **Innbygging av ansatt** skrives alltid med hint:
  `ansatt:admin_brukere!leier_ansatt_id_fkey(...)`. Bruk `LEIETAKER_FELT`
  der hele leietakeren trengs.
- **Supabase-rader** caster du til egne typer med `as unknown as X`.
  Innbygde relasjoner kommer ut som arrays i de genererte typene
  (klienten er utypet), og direkte feltoppslag på dem feiler i `tsc`.
- **Adminsider bruker `lagServerKlient()`** (RLS gjelder). **Ansattsiden og
  QR-siden bruker `supabaseAdmin`** i `src/lib/intern-leie.ts`, som sjekker
  eierskap selv – en ansatt har ingen leserettigheter i databasen.
- Returform fra `useActionState`-handlinger: `{ feil?: string; ok?: string }`.
  Begge kan være satt samtidig ved delvis uttak.
- Kodestil som i repoet: bokmål i kode, UI og kommentarer. Identifikatorer
  beholder æøå (`søk`, `påVerksted`), filnavn er ASCII kebab-case.
  Kommentarer forklarer **hvorfor**. `·` som skilletegn, `…`, «» rundt
  brukerverdier. `border-2`, ingen `rounded`, ingen `dark:`, ingen modaler,
  trykkflater `min-h-[2.75rem]`. All datovisning går gjennom `src/lib/dato.ts`.
- **Commit bare egne filer.** Arbeidstreet har Thomas' ucommittede endringer
  i `eslint.config.mjs`, `tsconfig.json`, `src/app/globals.css`,
  `.vercelignore` og `promo/` – de skal aldri med i en commit. Legg til filer
  med navn, aldri `git add -A` eller `git add .`.
- Commit-melding på bokmål, og avslutt med
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Kjør aldri `scripts/slett-testdata.mjs`.** Den tømmer alle leier og
  kunder i produksjonsbasen.

## Om testing i dette repoet

Syklusen som hver oppgave bruker:

```bash
npm test
```
```bash
npx next typegen
```
```bash
npx tsc --noEmit
```
```bash
npm run lint
```

`npx next typegen` må kjøres etter at en ny rute er opprettet, ellers finnes
ikke `PageProps<'/ny/rute'>`. Feiler `tsc` på `.next/dev/types/validator.ts`
etter at `next dev` har kjørt med ruter som ikke finnes lenger, slett `.next`
og kjør typegen på nytt. `npm run build` kjøres der oppgaven sier det – den
tar et par minutter.

`tsc` og `lint` skal være helt rene etter hver oppgave. Grunnlinjen før
oppgave 1 er ren (sjekket 2026-09-28).

**Databasen er produksjonsbasen** – det finnes ingen egen testbase. Migrasjonen
kjøres av Thomas i Supabase SQL Editor (oppgave 1). Spørringer sjekkes med et
engangsskript med service role, som bare leser.

**Innlogget testing gjør Thomas selv** (oppgave 13). Innlogging går mot
Supabase Auth, en tjeneste utenfor maskinen, og en agent logger ikke inn med
passord der, og oppretter heller ikke brukere der. Det agenten kan teste i
nettleseren, er sidene uten innlogging.

---

## Filoversikt

**Nye filer**

| Fil | Ansvar |
|---|---|
| `supabase/migrations/0011_ansatt.sql` | prosjekter, rolle, leietaker-sjekk, RLS |
| `src/lib/neste.ts` (+ `.test.mjs`) | `trygtNeste()` – lokal sti etter innlogging |
| `src/lib/leietaker.ts` (+ `.test.mjs`) | hvem en leie står på, hvorfor en maskin er opptatt |
| `src/lib/pris.test.mjs`, `src/lib/dato.test.mjs` | tester for eksisterende moduler |
| `src/lib/intern-leie.ts` | uttak, levering og data til `/ansatt` (server-only) |
| `src/components/bruker-meny.tsx` | flyttet fra `src/app/verksted/`, felles meny |
| `src/app/ansatt/page.tsx` | «Hos deg nå» og «Ta ut utstyr» |
| `src/app/ansatt/actions.ts` | `taUt`, `lever` |
| `src/app/ansatt/uttak-skjema.tsx` | `UttakListe` (flervalg) og `UttakEnkel` (QR) |
| `src/app/ansatt/lever-knapp.tsx` | lever med valgfri merknad |
| `src/app/ansatt/loading.tsx` | skjelett |
| `src/app/admin/(panel)/prosjekter/page.tsx` | liste med internleie hittil |
| `src/app/admin/(panel)/prosjekter/actions.ts` | opprett, endre, avslutt, slett |
| `src/app/admin/(panel)/prosjekter/nytt-prosjekt.tsx` | inline skjema |
| `src/app/admin/(panel)/prosjekter/loading.tsx` | skjelett |
| `src/app/admin/(panel)/prosjekter/[id]/page.tsx` | leiene på prosjektet, sum |
| `src/app/admin/(panel)/prosjekter/[id]/rediger-prosjekt.tsx` | navn og nummer |
| `src/app/admin/(panel)/prosjekter/[id]/loading.tsx` | skjelett |
| `src/app/admin/(panel)/leier/[id]/rett-internpris.tsx` | rett antall og beløp |

**Endrede filer**

| Fil | Endring |
|---|---|
| `package.json` | `test`-skript |
| `scripts/sjekk-migrasjoner.mjs` | rad for 0011 |
| `supabase/KJOR-DENNE.sql` | regenereres, redigeres aldri for hånd |
| `src/lib/types.ts` | nullbare felt, `Prosjekt`, `LeieRad`, `erForfalt` |
| `src/lib/pris.ts` | `beregnPris`, `summerInternleie` |
| `src/lib/dato.ts` | `returDato`, `norskSluttAvDag` (flyttet) |
| `src/lib/auth.ts` | rolle, `hjemFor`, `krevAnsatt`, `hentFullAdmin`, `kanEndreVerksted` |
| `src/proxy.ts` | sesjonsoppfrisking også utenfor `/admin` |
| `src/lib/verksted-data.ts` | leietaker i «ute hos», nullbar dato |
| `src/lib/epost/send.ts`, `maler.ts`, `varsler.ts` | merknad ved levering, forfall med leietaker |
| `src/lib/faktura-pdf.tsx` | `returDato` |
| `src/app/admin/logg-inn/page.tsx`, `skjema.tsx`, `actions.ts` | `?neste=` |
| `src/app/admin/bytt-passord/actions.ts` | `hjemFor` |
| `src/app/admin/(panel)/brukere/*` | rolle ansatt, mobil, «N ting ute» |
| `src/app/admin/(panel)/meny.tsx` | Prosjekter, Ta ut utstyr |
| `src/app/admin/(panel)/page.tsx`, `leier/page.tsx`, `kalender/page.tsx`, `maskiner/[id]/page.tsx` | leietaker, «Intern», ufakturert uten internleier |
| `src/app/admin/(panel)/leier/[id]/page.tsx`, `actions.ts`, `manuell-levering.tsx` | internleie-visning |
| `src/app/m/[qr]/page.tsx`, `actions.ts` | kort skjema for innloggede, `norskSluttAvDag` fra dato |
| `src/app/retur/page.tsx` | innlogget → `/ansatt`, «Ansatt? Logg inn» |
| `src/app/leie/[ref]/page.tsx` | `returDato` |
| `src/app/verksted/page.tsx`, `[id]/page.tsx`, `actions.ts` | rollesjekk, felles meny |
| `src/app/api/faktura/[id]/route.ts`, `api/maskiner/csv/route.ts`, `api/varsler/forfalt/route.ts`, `api/ical/[fil]/route.ts` | `hentFullAdmin`, internleier |
| `README.md` | roller og migrasjon |

---

## Oppgave 1: Migrasjon 0011

**Filer:**
- Opprett: `supabase/migrations/0011_ansatt.sql`
- Endre: `scripts/sjekk-migrasjoner.mjs` (lista `MIGRASJONER`)
- Regenerer: `supabase/KJOR-DENNE.sql`

**Grensesnitt:**
- Produserer: tabell `prosjekter(id, navn, nummer, aktiv, opprettet)`;
  `admin_brukere.telefon`; rolle `ansatt`; `leier.ansatt_id`,
  `leier.prosjekt_id` med fremmednøkkel `leier_ansatt_id_fkey`;
  `leier.kunde_id` og `leier.planlagt_slutt` nullbare; `er_admin()` krever
  `rolle = 'admin'`; policy `egen_rad` på `admin_brukere`.

- [ ] **Steg 1: Legg sonderingen for 0011 inn i sjekkskriptet**

I `scripts/sjekk-migrasjoner.mjs`, finn:

```js
  { fil: '0010_fjern_kjoretoy.sql', tabell: 'kjoretoy', kolonne: 'eu_frist', borte: true },
]
```

Erstatt med:

```js
  { fil: '0010_fjern_kjoretoy.sql', tabell: 'kjoretoy', kolonne: 'eu_frist', borte: true },
  { fil: '0011_ansatt.sql', tabell: 'prosjekter', kolonne: 'id' },
]
```

- [ ] **Steg 2: Kjør sjekken og se at 0011 mangler**

```bash
node --env-file=.env.local scripts/sjekk-migrasjoner.mjs
```

Forventet: `✗ 0011_ansatt.sql`, «1 migrasjon mangler», exit-kode 1.

- [ ] **Steg 3: Skriv migrasjonen**

Opprett `supabase/migrations/0011_ansatt.sql`:

```sql
-- ═══════════════════════════════════════════════════════════
--  Ansatt-rollen og prosjekter
--
--  Egne folk tar ut utstyr til firmaets prosjekter uten å fylle
--  ut kundeskjemaet. Leien føres på prosjektet med internpris.
--  Se docs/superpowers/specs/2026-09-28-ansatt-rolle-design.md.
--
--  Trygg å kjøre mot koden som ligger ute før denne: nye kolonner
--  er valgfrie, eksisterende leier oppfyller sjekken, og
--  tilgangsendringen treffer ingen kodevei som trenger den gamle.
-- ═══════════════════════════════════════════════════════════


-- ── Prosjekter ─────────────────────────────────────────────
create table if not exists prosjekter (
  id        uuid primary key default gen_random_uuid(),
  navn      text not null unique,
  nummer    text,
  aktiv     boolean not null default true,
  opprettet timestamptz not null default now()
);

comment on table prosjekter is
  'Firmaets egne prosjekter. Internleier føres på dem.';
comment on column prosjekter.aktiv is
  'false = avsluttet. Forsvinner fra de ansattes liste, men historikken består.';


-- ── Rollen ansatt ──────────────────────────────────────────
-- Sjekken fra 0005 ble laget inline på kolonnen, så Postgres valgte
-- navnet. Vi finner den på innholdet i stedet for å gjette.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.admin_brukere'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%rolle%'
  loop
    execute format('alter table admin_brukere drop constraint %I', c.conname);
  end loop;
end $$;

alter table admin_brukere
  add constraint admin_brukere_rolle_check
  check (rolle in ('admin', 'service', 'ansatt'));

comment on column admin_brukere.rolle is
  'admin = full tilgang. service = verkstedet, og kan ta ut utstyr. '
  'ansatt = kan bare ta ut utstyr til prosjekter.';

alter table admin_brukere
  add column if not exists telefon text;

comment on column admin_brukere.telefon is
  'Valgfritt mobilnummer, åtte siffer. Vises for admin på internleier.';


-- ── Leier: enten kunde eller ansatt ────────────────────────
alter table leier alter column kunde_id drop not null;
alter table leier alter column planlagt_slutt drop not null;

alter table leier
  add column if not exists ansatt_id uuid references admin_brukere(id),
  add column if not exists prosjekt_id uuid references prosjekter(id);

-- To former, og bare to. En kundeleie ser ut akkurat som før. En
-- internleie har ansatt og prosjekt, og kan stå «til videre».
alter table leier drop constraint if exists leier_leietaker_check;
alter table leier add constraint leier_leietaker_check check (
  (kunde_id is not null and ansatt_id is null and prosjekt_id is null
     and planlagt_slutt is not null)
  or
  (kunde_id is null and ansatt_id is not null and prosjekt_id is not null)
);

create index if not exists leier_prosjekt_idx
  on leier (prosjekt_id) where prosjekt_id is not null;
create index if not exists leier_ansatt_idx
  on leier (ansatt_id) where ansatt_id is not null;


-- ── Radsikkerhet ───────────────────────────────────────────
alter table prosjekter enable row level security;

drop policy if exists admin_alt on prosjekter;
create policy admin_alt on prosjekter
  for all using (er_admin()) with check (er_admin());

-- er_admin() sjekket bare at brukeren var aktiv. Alle policyene bygger
-- på den, så en servicebruker – og nå alle ansatte – kunne lese og
-- endre kundedata rett mot databasen med sin egen sesjon. Alt de andre
-- rollene gjør i appen, går gjennom server actions med service role,
-- så ingenting i koden trenger den gamle bredden.
create or replace function er_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_brukere
    where id = auth.uid() and aktiv = true and rolle = 'admin'
  );
$$;

-- Innloggingen (hentAdmin, loggInn) leser brukerens egen rad med
-- brukerens egen sesjon. Det må alle roller få lov til.
drop policy if exists egen_rad on admin_brukere;
create policy egen_rad on admin_brukere
  for select using (id = auth.uid());
```

- [ ] **Steg 4: Regenerer samlefila**

```bash
node scripts/lag-samlemigrasjon.mjs
```

Forventet: «Skrev 9 migrasjoner til supabase/KJOR-DENNE.sql», med
`0011_ansatt.sql` sist i lista. Åpne ikke fila for hånd.

- [ ] **Steg 5: Commit**

```bash
git add supabase/migrations/0011_ansatt.sql supabase/KJOR-DENNE.sql scripts/sjekk-migrasjoner.mjs
git commit -m "Migrasjon 0011: prosjekter, rollen ansatt og strammere er_admin()" -m "En leie har nå enten kunde eller ansatt og prosjekt, låst i databasen. er_admin() krever rollen admin, og alle kan lese sin egen brukerrad." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Steg 6: STOPP – Thomas kjører migrasjonen**

Be Thomas om dette, og vent på svar:

> Migrasjonen er klar. Åpne Supabase → SQL Editor, lim inn hele
> `supabase/migrations/0011_ansatt.sql` og trykk Run. Bare den fila – 0001–0010
> er kjørt fra før. Den er trygg mot koden som ligger ute nå.
>
> Kjør så denne, og si hva den svarer:
>
> ```sql
> select conname, pg_get_constraintdef(oid)
> from pg_constraint
> where conrelid = 'public.admin_brukere'::regclass and contype = 'c';
> ```
>
> Den skal gi én rad: `admin_brukere_rolle_check` med `'admin', 'service', 'ansatt'`.

- [ ] **Steg 7: Bekreft at migrasjonen er kjørt**

```bash
node --env-file=.env.local scripts/sjekk-migrasjoner.mjs
```

Forventet: alle ✓, «Alle migrasjoner er kjørt.», exit 0.

---

## Oppgave 2: Testkjøring og ren logikk

**Filer:**
- Endre: `package.json`
- Endre: `src/lib/pris.ts`, `src/lib/dato.ts`, `src/app/m/[qr]/actions.ts`
- Opprett: `src/lib/neste.ts`
- Test: `src/lib/pris.test.mjs`, `src/lib/dato.test.mjs`, `src/lib/neste.test.mjs`

**Grensesnitt:**
- Produserer:
  - `beregnPris(start: string, slutt: string, e: PrisEnhet, pris: number | null): { antall: number; belop: number | null }` i `@/lib/pris`
  - `returDato(iso: string | null): string` i `@/lib/dato`
  - `norskSluttAvDag(ymd: string): Date | null` i `@/lib/dato` (flyttet)
  - `trygtNeste(neste: unknown): string | null` i `@/lib/neste`

- [ ] **Steg 1: Legg til testskriptet**

I `package.json`, finn:

```json
    "lint": "eslint",
```

Erstatt med:

```json
    "lint": "eslint",
    "test": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test \"src/**/*.test.mjs\"",
```

Flagget demper en ufarlig advarsel: Node gjetter at `.ts`-filene er
ES-moduler, siden `package.json` ikke har `"type"`. Å sette `"type": "module"`
ville endret hvordan resten av prosjektet lastes – ikke gjør det.

- [ ] **Steg 2: Skriv testene**

Opprett `src/lib/pris.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beregnPris } from './pris.ts'

const start = '2026-09-01T08:00:00.000Z'

test('påbegynt døgn teller som helt', () => {
  assert.deepEqual(beregnPris(start, '2026-09-02T09:00:00.000Z', 'dogn', 450), {
    antall: 2,
    belop: 900,
  })
})

test('minst én enhet, også for ti minutter', () => {
  assert.deepEqual(beregnPris(start, '2026-09-01T08:10:00.000Z', 'dogn', 450), {
    antall: 1,
    belop: 450,
  })
})

test('timepris regner timer', () => {
  assert.deepEqual(beregnPris(start, '2026-09-01T10:30:00.000Z', 'time', 200), {
    antall: 3,
    belop: 600,
  })
})

test('uten pris blir beløpet null, ikke 0', () => {
  assert.deepEqual(beregnPris(start, '2026-09-03T08:00:00.000Z', 'dogn', null), {
    antall: 2,
    belop: null,
  })
})

test('hele kroner, som forslaget på godkjenningssiden', () => {
  assert.equal(beregnPris(start, '2026-09-02T08:00:00.000Z', 'dogn', 333.33).belop, 333)
})
```

Opprett `src/lib/dato.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { norskSluttAvDag, returDato } from './dato.ts'

test('vintertid: 23:59:59 norsk er 22:59:59 UTC', () => {
  assert.equal(norskSluttAvDag('2026-01-15')?.toISOString(), '2026-01-15T22:59:59.000Z')
})

test('sommertid: 23:59:59 norsk er 21:59:59 UTC', () => {
  assert.equal(norskSluttAvDag('2026-07-15')?.toISOString(), '2026-07-15T21:59:59.000Z')
})

test('feil format gir null', () => {
  assert.equal(norskSluttAvDag('15.07.2026'), null)
  assert.equal(norskSluttAvDag(''), null)
})

test('uten dato står det «til videre»', () => {
  assert.equal(returDato(null), 'til videre')
  assert.equal(returDato('2026-07-15T21:59:59.000Z'), '15.07.2026')
})
```

Opprett `src/lib/neste.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trygtNeste } from './neste.ts'

test('lokale stier godtas', () => {
  assert.equal(trygtNeste('/m/M-0012'), '/m/M-0012')
  assert.equal(trygtNeste('/ansatt'), '/ansatt')
})

test('alt som kan peke til en annen vert avvises', () => {
  for (const ond of ['//evil.no', '/\\evil.no', 'https://evil.no', 'evil.no', '/\t/evil.no', '']) {
    assert.equal(trygtNeste(ond), null, JSON.stringify(ond))
  }
})

test('manglende eller ikke-tekst avvises', () => {
  assert.equal(trygtNeste(null), null)
  assert.equal(trygtNeste(undefined), null)
  assert.equal(trygtNeste(['/ansatt']), null)
})
```

- [ ] **Steg 3: Kjør testene og se dem feile**

```bash
npm test
```

Forventet: FAIL – `beregnPris`, `norskSluttAvDag`/`returDato` finnes ikke,
og `./neste.ts` finnes ikke.

- [ ] **Steg 4: `beregnPris`**

Legg til nederst i `src/lib/pris.ts`:

```ts
/**
 * Antall enheter og beløp for en periode.
 *
 * Én regel for både forslaget på godkjenningssiden og internleie som
 * regnes ut ved levering, så de aldri kan regne ulikt. Hele kroner, som
 * forslaget alltid har vært. Uten pris på maskinen blir beløpet null,
 * ikke 0 – «mangler pris» er noe annet enn «gratis».
 */
export function beregnPris(
  start: string,
  slutt: string,
  e: PrisEnhet,
  pris: number | null,
): { antall: number; belop: number | null } {
  const antall = beregnAntall(start, slutt, e)
  return { antall, belop: pris === null ? null : Math.round(antall * pris) }
}
```

- [ ] **Steg 5: `returDato` og `norskSluttAvDag` i `dato.ts`**

I `src/app/m/[qr]/actions.ts`, **klipp ut** hele blokken fra kommentaren
`/**` som starter med `* «2026-07-30» → tidspunktet 23:59:59` til og med
avsluttende `}` på `function norskSluttAvDag` (linje 42–68), og lim den inn
nederst i `src/lib/dato.ts` med `export` foran `function`:

```ts
/**
 * «2026-07-30» → tidspunktet 23:59:59 den dagen i norsk tid, som et
 * korrekt UTC-instant – uavhengig av hvilken tidssone serveren står i.
 *
 * Vi finner Oslos offset ved å formatere kl. 12 UTC den dagen i
 * Europe/Oslo: klokka blir 13 (vinter, UTC+1) eller 14 (sommer, UTC+2).
 * Da vet vi at 23:59:59 Oslo = (23 − offset):59:59 UTC samme dato.
 * Kl. 12 UTC unngår all døgnkryssing.
 */
export function norskSluttAvDag(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null

  const [år, mnd, dag] = ymd.split('-').map(Number)
  const klokka12 = new Date(Date.UTC(år, mnd - 1, dag, 12, 0, 0))

  const osloTime = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Oslo',
      hour: '2-digit',
      hour12: false,
    }).format(klokka12),
  )
  const offset = osloTime - 12 // 1 om vinteren, 2 om sommeren

  const instant = new Date(Date.UTC(år, mnd - 1, dag, 23 - offset, 59, 59))
  return Number.isNaN(instant.getTime()) ? null : instant
}
```

Legg også til i `src/lib/dato.ts`, rett etter `dato()`:

```ts
/**
 * Avtalt levering, eller «til videre» for internleier uten dato.
 *
 * Kundeleier har alltid dato – databasen krever det – så for dem er
 * dette det samme som dato().
 */
export function returDato(iso: string | null): string {
  return iso ? dato(iso) : 'til videre'
}
```

I `src/app/m/[qr]/actions.ts`, finn:

```ts
import { varsleNyLeie } from '@/lib/epost/varsler'
```

Erstatt med:

```ts
import { varsleNyLeie } from '@/lib/epost/varsler'
import { norskSluttAvDag } from '@/lib/dato'
```

- [ ] **Steg 6: `trygtNeste`**

Opprett `src/lib/neste.ts`:

```ts
/**
 * Godtar bare en lokal sti som mål etter innlogging.
 *
 * «neste» kommer fra adresselinja og kan settes av hvem som helst. Uten
 * denne sjekken blir innloggingssiden en åpen omdirigering: en lenke til
 * vår egen innlogging som sender offeret videre til en falsk side etterpå.
 * «//evil.no» og «/\evil.no» ser lokale ut, men nettleseren tolker dem
 * som en annen vert. Tabulator og linjeskift fjernes av nettleseren før
 * tolkning, så «/⇥/evil.no» blir til «//evil.no» – derfor avvises
 * kontrolltegn også.
 */
export function trygtNeste(neste: unknown): string | null {
  if (typeof neste !== 'string') return null
  if (!neste.startsWith('/')) return null
  if (neste.startsWith('//') || neste.startsWith('/\\')) return null
  for (const tegn of neste) {
    if (tegn.charCodeAt(0) < 0x20) return null
  }
  return neste
}
```

- [ ] **Steg 7: Kjør testene og se dem passere**

```bash
npm test
```

Forventet: alle tester PASS, 0 fail.

- [ ] **Steg 8: Typer og lint**

```bash
npx tsc --noEmit
```
```bash
npm run lint
```

Forventet: ingen feil.

- [ ] **Steg 9: Commit**

```bash
git add package.json src/lib/pris.ts src/lib/pris.test.mjs src/lib/dato.ts src/lib/dato.test.mjs src/lib/neste.ts src/lib/neste.test.mjs "src/app/m/[qr]/actions.ts"
git commit -m "Tester med node:test, og felles regler for pris, returdato og omdirigering" -m "beregnPris blir regelen for både kundeforslag og internleie. norskSluttAvDag flyttes til dato.ts så uttaket kan bruke den. trygtNeste stenger for åpen omdirigering fra innloggingen." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Oppgave 3: Typer, «til videre» og `leietaker()`

`planlagt_slutt` og `kunde_id` blir nullbare. `tsc` peker da ut hvert sted
som leser dem – denne oppgaven retter alle, og legger til funksjonen som
bestemmer hvem en leie står på.

**Filer:**
- Endre: `src/lib/types.ts`
- Opprett: `src/lib/leietaker.ts`
- Test: `src/lib/leietaker.test.mjs`
- Endre (null-retting): `src/app/admin/(panel)/page.tsx`, `src/app/admin/(panel)/leier/page.tsx`,
  `src/app/admin/(panel)/leier/[id]/page.tsx`, `src/app/admin/(panel)/kalender/page.tsx`,
  `src/app/m/[qr]/page.tsx`, `src/app/leie/[ref]/page.tsx`, `src/lib/faktura-pdf.tsx`,
  `src/lib/epost/maler.ts`, `src/lib/epost/varsler.ts`, `src/app/api/ical/[fil]/route.ts`,
  `src/lib/verksted-data.ts`, `src/app/verksted/page.tsx`

**Grensesnitt:**
- Bruker: `returDato` fra oppgave 2.
- Produserer:
  - `Leie.kunde_id | ansatt_id | prosjekt_id | planlagt_slutt: string | null`
  - `type Prosjekt = { id; navn; nummer: string | null; aktiv: boolean; opprettet }`
  - `type AnsattInnbygd = { navn: string; telefon: string | null; epost: string }`
  - `type ProsjektInnbygd = { navn: string; nummer: string | null }`
  - `type LeieRad = Leie & { maskiner: Maskin | null; kunder: Kunde | null; ansatt: AnsattInnbygd | null; prosjekter: ProsjektInnbygd | null }`
  - i `@/lib/leietaker`: `LEIETAKER_FELT: string`, `prosjektNavn(p: ProsjektInnbygd): string`,
    `type LeietakerKilde`, `type Leietaker = { intern: boolean; navn: string; telefon: string | null; prosjekt: string | null }`,
    `leietaker(l: LeietakerKilde): Leietaker`, `leietakerTekst(l: LeietakerKilde): string`

- [ ] **Steg 1: Skriv testene for `leietaker`**

Opprett `src/lib/leietaker.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leietaker, leietakerTekst, prosjektNavn } from './leietaker.ts'

const ola = { navn: 'Ola Nordmann', telefon: null }
const kvamsøy = { navn: 'Kvamsøy bru', nummer: 'P-2317' }

test('kundeleie viser kunden', () => {
  assert.deepEqual(
    leietaker({ ansatt_id: null, kunder: { navn: 'Kari Kunde', telefon: '90000000' } }),
    { intern: false, navn: 'Kari Kunde', telefon: '90000000', prosjekt: null },
  )
})

test('internleie viser ansatt og prosjekt med nummer', () => {
  assert.deepEqual(leietaker({ ansatt_id: 'a1', ansatt: ola, prosjekter: kvamsøy }), {
    intern: true,
    navn: 'Ola Nordmann',
    telefon: null,
    prosjekt: 'Kvamsøy bru (P-2317)',
  })
})

test('prosjekt uten nummer er bare navnet', () => {
  assert.equal(prosjektNavn({ navn: 'Lager', nummer: null }), 'Lager')
})

test('manglende innbygde rader velter ingenting', () => {
  assert.deepEqual(leietaker({ ansatt_id: 'a1' }), {
    intern: true,
    navn: 'Ukjent ansatt',
    telefon: null,
    prosjekt: null,
  })
  assert.deepEqual(leietaker({}), { intern: false, navn: '–', telefon: null, prosjekt: null })
})

test('på én linje', () => {
  assert.equal(
    leietakerTekst({ ansatt_id: 'a1', ansatt: ola, prosjekter: { navn: 'Kvamsøy bru', nummer: null } }),
    'Ola Nordmann · Kvamsøy bru',
  )
  assert.equal(leietakerTekst({ kunder: { navn: 'Kari', telefon: '1' } }), 'Kari')
})
```

- [ ] **Steg 2: Kjør og se den feile**

```bash
npm test
```

Forventet: FAIL – `./leietaker.ts` finnes ikke.

- [ ] **Steg 3: Typene**

I `src/lib/types.ts`, finn i `export type Leie = {`:

```ts
  maskin_id: string
  kunde_id: string
  enhets_id: string | null
  status: LeieStatus
  planlagt_slutt: string
```

Erstatt med:

```ts
  maskin_id: string
  /** Null på internleier. */
  kunde_id: string | null
  /** Internleie: den ansatte som tok ut utstyret. Null på kundeleier. */
  ansatt_id: string | null
  /** Internleie: prosjektet leien føres på. Null på kundeleier. */
  prosjekt_id: string | null
  enhets_id: string | null
  status: LeieStatus
  /** Null bare på internleier uten dato – «til videre». */
  planlagt_slutt: string | null
```

Finn:

```ts
export type Bilde = {
```

Erstatt med:

```ts
export type Prosjekt = {
  id: string
  navn: string
  nummer: string | null
  /** false = avsluttet. */
  aktiv: boolean
  opprettet: string
}

/** Den ansatte slik leiespørringene bygger den inn – se LEIETAKER_FELT. */
export type AnsattInnbygd = { navn: string; telefon: string | null; epost: string }

/** Prosjektet slik leiespørringene bygger det inn. */
export type ProsjektInnbygd = { navn: string; nummer: string | null }

/** En leie med maskin og leietaker, slik adminsidene henter den. */
export type LeieRad = Leie & {
  maskiner: Maskin | null
  kunder: Kunde | null
  ansatt: AnsattInnbygd | null
  prosjekter: ProsjektInnbygd | null
}

export type Bilde = {
```

Finn:

```ts
/** En aktiv leie hvis avtalte leveringsdato er passert. */
export function erForfalt(leie: Pick<Leie, 'status' | 'planlagt_slutt'>): boolean {
  return leie.status === 'aktiv' && new Date(leie.planlagt_slutt).getTime() < Date.now()
}
```

Erstatt med:

```ts
/**
 * En aktiv leie hvis avtalte leveringsdato er passert. En internleie
 * uten dato står ute «til videre» og blir aldri forfalt.
 */
export function erForfalt(leie: Pick<Leie, 'status' | 'planlagt_slutt'>): boolean {
  return (
    leie.status === 'aktiv' &&
    leie.planlagt_slutt !== null &&
    new Date(leie.planlagt_slutt).getTime() < Date.now()
  )
}
```

- [ ] **Steg 4: `leietaker.ts`**

Opprett `src/lib/leietaker.ts`:

```ts
import type { ProsjektInnbygd } from '@/lib/types'

/*
 * Hvem en leie står på – kunden, eller den ansatte og prosjektet.
 *
 * Ett sted, så oversikten, leielista, kalenderen, verkstedet og
 * e-postene aldri viser det ulikt. Ingen formatering av telefon her:
 * fila testes med node:test, som ikke løser opp `@/`-stier, så den
 * importerer bare typer.
 */

/**
 * Innbygging av kunde, ansatt og prosjekt i leiespørringer.
 *
 * `leier` har to fremmednøkler til `admin_brukere` – `godkjent_av` og
 * `ansatt_id` – og da nekter PostgREST å gjette hvilken som menes.
 * Nøkkelen må navngis, ellers feiler hele spørringen.
 */
export const LEIETAKER_FELT =
  'kunder(*), ansatt:admin_brukere!leier_ansatt_id_fkey(navn, telefon, epost), prosjekter(navn, nummer)'

/** «Kvamsøy bru (P-2317)», eller bare navnet når nummeret mangler. */
export function prosjektNavn(p: ProsjektInnbygd): string {
  return p.nummer ? `${p.navn} (${p.nummer})` : p.navn
}

export type LeietakerKilde = {
  ansatt_id?: string | null
  kunder?: { navn: string; telefon: string } | null
  ansatt?: { navn: string; telefon: string | null } | null
  prosjekter?: ProsjektInnbygd | null
}

export type Leietaker = {
  intern: boolean
  navn: string
  /** Rått nummer. Formateres med visTelefon der det vises. */
  telefon: string | null
  /** Bare på internleier. */
  prosjekt: string | null
}

/** Avgjøres på `ansatt_id`, ikke på innbyggingen – den kan mangle. */
export function leietaker(l: LeietakerKilde): Leietaker {
  if (l.ansatt_id) {
    return {
      intern: true,
      navn: l.ansatt?.navn ?? 'Ukjent ansatt',
      telefon: l.ansatt?.telefon ?? null,
      prosjekt: l.prosjekter ? prosjektNavn(l.prosjekter) : null,
    }
  }
  return {
    intern: false,
    navn: l.kunder?.navn ?? '–',
    telefon: l.kunder?.telefon ?? null,
    prosjekt: null,
  }
}

/** «Ola Nordmann · Kvamsøy bru» eller «Kari Kunde» – der det er plass til én linje. */
export function leietakerTekst(l: LeietakerKilde): string {
  const t = leietaker(l)
  return t.prosjekt ? `${t.navn} · ${t.prosjekt}` : t.navn
}
```

- [ ] **Steg 5: Kjør testene**

```bash
npm test
```

Forventet: alle PASS.

- [ ] **Steg 6: Se hva `tsc` sier**

```bash
npx tsc --noEmit
```

Forventet: feil i fila-lista over, alle om `planlagt_slutt` som kan være
`null`. Rett dem slik:

**`src/app/admin/(panel)/page.tsx`** – finn:

```ts
import { dato, dagerTil, tidKort } from '@/lib/dato'
import { antallTekst, prisEnhet } from '@/lib/pris'
import type { Kunde, Leie, Maskin } from '@/lib/types'
```

Erstatt med:

```ts
import { dagerTil, returDato, tidKort } from '@/lib/dato'
import { antallTekst, prisEnhet } from '@/lib/pris'
import { erForfalt, type Kunde, type Leie, type Maskin } from '@/lib/types'
```

Finn:

```ts
  const supabase = await lagServerKlient()
  const nå = new Date().toISOString()
```

Erstatt med:

```ts
  const supabase = await lagServerKlient()
```

Finn:

```ts
  const forfalt = aktive.filter((l) => l.planlagt_slutt < nå)
```

Erstatt med:

```ts
  // erForfalt slipper bare gjennom leier med dato, så planlagt_slutt er
  // satt for alle i denne lista.
  const forfalt = aktive.filter(erForfalt)
```

Finn:

```tsx
                    {Math.abs(dagerTil(l.planlagt_slutt))} dager på overtid
```

Erstatt med:

```tsx
                    {Math.abs(dagerTil(l.planlagt_slutt!))} dager på overtid
```

Finn:

```tsx
              {aktive.slice(0, 8).map((l) => {
                const dager = dagerTil(l.planlagt_slutt)
```

Erstatt med:

```tsx
              {aktive.slice(0, 8).map((l) => {
                // Internleier uten dato står ute «til videre» – ingen nedtelling.
                const dager = l.planlagt_slutt ? dagerTil(l.planlagt_slutt) : null
```

Finn:

```tsx
                        <span className="hm-tall block text-sm font-semibold">
                          {dato(l.planlagt_slutt)}
                        </span>
                        <span
                          className={`block text-xs font-bold tracking-wider uppercase ${
                            dager < 0
                              ? 'text-hm-red'
                              : dager <= 1
                                ? 'text-hm-amber'
                                : 'text-[var(--blekk-svak)]'
                          }`}
                        >
                          {dager < 0
                            ? `${Math.abs(dager)} d på overtid`
                            : dager === 0
                              ? 'I dag'
                              : dager === 1
                                ? 'I morgen'
                                : `om ${dager} dager`}
                        </span>
```

Erstatt med:

```tsx
                        <span className="hm-tall block text-sm font-semibold">
                          {returDato(l.planlagt_slutt)}
                        </span>
                        {dager !== null && (
                          <span
                            className={`block text-xs font-bold tracking-wider uppercase ${
                              dager < 0
                                ? 'text-hm-red'
                                : dager <= 1
                                  ? 'text-hm-amber'
                                  : 'text-[var(--blekk-svak)]'
                            }`}
                          >
                            {dager < 0
                              ? `${Math.abs(dager)} d på overtid`
                              : dager === 0
                                ? 'I dag'
                                : dager === 1
                                  ? 'I morgen'
                                  : `om ${dager} dager`}
                          </span>
                        )}
```

**`src/app/admin/(panel)/leier/page.tsx`** – finn `import { dato } from '@/lib/dato'`,
erstatt med `import { returDato } from '@/lib/dato'`. Finn
`{dato(l.planlagt_slutt)}`, erstatt med `{returDato(l.planlagt_slutt)}`.

**`src/app/admin/(panel)/leier/[id]/page.tsx`** – finn
`import { dato, tid } from '@/lib/dato'`, erstatt med
`import { returDato, tid } from '@/lib/dato'`. Finn
`<Rad navn="Forventet levering" verdi={dato(leie.planlagt_slutt)} />`,
erstatt med `<Rad navn="Forventet levering" verdi={returDato(leie.planlagt_slutt)} />`.

**`src/app/leie/[ref]/page.tsx`** – finn `import { dato, tid } from '@/lib/dato'`,
erstatt med `import { returDato, tid } from '@/lib/dato'`. Finn
`verdi={dato(leie.planlagt_slutt)}`, erstatt med `verdi={returDato(leie.planlagt_slutt)}`.

**`src/lib/faktura-pdf.tsx`** – finn `import { dato, tid } from '@/lib/dato'`,
erstatt med `import { dato, returDato, tid } from '@/lib/dato'`. Finn
`Avtalt levering: {dato(leie.planlagt_slutt)}`, erstatt med
`Avtalt levering: {returDato(leie.planlagt_slutt)}`.

**`src/lib/epost/maler.ts`** – finn `import { dato, tid } from '@/lib/dato'`,
erstatt med `import { dato, returDato, tid } from '@/lib/dato'`. Erstatt så
**alle sju** forekomster av `dato(s.leie.planlagt_slutt)` med
`returDato(s.leie.planlagt_slutt)` (Edit med `replace_all`).

**`src/lib/epost/varsler.ts`** – finn:

```ts
  const dagerOver = (l: Leie) =>
    Math.max(
      1,
      Math.floor((Date.now() - new Date(l.planlagt_slutt).getTime()) / 86_400_000),
    )
```

Erstatt med:

```ts
  // lt() over slipper aldri gjennom en leie uten dato, så datoen er satt.
  const dagerOver = (l: Leie) =>
    Math.max(
      1,
      Math.floor((Date.now() - new Date(l.planlagt_slutt!).getTime()) / 86_400_000),
    )
```

**`src/app/api/ical/[fil]/route.ts`** – finn
`import type { Kunde, Leie, Maskin } from '@/lib/types'`, erstatt med
`import { erForfalt, type Kunde, type Leie, type Maskin } from '@/lib/types'`.
Finn:

```ts
    const slutt = l.slutt_tid ?? l.planlagt_slutt
    const forfalt =
      l.status === 'aktiv' && new Date(l.planlagt_slutt).getTime() < Date.now()
```

Erstatt med:

```ts
    // Internleier uten dato står ute til de leveres – vis dem fram til nå.
    const slutt = l.slutt_tid ?? l.planlagt_slutt ?? new Date().toISOString()
    const forfalt = erForfalt(l)
```

**`src/app/m/[qr]/page.tsx`** – finn `import { dato } from '@/lib/dato'`,
erstatt med `import { dato, returDato } from '@/lib/dato'`. Finn:

```tsx
              Startet {dato(aktiv.start_tid)}. Forventet levering{' '}
              {dato(aktiv.planlagt_slutt)}.
```

Erstatt med:

```tsx
              Startet {dato(aktiv.start_tid)}. Forventet levering{' '}
              {returDato(aktiv.planlagt_slutt)}.
```

Finn:

```tsx
          <Beskjed tittel="Maskinen er utleid">
            Den er ventet tilbake {dato(aktiv.planlagt_slutt)}. Ta kontakt med
            utleier hvis du trenger den før det.
          </Beskjed>
```

Erstatt med:

```tsx
          <Beskjed tittel="Maskinen er utleid">
            {aktiv.planlagt_slutt
              ? `Den er ventet tilbake ${dato(aktiv.planlagt_slutt)}. Ta kontakt med utleier hvis du trenger den før det.`
              : 'Ta kontakt med utleier hvis du trenger den.'}
          </Beskjed>
```

**`src/app/admin/(panel)/kalender/page.tsx`** – finn:

```ts
  // Aktive leier regnes som pågående til i dag, ikke bare til avtalt dato.
  const leier = ((data ?? []) as Rad[]).filter((l) => {
    const slutt =
      l.status === 'aktiv'
        ? new Date(Math.max(new Date(l.planlagt_slutt).getTime(), nå.getTime()))
        : new Date(l.slutt_tid ?? l.planlagt_slutt)
    return slutt >= førsteIMnd
  })
```

Erstatt med:

```ts
  const leier = ((data ?? []) as Rad[]).filter((l) => sluttFor(l, nå) >= førsteIMnd)
```

Finn:

```ts
      const fra = osloDag(l.start_tid)
      /*
       * En aktiv leie står ute til den faktisk leveres. Stoppet vi på
       * avtalt dato, ville nettopp de dagene maskinen er på overtid
       * mangle i kalenderen – som er de dagene man trenger å se.
       */
      const til =
        l.status === 'aktiv'
          ? osloDag(new Date(Math.max(new Date(l.planlagt_slutt).getTime(), nå.getTime())))
          : osloDag(l.slutt_tid ?? l.planlagt_slutt)
```

Erstatt med:

```ts
      const fra = osloDag(l.start_tid)
      const til = osloDag(sluttFor(l, nå))
```

Finn:

```ts
                      const påOvertid =
                        l.status === 'aktiv' && dag > osloDag(l.planlagt_slutt)
```

Erstatt med:

```ts
                      const påOvertid =
                        l.status === 'aktiv' &&
                        l.planlagt_slutt !== null &&
                        dag > osloDag(l.planlagt_slutt)
```

Finn `${datoKort(l.start_tid)}–${datoKort(l.slutt_tid ?? l.planlagt_slutt)}`,
erstatt med `${datoKort(l.start_tid)}–${tilTekst(l)}`. Finn:

```tsx
                      {l.slutt_tid ? datoKort(l.slutt_tid) : datoKort(l.planlagt_slutt)}
```

Erstatt med:

```tsx
                      {tilTekst(l)}
```

Finn:

```ts
export default async function KalenderSide(props: PageProps<'/admin/kalender'>) {
```

Erstatt med:

```ts
/**
 * Siste dag leien skal tegnes på.
 *
 * En aktiv leie står ute til den faktisk leveres. Stoppet vi på avtalt
 * dato, ville nettopp de dagene maskinen er på overtid mangle i
 * kalenderen – som er de dagene man trenger å se. Internleier uten dato
 * står ute «til videre», og tegnes også fram til i dag.
 */
function sluttFor(l: Leie, nå: Date): Date {
  if (l.status === 'aktiv') {
    return l.planlagt_slutt
      ? new Date(Math.max(new Date(l.planlagt_slutt).getTime(), nå.getTime()))
      : nå
  }
  return new Date(l.slutt_tid ?? l.planlagt_slutt ?? nå)
}

/** Sluttdatoen slik den skrives ut: levert, avtalt, eller «til videre». */
function tilTekst(l: Leie): string {
  if (l.slutt_tid) return datoKort(l.slutt_tid)
  return l.planlagt_slutt ? datoKort(l.planlagt_slutt) : 'til videre'
}

export default async function KalenderSide(props: PageProps<'/admin/kalender'>) {
```

**`src/lib/verksted-data.ts`** – `tsc` ser ikke denne (radene er utypede),
men typen lyver. Finn:

```ts
  /** Satt når maskinen står ute hos kunde nå. */
  utleie: { kunde: string | null; ventetTilbake: string } | null
```

Erstatt med:

```ts
  /** Satt når maskinen er ute nå. Uten dato står den ute «til videre». */
  utleie: { kunde: string | null; ventetTilbake: string | null } | null
```

Finn:

```ts
    { kunde: string | null; ventetTilbake: string }
```

Erstatt med:

```ts
    { kunde: string | null; ventetTilbake: string | null }
```

**`src/app/verksted/page.tsx`** – finn:

```tsx
                            Ute hos {m.utleie.kunde ?? 'kunde'} · ventet tilbake{' '}
                            <span className="font-semibold">
                              {dato(m.utleie.ventetTilbake)}
                            </span>
```

Erstatt med:

```tsx
                            Ute hos {m.utleie.kunde ?? 'kunde'}
                            {m.utleie.ventetTilbake ? (
                              <>
                                {' · ventet tilbake '}
                                <span className="font-semibold">
                                  {dato(m.utleie.ventetTilbake)}
                                </span>
                              </>
                            ) : (
                              ' · til videre'
                            )}
```

Dukker det opp `tsc`-feil i andre filer enn disse, er de av samme slag: vis
`returDato(...)` der datoen skrives ut, og sjekk `!== null` der den regnes med.

- [ ] **Steg 7: Typer, lint og tester**

```bash
npx tsc --noEmit
```
```bash
npm run lint
```
```bash
npm test
```

Forventet: ingen feil, alle tester PASS.

- [ ] **Steg 8: Commit**

```bash
git add src/lib/types.ts src/lib/leietaker.ts src/lib/leietaker.test.mjs "src/app/admin/(panel)/page.tsx" "src/app/admin/(panel)/leier/page.tsx" "src/app/admin/(panel)/leier/[id]/page.tsx" "src/app/admin/(panel)/kalender/page.tsx" "src/app/m/[qr]/page.tsx" "src/app/leie/[ref]/page.tsx" src/lib/faktura-pdf.tsx src/lib/epost/maler.ts src/lib/epost/varsler.ts "src/app/api/ical/[fil]/route.ts" src/lib/verksted-data.ts src/app/verksted/page.tsx
git commit -m "Returdato kan stå tom, og leietaker() sier hvem en leie står på" -m "Internleier uten dato står ute «til videre» og blir aldri forfalt. Alle steder som leser datoen, viser det i stedet for å gjette." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Oppgave 4: Tilgang – roller, innlogging, sesjon og rollesjekk

**Filer:**
- Endre: `src/lib/auth.ts`, `src/proxy.ts`
- Endre: `src/app/admin/logg-inn/page.tsx`, `skjema.tsx`, `actions.ts`
- Endre: `src/app/admin/bytt-passord/actions.ts`
- Endre: `src/app/api/faktura/[id]/route.ts`, `src/app/api/maskiner/csv/route.ts`, `src/app/api/varsler/forfalt/route.ts`
- Endre: `src/app/verksted/actions.ts`, `src/app/verksted/page.tsx`, `src/app/verksted/[id]/page.tsx`

**Grensesnitt:**
- Bruker: `trygtNeste` fra oppgave 2.
- Produserer i `@/lib/auth`: `type Rolle = 'admin' | 'service' | 'ansatt'`,
  `hjemFor(rolle: Rolle): string`, `hentFullAdmin(): Promise<AdminBruker | null>`,
  `krevAnsatt(): Promise<AdminBruker>`,
  `kanEndreVerksted(bruker: AdminBruker | null): bruker is AdminBruker`.
  `hentVerkstedBruker` og `krevVerkstedBruker` fjernes – de er ubrukt, og et
  navn som lover «verkstedbruker» mens det slipper inn alle, er en felle.

Ingen enhetstester her (alt avhenger av Next og Supabase). `trygtNeste` er
testet i oppgave 2. Verifiseres med `tsc`, `lint`, `build` og i oppgave 13.

- [ ] **Steg 1: `auth.ts`**

Erstatt hele `src/lib/auth.ts` med:

```ts
import { redirect } from 'next/navigation'
import { lagServerKlient } from '@/lib/supabase/server'
import 'server-only'

export type Rolle = 'admin' | 'service' | 'ansatt'

export type AdminBruker = {
  id: string
  navn: string
  epost: string
  rolle: Rolle
  maByttePassord: boolean
}

/** Siden brukeren sendes til når passordet må byttes. */
export const BYTT_PASSORD_STI = '/admin/bytt-passord'

/** Der hver rolle hører hjemme – etter innlogging og etter passordbytte. */
export function hjemFor(rolle: Rolle): string {
  if (rolle === 'service') return '/verksted'
  if (rolle === 'ansatt') return '/ansatt'
  return '/admin'
}

/** Henter innlogget bruker, eller null om ingen er logget inn. */
export async function hentAdmin(): Promise<AdminBruker | null> {
  const supabase = await lagServerKlient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  /*
   * `select('*')` framfor navngitte kolonner med vilje.
   *
   * Ber vi om en kolonne som ennå ikke finnes, feiler hele spørringen,
   * og da returnerer denne null – altså «ikke innlogget» for alle.
   * Én ukjørt migrasjon ville låst hele systemet ute. Med * får vi det
   * som finnes, og feltene under faller tilbake til trygge verdier.
   */
  const { data } = await supabase
    .from('admin_brukere')
    .select('*')
    .eq('id', user.id)
    .eq('aktiv', true)
    .single()

  if (!data) return null

  // Faller tilbake til admin når rolle-kolonnen mangler, slik at
  // eksisterende brukere ikke låses ute før migrasjon 0005 er kjørt.
  return {
    id: data.id,
    navn: data.navn,
    epost: data.epost,
    rolle: (data.rolle as Rolle) ?? 'admin',
    maByttePassord: data.ma_bytte_passord ?? false,
  }
}

/**
 * Admin med full tilgang, eller null.
 *
 * For route handlers, som skal svare 401 framfor å omdirigere. `hentAdmin`
 * alene slipper gjennom alle roller – også ansatte, som verken skal se
 * fakturagrunnlag eller kunne sende e-post til kundene.
 */
export async function hentFullAdmin(): Promise<AdminBruker | null> {
  const bruker = await hentAdmin()
  if (!bruker || bruker.rolle !== 'admin' || bruker.maByttePassord) return null
  return bruker
}

/**
 * Krever innlogget bruker, uten å tvinge passordbytte.
 *
 * Brukes av selve passordbyttesiden. Uten dette ville krevAdmin sendt
 * brukeren dit den allerede står, i en evig omdirigering.
 */
export async function krevInnlogget(): Promise<AdminBruker> {
  const bruker = await hentAdmin()
  if (!bruker) redirect('/admin/logg-inn')
  return bruker
}

/**
 * Krever innlogget bruker med full tilgang.
 *
 * Må kalles øverst i hver adminside OG i hver server action. En server
 * action er en POST-rute som kan treffes direkte utenfra, så verken
 * proxy.ts eller adminlayouten er tilstrekkelig sikring alene.
 *
 * Service og ansatte sendes hjem til sin egen side – de har ikke noe å
 * gjøre i kundelister og innstillinger.
 */
export async function krevAdmin(): Promise<AdminBruker> {
  const bruker = await hentAdmin()
  if (!bruker) redirect('/admin/logg-inn')
  // Midlertidig passord må byttes før man slipper videre.
  if (bruker.maByttePassord) redirect(BYTT_PASSORD_STI)
  if (bruker.rolle !== 'admin') redirect(hjemFor(bruker.rolle))
  return bruker
}

/**
 * Krever innlogget bruker som kan ta ut utstyr til prosjekter. Det kan
 * alle roller – alle som har en bruker her, er egne folk.
 *
 * Må kalles øverst på /ansatt OG i hver handling der, av samme grunn
 * som krevAdmin.
 */
export async function krevAnsatt(): Promise<AdminBruker> {
  const bruker = await hentAdmin()
  if (!bruker) redirect('/admin/logg-inn?neste=/ansatt')
  if (bruker.maByttePassord) redirect(BYTT_PASSORD_STI)
  return bruker
}

/**
 * Verkstedets egne vurderinger – deler bestilt, klar, mål, notater – er
 * for admin og service. En innlogget ansatt melder fra om sveising som
 * alle andre.
 */
export function kanEndreVerksted(bruker: AdminBruker | null): bruker is AdminBruker {
  return bruker !== null && (bruker.rolle === 'admin' || bruker.rolle === 'service')
}
```

- [ ] **Steg 2: Sesjonsoppfrisking utenfor `/admin`**

I `src/proxy.ts`, finn:

```ts
 * Matcher kun /admin. Kundeflyten har ingen sesjon å friske opp, og
 * skal slippe et unødvendig nettverkskall per forespørsel.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
```

Erstatt med:

```ts
 * Matcher alle sider der en innlogget bruker kan stå: adminpanelet,
 * verkstedet, uttakssiden og kundesidene, der ansatte får egne valg.
 * Server components kan ikke skrive informasjonskapsler, så uten dette
 * ble en utløpt sesjon på de sidene aldri fornyet, og brukeren ble
 * logget ut etter omtrent en time.
 */
export async function proxy(request: NextRequest) {
  // Uten Supabase-informasjonskapsel finnes det ingen sesjon å friske
  // opp. Det gjelder alle kunder på /m og /retur – de skal ikke betale
  // et nettverkskall for en innlogging de ikke har.
  if (!request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })
```

Finn:

```ts
export const config = {
  matcher: ['/admin/:path*'],
}
```

Erstatt med:

```ts
export const config = {
  matcher: ['/admin/:path*', '/ansatt/:path*', '/verksted/:path*', '/m/:path*', '/retur'],
}
```

- [ ] **Steg 3: `?neste=` på innloggingen**

I `src/app/admin/logg-inn/actions.ts`, finn:

```ts
import { lagServerKlient } from '@/lib/supabase/server'
```

Erstatt med:

```ts
import { lagServerKlient } from '@/lib/supabase/server'
import { trygtNeste } from '@/lib/neste'
```

Finn (i `loggInn`, siste linje før funksjonen slutter):

```ts
  redirect('/admin')
}
```

Erstatt med:

```ts
  // /admin sender hver rolle videre til sin egen side.
  redirect(trygtNeste(formData.get('neste')) ?? '/admin')
}
```

Erstatt hele `src/app/admin/logg-inn/page.tsx` med:

```tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { hentAdmin } from '@/lib/auth'
import { trygtNeste } from '@/lib/neste'
import { HMLogo } from '@/components/hm-logo'
import { LoggInnSkjema } from './skjema'

export const metadata: Metadata = { title: 'Logg inn – HM Utleie' }
export const dynamic = 'force-dynamic'

export default async function LoggInnSide(props: PageProps<'/admin/logg-inn'>) {
  const sp = await props.searchParams
  // Kom de fra en maskin eller fra returkoden, skal de tilbake dit.
  const neste = trygtNeste(sp.neste)

  if (await hentAdmin()) redirect(neste ?? '/admin')

  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-hm-black px-5 py-12">
      <div
        aria-hidden="true"
        className="absolute -top-40 -right-40 h-[150%] w-96 skew-x-[-18deg] bg-hm-red/90"
      />
      <div
        aria-hidden="true"
        className="absolute -top-40 right-[22rem] h-[150%] w-10 skew-x-[-18deg] bg-white/10"
      />

      <div className="relative w-full max-w-sm">
        <HMLogo størrelse="lg" />
        <h1 className="hm-display mt-6 text-3xl text-white">Logg inn</h1>
        <p className="mt-1 mb-8 text-sm text-white/60">
          Innlogging for ansatte hos Hauge Maskin
        </p>

        <div className="border-2 border-white bg-white p-6">
          <LoggInnSkjema neste={neste} />
        </div>
      </div>
    </main>
  )
}
```

I `src/app/admin/logg-inn/skjema.tsx`, finn:

```tsx
export function LoggInnSkjema() {
  const [tilstand, handling, venter] = useActionState(loggInn, start)

  return (
    <form action={handling} className="space-y-4">
```

Erstatt med:

```tsx
export function LoggInnSkjema({ neste }: { neste: string | null }) {
  const [tilstand, handling, venter] = useActionState(loggInn, start)

  return (
    <form action={handling} className="space-y-4">
      {neste && <input type="hidden" name="neste" value={neste} />}
```

- [ ] **Steg 4: Passordbyttet sender hver rolle hjem**

I `src/app/admin/bytt-passord/actions.ts`, finn
`import { krevInnlogget } from '@/lib/auth'`, erstatt med
`import { hjemFor, krevInnlogget } from '@/lib/auth'`. Finn:

```ts
  redirect(bruker.rolle === 'service' ? '/verksted' : '/admin')
```

Erstatt med:

```ts
  redirect(hjemFor(bruker.rolle))
```

- [ ] **Steg 5: API-rutene krever admin**

I hver av `src/app/api/faktura/[id]/route.ts`, `src/app/api/maskiner/csv/route.ts`
og `src/app/api/varsler/forfalt/route.ts`: erstatt
`import { hentAdmin } from '@/lib/auth'` med
`import { hentFullAdmin } from '@/lib/auth'`, og `await hentAdmin()` med
`await hentFullAdmin()`. Ingen andre endringer.

- [ ] **Steg 6: Verkstedet skiller på rolle**

I `src/app/verksted/actions.ts`, finn
`import { hentAdmin } from '@/lib/auth'`, erstatt med
`import { hentAdmin, kanEndreVerksted } from '@/lib/auth'`. Finn:

```ts
  const bruker = await hentAdmin()

  if (!bruker && !kanSettesAvAlle(gyldig.data as VerkstedStatus)) {
    return { feil: 'Du må være innlogget for å sette denne statusen.' }
  }
```

Erstatt med:

```ts
  const bruker = await hentAdmin()

  // Å melde fra kan alle. Å bestemme – deler bestilt, klar – er for
  // verkstedet. En innlogget ansatt melder fra som alle andre, men
  // logges med navn i stedet for enhets-ID.
  if (!kanEndreVerksted(bruker) && !kanSettesAvAlle(gyldig.data as VerkstedStatus)) {
    return {
      feil: bruker
        ? 'Bare verkstedet kan sette denne statusen.'
        : 'Du må være innlogget for å sette denne statusen.',
    }
  }
```

Erstatt så **alle fire** forekomster av (Edit med `replace_all`):

```ts
  const bruker = await hentAdmin()
  if (!bruker) return { feil: 'Krever innlogging.' }
```

med:

```ts
  const bruker = await hentAdmin()
  if (!kanEndreVerksted(bruker)) return { feil: 'Krever innlogging som verksted eller admin.' }
```

I `src/app/verksted/page.tsx`, finn `import { hentAdmin } from '@/lib/auth'`,
erstatt med `import { hentAdmin, kanEndreVerksted } from '@/lib/auth'`. Finn:

```tsx
        {!bruker && (
          <p className="mb-6 border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
            Du kan melde fra om at noe må sveises. For å sette «deler bestilt»
            eller «klar for drift» må du logge inn.
          </p>
        )}
```

Erstatt med:

```tsx
        {!kanEndreVerksted(bruker) && (
          <p className="mb-6 border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
            Du kan melde fra om at noe må sveises.{' '}
            {bruker
              ? '«Deler bestilt» og «klar for drift» settes av verkstedet.'
              : 'For å sette «deler bestilt» eller «klar for drift» må du logge inn.'}
          </p>
        )}
```

I `src/app/verksted/[id]/page.tsx`, finn `import { hentAdmin } from '@/lib/auth'`,
erstatt med `import { hentAdmin, kanEndreVerksted } from '@/lib/auth'`. Finn:

```ts
  const innlogget = Boolean(bruker)
```

Erstatt med:

```ts
  // «innlogget» betyr her innlogget med rett til å endre verkstedet. En
  // ansatt er innlogget, men melder fra som alle andre.
  const innlogget = kanEndreVerksted(bruker)
```

Finn:

```tsx
                Du kan melde fra om at den må sveises. De andre valgene krever
                innlogging.
```

Erstatt med:

```tsx
                Du kan melde fra om at den må sveises.{' '}
                {bruker
                  ? 'De andre valgene er for verkstedet.'
                  : 'De andre valgene krever innlogging.'}
```

- [ ] **Steg 7: Verifiser**

```bash
npx next typegen
```
```bash
npx tsc --noEmit
```
```bash
npm run lint
```
```bash
npm test
```
```bash
npm run build
```

Forventet: alt grønt. Bygget lister `ƒ Proxy (Middleware)` som før.

- [ ] **Steg 8: Commit**

```bash
git add src/lib/auth.ts src/proxy.ts src/app/admin/logg-inn/page.tsx src/app/admin/logg-inn/skjema.tsx src/app/admin/logg-inn/actions.ts src/app/admin/bytt-passord/actions.ts "src/app/api/faktura/[id]/route.ts" src/app/api/maskiner/csv/route.ts src/app/api/varsler/forfalt/route.ts src/app/verksted/actions.ts src/app/verksted/page.tsx "src/app/verksted/[id]/page.tsx"
git commit -m "Rollen ansatt, innlogging tilbake til siden du kom fra, og rollesjekk der det bare sto «innlogget»" -m "Fakturagrunnlag, maskin-CSV og manuell forfallsutsending krever admin. Verkstedets endringer krever admin eller service. Sesjonen friskes nå opp også på /verksted, /ansatt, /m og /retur – før ble den aldri fornyet der." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Oppgave 5: Brukere – rollen ansatt og mobilnummer

**Filer:**
- Endre: `src/app/admin/(panel)/brukere/actions.ts`, `ny-bruker.tsx`, `rediger-bruker.tsx`, `page.tsx`

**Grensesnitt:**
- `endreBruker(brukerId: string, formData: FormData): Promise<BrukerTilstand>` –
  returnerer nå feil i stedet for å svelge dem.
- `RedigerBruker` får prop `ute: number`.

- [ ] **Steg 1: Handlingene**

Erstatt hele `src/app/admin/(panel)/brukere/actions.ts` med:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { normaliserTelefon } from '@/lib/telefon'

export type BrukerTilstand = { feil?: string; ok?: string }

const ROLLER = ['admin', 'service', 'ansatt'] as const

/** Tomt er lov – mobilnummeret er valgfritt. Utfylt må det være gyldig. */
const telefon = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null
    const n = normaliserTelefon(v)
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'Mobilnummeret må være åtte siffer' })
      return z.NEVER
    }
    return n
  })

const skjema = z.object({
  navn: z.string().trim().min(2, 'Navn må fylles ut'),
  epost: z.email('Ugyldig e-postadresse'),
  passord: z.string().min(8, 'Passordet må være minst 8 tegn'),
  rolle: z.enum(ROLLER).default('admin'),
  telefon,
})

/**
 * Oppretter en ny bruker.
 *
 * Vi setter passordet direkte i stedet for å sende invitasjon på
 * e-post, fordi Supabase sin innebygde e-posttjeneste har lave
 * ratebegrensninger og ikke er egnet i drift uten egen SMTP.
 * Passordet formidles av den som oppretter brukeren.
 */
export async function opprettBruker(
  _forrige: BrukerTilstand,
  formData: FormData,
): Promise<BrukerTilstand> {
  await krevAdmin()

  const felter = skjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: felter.data.epost,
    password: felter.data.passord,
    email_confirm: true,
  })

  if (error || !data.user) {
    return {
      feil: error?.message.includes('already')
        ? 'Det finnes allerede en bruker med denne e-postadressen.'
        : `Kunne ikke opprette bruker: ${error?.message ?? 'ukjent feil'}`,
    }
  }

  const { error: radFeil } = await supabaseAdmin.from('admin_brukere').insert({
    id: data.user.id,
    navn: felter.data.navn,
    epost: felter.data.epost,
    rolle: felter.data.rolle,
    telefon: felter.data.telefon,
    // Passordet er midlertidig – brukeren må sette sitt eget først.
    ma_bytte_passord: true,
  })

  if (radFeil) {
    // Rydd opp, ellers står det igjen en auth-bruker uten tilgang som
    // ingen kan gjøre noe med.
    await supabaseAdmin.auth.admin.deleteUser(data.user.id)
    return { feil: `Kunne ikke gi tilgang: ${radFeil.message}` }
  }

  revalidatePath('/admin/brukere')
  return { ok: `${felter.data.navn} kan nå logge inn.` }
}

const endreSkjema = z.object({
  navn: z.string().trim().min(2, 'Navn må fylles ut'),
  rolle: z.enum(ROLLER),
  telefon,
})

/**
 * Endrer navn, rolle og mobil på en eksisterende bruker.
 *
 * Man kan ikke frata seg selv admintilgang. Er du siste admin og setter
 * deg til noe annet, er det ingen igjen som kan gi tilgangen tilbake –
 * da må databasen redigeres direkte for å komme inn igjen.
 */
export async function endreBruker(
  brukerId: string,
  formData: FormData,
): Promise<BrukerTilstand> {
  const meg = await krevAdmin()

  const felter = endreSkjema.safeParse({
    navn: formData.get('navn'),
    rolle: formData.get('rolle'),
    telefon: formData.get('telefon') ?? undefined,
  })
  if (!felter.success) return { feil: felter.error.issues[0].message }

  if (brukerId === meg.id && felter.data.rolle !== 'admin') {
    return { feil: 'Du kan ikke frata deg selv admintilgang.' }
  }

  const supabase = await lagServerKlient()
  const { error } = await supabase
    .from('admin_brukere')
    .update({
      navn: felter.data.navn,
      rolle: felter.data.rolle,
      telefon: felter.data.telefon,
    })
    .eq('id', brukerId)

  if (error) return { feil: `Kunne ikke lagre: ${error.message}` }

  revalidatePath('/admin/brukere')
  return { ok: 'Lagret.' }
}

/**
 * Setter nytt passord. Vi kan ikke lese det gamle, så dette er en
 * overstyring – admin må formidle det nye videre selv.
 */
export async function settPassord(
  brukerId: string,
  formData: FormData,
): Promise<BrukerTilstand> {
  await krevAdmin()

  const passord = String(formData.get('passord') ?? '')
  if (passord.length < 8) return { feil: 'Passordet må være minst 8 tegn.' }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(brukerId, {
    password: passord,
  })

  if (error) return { feil: `Kunne ikke endre passord: ${error.message}` }

  // Også dette er et midlertidig passord: admin kjenner det, så
  // brukeren må sette sitt eget ved neste innlogging.
  await supabaseAdmin
    .from('admin_brukere')
    .update({ ma_bytte_passord: true })
    .eq('id', brukerId)

  revalidatePath('/admin/brukere')
  return {
    ok: 'Midlertidig passord satt. Brukeren må velge sitt eget ved neste innlogging.',
  }
}

export async function settAktiv(brukerId: string, aktiv: boolean) {
  const admin = await krevAdmin()

  // Uten denne sjekken kunne siste admin deaktivert seg selv, og da er
  // det ingen igjen som kan slippe noen inn.
  if (brukerId === admin.id) return

  const supabase = await lagServerKlient()
  await supabase.from('admin_brukere').update({ aktiv }).eq('id', brukerId)
  revalidatePath('/admin/brukere')
}
```

- [ ] **Steg 2: Skjemaet for ny bruker**

I `src/app/admin/(panel)/brukere/ny-bruker.tsx`, finn:

```tsx
      <h2 className="hm-display mb-4 text-xl">Ny admin-bruker</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <label>
          <span className={ETIKETT}>Navn</span>
          <input name="navn" required className={FELT} />
        </label>
        <label>
          <span className={ETIKETT}>E-post</span>
          <input name="epost" type="email" required className={FELT} />
        </label>
        <label>
          <span className={ETIKETT}>Passord</span>
          <input name="passord" type="text" required minLength={8} className={FELT} />
        </label>

        <label className="sm:col-span-3">
          <span className={ETIKETT}>Tilgang</span>
          <select name="rolle" defaultValue="admin" className={FELT}>
            <option value="admin">Admin — full tilgang</option>
            <option value="service">Servicearbeider — kun verkstedet</option>
          </select>
          <span className="mt-1.5 block text-xs text-[var(--blekk-svak)]">
            Servicearbeidere ser verkstedlista og kan endre status på deler,
            men kommer ikke inn i kunder, leier eller innstillinger.
          </span>
        </label>
      </div>
```

Erstatt med:

```tsx
      <h2 className="hm-display mb-4 text-xl">Ny bruker</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={ETIKETT}>Navn</span>
          <input name="navn" required className={FELT} />
        </label>
        <label>
          <span className={ETIKETT}>E-post</span>
          <input name="epost" type="email" required className={FELT} />
        </label>
        <label>
          <span className={ETIKETT}>
            Mobil <span className="normal-case">(valgfritt)</span>
          </span>
          <input
            name="telefon"
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            placeholder="900 00 000"
            className={FELT}
          />
        </label>
        <label>
          <span className={ETIKETT}>Midlertidig passord</span>
          <input name="passord" type="text" required minLength={8} className={FELT} />
        </label>

        <label className="sm:col-span-2">
          <span className={ETIKETT}>Tilgang</span>
          <select name="rolle" defaultValue="admin" className={FELT}>
            <option value="admin">Admin — full tilgang</option>
            <option value="service">
              Servicearbeider — verkstedet, og kan ta ut utstyr til prosjekter
            </option>
            <option value="ansatt">Ansatt — kan ta ut utstyr til prosjekter</option>
          </select>
          <span className="mt-1.5 block text-xs text-[var(--blekk-svak)]">
            Servicearbeidere ser verkstedlista og kan endre status på deler.
            Ansatte kan bare ta ut og levere utstyr. Ingen av dem kommer inn i
            kunder, leier eller innstillinger.
          </span>
        </label>
      </div>
```

- [ ] **Steg 3: Redigering og visning**

Erstatt hele `src/app/admin/(panel)/brukere/rediger-bruker.tsx` med:

```tsx
'use client'

import { useState } from 'react'
import { FELT, KNAPP_LITEN, Merke } from '@/components/ui'
import { visTelefon } from '@/lib/telefon'
import { endreBruker, settAktiv, settPassord } from './actions'

export type Bruker = {
  id: string
  navn: string
  epost: string
  aktiv: boolean
  rolle: 'admin' | 'service' | 'ansatt'
  telefon: string | null
  ma_bytte_passord: boolean
}

const ROLLE: Record<Bruker['rolle'], { tekst: string; merke: 'svart' | 'nøytral' }> = {
  admin: { tekst: 'Admin', merke: 'svart' },
  service: { tekst: 'Service', merke: 'nøytral' },
  ansatt: { tekst: 'Ansatt', merke: 'nøytral' },
}

const LITEN_ETIKETT =
  'mb-1 block text-[10px] font-bold tracking-widest text-[var(--blekk-svak)] uppercase'

/**
 * Én brukerrad med redigering av navn, mobil, rolle og passord.
 *
 * Egen komponent framfor en egen side – lista er kort, og å hoppe fram
 * og tilbake for å endre et navn er mer friksjon enn det er verdt.
 */
export function RedigerBruker({
  bruker,
  erMeg,
  ute,
}: {
  bruker: Bruker
  erMeg: boolean
  /** Internleier brukeren har ute nå. */
  ute: number
}) {
  const [redigerer, settRedigerer] = useState(false)
  const [passordApen, settPassordApen] = useState(false)
  const [melding, settMelding] = useState('')
  const [feil, settFeil] = useState('')

  if (redigerer) {
    return (
      <form
        action={async (fd: FormData) => {
          const r = await endreBruker(bruker.id, fd)
          if (r.feil) {
            settFeil(r.feil)
            return
          }
          settFeil('')
          settRedigerer(false)
        }}
        className="flex flex-wrap items-end gap-3 p-4"
      >
        <div className="min-w-[10rem] flex-1">
          <label className={LITEN_ETIKETT}>Navn</label>
          <input name="navn" defaultValue={bruker.navn} required className={FELT} />
        </div>

        <div className="min-w-[9rem]">
          <label className={LITEN_ETIKETT}>Mobil</label>
          <input
            name="telefon"
            type="tel"
            inputMode="numeric"
            defaultValue={bruker.telefon ?? ''}
            placeholder="Valgfritt"
            className={FELT}
          />
        </div>

        <div className="min-w-[12rem]">
          <label className={LITEN_ETIKETT}>Tilgang</label>
          <select
            name="rolle"
            defaultValue={bruker.rolle}
            /* Siste utvei hvis du fratar deg selv admin er å redigere
               databasen direkte. Derfor låst på egen bruker. */
            disabled={erMeg}
            className={`${FELT} disabled:opacity-60`}
          >
            <option value="admin">Admin — full tilgang</option>
            <option value="service">Servicearbeider — verkstedet og uttak</option>
            <option value="ansatt">Ansatt — uttak til prosjekter</option>
          </select>
          {/* Et låst felt sendes ikke med skjemaet. Uten denne manglet
              rollen, og du fikk ikke endret ditt eget navn. */}
          {erMeg && <input type="hidden" name="rolle" value={bruker.rolle} />}
        </div>

        <button type="submit" className={KNAPP_LITEN}>
          Lagre
        </button>
        <button
          type="button"
          onClick={() => {
            settFeil('')
            settRedigerer(false)
          }}
          className="pb-2 text-sm text-[var(--blekk-svak)]"
        >
          Avbryt
        </button>

        {feil && (
          <p
            role="alert"
            className="w-full border-l-4 border-hm-red bg-hm-red/10 p-2 text-sm font-semibold text-hm-red-ink"
          >
            {feil}
          </p>
        )}

        {erMeg && (
          <p className="w-full text-xs text-[var(--blekk-svak)]">
            Du kan ikke frata deg selv admintilgang.
          </p>
        )}
      </form>
    )
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">
          {bruker.navn}
          {erMeg && (
            <span className="ml-2 text-xs font-normal text-[var(--blekk-svak)]">
              (deg)
            </span>
          )}
        </span>
        <span className="text-sm text-[var(--blekk-svak)]">{bruker.epost}</span>
        {bruker.telefon && (
          <span className="hm-tall text-sm text-[var(--blekk-svak)]">
            {visTelefon(bruker.telefon)}
          </span>
        )}

        <Merke type={ROLLE[bruker.rolle].merke}>{ROLLE[bruker.rolle].tekst}</Merke>
        {!bruker.aktiv && <Merke type="nøytral">Deaktivert</Merke>}
        {bruker.ma_bytte_passord && <Merke type="gul">Midlertidig passord</Merke>}
        {/* Synlig før noen deaktiveres – ellers står utstyret ute på en
            bruker som ikke lenger kan levere det. */}
        {ute > 0 && <Merke type="gul">{ute} ting ute</Merke>}

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => settRedigerer(true)}
            className={KNAPP_LITEN}
          >
            Endre
          </button>
          <button
            type="button"
            onClick={() => settPassordApen((v) => !v)}
            className={KNAPP_LITEN}
          >
            Nytt passord
          </button>
          {!erMeg && (
            <form action={settAktiv.bind(null, bruker.id, !bruker.aktiv)}>
              <button className={KNAPP_LITEN}>
                {bruker.aktiv ? 'Deaktiver' : 'Aktiver'}
              </button>
            </form>
          )}
        </div>
      </div>

      {passordApen && (
        <form
          action={async (fd: FormData) => {
            const r = await settPassord(bruker.id, fd)
            settMelding(r.feil ?? r.ok ?? '')
            if (r.ok) settPassordApen(false)
          }}
          className="mt-3 flex flex-wrap items-center gap-3 border-t-2 border-[var(--kant)] pt-3"
        >
          <input
            name="passord"
            type="text"
            required
            minLength={8}
            placeholder="Nytt passord, minst 8 tegn"
            className={`${FELT} min-w-[12rem] flex-1`}
          />
          <button type="submit" className={KNAPP_LITEN}>
            Sett passord
          </button>
          <span className="w-full text-xs text-[var(--blekk-svak)]">
            Vises i klartekst fordi du må gi det videre selv.
          </span>
        </form>
      )}

      {melding && (
        <p role="status" className="mt-2 text-sm font-semibold text-hm-green">
          {melding}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Steg 4: Sida teller hva hver bruker har ute**

I `src/app/admin/(panel)/brukere/page.tsx`, finn:

```tsx
  const { data } = await supabase.from('admin_brukere').select('*').order('navn')
  const brukere = (data ?? []) as Bruker[]

  return (
    <div className="space-y-7">
      <Seksjonstittel under="Admin ser alt. Servicearbeidere ser kun verkstedet.">
```

Erstatt med:

```tsx
  const [{ data }, { data: uteRader }] = await Promise.all([
    supabase.from('admin_brukere').select('*').order('navn'),
    supabase
      .from('leier')
      .select('ansatt_id')
      .eq('status', 'aktiv')
      .not('ansatt_id', 'is', null),
  ])
  const brukere = (data ?? []) as Bruker[]

  const ute = new Map<string, number>()
  for (const r of (uteRader ?? []) as { ansatt_id: string }[]) {
    ute.set(r.ansatt_id, (ute.get(r.ansatt_id) ?? 0) + 1)
  }

  return (
    <div className="space-y-7">
      <Seksjonstittel under="Admin ser alt. Service har verkstedet. Alle kan ta ut utstyr til prosjekter.">
```

Finn:

```tsx
          <RedigerBruker key={b.id} bruker={b} erMeg={b.id === meg.id} />
```

Erstatt med:

```tsx
          <RedigerBruker
            key={b.id}
            bruker={b}
            erMeg={b.id === meg.id}
            ute={ute.get(b.id) ?? 0}
          />
```

- [ ] **Steg 5: Verifiser**

```bash
npx tsc --noEmit
```
```bash
npm run lint
```

Forventet: ingen feil.

- [ ] **Steg 6: Commit**

```bash
git add "src/app/admin/(panel)/brukere/actions.ts" "src/app/admin/(panel)/brukere/ny-bruker.tsx" "src/app/admin/(panel)/brukere/rediger-bruker.tsx" "src/app/admin/(panel)/brukere/page.tsx"
git commit -m "Brukere: rollen ansatt, mobilnummer og hva hver har ute" -m "Å endre ditt eget navn virket ikke før – det låste rollefeltet ble ikke sendt med, og lagringen ble avvist uten beskjed. Nå sendes rollen med, og feil vises." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Oppgave 6: Datalaget for uttak og levering

**Filer:**
- Endre: `src/lib/leietaker.ts` (+ `opptattGrunn`), test i `src/lib/leietaker.test.mjs`
- Opprett: `src/lib/intern-leie.ts`
- Endre: `src/lib/epost/send.ts`, `src/lib/epost/maler.ts`, `src/lib/epost/varsler.ts`

**Grensesnitt:**
- Bruker: `beregnPris`, `prisEnhet` (pris), `kanLeiesUt` (verksted),
  `prosjektNavn`, `LEIETAKER_FELT`, `leietaker` (leietaker), `AdminBruker` (auth).
- Produserer:
  - `opptattGrunn(m: { status: string; påVerksted: boolean; leie: { ansatt_id: string | null; ansattNavn: string | null; prosjekt: string | null } | null; megId: string }): string | null` i `@/lib/leietaker`
  - i `@/lib/intern-leie`:
    - `type ProsjektValg = { id: string; navn: string }`
    - `type MinLeie = { id; maskin; internnummer: string | null; prosjekt; startTid; planlagtSlutt: string | null }`
    - `type UttakMaskin = { id; navn; internnummer: string | null; kategori: string; underkategori: string | null; opptatt: string | null }`
    - `type Uttaksside = { sattOpp: false } | { sattOpp: true; prosjekter: ProsjektValg[]; sistProsjektId: string | null; mine: MinLeie[]; maskiner: UttakMaskin[] }`
    - `hentProsjektvalg(brukerId: string): Promise<{ prosjekter: ProsjektValg[]; sistProsjektId: string | null } | null>`
    - `hentUttaksside(bruker: AdminBruker): Promise<Uttaksside>`
    - `taUtUtstyr(bruker: AdminBruker, maskinIder: string[], prosjektId: string, planlagtSlutt: Date | null): Promise<{ feil: string } | { tattUt: string[]; ikkeTatt: string[] }>`
    - `avsluttInternLeie(opts: { leieId: string; aktor: string; ansattId?: string; kommentar?: string | null }): Promise<{ feil: string } | { ok: true; maskin: string }>`
  - `varsleMerknadIntern(leieId: string): Promise<void>` i `@/lib/epost/varsler`

- [ ] **Steg 1: Test for `opptattGrunn`**

Legg til nederst i `src/lib/leietaker.test.mjs`, og utvid importen øverst til
`import { leietaker, leietakerTekst, opptattGrunn, prosjektNavn } from './leietaker.ts'`:

```js
const meg = 'meg'
const ledig = { status: 'ledig', påVerksted: false, leie: null, megId: meg }

test('ledig maskin kan tas ut', () => {
  assert.equal(opptattGrunn(ledig), null)
})

test('hos kunde står det bare «Utleid», aldri navnet', () => {
  assert.equal(
    opptattGrunn({ ...ledig, status: 'utleid', leie: { ansatt_id: null, ansattNavn: null, prosjekt: null } }),
    'Utleid',
  )
})

test('hos deg selv', () => {
  assert.equal(
    opptattGrunn({ ...ledig, status: 'utleid', leie: { ansatt_id: meg, ansattNavn: 'Deg', prosjekt: 'Kvamsøy bru' } }),
    'Hos deg · Kvamsøy bru',
  )
})

test('hos en kollega, så du vet hvem du skal spørre', () => {
  assert.equal(
    opptattGrunn({ ...ledig, status: 'utleid', leie: { ansatt_id: 'ola', ansattNavn: 'Ola Nordmann', prosjekt: 'Kvamsøy bru' } }),
    'Hos Ola Nordmann · Kvamsøy bru',
  )
})

test('verksted og service', () => {
  assert.equal(opptattGrunn({ ...ledig, påVerksted: true }), 'Til reparasjon')
  assert.equal(opptattGrunn({ ...ledig, status: 'service' }), 'Ute av drift')
})
```

- [ ] **Steg 2: Kjør og se den feile**

```bash
npm test
```

Forventet: FAIL – `opptattGrunn` er ikke eksportert.

- [ ] **Steg 3: `opptattGrunn`**

Legg til nederst i `src/lib/leietaker.ts`:

```ts
/**
 * Hvorfor en maskin ikke kan tas ut – eller null når den er ledig.
 *
 * Ansatte ser hvilken kollega som har utstyret, så de vet hvem de skal
 * spørre. Kundens navn vises aldri – der står det bare «Utleid».
 */
export function opptattGrunn(m: {
  status: string
  påVerksted: boolean
  leie: { ansatt_id: string | null; ansattNavn: string | null; prosjekt: string | null } | null
  megId: string
}): string | null {
  if (m.leie) {
    if (!m.leie.ansatt_id) return 'Utleid'
    const hvem =
      m.leie.ansatt_id === m.megId ? 'Hos deg' : `Hos ${m.leie.ansattNavn ?? 'en kollega'}`
    return m.leie.prosjekt ? `${hvem} · ${m.leie.prosjekt}` : hvem
  }
  if (m.status === 'service') return 'Ute av drift'
  if (m.påVerksted) return 'Til reparasjon'
  if (m.status !== 'ledig') return 'Utleid'
  return null
}
```

- [ ] **Steg 4: Kjør testene**

```bash
npm test
```

Forventet: alle PASS.

- [ ] **Steg 5: E-postmal og varsel for merknad ved levering**

I `src/lib/epost/send.ts`, finn:

```ts
  | 'forfalt_admin'
  | 'forfalt_kunde'
```

Erstatt med:

```ts
  | 'forfalt_admin'
  | 'forfalt_kunde'
  | 'merknad_intern'
```

I `src/lib/epost/maler.ts`, finn:

```ts
/* ── Til kunden: innlevering mottatt ────────────────────── */
```

Erstatt med:

```ts
/* ── Til admin: en ansatt meldte fra ved levering ───────── */

export function merknadIntern(s: {
  maskin: string
  ansatt: string
  prosjekt: string
  merknad: string
  leieId: string
  firmanavn: string
  nettadresse: string
}): Mal {
  const url = `${s.nettadresse}/admin/leier/${s.leieId}`

  return {
    emne: `Merknad ved levering: ${s.maskin}`,
    html: ramme(
      'Merknad ved levering',
      h1('Merknad ved levering') +
        fakta([
          ['Maskin', s.maskin],
          ['Levert av', s.ansatt],
          ['Prosjekt', s.prosjekt],
        ]) +
        p(`<em>«${esc(s.merknad)}»</em>`) +
        p('Maskinen er allerede ledig igjen – internleier godkjennes ikke.') +
        knapp(url, 'Se leien'),
      s.firmanavn,
    ),
    tekst: `Merknad ved levering.

Maskin: ${s.maskin}
Levert av: ${s.ansatt}
Prosjekt: ${s.prosjekt}

«${s.merknad}»

Maskinen er allerede ledig igjen – internleier godkjennes ikke.

${url}`,
  }
}

/* ── Til kunden: innlevering mottatt ────────────────────── */
```

I `src/lib/epost/varsler.ts`, finn:

```ts
import * as maler from './maler'
```

Erstatt med:

```ts
import * as maler from './maler'
import { LEIETAKER_FELT, leietaker, type LeietakerKilde } from '@/lib/leietaker'
```

Finn:

```ts
/**
 * Går gjennom alle forfalte leier og sender ut varsler.
```

Erstatt med:

```ts
/**
 * En ansatt skrev noe i «Noe som bør fikses?» ved levering.
 *
 * Internleier går rett tilbake i drift uten godkjenning, så uten denne
 * ville ingen sett merknaden. Styres av samme bryter som returvarsler.
 */
export async function varsleMerknadIntern(leieId: string) {
  try {
    const innst = await hentVarselInnstillinger()
    if (!innst?.varsle_retur) return

    const { data } = await supabaseAdmin
      .from('leier')
      .select(`id, ansatt_id, kommentar_retur, maskiner(navn), ${LEIETAKER_FELT}`)
      .eq('id', leieId)
      .maybeSingle()

    const leie = data as unknown as
      | (LeietakerKilde & { kommentar_retur: string | null; maskiner: { navn: string } | null })
      | null
    if (!leie?.kommentar_retur) return

    const t = leietaker(leie)
    const m = maler.merknadIntern({
      maskin: leie.maskiner?.navn ?? 'Ukjent maskin',
      ansatt: t.navn,
      prosjekt: t.prosjekt ?? '–',
      merknad: leie.kommentar_retur,
      leieId,
      firmanavn: innst.firmanavn ?? '',
      nettadresse: env.NEXT_PUBLIC_SITE_URL,
    })

    await sendEpost({
      type: 'merknad_intern',
      til: adresser(innst.varsel_epost),
      kopi: adresser(innst.varsel_kopi),
      emne: m.emne,
      html: m.html,
      tekst: m.tekst,
      leieId,
      avsenderNavn: innst.avsender_navn,
    })
  } catch {
    // Varsling skal aldri velte leveringen.
  }
}

/**
 * Går gjennom alle forfalte leier og sender ut varsler.
```

- [ ] **Steg 6: `intern-leie.ts`**

Opprett `src/lib/intern-leie.ts`:

```ts
import { after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { varsleMerknadIntern } from '@/lib/epost/varsler'
import { beregnPris, prisEnhet } from '@/lib/pris'
import { kanLeiesUt } from '@/lib/verksted'
import { opptattGrunn, prosjektNavn } from '@/lib/leietaker'
import type { AdminBruker } from '@/lib/auth'
import type { ProsjektInnbygd } from '@/lib/types'
import 'server-only'

/*
 * Uttak og levering for egne folk.
 *
 * Går gjennom service role, som kundeflyten og verkstedet: en ansatt har
 * ingen leserettigheter i databasen (se er_admin i 0011). Derfor sjekker
 * hver funksjon her selv at det den gjør, gjelder den innloggede.
 * Kallstedet har allerede krevd innlogging med krevAnsatt.
 */

/** PostgREST- og Postgres-kodene for «tabellen finnes ikke». */
const FINNES_IKKE = ['PGRST205', '42P01']

export type ProsjektValg = { id: string; navn: string }

export type MinLeie = {
  id: string
  maskin: string
  internnummer: string | null
  prosjekt: string
  startTid: string
  planlagtSlutt: string | null
}

export type UttakMaskin = {
  id: string
  navn: string
  internnummer: string | null
  kategori: string
  underkategori: string | null
  /** null når den kan tas ut. Ellers grunnen, klar til å vises. */
  opptatt: string | null
}

export type Uttaksside =
  | { sattOpp: false }
  | {
      sattOpp: true
      prosjekter: ProsjektValg[]
      sistProsjektId: string | null
      mine: MinLeie[]
      maskiner: UttakMaskin[]
    }

type AktivRad = {
  id: string
  maskin_id: string
  ansatt_id: string | null
  start_tid: string
  planlagt_slutt: string | null
  maskiner: { navn: string; internnummer: string | null } | null
  ansatt: { navn: string } | null
  prosjekter: ProsjektInnbygd | null
}

type MaskinRad = {
  id: string
  navn: string
  internnummer: string | null
  kategori: string | null
  underkategori: string | null
  status: string
  verksted_status: string | null
}

/**
 * Aktive prosjekter å velge mellom, og prosjektet brukeren tok ut til
 * sist – forhåndsvalgt, siden det som regel er det samme i dag.
 *
 * null betyr at prosjekttabellen ikke finnes ennå (0011 er ikke kjørt).
 * Andre feil kastes, så de ikke forkles som «ikke satt opp».
 */
export async function hentProsjektvalg(brukerId: string): Promise<{
  prosjekter: ProsjektValg[]
  sistProsjektId: string | null
} | null> {
  const [{ data: prosjekter, error }, { data: siste }] = await Promise.all([
    supabaseAdmin.from('prosjekter').select('id, navn, nummer').eq('aktiv', true).order('navn'),
    supabaseAdmin
      .from('leier')
      .select('prosjekt_id')
      .eq('ansatt_id', brukerId)
      .order('start_tid', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (error) {
    if (FINNES_IKKE.includes(error.code)) return null
    throw new Error(`Kunne ikke hente prosjekter: ${error.message}`)
  }

  const valg = ((prosjekter ?? []) as (ProsjektInnbygd & { id: string })[]).map((p) => ({
    id: p.id,
    navn: prosjektNavn(p),
  }))

  // Et avsluttet prosjekt står ikke i lista, og kan ikke forhåndsvelges.
  const sistId = (siste as { prosjekt_id: string | null } | null)?.prosjekt_id ?? null
  const sistProsjektId = sistId && valg.some((p) => p.id === sistId) ? sistId : null

  return { prosjekter: valg, sistProsjektId }
}

/**
 * Alt /ansatt trenger, hentet i én runde. Hver tur til databasen koster
 * mer enn spørringen selv – se hentVerksted.
 */
export async function hentUttaksside(bruker: AdminBruker): Promise<Uttaksside> {
  const [valg, { data: maskinRader }, { data: aktiveRader }] = await Promise.all([
    hentProsjektvalg(bruker.id),
    supabaseAdmin
      .from('maskiner')
      .select('id, navn, internnummer, kategori, underkategori, status, verksted_status')
      .eq('aktiv', true)
      .neq('status', 'utrangert')
      .order('kategori', { nullsFirst: false })
      .order('underkategori', { nullsFirst: false })
      .order('internnummer')
      .order('navn'),
    supabaseAdmin
      .from('leier')
      .select(
        'id, maskin_id, ansatt_id, start_tid, planlagt_slutt, maskiner(navn, internnummer), ansatt:admin_brukere!leier_ansatt_id_fkey(navn), prosjekter(navn, nummer)',
      )
      .in('status', ['aktiv', 'venter_godkjenning'])
      .order('start_tid'),
  ])

  if (!valg) return { sattOpp: false }

  const aktive = (aktiveRader ?? []) as unknown as AktivRad[]
  const perMaskin = new Map(aktive.map((l) => [l.maskin_id, l]))

  const mine: MinLeie[] = aktive
    .filter((l) => l.ansatt_id === bruker.id)
    .map((l) => ({
      id: l.id,
      maskin: l.maskiner?.navn ?? 'Ukjent maskin',
      internnummer: l.maskiner?.internnummer ?? null,
      prosjekt: l.prosjekter ? prosjektNavn(l.prosjekter) : '–',
      startTid: l.start_tid,
      planlagtSlutt: l.planlagt_slutt,
    }))

  const maskiner: UttakMaskin[] = ((maskinRader ?? []) as MaskinRad[]).map((m) => {
    const l = perMaskin.get(m.id)
    return {
      id: m.id,
      navn: m.navn,
      internnummer: m.internnummer,
      kategori: m.kategori?.trim() || 'Uten kategori',
      underkategori: m.underkategori,
      opptatt: opptattGrunn({
        status: m.status,
        påVerksted: !kanLeiesUt(m.verksted_status),
        leie: l
          ? {
              ansatt_id: l.ansatt_id,
              ansattNavn: l.ansatt?.navn ?? null,
              prosjekt: l.prosjekter ? prosjektNavn(l.prosjekter) : null,
            }
          : null,
        megId: bruker.id,
      }),
    }
  })

  return { sattOpp: true, ...valg, mine, maskiner }
}

/**
 * Tar ut én eller flere maskiner til et prosjekt.
 *
 * Maskin for maskin, ikke alt eller ingenting: rakk en kollega å ta én
 * av dem, skal ikke de andre falle bort. Den unike indeksen på aktive
 * leier er det som faktisk hindrer dobbeltuttak – sjekkene før er der
 * for å gi en grunn folk forstår.
 */
export async function taUtUtstyr(
  bruker: AdminBruker,
  maskinIder: string[],
  prosjektId: string,
  planlagtSlutt: Date | null,
): Promise<{ feil: string } | { tattUt: string[]; ikkeTatt: string[] }> {
  const { data: prosjektRad } = await supabaseAdmin
    .from('prosjekter')
    .select('id, navn, nummer, aktiv')
    .eq('id', prosjektId)
    .maybeSingle()

  const prosjekt = prosjektRad as (ProsjektInnbygd & { id: string; aktiv: boolean }) | null
  if (!prosjekt) return { feil: 'Fant ikke prosjektet.' }
  if (!prosjekt.aktiv) return { feil: 'Prosjektet er avsluttet. Velg et annet.' }

  const { data: rader } = await supabaseAdmin
    .from('maskiner')
    .select('id, navn, aktiv, status, verksted_status')
    .in('id', maskinIder)

  type Rad = { id: string; navn: string; aktiv: boolean; status: string; verksted_status: string | null }
  const maskiner = new Map(((rader ?? []) as Rad[]).map((m) => [m.id, m]))

  const tattUt: string[] = []
  const ikkeTatt: string[] = []

  for (const id of maskinIder) {
    const m = maskiner.get(id)
    if (!m || !m.aktiv) {
      ikkeTatt.push(`${m?.navn ?? 'En maskin'} finnes ikke lenger`)
      continue
    }
    if (!kanLeiesUt(m.verksted_status)) {
      ikkeTatt.push(`${m.navn} står til reparasjon`)
      continue
    }
    if (m.status !== 'ledig') {
      ikkeTatt.push(`${m.navn} er ikke ledig`)
      continue
    }

    const { data: leie, error } = await supabaseAdmin
      .from('leier')
      .insert({
        maskin_id: m.id,
        ansatt_id: bruker.id,
        prosjekt_id: prosjekt.id,
        planlagt_slutt: planlagtSlutt?.toISOString() ?? null,
      })
      .select('id')
      .single()

    if (error || !leie) {
      ikkeTatt.push(
        error?.code === '23505'
          ? `${m.navn} rakk noen andre å ta`
          : `${m.navn} kunne ikke registreres`,
      )
      continue
    }

    await supabaseAdmin.from('maskiner').update({ status: 'utleid' }).eq('id', m.id)
    await supabaseAdmin.from('hendelser').insert({
      leie_id: leie.id,
      type: 'startet',
      beskrivelse: `${bruker.navn} tok ut ${m.navn} til ${prosjektNavn(prosjekt)}`,
      aktor: `ansatt:${bruker.epost}`,
    })
    tattUt.push(m.navn)
  }

  return { tattUt, ikkeTatt }
}

/**
 * Avslutter en internleie: klokka stopper nå, prisen regnes ut og føres
 * på prosjektet, og maskinen er ledig med én gang.
 *
 * Brukes både når den ansatte leverer selv og når admin registrerer
 * levering på vegne av noen. Med `ansattId` må leien være deres – ellers
 * kunne hvem som helst levere en kollegas utstyr med en direkte POST.
 */
export async function avsluttInternLeie(opts: {
  leieId: string
  aktor: string
  ansattId?: string
  kommentar?: string | null
}): Promise<{ feil: string } | { ok: true; maskin: string }> {
  let spørring = supabaseAdmin
    .from('leier')
    .select('id, status, start_tid, maskin_id, ansatt_id, maskiner(navn, dogn_pris, pris_enhet)')
    .eq('id', opts.leieId)
    .not('ansatt_id', 'is', null)
  if (opts.ansattId) spørring = spørring.eq('ansatt_id', opts.ansattId)

  const { data } = await spørring.maybeSingle()
  const leie = data as unknown as {
    id: string
    status: string
    start_tid: string
    maskin_id: string
    maskiner: { navn: string; dogn_pris: number | null; pris_enhet: string | null } | null
  } | null

  if (!leie) return { feil: 'Fant ikke leien.' }
  if (leie.status !== 'aktiv') return { feil: 'Denne er allerede levert.' }

  // Servertid, som i kundereturen. Se docs/TEKNISK-PLAN.md, designvalg 1.
  const slutt = new Date().toISOString()
  const { antall, belop } = beregnPris(
    leie.start_tid,
    slutt,
    prisEnhet(leie.maskiner?.pris_enhet),
    leie.maskiner?.dogn_pris ?? null,
  )

  // `.eq('status','aktiv')` + `.select()` gjør leveringen atomisk: sendes
  // skjemaet to ganger, treffer den andre ingen rad.
  const { data: oppdatert, error } = await supabaseAdmin
    .from('leier')
    .update({
      status: 'avsluttet',
      slutt_tid: slutt,
      antall_dogn: antall,
      belop,
      kommentar_retur: opts.kommentar || null,
    })
    .eq('id', leie.id)
    .eq('status', 'aktiv')
    .select('id')

  if (error) return { feil: 'Kunne ikke registrere leveringen. Prøv igjen.' }
  if (!oppdatert?.length) return { feil: 'Denne er allerede levert.' }

  // Satt til service i mellomtiden? Da skal den ikke bli ledig av dette.
  await supabaseAdmin
    .from('maskiner')
    .update({ status: 'ledig' })
    .eq('id', leie.maskin_id)
    .eq('status', 'utleid')

  const maskin = leie.maskiner?.navn ?? 'Maskinen'
  await supabaseAdmin.from('hendelser').insert({
    leie_id: leie.id,
    type: 'levert',
    beskrivelse: opts.kommentar ? `${maskin} levert – «${opts.kommentar}»` : `${maskin} levert`,
    aktor: opts.aktor,
  })

  if (opts.kommentar) after(() => varsleMerknadIntern(leie.id))

  return { ok: true, maskin }
}
```

- [ ] **Steg 7: Sjekk spørringene mot databasen**

Krever at 0011 er kjørt (oppgave 1, steg 6). Skriptet leser bare. Kjør fra
repo-rota:

```bash
node --env-file=.env.local --input-type=module <<'EOF'
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const FELT = 'kunder(*), ansatt:admin_brukere!leier_ansatt_id_fkey(navn, telefon, epost), prosjekter(navn, nummer)'
const sjekker = {
  'uttak: aktive leier': db.from('leier').select('id, maskin_id, ansatt_id, start_tid, planlagt_slutt, maskiner(navn, internnummer), ansatt:admin_brukere!leier_ansatt_id_fkey(navn), prosjekter(navn, nummer)').in('status', ['aktiv', 'venter_godkjenning']).limit(1),
  'uttak: prosjekter': db.from('prosjekter').select('id, navn, nummer, aktiv').limit(1),
  'uttak: sist brukt': db.from('leier').select('prosjekt_id').eq('ansatt_id', '00000000-0000-0000-0000-000000000000').limit(1),
  'levering': db.from('leier').select('id, status, start_tid, maskin_id, ansatt_id, maskiner(navn, dogn_pris, pris_enhet)').not('ansatt_id', 'is', null).limit(1),
  'merknad': db.from('leier').select(`id, ansatt_id, kommentar_retur, maskiner(navn), ${FELT}`).limit(1),
}
for (const [navn, q] of Object.entries(sjekker)) {
  const { error } = await q
  console.log(error ? `✗ ${navn}: ${error.message}` : `✓ ${navn}`)
}
EOF
```

Forventet: fem ✓. En ✗ med «Could not find a relationship» betyr feil i
fremmednøkkel-hintet – rett det før du går videre.

- [ ] **Steg 8: Verifiser**

```bash
npx tsc --noEmit
```
```bash
npm run lint
```
```bash
npm test
```

Forventet: ingen feil, alle PASS.

- [ ] **Steg 9: Commit**

```bash
git add src/lib/leietaker.ts src/lib/leietaker.test.mjs src/lib/intern-leie.ts src/lib/epost/send.ts src/lib/epost/maler.ts src/lib/epost/varsler.ts
git commit -m "Datalaget for uttak og levering til prosjekter" -m "Uttak går maskin for maskin, så én som ble tatt av en kollega ikke velter resten. Levering regner ut internprisen og gjør maskinen ledig med én gang. Skriver den ansatte noe om skade, får admin e-post – ellers ville ingen sett det." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Oppgave 7: Siden `/ansatt` og felles meny

**Filer:**
- Flytt og endre: `src/app/verksted/bruker-meny.tsx` → `src/components/bruker-meny.tsx`
- Endre: `src/app/verksted/page.tsx`, `src/app/verksted/[id]/page.tsx`, `src/app/admin/(panel)/meny.tsx`
- Opprett: `src/app/ansatt/page.tsx`, `actions.ts`, `uttak-skjema.tsx`, `lever-knapp.tsx`, `loading.tsx`

**Grensesnitt:**
- Bruker: `krevAnsatt` (auth), `hentUttaksside`, `taUtUtstyr`, `avsluttInternLeie` og typene fra oppgave 6,
  `norskSluttAvDag`, `osloDag`, `dato` (dato), `MAKS_KOMMENTAR` (validering).
- Produserer:
  - `BrukerMeny({ bruker: AdminBruker | null; her: 'verksted' | 'ansatt' })` i `@/components/bruker-meny`
  - `taUt(forrige: UttakTilstand, formData: FormData): Promise<UttakTilstand>` og
    `lever(leieId: string, forrige: LeverTilstand, formData: FormData): Promise<LeverTilstand>`
    i `@/app/ansatt/actions`, begge tilstander `{ feil?: string; ok?: string }`
  - `UttakListe({ maskiner, prosjekter, sistProsjektId, iDag })` og
    `UttakEnkel({ maskinId, prosjekter, sistProsjektId, iDag })` i `@/app/ansatt/uttak-skjema`
  - `LeverKnapp({ leieId: string })` i `@/app/ansatt/lever-knapp`

- [ ] **Steg 1: Flytt menyen**

```bash
git mv src/app/verksted/bruker-meny.tsx src/components/bruker-meny.tsx
```

Erstatt hele `src/components/bruker-meny.tsx` med:

```tsx
import Link from 'next/link'
import type { AdminBruker, Rolle } from '@/lib/auth'
import { loggUt } from '@/app/admin/logg-inn/actions'

const ROLLE_TEKST: Record<Rolle, string> = {
  admin: 'Admin',
  service: 'Servicearbeider',
  ansatt: 'Ansatt',
}

/**
 * Brukermeny øverst på verkstedet og på uttakssiden.
 *
 * Begge ligger utenfor adminlayouten, så uten denne hadde en
 * servicearbeider verken kommet mellom verkstedet og uttak, til
 * passordbytte eller kunnet logge ut – bare stått fast på én side.
 *
 * Bruker <details> framfor egen klientkomponent: det gir en meny som
 * åpnes og lukkes uten JavaScript, og lukkes med Escape av seg selv.
 */
export function BrukerMeny({
  bruker,
  her,
}: {
  bruker: AdminBruker | null
  /** Siden menyen står på – lenken dit vises ikke. */
  her: 'verksted' | 'ansatt'
}) {
  if (!bruker) {
    return (
      <Link
        href={`/admin/logg-inn?neste=/${her}`}
        className="border-2 border-white/25 px-3 py-1.5 text-xs font-bold tracking-wider text-white/80 uppercase transition-colors hover:border-white hover:text-white"
      >
        Logg inn
      </Link>
    )
  }

  const lenke =
    'block px-4 py-3 text-sm font-semibold text-[var(--blekk)] transition-colors hover:bg-[var(--flate-2)]'

  const lenker = [
    { href: '/admin', tekst: 'Adminpanel', vis: bruker.rolle === 'admin' },
    {
      href: '/verksted',
      tekst: 'Verksted',
      vis: bruker.rolle !== 'ansatt' && her !== 'verksted',
    },
    { href: '/ansatt', tekst: 'Ta ut utstyr', vis: her !== 'ansatt' },
    { href: '/admin/bytt-passord', tekst: 'Bytt passord', vis: true },
  ]

  return (
    <details className="relative">
      <summary className="inline-flex min-h-[2.5rem] cursor-pointer list-none items-center gap-2 border-2 border-white/25 px-3 text-xs font-bold tracking-wider text-white/80 uppercase transition-colors hover:border-white hover:text-white [&::-webkit-details-marker]:hidden">
        {bruker.navn}
        <span aria-hidden="true">▾</span>
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-52 border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] shadow-[4px_4px_0_0_var(--kant-sterk)]">
        <p className="border-b-2 border-[var(--kant)] px-4 py-2 text-[10px] font-bold tracking-widest text-[var(--blekk-svak)] uppercase">
          {ROLLE_TEKST[bruker.rolle]}
        </p>

        {lenker
          .filter((l) => l.vis)
          .map((l) => (
            <Link key={l.href} href={l.href} className={lenke}>
              {l.tekst}
            </Link>
          ))}

        <form action={loggUt} className="border-t-2 border-[var(--kant)]">
          <button type="submit" className={`${lenke} w-full text-left text-hm-red-ink`}>
            Logg ut
          </button>
        </form>
      </div>
    </details>
  )
}
```

I `src/app/verksted/page.tsx`: erstatt `import { BrukerMeny } from './bruker-meny'`
med `import { BrukerMeny } from '@/components/bruker-meny'`, og
`<BrukerMeny bruker={bruker} />` med `<BrukerMeny bruker={bruker} her="verksted" />`.

I `src/app/verksted/[id]/page.tsx`: erstatt `import { BrukerMeny } from '../bruker-meny'`
med `import { BrukerMeny } from '@/components/bruker-meny'`, og
`<BrukerMeny bruker={bruker} />` med `<BrukerMeny bruker={bruker} her="verksted" />`.

I `src/app/admin/(panel)/meny.tsx`, finn:

```ts
  { href: '/verksted', tekst: 'Verksted' },
]
```

Erstatt med:

```ts
  { href: '/verksted', tekst: 'Verksted' },
  { href: '/ansatt', tekst: 'Ta ut utstyr' },
]
```

- [ ] **Steg 2: Handlingene**

Opprett `src/app/ansatt/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { krevAnsatt } from '@/lib/auth'
import { norskSluttAvDag } from '@/lib/dato'
import { MAKS_KOMMENTAR } from '@/lib/validering'
import { avsluttInternLeie, taUtUtstyr } from '@/lib/intern-leie'

export type UttakTilstand = { feil?: string; ok?: string }
export type LeverTilstand = { feil?: string; ok?: string }

const uttakSkjema = z.object({
  maskinIder: z.array(z.uuid()).min(1, 'Velg minst én ting').max(50, 'Maks 50 om gangen'),
  prosjekt_id: z.uuid('Velg prosjekt'),
  planlagt_slutt: z.string().optional(),
})

/**
 * Tar ut det som er huket av, til valgt prosjekt.
 *
 * Både ok og feil kan være satt: gikk tre av fire, skal det stå hvilke
 * tre som ble tatt ut og hvorfor den fjerde ikke ble det.
 */
export async function taUt(
  _forrige: UttakTilstand,
  formData: FormData,
): Promise<UttakTilstand> {
  const bruker = await krevAnsatt()

  const felter = uttakSkjema.safeParse({
    maskinIder: formData.getAll('maskin_id'),
    prosjekt_id: formData.get('prosjekt_id'),
    planlagt_slutt: formData.get('planlagt_slutt') || undefined,
  })
  if (!felter.success) return { feil: felter.error.issues[0].message }

  // Tom dato betyr «til videre». Satt dato gjelder slutten av dagen i
  // norsk tid – se norskSluttAvDag.
  let slutt: Date | null = null
  if (felter.data.planlagt_slutt) {
    slutt = norskSluttAvDag(felter.data.planlagt_slutt)
    if (!slutt) return { feil: 'Ugyldig dato' }
    if (slutt.getTime() < Date.now()) return { feil: 'Datoen kan ikke være tilbake i tid' }
  }

  const svar = await taUtUtstyr(
    bruker,
    [...new Set(felter.data.maskinIder)],
    felter.data.prosjekt_id,
    slutt,
  )
  if ('feil' in svar) return { feil: svar.feil }

  revalidatePath('/ansatt')
  revalidatePath('/m/[qr]', 'page')

  return {
    ok: svar.tattUt.length > 0 ? `Tatt ut: ${svar.tattUt.join(', ')}.` : undefined,
    feil: svar.ikkeTatt.length > 0 ? `${svar.ikkeTatt.join('. ')}.` : undefined,
  }
}

/** Leverer én internleie. Leien må være den innloggedes egen. */
export async function lever(
  leieId: string,
  _forrige: LeverTilstand,
  formData: FormData,
): Promise<LeverTilstand> {
  const bruker = await krevAnsatt()
  if (!z.uuid().safeParse(leieId).success) return { feil: 'Fant ikke leien.' }

  const kommentar = String(formData.get('kommentar') ?? '')
    .trim()
    .slice(0, MAKS_KOMMENTAR)

  const svar = await avsluttInternLeie({
    leieId,
    ansattId: bruker.id,
    aktor: `ansatt:${bruker.epost}`,
    kommentar: kommentar || null,
  })
  if ('feil' in svar) return { feil: svar.feil }

  revalidatePath('/ansatt')
  revalidatePath('/m/[qr]', 'page')
  return { ok: `${svar.maskin} er levert.` }
}
```

- [ ] **Steg 3: Lever-knappen**

Opprett `src/app/ansatt/lever-knapp.tsx`:

```tsx
'use client'

import { useActionState, useState } from 'react'
import { ETIKETT, FELT, KNAPP_LITEN } from '@/components/ui'
import { MAKS_KOMMENTAR } from '@/lib/validering'
import { lever, type LeverTilstand } from './actions'

const start: LeverTilstand = {}

/**
 * Lever-knapp med et valgfritt felt om skade.
 *
 * Ett ekstra trykk før leveringen går, fordi den stopper klokka og fører
 * prisen på prosjektet – og det er ingen godkjenning etterpå som fanger
 * et feiltrykk.
 */
export function LeverKnapp({ leieId }: { leieId: string }) {
  const [åpen, settÅpen] = useState(false)
  const [tilstand, handling, venter] = useActionState(lever.bind(null, leieId), start)

  if (!åpen) {
    return (
      <button
        type="button"
        onClick={() => settÅpen(true)}
        className={`${KNAPP_LITEN} min-h-[2.75rem] px-4`}
      >
        Lever
      </button>
    )
  }

  return (
    <form action={handling} className="w-full space-y-3 border-t-2 border-[var(--kant)] pt-3">
      <label className="block">
        <span className={ETIKETT}>
          Noe som bør fikses? <span className="normal-case">(valgfritt)</span>
        </span>
        <textarea name="kommentar" rows={2} maxLength={MAKS_KOMMENTAR} className={FELT} />
      </label>

      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={venter}
          className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-4 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
        >
          {venter ? 'Leverer …' : 'Bekreft levering'}
        </button>
        <button
          type="button"
          onClick={() => settÅpen(false)}
          className="min-h-[2.75rem] text-sm text-[var(--blekk-svak)]"
        >
          Avbryt
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Steg 4: Uttaksskjemaet**

Opprett `src/app/ansatt/uttak-skjema.tsx`:

```tsx
'use client'

import { useActionState, useState } from 'react'
import { ETIKETT, FELT, KNAPP_PRIMÆR } from '@/components/ui'
import type { ProsjektValg, UttakMaskin } from '@/lib/intern-leie'
import { taUt, type UttakTilstand } from './actions'

const start: UttakTilstand = {}

type Felles = {
  prosjekter: ProsjektValg[]
  sistProsjektId: string | null
  /** yyyy-mm-dd i norsk tid, regnet på serveren – minste lovlige dato. */
  iDag: string
}

/**
 * Lista på /ansatt: kryss av én eller flere, velg prosjekt, ta ut.
 *
 * Søket filtrerer i nettleseren og skjuler rader med `hidden` i stedet
 * for å fjerne dem. Et skjult felt sendes fortsatt med skjemaet, så en
 * avkrysning forsvinner ikke fordi man søkte etter noe annet.
 */
export function UttakListe({ maskiner, prosjekter, sistProsjektId, iDag }: Felles & {
  maskiner: UttakMaskin[]
}) {
  const [valgte, settValgte] = useState<Set<string>>(() => new Set())
  const [søk, settSøk] = useState('')

  // Valgene tømmes i selve handlingen, ikke i en effekt etterpå – da står
  // ikke avkrysningene igjen på maskiner som nettopp ble tatt ut.
  const [tilstand, handling, venter] = useActionState(
    async (forrige: UttakTilstand, fd: FormData) => {
      const svar = await taUt(forrige, fd)
      if (svar.ok) settValgte(new Set())
      return svar
    },
    start,
  )

  const n = søk.toLowerCase().replace(/\s/g, '')
  const treff = (m: UttakMaskin) =>
    !n ||
    [m.navn, m.internnummer, m.underkategori, m.kategori]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().replace(/\s/g, '').includes(n))

  const grupper = new Map<string, UttakMaskin[]>()
  for (const m of maskiner) {
    if (!grupper.has(m.kategori)) grupper.set(m.kategori, [])
    grupper.get(m.kategori)!.push(m)
  }

  function veksle(id: string) {
    settValgte((før) => {
      const ny = new Set(før)
      if (ny.has(id)) ny.delete(id)
      else ny.add(id)
      return ny
    })
  }

  return (
    <form action={handling} className="space-y-6">
      {prosjekter.length === 0 && <IngenProsjekter />}

      <input
        type="search"
        value={søk}
        onChange={(e) => settSøk(e.target.value)}
        placeholder="Søk på navn, internnummer eller type"
        aria-label="Søk i utstyret"
        className={FELT}
      />

      {[...grupper.entries()].map(([kategori, liste]) => (
        <section key={kategori} hidden={!liste.some(treff)}>
          <h3 className="hm-display mb-2 text-lg">{kategori}</h3>
          <ul className="space-y-2">
            {liste.map((m) => (
              <li key={m.id} hidden={!treff(m)}>
                {m.opptatt ? (
                  <div className="flex min-h-[3.5rem] flex-wrap items-center justify-between gap-2 border-2 border-[var(--kant)] bg-[var(--flate-2)] px-4 py-2 opacity-70">
                    <Navn maskin={m} />
                    <span className="text-sm font-semibold">{m.opptatt}</span>
                  </div>
                ) : (
                  <label className="flex min-h-[3.5rem] cursor-pointer items-center gap-3 border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] px-4 py-2 has-checked:border-hm-red has-checked:bg-hm-red/10">
                    <input
                      type="checkbox"
                      name="maskin_id"
                      value={m.id}
                      checked={valgte.has(m.id)}
                      onChange={() => veksle(m.id)}
                      className="size-6 shrink-0 accent-[var(--color-hm-red)]"
                    />
                    <Navn maskin={m} />
                  </label>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Bunnlinja ligger i skjemaet og er sticky, så den følger med mens
          man blar – og svaret blir stående etter at valgene er tømt. */}
      <div
        hidden={valgte.size === 0 && !tilstand.ok && !tilstand.feil}
        className="sticky bottom-0 -mx-5 space-y-3 border-t-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <Svar tilstand={tilstand} />
        {valgte.size > 0 && (
          <>
            <p className="hm-display text-lg">{valgte.size} valgt</p>
            <Felter
              prosjekter={prosjekter}
              sistProsjektId={sistProsjektId}
              iDag={iDag}
              venter={venter}
            />
          </>
        )}
      </div>
    </form>
  )
}

/** Det korte skjemaet på maskinens QR-side – maskinen er allerede valgt. */
export function UttakEnkel({ maskinId, prosjekter, sistProsjektId, iDag }: Felles & {
  maskinId: string
}) {
  const [tilstand, handling, venter] = useActionState(taUt, start)

  return (
    <form action={handling} className="space-y-4">
      <input type="hidden" name="maskin_id" value={maskinId} />
      {prosjekter.length === 0 && <IngenProsjekter />}
      <Felter
        prosjekter={prosjekter}
        sistProsjektId={sistProsjektId}
        iDag={iDag}
        venter={venter}
      />
      <Svar tilstand={tilstand} />
    </form>
  )
}

function Felter({
  prosjekter,
  sistProsjektId,
  iDag,
  venter,
}: Felles & { venter: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className={ETIKETT}>Prosjekt</span>
        <select
          name="prosjekt_id"
          required
          defaultValue={sistProsjektId ?? ''}
          className={FELT}
        >
          <option value="" disabled>
            Velg prosjekt
          </option>
          {prosjekter.map((p) => (
            <option key={p.id} value={p.id}>
              {p.navn}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={ETIKETT}>
          Tilbake <span className="normal-case">(valgfritt)</span>
        </span>
        <input type="date" name="planlagt_slutt" min={iDag} className={FELT} />
        <span className="mt-1.5 block text-xs text-[var(--blekk-svak)]">
          Tomt betyr til videre
        </span>
      </label>

      <button
        type="submit"
        disabled={venter || prosjekter.length === 0}
        className={`${KNAPP_PRIMÆR} sm:col-span-2`}
      >
        {venter ? 'Tar ut …' : 'Ta ut'}
      </button>
    </div>
  )
}

function Svar({ tilstand }: { tilstand: UttakTilstand }) {
  return (
    <>
      {tilstand.ok && (
        <p role="status" className="text-sm font-semibold text-hm-green">
          {tilstand.ok}
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
    </>
  )
}

function IngenProsjekter() {
  return (
    <p className="border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
      Ingen aktive prosjekter ennå – admin må legge inn prosjekter først.
    </p>
  )
}

function Navn({ maskin }: { maskin: UttakMaskin }) {
  const under = [maskin.internnummer, maskin.underkategori].filter(Boolean).join(' · ')
  return (
    <span className="min-w-0 flex-1">
      <span className="block font-semibold">{maskin.navn}</span>
      {under && <span className="block text-sm text-[var(--blekk-svak)]">{under}</span>}
    </span>
  )
}
```

- [ ] **Steg 5: Sida**

Opprett `src/app/ansatt/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { krevAnsatt } from '@/lib/auth'
import { hentUttaksside } from '@/lib/intern-leie'
import { dato, osloDag } from '@/lib/dato'
import { HMLogo } from '@/components/hm-logo'
import { BrukerMeny } from '@/components/bruker-meny'
import { TomTilstand } from '@/components/ui'
import { LeverKnapp } from './lever-knapp'
import { UttakListe } from './uttak-skjema'

export const metadata: Metadata = { title: 'Utstyr – HM' }
export const dynamic = 'force-dynamic'

/**
 * Egne folk tar ut utstyr til prosjekter her – uten kundeskjemaet. Hvem
 * de er, vet vi fra innloggingen.
 */
export default async function AnsattSide() {
  const bruker = await krevAnsatt()
  const side = await hentUttaksside(bruker)
  // Regnes på serveren, så datovelgeren og serveren er enige om «i dag».
  const iDag = osloDag(new Date())

  return (
    <>
      <header className="relative overflow-hidden bg-hm-black px-5 pt-6 pb-8 text-white">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-16 h-[160%] w-40 skew-x-[-18deg] bg-hm-red/90"
        />
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <HMLogo størrelse="sm" />
            <BrukerMeny bruker={bruker} her="ansatt" />
          </div>
          <h1 className="hm-display mt-6 text-3xl">Utstyr</h1>
          <p className="mt-1 text-sm text-white/70">
            Ta ut til et prosjekt, og lever når du er ferdig.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-5 py-7">
        {!side.sattOpp ? (
          <TomTilstand tittel="Ikke satt opp ennå">
            Uttak til prosjekter er ikke slått på i databasen ennå. Si fra til
            en admin.
          </TomTilstand>
        ) : (
          <>
            <section>
              <Overskrift antall={side.mine.length}>Hos deg nå</Overskrift>
              {side.mine.length === 0 ? (
                <p className="text-sm text-[var(--blekk-svak)]">Du har ikke noe ute.</p>
              ) : (
                <ul className="space-y-3">
                  {side.mine.map((l) => (
                    <li
                      key={l.id}
                      className="flex flex-wrap items-start justify-between gap-3 border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="hm-display block text-lg">{l.maskin}</span>
                        <span className="mt-0.5 block text-sm text-[var(--blekk-svak)]">
                          {[l.internnummer, l.prosjekt].filter(Boolean).join(' · ')}
                        </span>
                        <span className="mt-1 block text-sm">
                          Ute siden {dato(l.startTid)}
                          {l.planlagtSlutt && ` · ventet tilbake ${dato(l.planlagtSlutt)}`}
                        </span>
                      </div>
                      <LeverKnapp leieId={l.id} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <Overskrift>Ta ut utstyr</Overskrift>
              <UttakListe
                maskiner={side.maskiner}
                prosjekter={side.prosjekter}
                sistProsjektId={side.sistProsjektId}
                iDag={iDag}
              />
            </section>
          </>
        )}
      </main>
    </>
  )
}

function Overskrift({ children, antall }: { children: React.ReactNode; antall?: number }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="hm-skrastrek !h-1 !w-5" aria-hidden="true" />
      <h2 className="hm-display text-xl">{children}</h2>
      {antall !== undefined && antall > 0 && (
        <span className="hm-tall text-xs font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
          {antall}
        </span>
      )}
    </div>
  )
}
```

Opprett `src/app/ansatt/loading.tsx`:

```tsx
import { VerkstedSkjelett } from '@/components/skjelett'

export default function Laster() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-7">
      <VerkstedSkjelett />
    </main>
  )
}
```

- [ ] **Steg 6: Verifiser**

```bash
npx next typegen
```
```bash
npx tsc --noEmit
```
```bash
npm run lint
```
```bash
npm run build
```

Forventet: alt grønt, og `ƒ /ansatt` står i rutelista fra bygget.

- [ ] **Steg 7: Commit**

```bash
git add src/components/bruker-meny.tsx src/app/verksted/page.tsx "src/app/verksted/[id]/page.tsx" "src/app/admin/(panel)/meny.tsx" src/app/ansatt/page.tsx src/app/ansatt/actions.ts src/app/ansatt/uttak-skjema.tsx src/app/ansatt/lever-knapp.tsx src/app/ansatt/loading.tsx
git commit -m "Siden der egne folk tar ut og leverer utstyr" -m "Hos deg nå øverst, med levering og valgfri merknad. Under: alt utstyret, med avkrysning på det som er ledig og navnet på kollegaen som har resten. Verkstedmenyen blir felles meny, så service kommer mellom verksted og uttak." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Flyttingen er allerede lagt i indeksen av `git mv`. Ikke ta med den gamle
stien i `git add` – den finnes ikke lenger, og da feiler hele kommandoen.

---

## Oppgave 8: QR-siden og returkoden for innloggede

**Filer:**
- Endre: `src/app/m/[qr]/page.tsx` (skrives om)
- Endre: `src/app/retur/page.tsx`

**Grensesnitt:**
- Bruker: `hentAdmin`, `BYTT_PASSORD_STI` (auth), `hentProsjektvalg` (intern-leie),
  `prosjektNavn` (leietaker), `UttakEnkel`, `LeverKnapp` (ansatt), `osloDag`, `dato`, `returDato`.

- [ ] **Steg 1: Maskinsiden**

Erstatt hele `src/app/m/[qr]/page.tsx` med:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hentEnhetsId } from '@/lib/enhet'
import { BYTT_PASSORD_STI, hentAdmin } from '@/lib/auth'
import { hentProsjektvalg } from '@/lib/intern-leie'
import { prosjektNavn } from '@/lib/leietaker'
import type { Leie, Maskin, ProsjektInnbygd } from '@/lib/types'
import { HMLogo } from '@/components/hm-logo'
import { KNAPP_PRIMÆR, Merke } from '@/components/ui'
import { dato, osloDag, returDato } from '@/lib/dato'
import { krPer, prisEnhet } from '@/lib/pris'
import { kanLeiesUt, verkstedStatusAv } from '@/lib/verksted'
import { LeverKnapp } from '@/app/ansatt/lever-knapp'
import { UttakEnkel } from '@/app/ansatt/uttak-skjema'
import { LeieSkjema } from './leie-skjema'

export const dynamic = 'force-dynamic'

type AktivLeie = Leie & {
  ansatt: { navn: string } | null
  prosjekter: ProsjektInnbygd | null
}

export async function generateMetadata(
  props: PageProps<'/m/[qr]'>,
): Promise<Metadata> {
  const { qr } = await props.params
  const { data } = await supabaseAdmin
    .from('maskiner')
    .select('navn')
    .eq('qr_kode', qr)
    .maybeSingle()

  return { title: data?.navn ? `${data.navn} – HM Utleie` : 'HM Utleie' }
}

export default async function MaskinSide(props: PageProps<'/m/[qr]'>) {
  const { qr } = await props.params

  const { data } = await supabaseAdmin
    .from('maskiner')
    .select('*')
    .eq('qr_kode', qr)
    .eq('aktiv', true)
    .maybeSingle()

  if (!data) notFound()
  const maskin = data as Maskin

  const [{ data: aktivRad }, enhetsId, bruker] = await Promise.all([
    supabaseAdmin
      .from('leier')
      .select('*, ansatt:admin_brukere!leier_ansatt_id_fkey(navn), prosjekter(navn, nummer)')
      .eq('maskin_id', maskin.id)
      .in('status', ['aktiv', 'venter_godkjenning'])
      .maybeSingle(),
    hentEnhetsId(),
    hentAdmin(),
  ])

  const aktiv = aktivRad as unknown as AktivLeie | null
  const erMin = Boolean(aktiv && enhetsId && aktiv.enhets_id === enhetsId)
  const utilgjengelig = maskin.status === 'service' || maskin.status === 'utrangert'
  const påVerksted = !kanLeiesUt(maskin.verksted_status)

  // Innlogget betyr en av våre egne. De får det korte uttaksskjemaet i
  // stedet for kundeskjemaet, og ser hvilken kollega som har maskinen.
  const ansatt = bruker && !bruker.maByttePassord ? bruker : null
  const minIntern = Boolean(ansatt && aktiv?.ansatt_id === ansatt.id)
  const prosjekt = aktiv?.prosjekter ? prosjektNavn(aktiv.prosjekter) : null
  const valg =
    ansatt && !aktiv && !utilgjengelig && !påVerksted
      ? await hentProsjektvalg(ansatt.id)
      : null

  return (
    <>
      {/* ── Maskinkort ────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-hm-black px-5 pt-6 pb-8 text-white">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-16 h-[160%] w-40 skew-x-[-18deg] bg-hm-red/90"
        />
        <div className="relative mx-auto max-w-md">
          <div className="flex items-start justify-between gap-4">
            <HMLogo størrelse="sm" />
            <span className="hm-tall font-mono text-xs tracking-widest text-white/50">
              {maskin.qr_kode}
            </span>
          </div>

          <h1 className="hm-display mt-6 text-3xl">{maskin.navn}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {utilgjengelig ? (
              <Merke type="nøytral">Ute av drift</Merke>
            ) : aktiv ? (
              <Merke type="gul">
                {erMin ? 'Du leier denne' : minIntern ? 'Du har denne' : 'Utleid'}
              </Merke>
            ) : (
              <Merke type="grønn">Ledig nå</Merke>
            )}
            {maskin.kategori && (
              <span className="text-sm text-white/60">{maskin.kategori}</span>
            )}
          </div>

          {/* Internleie har ingen kundepris – prisen er for kunder. */}
          {!ansatt && maskin.vis_pris && maskin.dogn_pris !== null && (
            <p className="mt-6 flex items-baseline gap-2">
              <span className="hm-display hm-tall text-5xl">
                {maskin.dogn_pris.toLocaleString('nb-NO')}
              </span>
              <span className="text-sm font-semibold tracking-widest text-white/60 uppercase">
                {krPer(prisEnhet(maskin.pris_enhet))}
              </span>
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-7">
        {utilgjengelig ? (
          <Beskjed tittel="Ikke tilgjengelig">
            Denne maskinen er ute av drift. Ta kontakt med utleier.
          </Beskjed>
        ) : påVerksted && !aktiv ? (
          <Beskjed tittel="Står til reparasjon">
            {verkstedStatusAv(maskin.verksted_status) === 'deler_bestilt'
              ? 'Deler er bestilt, og den er klar når de er på plass.'
              : 'Den må sveises før den kan brukes igjen.'}{' '}
            Ta kontakt med utleier hvis du trenger den.
          </Beskjed>
        ) : erMin && aktiv ? (
          <div className="space-y-5">
            <Beskjed tittel="Leien din er i gang">
              Startet {dato(aktiv.start_tid)}. Forventet levering{' '}
              {returDato(aktiv.planlagt_slutt)}.
            </Beskjed>
            <Link href={`/leie/${aktiv.referanse}`} className={KNAPP_PRIMÆR}>
              Se leien og lever
            </Link>
          </div>
        ) : minIntern && aktiv ? (
          <div className="space-y-5">
            <Beskjed tittel={prosjekt ? `Du har denne på ${prosjekt}` : 'Du har denne'}>
              Tatt ut {dato(aktiv.start_tid)}.
              {aktiv.planlagt_slutt && ` Ventet tilbake ${dato(aktiv.planlagt_slutt)}.`}
            </Beskjed>
            <LeverKnapp leieId={aktiv.id} />
          </div>
        ) : ansatt && aktiv?.ansatt_id ? (
          <Beskjed tittel={`Hos ${aktiv.ansatt?.navn ?? 'en kollega'}`}>
            {prosjekt ? `Står på ${prosjekt}. ` : ''}
            {aktiv.planlagt_slutt
              ? `Ventet tilbake ${dato(aktiv.planlagt_slutt)}.`
              : 'Ute til videre.'}
          </Beskjed>
        ) : aktiv ? (
          <Beskjed tittel="Maskinen er utleid">
            {aktiv.planlagt_slutt
              ? `Den er ventet tilbake ${dato(aktiv.planlagt_slutt)}. Ta kontakt med utleier hvis du trenger den før det.`
              : 'Ta kontakt med utleier hvis du trenger den.'}
          </Beskjed>
        ) : bruker?.maByttePassord ? (
          <Beskjed tittel="Bytt passord først">
            Du må velge ditt eget passord før du kan ta ut utstyr.{' '}
            <Link href={BYTT_PASSORD_STI} className="font-semibold underline underline-offset-4">
              Bytt passord
            </Link>
          </Beskjed>
        ) : ansatt && valg ? (
          <div className="space-y-4">
            <p className="hm-display text-lg">Ta ut til prosjekt</p>
            <UttakEnkel
              maskinId={maskin.id}
              prosjekter={valg.prosjekter}
              sistProsjektId={valg.sistProsjektId}
              iDag={osloDag(new Date())}
            />
          </div>
        ) : (
          <>
            <LeieSkjema maskinId={maskin.id} maskinNavn={maskin.navn} />
            <p className="mt-8 text-center">
              <Link
                href={`/admin/logg-inn?neste=${encodeURIComponent(`/m/${maskin.qr_kode}`)}`}
                className="inline-flex min-h-[2.75rem] items-center text-sm font-semibold text-[var(--blekk-svak)] underline underline-offset-4"
              >
                Ansatt? Logg inn
              </Link>
            </p>
          </>
        )}
      </main>
    </>
  )
}

function Beskjed({
  tittel,
  children,
}: {
  tittel: string
  children: React.ReactNode
}) {
  return (
    <div className="border-l-4 border-hm-red bg-[var(--flate-2)] p-4">
      <p className="hm-display text-lg">{tittel}</p>
      <p className="mt-1 text-sm text-[var(--blekk-svak)]">{children}</p>
    </div>
  )
}
```

- [ ] **Steg 2: Returkoden**

I `src/app/retur/page.tsx`, finn:

```ts
import { hentEnhetsId } from '@/lib/enhet'
```

Erstatt med:

```ts
import { hentEnhetsId } from '@/lib/enhet'
import { hentAdmin } from '@/lib/auth'
```

Finn:

```ts
export default async function FellesReturSide() {
  const enhetsId = await hentEnhetsId()
```

Erstatt med:

```ts
export default async function FellesReturSide() {
  // Egne folk leverer fra sin egen side, der alt de har ute står samlet.
  if (await hentAdmin()) redirect('/ansatt')

  const enhetsId = await hentEnhetsId()
```

Finn (nederst i `<main>`):

```tsx
            <FinnSkjema />
          </>
        )}
      </main>
```

Erstatt med:

```tsx
            <FinnSkjema />
          </>
        )}

        <p className="mt-8 text-center">
          <Link
            href="/admin/logg-inn?neste=/ansatt"
            className="inline-flex min-h-[2.75rem] items-center text-sm font-semibold text-[var(--blekk-svak)] underline underline-offset-4"
          >
            Ansatt? Logg inn
          </Link>
        </p>
      </main>
```

- [ ] **Steg 3: Verifiser**

```bash
npx tsc --noEmit
```
```bash
npm run lint
```

Forventet: ingen feil.

- [ ] **Steg 4: Sjekk uinnlogget i nettleseren**

Start dev-serveren (se oppgave 13, steg 4 for `launch.json`). Hent en ekte
QR-kode med skriptet under, og åpne `/m/<kode>`:

```bash
node --env-file=.env.local --input-type=module <<'EOF'
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data } = await db.from('maskiner').select('qr_kode, navn, status').eq('aktiv', true).eq('status', 'ledig').limit(1)
console.log(data)
EOF
```

Forventet på `/m/<kode>`: kundeskjemaet som før, og «Ansatt? Logg inn»
nederst. Lenken går til `/admin/logg-inn?neste=%2Fm%2F<kode>`, og siden der
heter «Logg inn». På `/retur`: «Ansatt? Logg inn» nederst. `/ansatt` sender
til `/admin/logg-inn?neste=/ansatt`. **Ikke fyll ut og send kundeskjemaet** –
det lager en ekte leie i produksjonsbasen.

- [ ] **Steg 5: Commit**

```bash
git add "src/app/m/[qr]/page.tsx" src/app/retur/page.tsx
git commit -m "QR-koden gir egne folk det korte skjemaet" -m "Innlogget på en ledig maskin: velg prosjekt og ta ut. Har du den selv, kan du levere der. Har en kollega den, står det hvem. Uinnlogget er alt som før, med en lenke til innlogging for ansatte." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Oppgave 9: Prosjekter i adminpanelet

**Filer:**
- Endre: `src/lib/pris.ts` (+ `summerInternleie`), test i `src/lib/pris.test.mjs`
- Opprett: `src/app/admin/(panel)/prosjekter/page.tsx`, `actions.ts`, `nytt-prosjekt.tsx`, `loading.tsx`
- Opprett: `src/app/admin/(panel)/prosjekter/[id]/page.tsx`, `rediger-prosjekt.tsx`, `loading.tsx`
- Endre: `src/app/admin/(panel)/meny.tsx`

**Grensesnitt:**
- Produserer:
  - `type InternleieRad = { status: string; start_tid: string; belop: number | null; pris: number | null; enhet: PrisEnhet }`
  - `summerInternleie(rader: InternleieRad[], nå: string): { levert: number; løpende: number; ute: number; manglerPris: boolean }`
  - i `prosjekter/actions.ts`: `type ProsjektTilstand = { feil?: string; ok?: string }`,
    `opprettProsjekt(forrige, formData)`, `endreProsjekt(id, forrige, formData)`,
    `settProsjektAktiv(id: string, aktiv: boolean)`, `slettProsjekt(id: string)`

- [ ] **Steg 1: Test for `summerInternleie`**

Legg til nederst i `src/lib/pris.test.mjs`, og utvid importen til
`import { beregnPris, summerInternleie } from './pris.ts'`:

```js
test('levert og løpende summeres hver for seg', () => {
  const sum = summerInternleie(
    [
      { status: 'avsluttet', start_tid: '2026-08-01T08:00:00.000Z', belop: 900, pris: 450, enhet: 'dogn' },
      { status: 'aktiv', start_tid: '2026-09-01T08:00:00.000Z', belop: null, pris: 450, enhet: 'dogn' },
    ],
    '2026-09-03T08:00:00.000Z',
  )
  assert.deepEqual(sum, { levert: 900, løpende: 900, ute: 1, manglerPris: false })
})

test('maskin uten pris sier fra i stedet for å telle 0 kr', () => {
  const sum = summerInternleie(
    [
      { status: 'aktiv', start_tid: '2026-09-01T08:00:00.000Z', belop: null, pris: null, enhet: 'dogn' },
      { status: 'avsluttet', start_tid: '2026-08-01T08:00:00.000Z', belop: null, pris: null, enhet: 'dogn' },
    ],
    '2026-09-02T08:00:00.000Z',
  )
  assert.deepEqual(sum, { levert: 0, løpende: 0, ute: 1, manglerPris: true })
})
```

- [ ] **Steg 2: Kjør og se den feile**

```bash
npm test
```

Forventet: FAIL – `summerInternleie` er ikke eksportert.

- [ ] **Steg 3: `summerInternleie`**

Legg til nederst i `src/lib/pris.ts`:

```ts
export type InternleieRad = {
  status: string
  start_tid: string
  /** Lagret ved levering. Null så lenge leien er ute. */
  belop: number | null
  /** Maskinens pris, for anslaget på det som fortsatt er ute. */
  pris: number | null
  enhet: PrisEnhet
}

/**
 * Hva et prosjekt har brukt på internleie.
 *
 * Levert er de lagrede beløpene. Løpende er et anslag fram til nå for det
 * som fortsatt er ute – det vokser hver dag til utstyret leveres.
 * manglerPris flagger en maskin uten pris, så summen ikke ser komplett
 * ut når den ikke er det.
 */
export function summerInternleie(
  rader: InternleieRad[],
  nå: string,
): { levert: number; løpende: number; ute: number; manglerPris: boolean } {
  let levert = 0
  let løpende = 0
  let ute = 0
  let manglerPris = false

  for (const r of rader) {
    if (r.status === 'aktiv') {
      ute++
      const { belop } = beregnPris(r.start_tid, nå, r.enhet, r.pris)
      if (belop === null) manglerPris = true
      else løpende += belop
    } else if (r.status === 'avsluttet') {
      if (r.belop === null) manglerPris = true
      else levert += r.belop
    }
  }

  return { levert, løpende, ute, manglerPris }
}
```

- [ ] **Steg 4: Kjør testene**

```bash
npm test
```

Forventet: alle PASS.

- [ ] **Steg 5: Handlingene**

Opprett `src/app/admin/(panel)/prosjekter/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'

export type ProsjektTilstand = { feil?: string; ok?: string }

const skjema = z.object({
  navn: z.string().trim().min(2, 'Navn må fylles ut').max(100),
  nummer: z.string().trim().max(40).optional(),
})

function lagringsfeil(error: { code?: string; message: string }): string {
  return error.code === '23505'
    ? 'Det finnes allerede et prosjekt med det navnet.'
    : `Kunne ikke lagre: ${error.message}`
}

export async function opprettProsjekt(
  _forrige: ProsjektTilstand,
  formData: FormData,
): Promise<ProsjektTilstand> {
  await krevAdmin()

  const felter = skjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const supabase = await lagServerKlient()
  const { error } = await supabase
    .from('prosjekter')
    .insert({ navn: felter.data.navn, nummer: felter.data.nummer || null })

  if (error) return { feil: lagringsfeil(error) }

  revalidatePath('/admin/prosjekter')
  return { ok: `${felter.data.navn} er lagt til.` }
}

export async function endreProsjekt(
  id: string,
  _forrige: ProsjektTilstand,
  formData: FormData,
): Promise<ProsjektTilstand> {
  await krevAdmin()

  const felter = skjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const supabase = await lagServerKlient()
  const { error } = await supabase
    .from('prosjekter')
    .update({ navn: felter.data.navn, nummer: felter.data.nummer || null })
    .eq('id', id)

  if (error) return { feil: lagringsfeil(error) }

  revalidatePath('/admin/prosjekter', 'layout')
  return { ok: 'Lagret.' }
}

/**
 * Avslutter eller åpner et prosjekt igjen. Utstyr som står ute på det,
 * blir der til det leveres – et avsluttet prosjekt forsvinner bare fra
 * de ansattes liste.
 */
export async function settProsjektAktiv(id: string, aktiv: boolean) {
  await krevAdmin()
  const supabase = await lagServerKlient()
  await supabase.from('prosjekter').update({ aktiv }).eq('id', id)
  revalidatePath('/admin/prosjekter', 'layout')
}

/**
 * Sletter et prosjekt uten leier – typisk et feilskrevet et. Har det
 * leier, stopper fremmednøkkelen slettingen uansett. Da skal det
 * avsluttes, ikke slettes, så historikken består.
 */
export async function slettProsjekt(id: string) {
  await krevAdmin()
  const supabase = await lagServerKlient()

  const { count } = await supabase
    .from('leier')
    .select('id', { count: 'exact', head: true })
    .eq('prosjekt_id', id)
  if (count) return

  await supabase.from('prosjekter').delete().eq('id', id)
  revalidatePath('/admin/prosjekter')
  redirect('/admin/prosjekter')
}
```

- [ ] **Steg 6: Skjema for nytt prosjekt**

Opprett `src/app/admin/(panel)/prosjekter/nytt-prosjekt.tsx`:

```tsx
'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { ETIKETT, FELT, KNAPP_SEKUNDÆR } from '@/components/ui'
import { opprettProsjekt, type ProsjektTilstand } from './actions'

const start: ProsjektTilstand = {}

export function NyttProsjekt() {
  const [åpen, settÅpen] = useState(false)
  const [tilstand, handling, venter] = useActionState(opprettProsjekt, start)
  const skjema = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (tilstand.ok) skjema.current?.reset()
  }, [tilstand.ok])

  if (!åpen) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => settÅpen(true)}
          className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-4 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover"
        >
          + Nytt prosjekt
        </button>
        {tilstand.ok && (
          <p role="status" className="text-sm font-semibold text-hm-green">
            {tilstand.ok}
          </p>
        )}
      </div>
    )
  }

  return (
    <form
      ref={skjema}
      action={handling}
      className="border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-5"
    >
      <h2 className="hm-display mb-4 text-xl">Nytt prosjekt</h2>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <label>
          <span className={ETIKETT}>Navn</span>
          <input name="navn" required placeholder="Kvamsøy bru" className={FELT} />
        </label>
        <label>
          <span className={ETIKETT}>
            Prosjektnummer <span className="normal-case">(valgfritt)</span>
          </span>
          <input name="nummer" placeholder="P-2317" className={FELT} />
        </label>
      </div>

      {tilstand.feil && (
        <p
          role="alert"
          className="mt-4 border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}
      {tilstand.ok && (
        <p className="mt-4 text-sm font-semibold text-hm-green">{tilstand.ok}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={venter}
          className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-5 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
        >
          {venter ? 'Lagrer …' : 'Legg til'}
        </button>
        <button type="button" onClick={() => settÅpen(false)} className={KNAPP_SEKUNDÆR}>
          Lukk
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Steg 7: Lista**

Opprett `src/app/admin/(panel)/prosjekter/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { prisEnhet, summerInternleie, type InternleieRad } from '@/lib/pris'
import type { Prosjekt } from '@/lib/types'
import { Merke, Seksjonstittel, TomTilstand } from '@/components/ui'
import { NyttProsjekt } from './nytt-prosjekt'

export const metadata: Metadata = { title: 'Prosjekter – HM Utleie' }
export const dynamic = 'force-dynamic'

type Rad = {
  prosjekt_id: string
  status: string
  start_tid: string
  belop: number | null
  maskiner: { dogn_pris: number | null; pris_enhet: string | null } | null
}

const kr = (n: number) => `${n.toLocaleString('nb-NO')} kr`

export default async function ProsjekterSide() {
  await krevAdmin()
  const supabase = await lagServerKlient()
  const nå = new Date().toISOString()

  const [{ data: prosjektRader }, { data: leieRader }] = await Promise.all([
    supabase
      .from('prosjekter')
      .select('*')
      .order('aktiv', { ascending: false })
      .order('navn'),
    supabase
      .from('leier')
      .select('prosjekt_id, status, start_tid, belop, maskiner(dogn_pris, pris_enhet)')
      .not('prosjekt_id', 'is', null)
      .in('status', ['aktiv', 'avsluttet']),
  ])

  const prosjekter = (prosjektRader ?? []) as Prosjekt[]

  const perProsjekt = new Map<string, InternleieRad[]>()
  for (const l of (leieRader ?? []) as unknown as Rad[]) {
    const liste = perProsjekt.get(l.prosjekt_id) ?? []
    liste.push({
      status: l.status,
      start_tid: l.start_tid,
      belop: l.belop,
      pris: l.maskiner?.dogn_pris ?? null,
      enhet: prisEnhet(l.maskiner?.pris_enhet),
    })
    perProsjekt.set(l.prosjekt_id, liste)
  }

  return (
    <div className="space-y-7">
      <Seksjonstittel under="Internleie føres på prosjektet når noen tar ut utstyr til det.">
        Prosjekter
      </Seksjonstittel>

      <NyttProsjekt />

      {prosjekter.length === 0 ? (
        <TomTilstand tittel="Ingen prosjekter ennå">
          Legg inn det første, så kan de ansatte ta ut utstyr til det.
        </TomTilstand>
      ) : (
        <div className="overflow-x-auto border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)]">
          <table className="w-full text-sm">
            <thead className="bg-hm-black text-white">
              <tr>
                <Th>Prosjekt</Th>
                <Th>Ute nå</Th>
                <Th>Internleie hittil</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {prosjekter.map((p) => {
                const s = summerInternleie(perProsjekt.get(p.id) ?? [], nå)
                return (
                  <tr
                    key={p.id}
                    className="border-b-2 border-[var(--kant)] transition-colors last:border-0 hover:bg-[var(--flate-2)]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/prosjekter/${p.id}`}
                        className="inline-flex min-h-[2.75rem] items-center font-semibold underline underline-offset-4"
                      >
                        {p.navn}
                      </Link>
                      {p.nummer && (
                        <div className="hm-tall text-xs text-[var(--blekk-svak)]">{p.nummer}</div>
                      )}
                    </td>
                    <td className="hm-tall px-4 py-3">{s.ute}</td>
                    <td className="hm-tall px-4 py-3 whitespace-nowrap">
                      {kr(s.levert + s.løpende)}
                      {s.løpende > 0 && (
                        <span className="block text-xs text-[var(--blekk-svak)]">
                          herav {kr(s.løpende)} løpende
                        </span>
                      )}
                      {s.manglerPris && (
                        <span className="block text-[10px] font-bold tracking-wider text-hm-amber uppercase">
                          Mangler pris
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Merke type={p.aktiv ? 'grønn' : 'nøytral'}>
                        {p.aktiv ? 'Aktiv' : 'Avsluttet'}
                      </Merke>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-[11px] font-bold tracking-widest uppercase">
      {children}
    </th>
  )
}
```

Opprett `src/app/admin/(panel)/prosjekter/loading.tsx`:

```tsx
import { ListeSkjelett } from '@/components/skjelett'

export default function Laster() {
  return <ListeSkjelett antall={6} />
}
```

- [ ] **Steg 8: Detaljsiden**

Opprett `src/app/admin/(panel)/prosjekter/[id]/rediger-prosjekt.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { ETIKETT, FELT, KNAPP_SEKUNDÆR } from '@/components/ui'
import { endreProsjekt, type ProsjektTilstand } from '../actions'

const start: ProsjektTilstand = {}

export function RedigerProsjekt({
  id,
  navn,
  nummer,
}: {
  id: string
  navn: string
  nummer: string | null
}) {
  const [tilstand, handling, venter] = useActionState(endreProsjekt.bind(null, id), start)

  return (
    <form action={handling} className="grid gap-4 p-5 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
      <label>
        <span className={ETIKETT}>Navn</span>
        <input name="navn" required defaultValue={navn} className={FELT} />
      </label>
      <label>
        <span className={ETIKETT}>Prosjektnummer</span>
        <input name="nummer" defaultValue={nummer ?? ''} className={FELT} />
      </label>
      <button type="submit" disabled={venter} className={KNAPP_SEKUNDÆR}>
        {venter ? 'Lagrer …' : 'Lagre'}
      </button>
      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink sm:col-span-3"
        >
          {tilstand.feil}
        </p>
      )}
      {tilstand.ok && (
        <p role="status" className="text-sm font-semibold text-hm-green sm:col-span-3">
          {tilstand.ok}
        </p>
      )}
    </form>
  )
}
```

Opprett `src/app/admin/(panel)/prosjekter/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { antallTekst, beregnPris, prisEnhet, summerInternleie } from '@/lib/pris'
import { dato } from '@/lib/dato'
import type { Prosjekt } from '@/lib/types'
import { Kort, KortTittel, Merke, TomTilstand } from '@/components/ui'
import { BekreftKnapp } from '@/components/bekreft-knapp'
import { settProsjektAktiv, slettProsjekt } from '../actions'
import { RedigerProsjekt } from './rediger-prosjekt'

export const metadata: Metadata = { title: 'Prosjekt – HM Utleie' }
export const dynamic = 'force-dynamic'

type Rad = {
  id: string
  referanse: string
  status: string
  start_tid: string
  slutt_tid: string | null
  antall_dogn: number | null
  belop: number | null
  manuelt_justert: boolean
  maskiner: { navn: string; dogn_pris: number | null; pris_enhet: string | null } | null
  ansatt: { navn: string } | null
}

const kr = (n: number) => `${n.toLocaleString('nb-NO')} kr`

export default async function ProsjektSide(props: PageProps<'/admin/prosjekter/[id]'>) {
  await krevAdmin()
  const { id } = await props.params
  const supabase = await lagServerKlient()

  const [{ data: prosjektRad }, { data: leieRader }] = await Promise.all([
    supabase.from('prosjekter').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('leier')
      .select(
        'id, referanse, status, start_tid, slutt_tid, antall_dogn, belop, manuelt_justert, maskiner(navn, dogn_pris, pris_enhet), ansatt:admin_brukere!leier_ansatt_id_fkey(navn)',
      )
      .eq('prosjekt_id', id)
      .order('start_tid', { ascending: false }),
  ])

  if (!prosjektRad) notFound()
  const prosjekt = prosjektRad as Prosjekt
  const leier = (leieRader ?? []) as unknown as Rad[]
  const nå = new Date().toISOString()

  const sum = summerInternleie(
    leier.map((l) => ({
      status: l.status,
      start_tid: l.start_tid,
      belop: l.belop,
      pris: l.maskiner?.dogn_pris ?? null,
      enhet: prisEnhet(l.maskiner?.pris_enhet),
    })),
    nå,
  )

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/prosjekter"
          className="inline-flex min-h-[2.75rem] items-center text-sm font-semibold text-[var(--blekk-svak)] underline underline-offset-4"
        >
          ← Alle prosjekter
        </Link>
        <span className="hm-skrastrek mt-2 mb-3 block" aria-hidden="true" />
        <h1 className="hm-display text-3xl">{prosjekt.navn}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {prosjekt.nummer && (
            <span className="hm-tall font-mono text-sm text-[var(--blekk-svak)]">
              {prosjekt.nummer}
            </span>
          )}
          <Merke type={prosjekt.aktiv ? 'grønn' : 'nøytral'}>
            {prosjekt.aktiv ? 'Aktiv' : 'Avsluttet'}
          </Merke>
        </div>
      </div>

      <Kort>
        <KortTittel>Internleie hittil</KortTittel>
        <div className="p-5">
          <p className="hm-display hm-tall text-4xl">{kr(sum.levert + sum.løpende)}</p>
          <p className="mt-1 text-sm text-[var(--blekk-svak)]">
            {kr(sum.levert)} levert
            {sum.ute > 0 && ` · ${kr(sum.løpende)} løpende på ${sum.ute} ting som er ute`}
          </p>
          {sum.manglerPris && (
            <p className="mt-3 border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
              Noe utstyr på prosjektet mangler pris, så summen er for lav. Sett
              pris på maskinen, og rett beløpet på leien.
            </p>
          )}
        </div>
      </Kort>

      <Kort>
        <KortTittel>Leier</KortTittel>
        {leier.length === 0 ? (
          <div className="p-5">
            <TomTilstand tittel="Ingenting ført ennå">
              Når noen tar ut utstyr til prosjektet, dukker det opp her.
            </TomTilstand>
          </div>
        ) : (
          <ul className="divide-y-2 divide-[var(--kant)]">
            {leier.map((l) => {
              const enhet = prisEnhet(l.maskiner?.pris_enhet)
              const anslag =
                l.status === 'aktiv'
                  ? beregnPris(l.start_tid, nå, enhet, l.maskiner?.dogn_pris ?? null)
                  : null
              const antall = anslag?.antall ?? l.antall_dogn
              const belop = anslag ? anslag.belop : l.belop
              return (
                <li key={l.id}>
                  <Link
                    href={`/admin/leier/${l.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition-colors hover:bg-[var(--flate-2)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {l.maskiner?.navn ?? 'Ukjent maskin'}
                      </span>
                      <span className="block text-sm text-[var(--blekk-svak)]">
                        {l.ansatt?.navn ?? 'Ukjent ansatt'} · {dato(l.start_tid)} –{' '}
                        {l.slutt_tid ? dato(l.slutt_tid) : 'ute nå'}
                      </span>
                    </span>
                    <span className="hm-tall text-sm">
                      {antall !== null ? antallTekst(antall, enhet) : '–'}
                    </span>
                    <span className="hm-tall shrink-0 text-right font-semibold">
                      {belop !== null ? kr(belop) : 'mangler pris'}
                      {anslag && (
                        <span className="block text-[10px] font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
                          Løpende
                        </span>
                      )}
                      {l.manuelt_justert && (
                        <span className="block text-[10px] font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
                          Justert
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Kort>

      <Kort>
        <KortTittel>Navn og nummer</KortTittel>
        <RedigerProsjekt id={prosjekt.id} navn={prosjekt.navn} nummer={prosjekt.nummer} />
      </Kort>

      <div className="space-y-3">
        {prosjekt.aktiv && sum.ute > 0 && (
          <p className="border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
            {sum.ute} ting står fortsatt ute på prosjektet. Avslutter du det, blir
            de stående til de leveres – men ingen kan ta ut mer til det.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <form action={settProsjektAktiv.bind(null, prosjekt.id, !prosjekt.aktiv)}>
            <BekreftKnapp
              etikett={prosjekt.aktiv ? 'Avslutt prosjektet' : 'Åpne prosjektet igjen'}
              bekreft={prosjekt.aktiv ? 'Ja, avslutt' : 'Ja, åpne'}
            />
          </form>
          {leier.length === 0 && (
            <form action={slettProsjekt.bind(null, prosjekt.id)}>
              <BekreftKnapp etikett="Slett prosjektet" bekreft="Slett for godt" fare />
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
```

Opprett `src/app/admin/(panel)/prosjekter/[id]/loading.tsx`:

```tsx
import { DetaljSkjelett } from '@/components/skjelett'

export default function Laster() {
  return <DetaljSkjelett kort={3} />
}
```

I `src/app/admin/(panel)/meny.tsx`, finn:

```ts
  { href: '/admin/leier', tekst: 'Leier' },
```

Erstatt med:

```ts
  { href: '/admin/leier', tekst: 'Leier' },
  { href: '/admin/prosjekter', tekst: 'Prosjekter' },
```

- [ ] **Steg 9: Verifiser**

```bash
npx next typegen
```
```bash
npx tsc --noEmit
```
```bash
npm run lint
```
```bash
npm test
```

Forventet: alt grønt.

- [ ] **Steg 10: Commit**

```bash
git add src/lib/pris.ts src/lib/pris.test.mjs "src/app/admin/(panel)/prosjekter" "src/app/admin/(panel)/meny.tsx"
git commit -m "Prosjekter i adminpanelet, med internleie per prosjekt" -m "Lista viser hva hvert prosjekt har brukt – levert, pluss et løpende anslag for det som er ute – og sier fra når en maskin mangler pris. Prosjekter avsluttes, og kan bare slettes når ingenting er ført på dem." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Oppgave 10: Interne leier i oversikt, leieliste, kalender, maskinside og verksted

**Filer:**
- Endre: `src/app/admin/(panel)/page.tsx`, `leier/page.tsx`, `kalender/page.tsx`, `maskiner/[id]/page.tsx`
- Endre: `src/lib/verksted-data.ts`

**Grensesnitt:**
- Bruker: `LEIETAKER_FELT`, `leietaker`, `leietakerTekst`, `type LeietakerKilde` (leietaker),
  `type LeieRad` (types), `visTelefon` (telefon).

- [ ] **Steg 1: Oversikten**

I `src/app/admin/(panel)/page.tsx`, finn:

```ts
import { erForfalt, type Kunde, type Leie, type Maskin } from '@/lib/types'
```

Erstatt med:

```ts
import { erForfalt, type LeieRad } from '@/lib/types'
import { LEIETAKER_FELT, leietaker, leietakerTekst } from '@/lib/leietaker'
```

Finn `type Rad = Leie & { maskiner: Maskin | null; kunder: Kunde | null }`,
erstatt med `type Rad = LeieRad`.

Erstatt alle tre forekomster av `.select('*, maskiner(*), kunder(*)')` med
``.select(`*, maskiner(*), ${LEIETAKER_FELT}`)`` (Edit med `replace_all`).

Finn:

```ts
      .eq('status', 'avsluttet')
      .eq('fakturert', false)
```

Erstatt med:

```ts
      .eq('status', 'avsluttet')
      .eq('fakturert', false)
      // Internleier faktureres ikke – de føres på prosjektet.
      .is('ansatt_id', null)
```

Finn:

```tsx
                  <span className="text-sm text-[var(--blekk-svak)]">
                    {l.kunder?.navn ?? '–'}
                  </span>
```

Erstatt med:

```tsx
                  <span className="text-sm text-[var(--blekk-svak)]">
                    {leietakerTekst(l)}
                  </span>
```

Finn:

```tsx
                  <span className="text-sm">
                    {l.kunder?.navn ?? '–'}
                    {l.kunder && (
                      <span className="hm-tall text-[var(--blekk-svak)]">
                        {' · '}
                        {visTelefon(l.kunder.telefon)}
                      </span>
                    )}
                  </span>
```

Erstatt med:

```tsx
                  <span className="text-sm">
                    {leietakerTekst(l)}
                    {leietaker(l).telefon && (
                      <span className="hm-tall text-[var(--blekk-svak)]">
                        {' · '}
                        {visTelefon(leietaker(l).telefon!)}
                      </span>
                    )}
                  </span>
```

Finn:

```tsx
                        <span className="block truncate text-sm text-[var(--blekk-svak)]">
                          {l.kunder?.navn ?? '–'}
                        </span>
```

Erstatt med:

```tsx
                        <span className="block truncate text-sm text-[var(--blekk-svak)]">
                          {leietakerTekst(l)}
                        </span>
```

«Klar til fakturering» har bare kundeleier nå, og beholder `l.kunder?.navn`.

- [ ] **Steg 2: Leielista**

I `src/app/admin/(panel)/leier/page.tsx`, finn:

```ts
import {
  LEIE_MERKE,
  LEIE_STATUS_TEKST,
  erForfalt,
  type Leie,
  type Kunde,
  type Maskin,
} from '@/lib/types'
```

Erstatt med:

```ts
import { LEIE_MERKE, LEIE_STATUS_TEKST, erForfalt, type LeieRad } from '@/lib/types'
import { LEIETAKER_FELT, leietaker } from '@/lib/leietaker'
```

Finn `type Rad = Leie & { maskiner: Maskin | null; kunder: Kunde | null }`,
erstatt med `type Rad = LeieRad`.

Finn `.select('*, maskiner(*), kunder(*)')`, erstatt med
``.select(`*, maskiner(*), ${LEIETAKER_FELT}`)``.

Finn:

```ts
    spørring = spørring.eq('status', 'avsluttet').eq('fakturert', false)
```

Erstatt med:

```ts
    // Internleier faktureres ikke – de føres på prosjektet.
    spørring = spørring.eq('status', 'avsluttet').eq('fakturert', false).is('ansatt_id', null)
```

Finn:

```ts
        l.kunder?.navn,
        l.kunder?.telefon,
        l.kunder?.epost,
```

Erstatt med:

```ts
        l.kunder?.navn,
        l.kunder?.telefon,
        l.kunder?.epost,
        l.ansatt?.navn,
        l.prosjekter?.navn,
        l.prosjekter?.nummer,
```

Finn `plassholder="Søk på navn, referanse, maskin eller telefon"`, erstatt med
`plassholder="Søk på navn, referanse, maskin, telefon eller prosjekt"`.

Finn `<Th>Kunde</Th>`, erstatt med `<Th>Leietaker</Th>`.

Finn:

```tsx
                  <td className="px-4 py-3">
                    <div>{l.kunder?.navn ?? '–'}</div>
                    {l.kunder && (
                      <div className="hm-tall text-xs text-[var(--blekk-svak)]">
                        {visTelefon(l.kunder.telefon)}
                      </div>
                    )}
                  </td>
```

Erstatt med:

```tsx
                  <td className="px-4 py-3">
                    <Leietaker l={l} />
                  </td>
```

Finn:

```tsx
                      {l.status === 'avsluttet' &&
                        (l.fakturert ? (
```

Erstatt med:

```tsx
                      {l.status === 'avsluttet' &&
                        !l.ansatt_id &&
                        (l.fakturert ? (
```

Legg til nederst i fila:

```tsx
/** Kunden med telefon, eller den ansatte med prosjektet. */
function Leietaker({ l }: { l: Rad }) {
  const t = leietaker(l)
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {t.navn}
        {t.intern && <Merke>Intern</Merke>}
      </div>
      {t.prosjekt ? (
        <div className="text-xs text-[var(--blekk-svak)]">{t.prosjekt}</div>
      ) : (
        t.telefon && (
          <div className="hm-tall text-xs text-[var(--blekk-svak)]">
            {visTelefon(t.telefon)}
          </div>
        )
      )}
    </>
  )
}
```

- [ ] **Steg 3: Kalenderen**

I `src/app/admin/(panel)/kalender/page.tsx`, finn:

```ts
import { LEIE_STATUS_TEKST, erForfalt, type Kunde, type Leie, type Maskin } from '@/lib/types'
```

Erstatt med:

```ts
import { LEIE_STATUS_TEKST, erForfalt, type Leie, type LeieRad } from '@/lib/types'
import { LEIETAKER_FELT, leietaker, leietakerTekst } from '@/lib/leietaker'
```

Finn `type Rad = Leie & { maskiner: Maskin | null; kunder: Kunde | null }`,
erstatt med `type Rad = LeieRad`.

Finn `.select('*, maskiner(*), kunder(*)')`, erstatt med
``.select(`*, maskiner(*), ${LEIETAKER_FELT}`)``.

Finn `${l.maskiner?.navn} · ${l.kunder?.navn ?? ''} ·`, erstatt med
`${l.maskiner?.navn} · ${leietakerTekst(l)} ·`.

Finn:

```tsx
                        {l.kunder?.navn ?? '–'}
                        {l.kunder && ` · ${visTelefon(l.kunder.telefon)}`}
```

Erstatt med:

```tsx
                        {leietakerTekst(l)}
                        {leietaker(l).telefon && ` · ${visTelefon(leietaker(l).telefon!)}`}
```

- [ ] **Steg 4: Maskinsiden i admin**

I `src/app/admin/(panel)/maskiner/[id]/page.tsx`, finn:

```ts
import { LEIE_STATUS_TEKST, MASKIN_STATUS_TEKST, type Leie, type Kunde, type Maskin } from '@/lib/types'
```

Erstatt med:

```ts
import { LEIE_STATUS_TEKST, MASKIN_STATUS_TEKST, type LeieRad, type Maskin } from '@/lib/types'
import { LEIETAKER_FELT, leietakerTekst } from '@/lib/leietaker'
```

Finn `.select('*, kunder(*)')`, erstatt med ``.select(`*, ${LEIETAKER_FELT}`)``.

Finn:

```ts
  const leier = (leieRader ?? []) as (Leie & { kunder: Kunde | null })[]
```

Erstatt med:

```ts
  const leier = (leieRader ?? []) as unknown as Omit<LeieRad, 'maskiner'>[]
```

Finn (i «Siste leier»):

```tsx
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {l.kunder?.navn ?? '–'}
                  </span>
```

Erstatt med:

```tsx
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {leietakerTekst(l)}
                  </span>
```

`Leie` og `Kunde` ble bare brukt i castingen over, så de skal ut av importen.

- [ ] **Steg 5: Verkstedlista**

I `src/lib/verksted-data.ts`, finn:

```ts
import type { Maskin } from '@/lib/types'
```

Erstatt med:

```ts
import type { Maskin } from '@/lib/types'
import { leietakerTekst, type LeietakerKilde } from '@/lib/leietaker'
```

Finn:

```ts
      .select('maskin_id, planlagt_slutt, kunder(navn)')
```

Erstatt med:

```ts
      .select(
        'maskin_id, planlagt_slutt, ansatt_id, kunder(navn, telefon), ansatt:admin_brukere!leier_ansatt_id_fkey(navn, telefon), prosjekter(navn, nummer)',
      )
```

Finn:

```ts
      kunde: (l.kunder as unknown as { navn: string } | null)?.navn ?? null,
```

Erstatt med:

```ts
      // Kunden, eller «Ola Nordmann · Kvamsøy bru» for internleier.
      kunde: leietakerTekst(l as unknown as LeietakerKilde),
```

- [ ] **Steg 6: Sjekk spørringene mot databasen**

```bash
node --env-file=.env.local --input-type=module <<'EOF'
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const FELT = 'kunder(*), ansatt:admin_brukere!leier_ansatt_id_fkey(navn, telefon, epost), prosjekter(navn, nummer)'
const sjekker = {
  'oversikt/leier/kalender': db.from('leier').select(`*, maskiner(*), ${FELT}`).limit(1),
  'maskinside': db.from('leier').select(`*, ${FELT}`).limit(1),
  'verksted': db.from('leier').select('maskin_id, planlagt_slutt, ansatt_id, kunder(navn, telefon), ansatt:admin_brukere!leier_ansatt_id_fkey(navn, telefon), prosjekter(navn, nummer)').limit(1),
  'ufakturert': db.from('leier').select('id').eq('status', 'avsluttet').eq('fakturert', false).is('ansatt_id', null).limit(1),
  'prosjektliste': db.from('leier').select('prosjekt_id, status, start_tid, belop, maskiner(dogn_pris, pris_enhet)').not('prosjekt_id', 'is', null).limit(1),
  'prosjektside': db.from('leier').select('id, referanse, status, start_tid, slutt_tid, antall_dogn, belop, manuelt_justert, maskiner(navn, dogn_pris, pris_enhet), ansatt:admin_brukere!leier_ansatt_id_fkey(navn)').limit(1),
  'qr-side': db.from('leier').select('*, ansatt:admin_brukere!leier_ansatt_id_fkey(navn), prosjekter(navn, nummer)').limit(1),
}
for (const [navn, q] of Object.entries(sjekker)) {
  const { error } = await q
  console.log(error ? `✗ ${navn}: ${error.message}` : `✓ ${navn}`)
}
EOF
```

Forventet: sju ✓.

- [ ] **Steg 7: Verifiser**

```bash
npx tsc --noEmit
```
```bash
npm run lint
```

Forventet: ingen feil. `visTelefon` brukes fortsatt i alle fire filene.

- [ ] **Steg 8: Commit**

```bash
git add "src/app/admin/(panel)/page.tsx" "src/app/admin/(panel)/leier/page.tsx" "src/app/admin/(panel)/kalender/page.tsx" "src/app/admin/(panel)/maskiner/[id]/page.tsx" src/lib/verksted-data.ts
git commit -m "Internleier i oversikten, leielista, kalenderen og verkstedet" -m "Der kunden sto, står nå den ansatte og prosjektet, merket «Intern». «Ikke fakturert» holder dem utenfor – de skal aldri faktureres. Søket i leielista finner også ansatt og prosjekt." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Oppgave 11: Leiesiden for en internleie

**Filer:**
- Endre: `src/app/admin/(panel)/leier/[id]/page.tsx`, `actions.ts`, `manuell-levering.tsx`
- Opprett: `src/app/admin/(panel)/leier/[id]/rett-internpris.tsx`

**Grensesnitt:**
- Bruker: `beregnPris` (pris), `LEIETAKER_FELT`, `leietaker` (leietaker), `avsluttInternLeie` (intern-leie).
- Produserer: `rettInternpris(leieId: string, forrige: GodkjennTilstand, formData: FormData): Promise<GodkjennTilstand>`;
  `ManuellLevering({ leieId, intern })`; `RettInternpris({ leieId, antall, belop, antallEtikett })`.

- [ ] **Steg 1: Handlingene**

I `src/app/admin/(panel)/leier/[id]/actions.ts`, finn:

```ts
import { slettLeierMedFiler } from '@/lib/slett'
```

Erstatt med:

```ts
import { slettLeierMedFiler } from '@/lib/slett'
import { avsluttInternLeie } from '@/lib/intern-leie'
```

Finn:

```ts
export async function registrerLeveringManuelt(leieId: string) {
  const admin = await krevAdmin()
  const supabase = await lagServerKlient()

  // `.eq('status','aktiv')` gjør det trygt om kunden rakk å levere selv i
  // mellomtiden – da treffer vi ingen rad og gjør ingenting.
  const { data: oppdatert } = await supabase
```

Erstatt med:

```ts
export async function registrerLeveringManuelt(leieId: string) {
  const admin = await krevAdmin()
  const supabase = await lagServerKlient()

  const { data: leie } = await supabase
    .from('leier')
    .select('ansatt_id')
    .eq('id', leieId)
    .maybeSingle()
  if (!leie) return

  // Internleier har ingen godkjenning å gå til. De avsluttes med utregnet
  // pris, akkurat som når den ansatte leverer selv.
  if (leie.ansatt_id) {
    await avsluttInternLeie({ leieId, aktor: `admin:${admin.epost}` })
    revalidatePath('/admin')
    revalidatePath('/admin/leier')
    revalidatePath(`/admin/leier/${leieId}`)
    return
  }

  // `.eq('status','aktiv')` gjør det trygt om kunden rakk å levere selv i
  // mellomtiden – da treffer vi ingen rad og gjør ingenting.
  const { data: oppdatert } = await supabase
```

Legg til nederst i fila:

```ts
const rettSkjema = z.object({
  antall_dogn: desimal,
  belop: desimal,
})

/**
 * Retter antall og beløp på en levert internleie.
 *
 * Internleier regnes ut automatisk ved levering uten at noen ser over
 * dem, så dette er stedet admin overstyrer – for eksempel når maskinen
 * manglet pris.
 */
export async function rettInternpris(
  leieId: string,
  _forrige: GodkjennTilstand,
  formData: FormData,
): Promise<GodkjennTilstand> {
  const admin = await krevAdmin()

  const felter = rettSkjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const supabase = await lagServerKlient()
  const { data: oppdatert, error } = await supabase
    .from('leier')
    .update({
      antall_dogn: felter.data.antall_dogn,
      belop: felter.data.belop,
      manuelt_justert: true,
    })
    .eq('id', leieId)
    .eq('status', 'avsluttet')
    .not('ansatt_id', 'is', null)
    .select('id')

  if (error) return { feil: `Kunne ikke lagre: ${error.message}` }
  if (!oppdatert?.length) return { feil: 'Fant ikke en levert internleie å rette.' }

  await supabase.from('hendelser').insert({
    leie_id: leieId,
    type: 'justert',
    beskrivelse: 'Antall og beløp rettet',
    aktor: `admin:${admin.epost}`,
  })

  revalidatePath(`/admin/leier/${leieId}`)
  revalidatePath('/admin/prosjekter', 'layout')
  return { ok: 'Lagret.' }
}
```

- [ ] **Steg 2: Skjemaet for retting**

Opprett `src/app/admin/(panel)/leier/[id]/rett-internpris.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { ETIKETT, FELT, KNAPP_SEKUNDÆR, Kort, KortTittel } from '@/components/ui'
import { rettInternpris, type GodkjennTilstand } from './actions'

const start: GodkjennTilstand = {}

export function RettInternpris({
  leieId,
  antall,
  belop,
  antallEtikett,
}: {
  leieId: string
  antall: number | null
  belop: number | null
  antallEtikett: string
}) {
  const [tilstand, handling, venter] = useActionState(rettInternpris.bind(null, leieId), start)

  return (
    <Kort>
      <KortTittel>Rett antall og beløp</KortTittel>
      <form action={handling} className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label>
          <span className={ETIKETT}>{antallEtikett}</span>
          <input
            name="antall_dogn"
            inputMode="decimal"
            defaultValue={antall ?? ''}
            className={FELT}
          />
        </label>
        <label>
          <span className={ETIKETT}>Beløp (kr)</span>
          <input name="belop" inputMode="decimal" defaultValue={belop ?? ''} className={FELT} />
        </label>
        <button type="submit" disabled={venter} className={KNAPP_SEKUNDÆR}>
          {venter ? 'Lagrer …' : 'Lagre'}
        </button>
        {tilstand.feil && (
          <p
            role="alert"
            className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink sm:col-span-3"
          >
            {tilstand.feil}
          </p>
        )}
        {tilstand.ok && (
          <p role="status" className="text-sm font-semibold text-hm-green sm:col-span-3">
            {tilstand.ok}
          </p>
        )}
      </form>
    </Kort>
  )
}
```

- [ ] **Steg 3: Manuell levering sier hva som skjer**

I `src/app/admin/(panel)/leier/[id]/manuell-levering.tsx`, finn:

```tsx
export function ManuellLevering({ leieId }: { leieId: string }) {
  const [bekrefter, settBekrefter] = useState(false)

  return (
    <section className="border-2 border-[var(--kant)] bg-[var(--flate-opp)] p-5">
      <h2 className="hm-display text-lg">Kunden får ikke levert selv?</h2>
      <p className="mt-1 mb-4 text-sm text-[var(--blekk-svak)]">
        Du kan registrere leveringen på kundens vegne. Klokka stopper nå, og
        leien går til godkjenning der du setter døgn og beløp.
      </p>
```

Erstatt med:

```tsx
export function ManuellLevering({ leieId, intern }: { leieId: string; intern: boolean }) {
  const [bekrefter, settBekrefter] = useState(false)

  return (
    <section className="border-2 border-[var(--kant)] bg-[var(--flate-opp)] p-5">
      <h2 className="hm-display text-lg">
        {intern ? 'Levert uten at det er registrert?' : 'Kunden får ikke levert selv?'}
      </h2>
      <p className="mt-1 mb-4 text-sm text-[var(--blekk-svak)]">
        {intern
          ? 'Du kan registrere leveringen på den ansattes vegne. Klokka stopper nå, prisen føres på prosjektet, og maskinen blir ledig.'
          : 'Du kan registrere leveringen på kundens vegne. Klokka stopper nå, og leien går til godkjenning der du setter døgn og beløp.'}
      </p>
```

- [ ] **Steg 4: Sida**

I `src/app/admin/(panel)/leier/[id]/page.tsx`, finn:

```ts
import { antallEtikett, antallTekst, beregnAntall, prisEnhet } from '@/lib/pris'
```

Erstatt med:

```ts
import { antallEtikett, antallTekst, beregnPris, prisEnhet } from '@/lib/pris'
```

Finn:

```ts
import { LEIE_STATUS_TEKST, type Bilde, type Kunde, type Leie, type Maskin } from '@/lib/types'
```

Erstatt med:

```ts
import { LEIE_STATUS_TEKST, type Bilde, type LeieRad } from '@/lib/types'
import { LEIETAKER_FELT, leietaker } from '@/lib/leietaker'
```

Finn:

```ts
import { SlettLeie } from './slett-leie'
```

Erstatt med:

```ts
import { SlettLeie } from './slett-leie'
import { RettInternpris } from './rett-internpris'
```

Finn:

```ts
    .select('*, maskiner(*), kunder(*)')
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()
  const leie = data as Leie & { maskiner: Maskin | null; kunder: Kunde | null }
```

Erstatt med:

```ts
    .select(`*, maskiner(*), ${LEIETAKER_FELT}`)
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()
  const leie = data as unknown as LeieRad
  // Internleier har ansatt og prosjekt i stedet for kunde, og faktureres ikke.
  const intern = Boolean(leie.ansatt_id)
  const t = leietaker(leie)
```

Finn:

```ts
  const sluttForBeregning = leie.slutt_tid ?? new Date().toISOString()
  const enhet = prisEnhet(leie.maskiner?.pris_enhet)
  const foreslattDogn = beregnAntall(leie.start_tid, sluttForBeregning, enhet)
  const foreslattBelop = leie.maskiner?.dogn_pris
    ? Math.round(foreslattDogn * leie.maskiner.dogn_pris)
    : null
```

Erstatt med:

```ts
  const enhet = prisEnhet(leie.maskiner?.pris_enhet)
  // Samme regel som når en ansatt leverer – se beregnPris.
  const { antall: foreslattDogn, belop: foreslattBelop } = beregnPris(
    leie.start_tid,
    leie.slutt_tid ?? new Date().toISOString(),
    enhet,
    leie.maskiner?.dogn_pris ?? null,
  )
```

Finn:

```tsx
      {leie.status === 'aktiv' && <ManuellLevering leieId={leie.id} />}
```

Erstatt med:

```tsx
      {leie.status === 'aktiv' && <ManuellLevering leieId={leie.id} intern={intern} />}
```

Finn:

```tsx
        <Kort>
          <KortTittel>Kunde</KortTittel>
          <div className="p-5">
            {leie.kunder ? (
```

Erstatt med:

```tsx
        <Kort>
          <KortTittel>{intern ? 'Ansatt og prosjekt' : 'Kunde'}</KortTittel>
          <div className="p-5">
            {intern ? (
              <dl className="space-y-2.5 text-sm">
                <Rad navn="Ansatt" verdi={t.navn} />
                <Rad navn="Mobil" verdi={t.telefon ? visTelefon(t.telefon) : '–'} />
                <Rad
                  navn="Prosjekt"
                  verdi={
                    <Link
                      href={`/admin/prosjekter/${leie.prosjekt_id}`}
                      className="underline underline-offset-4"
                    >
                      {t.prosjekt ?? 'Prosjekt'}
                    </Link>
                  }
                />
              </dl>
            ) : leie.kunder ? (
```

Finn:

```tsx
      {leie.status === 'avsluttet' && (
        <Kort>
          <KortTittel>Fakturagrunnlag</KortTittel>
```

Erstatt med:

```tsx
      {leie.status === 'avsluttet' && intern && (
        <RettInternpris
          leieId={leie.id}
          antall={leie.antall_dogn}
          belop={leie.belop}
          antallEtikett={antallEtikett(enhet)}
        />
      )}

      {leie.status === 'avsluttet' && !intern && (
        <Kort>
          <KortTittel>Fakturagrunnlag</KortTittel>
```

- [ ] **Steg 5: Verifiser**

```bash
npx tsc --noEmit
```
```bash
npm run lint
```
```bash
npm test
```

Forventet: alt grønt.

- [ ] **Steg 6: Commit**

```bash
git add "src/app/admin/(panel)/leier/[id]/page.tsx" "src/app/admin/(panel)/leier/[id]/actions.ts" "src/app/admin/(panel)/leier/[id]/manuell-levering.tsx" "src/app/admin/(panel)/leier/[id]/rett-internpris.tsx"
git commit -m "Leiesiden viser ansatt og prosjekt for internleier" -m "Ingen fakturagrunnlag, men admin kan rette antall og beløp etterpå, og registrere levering på vegne av en ansatt. Forslaget til kunder bruker nå samme prisregel som internleia." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Oppgave 12: Faktura, kalenderfeed og forfallsvarsel

**Filer:**
- Endre: `src/app/api/faktura/[id]/route.ts`, `src/app/api/ical/[fil]/route.ts`, `src/lib/epost/varsler.ts`

- [ ] **Steg 1: Faktura avviser internleier**

I `src/app/api/faktura/[id]/route.ts`, finn:

```ts
  const leie = data as Leie & { maskiner: Maskin | null; kunder: Kunde | null }
```

Erstatt med:

```ts
  const leie = data as Leie & { maskiner: Maskin | null; kunder: Kunde | null }

  // Internleier faktureres ikke – de føres på prosjektet.
  if (leie.ansatt_id) {
    return new Response('Internleier har ikke fakturagrunnlag.', { status: 404 })
  }
```

- [ ] **Steg 2: Kalenderfeeden**

I `src/app/api/ical/[fil]/route.ts`, finn:

```ts
import { erForfalt, type Kunde, type Leie, type Maskin } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Rad = Leie & { maskiner: Maskin | null; kunder: Kunde | null }
```

Erstatt med:

```ts
import { erForfalt, type LeieRad } from '@/lib/types'
import { LEIETAKER_FELT, leietaker, leietakerTekst } from '@/lib/leietaker'

export const dynamic = 'force-dynamic'

type Rad = LeieRad
```

Finn `.select('*, maskiner(*), kunder(*)')`, erstatt med
``.select(`*, maskiner(*), ${LEIETAKER_FELT}`)``.

Finn:

```ts
    const beskrivelse = [
      l.kunder ? `Kunde: ${l.kunder.navn}` : null,
      l.kunder ? `Mobil: ${visTelefon(l.kunder.telefon)}` : null,
      l.kunder ? `E-post: ${l.kunder.epost}` : null,
```

Erstatt med:

```ts
    const t = leietaker(l)
    const beskrivelse = [
      t.intern ? `Intern: ${t.navn}` : `Kunde: ${t.navn}`,
      t.prosjekt ? `Prosjekt: ${t.prosjekt}` : null,
      t.telefon ? `Mobil: ${visTelefon(t.telefon)}` : null,
      l.kunder ? `E-post: ${l.kunder.epost}` : null,
```

Finn:

```ts
      title: `${forfalt ? '⚠ ' : ''}${l.maskiner?.navn ?? 'Maskin'} – ${l.kunder?.navn ?? 'ukjent'}`,
```

Erstatt med:

```ts
      title: `${forfalt ? '⚠ ' : ''}${l.maskiner?.navn ?? 'Maskin'} – ${leietakerTekst(l)}`,
```

- [ ] **Steg 3: Forfallsvarselet**

I `src/lib/epost/varsler.ts`, finn:

```ts
import type { Kunde, Leie, Maskin } from '@/lib/types'
```

Erstatt med:

```ts
import type { Kunde, Leie, LeieRad, Maskin } from '@/lib/types'
```

Finn:

```ts
import { LEIETAKER_FELT, leietaker, type LeietakerKilde } from '@/lib/leietaker'
```

Erstatt med:

```ts
import {
  LEIETAKER_FELT,
  leietaker,
  leietakerTekst,
  type LeietakerKilde,
} from '@/lib/leietaker'
```

Finn:

```ts
    .select('*, maskiner(*), kunder(*)')
    .eq('status', 'aktiv')
    .lt('planlagt_slutt', new Date().toISOString())
```

Erstatt med:

```ts
    .select(`*, maskiner(*), ${LEIETAKER_FELT}`)
    .eq('status', 'aktiv')
    .lt('planlagt_slutt', new Date().toISOString())
```

Finn:

```ts
  const forfalte = (data ?? []) as (Leie & {
    maskiner: Maskin | null
    kunder: Kunde | null
  })[]
```

Erstatt med:

```ts
  // Internleier med passert dato er med – admin vil vite at en ansatt har
  // noe på overtid. Purringen under går bare til kunder.
  const forfalte = (data ?? []) as unknown as LeieRad[]
```

Finn:

```ts
        kunde: l.kunder?.navn ?? '–',
        telefon: l.kunder?.telefon ?? '–',
```

Erstatt med:

```ts
        kunde: leietakerTekst(l),
        telefon: leietaker(l).telefon ?? '–',
```

- [ ] **Steg 4: Sjekk spørringen for forfall**

```bash
node --env-file=.env.local --input-type=module <<'EOF'
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const FELT = 'kunder(*), ansatt:admin_brukere!leier_ansatt_id_fkey(navn, telefon, epost), prosjekter(navn, nummer)'
const { error } = await db.from('leier').select(`*, maskiner(*), ${FELT}`).eq('status', 'aktiv').lt('planlagt_slutt', new Date().toISOString()).limit(1)
console.log(error ? `✗ forfall: ${error.message}` : '✓ forfall')
EOF
```

Forventet: `✓ forfall`.

- [ ] **Steg 5: Verifiser**

```bash
npx tsc --noEmit
```
```bash
npm run lint
```

Forventet: ingen feil.

- [ ] **Steg 6: Commit**

```bash
git add "src/app/api/faktura/[id]/route.ts" "src/app/api/ical/[fil]/route.ts" src/lib/epost/varsler.ts
git commit -m "Faktura, kalenderfeed og forfallsvarsel kjenner internleier" -m "Fakturaruta avviser dem. Feeden og forfallsoversikten viser den ansatte og prosjektet der kunden sto. Purring går fortsatt bare til kunder." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Oppgave 13: README, full verifisering og push

**Filer:**
- Endre: `README.md`
- Opprett ved behov (ikke commit): `.claude/launch.json`

- [ ] **Steg 1: README**

I `README.md`, finn:

```
src/app/admin/         Adminpanel, krever innlogging
```

Erstatt med:

```
src/app/ansatt/        Uttak til prosjekter for egne folk, krever innlogging
src/app/admin/         Adminpanel, krever innlogging
```

Finn:

```
## Slå på e-postvarsling (utsatt – gjøres når det passer)
```

Erstatt med:

```
## Roller

| Rolle | Kommer inn på | Kan ta ut utstyr til prosjekter |
|---|---|---|
| Admin | alt | ja |
| Servicearbeider | verkstedet | ja |
| Ansatt | `/ansatt` | ja |

Brukere lages under `/admin/brukere` med et midlertidig passord, som må
byttes ved første innlogging. Prosjektene de ansatte velger mellom, legges
inn under `/admin/prosjekter`. Internleie regnes ut når utstyret leveres,
og summeres per prosjekt – den faktureres ikke.

## Slå på e-postvarsling (utsatt – gjøres når det passer)
```

Finn:

```
`src/proxy.ts` frisker kun opp sesjonen. Selve tilgangskontrollen ligger i
adminlayouten og i hver enkelt server action – server actions kjører som POST
mot siden de brukes fra, og kan derfor ikke sikres av proxy alene.
```

Erstatt med:

```
`src/proxy.ts` frisker kun opp sesjonen. Selve tilgangskontrollen ligger i
adminlayouten og i hver enkelt server action – server actions kjører som POST
mot siden de brukes fra, og kan derfor ikke sikres av proxy alene.

Radsikkerheten i databasen slipper bare rollen admin til (`er_admin()`, fra
migrasjon 0011). Service og ansatte kan lese sin egen brukerrad og ingenting
annet – alt de gjør, går gjennom server actions som sjekker tilgangen selv.
```

- [ ] **Steg 2: Full statisk verifisering**

```bash
npm test
```
```bash
npx next typegen
```
```bash
npx tsc --noEmit
```
```bash
npm run lint
```
```bash
npm run build
```

Forventet: alle tester PASS, ingen typefeil, ingen lintfeil, bygget grønt med
`ƒ /ansatt`, `ƒ /admin/prosjekter` og `ƒ /admin/prosjekter/[id]` i rutelista.

- [ ] **Steg 3: Migrasjonen og alle spørringer**

```bash
node --env-file=.env.local scripts/sjekk-migrasjoner.mjs
```

Forventet: «Alle migrasjoner er kjørt.» Kjør så sjekkskriptene fra oppgave 6
steg 7, oppgave 10 steg 6 og oppgave 12 steg 4 på nytt. Forventet: bare ✓.

- [ ] **Steg 4: Uinnlogget i nettleseren**

Finnes ikke `.claude/launch.json`, opprett den (sjekk `.gitignore` – den skal
ikke committes):

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "utleie-dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

Start med `preview_start` (navn `utleie-dev`) og sjekk:

1. `/m/<ledig kode>` (hent en med skriptet i oppgave 8 steg 4): kundeskjemaet,
   pris i toppen, «Ansatt? Logg inn» nederst. **Ikke send skjemaet.**
2. «Ansatt? Logg inn» går til en side med overskriften «Logg inn», og
   adressen har `neste=%2Fm%2F<kode>`.
3. `/retur`: «Ansatt? Logg inn» nederst.
4. `/ansatt` sender til `/admin/logg-inn?neste=/ansatt`.
5. `/verksted` viser lista og «Logg inn» øverst. Lenken har `neste=/verksted`.
6. `/admin/logg-inn?neste=//evil.no` – skjemaet har ikke et skjult felt `neste`
   (sjekk med `read_page`).
7. Nettleserkonsollen: ingen nye feil. (Hydreringsfeil fra `Lukkar` er kjent
   fra før – se minnet `worktree-verifisering`.)

- [ ] **Steg 5: Commit README**

```bash
git add README.md
git commit -m "README: roller og internleie" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Steg 6: STOPP – spør Thomas om testing før push**

Vis Thomas sjekklista under, og spør: «Vil du gå gjennom den i nettleseren
her før jeg pusher, eller skal jeg pushe nå og så tester du i produksjon?»
Ingen ansatte har tilgang før noen får rollen, så de nye sidene er usynlige
for alle andre til da. Det som endres for alle med én gang, er adminpanelet –
og spørringene der er sjekket i steg 3.

> **Sjekkliste – innlogget (Thomas)**
>
> 1. **Admin → Prosjekter:** legg inn «TEST – slett meg».
> 2. **Admin → Brukere:** ny bruker med rollen Ansatt, et mobilnummer og et
>    midlertidig passord. Bruk en e-postadresse du har, f.eks. med `+ansatt`.
> 3. **Privat vindu:** logg inn som testbrukeren. Du skal måtte bytte passord,
>    og så havne på `/ansatt`.
> 4. **Ta ut:** kryss av én ting, velg testprosjektet, sett en dato, ta ut.
>    Kryss av én til uten dato, ta ut. Begge skal stå under «Hos deg nå».
> 5. **QR:** åpne `/m/<kode>` for den ene. Det skal stå «Du har denne på TEST –
>    slett meg», med en Lever-knapp.
> 6. **Lever** den ene med merknaden «test». Den forsvinner fra «Hos deg nå»,
>    og varseladressen får e-post hvis returvarsel er slått på.
> 7. **Som testbrukeren:** `/admin` og `/admin/leier` sender til `/ansatt`.
>    `/api/faktura/<en leie-id>` gir 401.
> 8. **Som admin:**
>    - Prosjekter viser testprosjektet med sum og «løpende».
>    - Leier viser «Intern».
>    - «Ikke fakturert» viser dem ikke.
>    - Leiesiden viser «Ansatt og prosjekt» og «Rett antall og beløp».
>    - Registrer levering på den som fortsatt er ute.
> 9. **Tilgang i databasen**, i SQL Editor (bytt inn testbrukerens id fra
>    `select id, navn, rolle from admin_brukere;`):
>    ```sql
>    begin;
>    set local role authenticated;
>    set local request.jwt.claims = '{"sub":"<id>","role":"authenticated"}';
>    select count(*) as kunder_synlige from kunder;   -- skal være 0
>    select count(*) as egne_rader from admin_brukere; -- skal være 1
>    rollback;
>    ```
> 10. **Rydd:** slett testleiene fra leiesiden, deretter testprosjektet, og
>     slett testbrukeren under Supabase → Authentication → Users.

- [ ] **Steg 7: Push**

Når Thomas har svart:

```bash
git status --short
```

Forventet: bare Thomas' egne ucommittede filer (`eslint.config.mjs`,
`tsconfig.json`, `src/app/globals.css`, `.vercelignore`, `promo/`, gamle
promo-docs) – ingenting fra denne planen.

```bash
git log --oneline origin/main..main
```

Forventet: spec- og plan-commitene, og én eller to per oppgave. Ingen andre.

```bash
git push origin main
```

- [ ] **Steg 8: Etter push**

Si fra til Thomas at Vercel bygger fra main nå, og at han kan gå gjennom
sjekklista i produksjon hvis han ikke gjorde det før push.

---

## Utenfor denne planen

- Flytte utstyr direkte mellom prosjekter.
- Eksport av prosjektsummer til Excel/CSV.
- Egen flis i Hauge Maskin-appen (`hauge-maskin-mobil`).
- Skjule kundenavn på den offentlige verkstedlista – foreslått som egen
  oppgave, gjelder også internleier etter denne planen.
