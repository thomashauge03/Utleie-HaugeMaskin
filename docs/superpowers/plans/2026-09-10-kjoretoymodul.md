# Kjøretøymodul — implementasjonsplan

> **For agentiske arbeidere:** PÅKREVD UNDERFERDIGHET: Bruk
> superpowers:subagent-driven-development (anbefalt) eller
> superpowers:executing-plans til å gjennomføre planen oppgave for oppgave.
> Stegene bruker avkryssingsbokser (`- [ ]`).

**Mål:** Et internt kjøretøyregister i adminpanelet med registreringsnummer,
EU-kontroll og andre frister, automatisk oppslag mot Statens vegvesen, og
e-postpåminnelse via Resend.

**Arkitektur:** Én ny tabell `kjoretoy` uten relasjoner til utleieparken. En
server-only klient mot Vegvesens åpne API som degraderer til manuell
innskriving når nøkkelen mangler. Én daglig cron som først frisker opp et
utvalg kjøretøy fra Vegvesen, så sender en samle-e-post — men bare på dager der
en frist faktisk treffer en terskel.

**Teknologi:** Next.js 16.2.12 (App Router, server actions), React 19.2.4,
Supabase (`@supabase/ssr`), zod 4, Tailwind v4, Resend.

**Spec:** `docs/superpowers/specs/2026-09-10-kjoretoy-design.md`

## Globale krav

Kopiert ordrett fra speccen og fra konvensjonene i repoet. Gjelder **hver**
oppgave under.

- **Språk i kode, UI-tekst og kommentarer er bokmål.** Ikke nynorsk. (Commit-
  emnene i historikken er delvis nynorsk — la det ikke smitte over i koden.)
- **Filnavn** er små bokstaver, kebab-case, ASCII-foldet: `nytt-kjoretoy.tsx`.
  **Identifikatorer beholder æøå**: `NyttKjøretøy`, `søk`, `åpen`.
  **DB-kolonner er ASCII-foldet norsk snake_case**: `reg_nr`, `arsmodell`.
- **Rutesegment:** `kjoretoy` (URL `/admin/kjoretoy`).
- `export const dynamic = 'force-dynamic'` på hver side og hver rutehåndterer.
- `params` og `searchParams` er **Promises** i Next 16 og må `await`-es.
  Synkron tilgang er fjernet, ikke bare frarådet.
- Prosjektet har **ikke** `cacheComponents` i `next.config.ts`. `use cache`,
  `cacheLife`, `cacheTag` og `updateTag` er utilgjengelige — ikke innfør dem.
  `revalidatePath` er riktig verktøy.
- `revalidatePath` kalles **før** `redirect`, og `redirect()` skal aldri stå
  inne i en `try`-blokk (den kaster `NEXT_REDIRECT`).
- **Hver side og hver server action** kaller tilgangssjekken som første
  setning. En server action er en POST-rute som kan treffes direkte utenfra.
- Bruk `lagServerKlient()` i sider og actions (anon + cookie ⇒ RLS gjelder).
  `supabaseAdmin` brukes kun i e-postlaget og i cron-ruten.
- Returform fra alle `useActionState`-actions: `{ feil?: string; ok?: string }`
  — én streng, aldri feil per felt. Bruk `felter.error.issues[0].message`.
- **Ingen avrunding** noe sted (`rounded*` gir null treff i repoet).
  `border-2`, `divide-y-2`, `border-l-4 border-hm-red` for feil,
  `border-l-4 border-hm-amber` for advarsel.
- **Ingen `dark:`-varianter.** Mørk modus skjer via `prefers-color-scheme` på
  de semantiske variablene i `globals.css`.
- **Ingen modaler.** «Nytt element» er inline utvidelse med lokal `useState`.
- **Ukontrollerte felt** (`name` + `defaultValue`), lest fra `FormData`.
  `useActionState`, aldri `useFormStatus`. Ventetilstand er tekstbytte
  («Lagrer …»), aldri spinner.
- **All datovisning** går gjennom `src/lib/dato.ts`. Ikke skriv nye
  datofunksjoner — `dagerTil()` gjør allerede det som trengs.
- Touch-mål `min-h-[2.75rem]`. Omsluttende `<label>`, ikke `htmlFor`.
  `aria-label` der etiketten er skjult.
- Kommentarstil: forklarer **hvorfor**, aldri hva koden gjør. JSDoc på hver
  eksportert hjelper. Seksjonsskiller med boksstreker.
- Tekst: `·` som skilletegn, `…` (ikke `...`), «» rundt brukerverdier.

## Om testing i dette repoet

**Repoet har ingen testkjører.** Ingen vitest, jest eller playwright i
`package.json`, og ingen testfiler. Planen innfører ikke en — det ville vært et
eget prosjekt, og et halvhjertet oppsett er verre enn ingen.

Verifiseringssyklusen som faktisk finnes, og som hver oppgave bruker:

```bash
npx tsc --noEmit
```
```bash
npm run lint
```

`PageProps<'/admin/kjoretoy'>` og typede `<Link href>` er **genererte** typer
som ikke finnes før `next dev`, `next build` eller `next typegen` har kjørt
etter at mappa er opprettet. Får du «Cannot find name 'PageProps'» eller en
`href`-typefeil på en nyopprettet rute, kjør:

```bash
npx next typegen
```

Repoets egen verifiseringsidiom er `scripts/sjekk-*.mjs` mot det levende
systemet. Oppgave 2 legger til én til, og den er det som avklarer punktene
speccen lister som ikke-verifiserte mot Vegvesens API.

---

## Filoversikt

**Nye filer**

| Fil | Ansvar |
|---|---|
| `supabase/migrations/0009_kjoretoy.sql` | tabell, indeks, RLS, ny kolonne på `innstillinger` |
| `src/lib/vegvesen.ts` | ett HTTP-oppslag mot SVV, oversatt til en union |
| `src/lib/frister.ts` | ren logikk: hvilke frister finnes, hvilke treffer terskel |
| `scripts/sjekk-vegvesen.mjs` | levende røyktest av SVV-nøkkelen |
| `src/app/admin/(panel)/kjoretoy/page.tsx` | liste, søk, filter |
| `src/app/admin/(panel)/kjoretoy/actions.ts` | `opprettKjøretøy` |
| `src/app/admin/(panel)/kjoretoy/nytt-kjoretoy.tsx` | inline opprettskjema |
| `src/app/admin/(panel)/kjoretoy/loading.tsx` | listeskjelett |
| `src/app/admin/(panel)/kjoretoy/[id]/page.tsx` | detalj |
| `src/app/admin/(panel)/kjoretoy/[id]/actions.ts` | lagre, slett, oppdater fra SVV |
| `src/app/admin/(panel)/kjoretoy/[id]/rediger-skjema.tsx` | redigeringsskjema |
| `src/app/admin/(panel)/kjoretoy/[id]/loading.tsx` | detaljskjelett |
| `src/app/verksted/kjoretoy/page.tsx` | skrivebeskyttet liste |
| `src/app/verksted/kjoretoy/loading.tsx` | listeskjelett |
| `src/app/api/kjoretoy/oppdater/route.ts` | cron: oppfrisk + varsle |

**Endrede filer**

| Fil | Endring |
|---|---|
| `src/lib/types.ts` | `Kjøretøy`, `KjøretøyStatus`, teksttabeller |
| `src/lib/epost/send.ts` | ny `Varseltype`, nytt felt i `Innstillinger` |
| `src/lib/epost/maler.ts` | `euKontrollAdmin` |
| `src/lib/epost/varsler.ts` | `varsleEuKontroll` |
| `src/app/admin/(panel)/meny.tsx` | ny lenke |
| `src/app/admin/(panel)/page.tsx` | «Frister» i Krever handling |
| `src/app/admin/(panel)/innstillinger/varsel-skjema.tsx` | ny bryter |
| `src/app/admin/(panel)/innstillinger/actions.ts` | nytt felt i skjema + update |
| `src/app/admin/(panel)/innstillinger/page.tsx` | send nytt felt inn i `Varsling` |
| `src/app/verksted/page.tsx` | lenke til kjøretøylista |
| `src/app/personvern/page.tsx` | én setning om ansvarlig person |
| `scripts/sjekk-migrasjoner.mjs` | ny rad |
| `vercel.json` | ny cron |
| `supabase/KJOR-DENNE.sql` | regenereres, redigeres aldri for hånd |

---

## Oppgave 1: Migrasjon og typer

Ingenting annet kan bygges før tabellen finnes. Denne oppgaven leverer
skjemaet og TypeScript-speilet av det.

**Filer:**
- Opprett: `supabase/migrations/0009_kjoretoy.sql`
- Endre: `scripts/sjekk-migrasjoner.mjs:19-28`
- Endre: `src/lib/types.ts` (legg til nederst)
- Regenerer: `supabase/KJOR-DENNE.sql`

**Grensesnitt:**
- Produserer: tabellen `kjoretoy`; kolonnen `innstillinger.varsle_eu_kontroll`;
  typene `Kjøretøy`, `KjøretøyStatus`, konstantene
  `KJØRETØY_STATUS_TEKST`, `KJØRETØY_MERKE`.

- [ ] **Steg 1: Skriv migrasjonen**

Opprett `supabase/migrations/0009_kjoretoy.sql`:

```sql
-- ═══════════════════════════════════════════════════════════
--  Kjøretøy med EU-kontroll og andre frister
--
--  Egen tabell framfor kolonner på maskiner: et kjøretøy har
--  skilt og en offentlig frist, ikke QR-kode og døgnpris. Å
--  presse begge inn i maskiner ville gitt en tabell der halve
--  kolonnene alltid er tomme, og en utleiekatalog full av
--  objekter som ikke kan leies.
--
--  Feltene merket «Vegvesen» overskrives av oppslaget mot
--  Statens vegvesen når nøkkelen finnes. Fram til da er de
--  manuelle. svv_hentet skiller de to tilfellene.
-- ═══════════════════════════════════════════════════════════

create table if not exists kjoretoy (
  id                  uuid primary key default gen_random_uuid(),
  reg_nr              text not null unique,
  internt_navn        text,
  ansvarlig_navn      text,
  ansvarlig_epost     text,

  -- Vegvesen, med manuell fallback
  merke               text,
  modell              text,
  arsmodell           integer,
  kjoretoy_klasse     text,
  eu_frist            date,
  eu_sist_godkjent    date,
  reg_status          text,
  svv_hentet          timestamptz,

  -- Manuelle frister
  km                  integer,
  forsikring_selskap  text,
  forsikring_forfall  date,
  neste_service       date,
  neste_dekkskift     date,

  status              text not null default 'i_drift'
                      check (status in ('i_drift', 'avskiltet', 'solgt')),
  notat               text,
  opprettet           timestamptz not null default now(),
  oppdatert           timestamptz not null default now()
);

comment on column kjoretoy.reg_nr is
  'Normalisert i applikasjonen: store bokstaver, uten mellomrom og bindestrek.';
comment on column kjoretoy.eu_frist is
  'Kalenderdato, ikke tidspunkt. Fristen er en dag i Statens vegvesens '
  'register, derfor date og ikke timestamptz som resten av skjemaet.';
comment on column kjoretoy.svv_hentet is
  'Null betyr at ingen vellykket oppslag mot Vegvesen har skjedd, og at '
  'feltene over er skrevet inn for hånd.';
comment on column kjoretoy.reg_status is
  'Kodeverdi fra Vegvesen: REGISTRERT, AVREGISTRERT, UREGISTRERT, UTFORT, '
  'VRAKET. Lagres rått framfor som check-constraint, siden kodeverket eies '
  'av Vegvesen og kan utvides uten forvarsel.';

-- Varsellista er «kjøretøy i drift med frist før dato X».
create index if not exists kjoretoy_frist_idx
  on kjoretoy (eu_frist) where status = 'i_drift';

-- Cron-jobben plukker de som er lengst siden oppfrisket.
create index if not exists kjoretoy_hentet_idx
  on kjoretoy (svv_hentet) where status = 'i_drift';

alter table kjoretoy enable row level security;

drop policy if exists admin_alt on kjoretoy;
create policy admin_alt on kjoretoy
  for all using (er_admin()) with check (er_admin());

-- ── Bryter for fristvarselet ─────────────────────────────
alter table innstillinger
  add column if not exists varsle_eu_kontroll boolean not null default true;

comment on column innstillinger.varsle_eu_kontroll is
  'Slår av og på samle-e-posten om frister på kjøretøy.';
```

- [ ] **Steg 2: Registrer migrasjonen i sjekkskriptet**

I `scripts/sjekk-migrasjoner.mjs`, legg til som siste element i
`MIGRASJONER`-arrayet (etter linje 27):

```js
  { fil: '0009_kjoretoy.sql', tabell: 'kjoretoy', kolonne: 'eu_frist' },
```

- [ ] **Steg 3: Regenerer samlemigrasjonen**

```bash
node scripts/lag-samlemigrasjon.mjs
```

Forventet: skriptet melder at `supabase/KJOR-DENNE.sql` er oppdatert.
**Rediger aldri den fila for hånd.**

- [ ] **Steg 4: Legg til typene**

Legg til nederst i `src/lib/types.ts`:

```ts
/* ═══ Kjøretøy ═════════════════════════════════════════════ */

export type KjøretøyStatus = 'i_drift' | 'avskiltet' | 'solgt'

/** Speiler supabase/migrations/0009_kjoretoy.sql. */
export type Kjøretøy = {
  id: string
  reg_nr: string
  internt_navn: string | null
  ansvarlig_navn: string | null
  ansvarlig_epost: string | null
  merke: string | null
  modell: string | null
  arsmodell: number | null
  kjoretoy_klasse: string | null
  /** yyyy-mm-dd. Neste EU-kontroll. */
  eu_frist: string | null
  eu_sist_godkjent: string | null
  reg_status: string | null
  /** Null = aldri hentet fra Vegvesen, altså manuelt innlagt. */
  svv_hentet: string | null
  km: number | null
  forsikring_selskap: string | null
  forsikring_forfall: string | null
  neste_service: string | null
  neste_dekkskift: string | null
  status: KjøretøyStatus
  notat: string | null
  opprettet: string
  oppdatert: string
}

export const KJØRETØY_STATUS_TEKST: Record<KjøretøyStatus, string> = {
  i_drift: 'I drift',
  avskiltet: 'Avskiltet',
  solgt: 'Solgt',
}

/**
 * Status → merketype. Merk at «forfalt» ikke finnes her: en passert
 * frist er et avledet predikat, ikke en status – samme valg som for
 * leier, se erForfalt over.
 */
export const KJØRETØY_MERKE: Record<KjøretøyStatus, 'grønn' | 'nøytral' | 'svart'> = {
  i_drift: 'grønn',
  avskiltet: 'nøytral',
  solgt: 'svart',
}
```

- [ ] **Steg 5: Verifiser at det typesjekker**

```bash
npx tsc --noEmit
```
Forventet: ingen feil.

- [ ] **Steg 6: Kjør migrasjonen i Supabase**

Dette steget gjøres av eier, ikke av en agent. Åpne Supabase → SQL Editor,
lim inn hele `supabase/KJOR-DENNE.sql`, kjør. Den er trygg å kjøre flere
ganger.

Verifiser etterpå:

```bash
node --env-file=.env.local scripts/sjekk-migrasjoner.mjs
```
Forventet: `✓ 0009_kjoretoy.sql` og «Alle migrasjoner er kjørt.»

- [ ] **Steg 7: Commit**

```bash
git add supabase/migrations/0009_kjoretoy.sql supabase/KJOR-DENNE.sql scripts/sjekk-migrasjoner.mjs src/lib/types.ts
git commit -m "Kjøretøytabell med frister og RLS"
```

---

## Oppgave 2: Vegvesen-klient

Isolert HTTP-lag. Ingen UI avhenger av at nøkkelen finnes.

**Filer:**
- Opprett: `src/lib/vegvesen.ts`
- Opprett: `scripts/sjekk-vegvesen.mjs`

**Grensesnitt:**
- Produserer: `normaliserRegNr(rå: string): string`,
  `vegvesenErSattOpp(): boolean`,
  `hentKjøretøy(kjennemerke: string): Promise<Oppslag>`,
  `type Oppslag`, `type Kjøretøydata`.

- [ ] **Steg 1: Skriv klienten**

Opprett `src/lib/vegvesen.ts`:

```ts
import 'server-only'

/**
 * Oppslag mot Statens vegvesens åpne kjøretøyregister.
 *
 * Nøkkelen leses rått fra process.env og ligger bevisst ikke i
 * env.ts-valideringen. Å bestille den krever BankID og Altinn-tjenesten
 * «Kjøretøyoppslag», altså et menneske. Modulen skal virke manuelt fram
 * til det er gjort – samme grep som RESEND_API_KEY allerede bruker.
 *
 * Data er lisensiert CC BY 4.0. Statens vegvesen krediteres der
 * verdiene vises.
 */

const BASE = 'https://akfell-datautlevering.atlas.vegvesen.no'

export type Kjøretøydata = {
  merke: string | null
  modell: string | null
  arsmodell: number | null
  kjoretoy_klasse: string | null
  eu_frist: string | null
  eu_sist_godkjent: string | null
  reg_status: string | null
}

/**
 * Utfallene kallstedet må kunne skille mellom.
 *
 * «ukjent» dekker både skilt som ikke finnes og skilt som er skjermet –
 * Vegvesen bruker samme feilkode for begge. Derfor sier vi aldri
 * «finnes ikke» til brukeren, bare «kunne ikke verifiseres».
 */
export type Oppslag =
  | { status: 'ok'; data: Kjøretøydata }
  | { status: 'ukjent' }
  | { status: 'kvote' }
  | { status: 'nøkkelfeil' }
  | { status: 'feil'; kode: number | 'timeout' }

/** «AB 12345» og «ab-12345» blir begge «AB12345». */
export function normaliserRegNr(rå: string): string {
  return rå.replace(/[\s-]/g, '').toUpperCase()
}

export function vegvesenErSattOpp(): boolean {
  return Boolean(process.env.SVV_API_KEY)
}

/** yyyy-mm-dd, eller null hvis verdien ikke er en dato vi kjenner igjen. */
function somDato(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const treff = /^\d{4}-\d{2}-\d{2}/.exec(v)
  return treff ? treff[0] : null
}

/**
 * Plukker feltene vi bryr oss om ut av responsen.
 *
 * Hvert eneste steg er valgfritt i Vegvesens skjema:
 * periodiskKjoretoyKontroll mangler helt for kjøretøy uten
 * kontrollplikt, og merke/handelsbetegnelse er arrays som kan være
 * tomme. Én manglende null-sjekk her er en 500 i adminpanelet.
 */
function tolk(rad: Record<string, unknown>): Kjøretøydata {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const r = rad as any

  const generelt = r?.godkjenning?.tekniskGodkjenning?.tekniskeData?.generelt
  const pkk = r?.periodiskKjoretoyKontroll
  const førstegang = somDato(
    r?.forstegangsregistrering?.registrertForstegangNorgeDato,
  )

  return {
    merke: generelt?.merke?.[0]?.merke ?? null,
    modell: generelt?.handelsbetegnelse?.[0] ?? null,
    arsmodell: førstegang ? Number(førstegang.slice(0, 4)) : null,
    kjoretoy_klasse:
      r?.godkjenning?.tekniskGodkjenning?.kjoretoyklassifisering?.tekniskKode
        ?.kodeVerdi ?? null,
    eu_frist: somDato(pkk?.kontrollfrist),
    eu_sist_godkjent: somDato(pkk?.sistGodkjent),
    reg_status: r?.registrering?.registreringsstatus?.kodeVerdi ?? null,
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function hentKjøretøy(kjennemerke: string): Promise<Oppslag> {
  const nøkkel = process.env.SVV_API_KEY
  if (!nøkkel) return { status: 'nøkkelfeil' }

  const url = new URL('/enkeltoppslag/kjoretoydata', BASE)
  url.searchParams.set('kjennemerke', normaliserRegNr(kjennemerke))

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        'SVV-Authorization': `Apikey ${nøkkel}`,
        Accept: 'application/json',
      },
      // Next 16 sin standard er «auto no cache», som blir bakt inn
      // dersom ruten prerendres. Eksplisitt no-store er det eneste
      // som garanterer et ferskt svar.
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    // Dekker både timeout og nettverksfeil. Kallstedet trenger ikke
    // skille dem – begge betyr «prøv igjen senere».
    return { status: 'feil', kode: 'timeout' }
  }

  // Dokumentasjonen sier 401, men 403 er ikke utelukket. Begge
  // betyr det samme for oss.
  if (res.status === 401 || res.status === 403) return { status: 'nøkkelfeil' }
  // Dokumentasjonen sier 429, OpenAPI-skjemaet sier 422. Vi vet ikke
  // hvilken vi faktisk får før kvoten sprekker, så vi tar begge.
  if (res.status === 429 || res.status === 422) return { status: 'kvote' }
  if (!res.ok) return { status: 'feil', kode: res.status }

  let kropp: unknown
  try {
    kropp = await res.json()
  } catch {
    return { status: 'feil', kode: res.status }
  }

  /*
   * Ukjent skilt gir HTTP 200, ikke 404, med
   * {"feilmelding":"OPPLYSNINGER_IKKE_TILGJENGELIGE"} og tom liste.
   * Å lete etter 404 her ville aldri truffet.
   */
  const liste = (kropp as { kjoretoydataListe?: unknown[] })?.kjoretoydataListe
  const rad = Array.isArray(liste) ? liste[0] : undefined
  if (!rad || typeof rad !== 'object') return { status: 'ukjent' }

  return { status: 'ok', data: tolk(rad as Record<string, unknown>) }
}
```

- [ ] **Steg 2: Verifiser at det typesjekker og lint-er**

```bash
npx tsc --noEmit && npm run lint
```
Forventet: ingen feil.

- [ ] **Steg 3: Skriv røyktesten**

Dette er det eneste som kan avklare punktene speccen lister som ikke
verifisert mot det levende API-et. Opprett `scripts/sjekk-vegvesen.mjs`:

```js
/**
 * Røyktest av Vegvesen-nøkkelen.
 *
 *   node --env-file=.env.local scripts/sjekk-vegvesen.mjs EK12345
 *
 * Finnes fordi ingenting i integrasjonen er bekreftet mot det levende
 * API-et: verken at «Apikey»-headeren virker, at kontrollfrist kommer
 * som yyyy-mm-dd, eller hva et ukjent skilt faktisk svarer. Kjør denne
 * første gang nøkkelen er på plass, og les utskriften.
 */
const BASE = 'https://akfell-datautlevering.atlas.vegvesen.no'

const nøkkel = process.env.SVV_API_KEY
if (!nøkkel) {
  console.log('\nSVV_API_KEY mangler.\n')
  console.log('Modulen virker manuelt uten den. Skal oppslaget virke:')
  console.log('  1. Skaff Altinn-tjenesten «Kjøretøyoppslag» for firmaet')
  console.log('  2. https://www.vegvesen.no/dinside/data-og-api-er/tilgang-til-api-for-kjoretoyopplysninger/')
  console.log('  3. Logg inn med BankID, bestill, kopier nøkkelen med én gang')
  console.log('  4. Legg den i .env.local og i Vercel som SVV_API_KEY\n')
  process.exit(1)
}

const kjennemerke = (process.argv[2] ?? '').replace(/[\s-]/g, '').toUpperCase()
if (!kjennemerke) {
  console.log('\nBruk: node --env-file=.env.local scripts/sjekk-vegvesen.mjs EK12345\n')
  process.exit(1)
}

const url = new URL('/enkeltoppslag/kjoretoydata', BASE)
url.searchParams.set('kjennemerke', kjennemerke)

const res = await fetch(url, {
  headers: { 'SVV-Authorization': `Apikey ${nøkkel}`, Accept: 'application/json' },
})

console.log(`\nHTTP ${res.status} ${res.statusText}`)

const tekst = await res.text()
let kropp
try {
  kropp = JSON.parse(tekst)
} catch {
  console.log('Svaret var ikke JSON:\n')
  console.log(tekst.slice(0, 800))
  process.exit(1)
}

if (kropp.feilmelding) console.log(`feilmelding: ${kropp.feilmelding}`)

const rad = kropp.kjoretoydataListe?.[0]
if (!rad) {
  console.log('\nIngen data for dette skiltet.')
  console.log('Merk at samme svar kommer for skilt som ikke finnes OG for')
  console.log('skjermede skilt – de kan ikke skilles.\n')
  process.exit(0)
}

const pkk = rad.periodiskKjoretoyKontroll
const generelt = rad.godkjenning?.tekniskGodkjenning?.tekniskeData?.generelt

console.log('\nTolket:')
console.log(`  merke            ${generelt?.merke?.[0]?.merke ?? '–'}`)
console.log(`  modell           ${generelt?.handelsbetegnelse?.[0] ?? '–'}`)
console.log(`  reg.status       ${rad.registrering?.registreringsstatus?.kodeVerdi ?? '–'}`)
console.log(`  EU-frist         ${pkk?.kontrollfrist ?? '– (ingen kontrollplikt?)'}`)
console.log(`  sist godkjent    ${pkk?.sistGodkjent ?? '–'}`)

if (pkk?.kontrollfrist && !/^\d{4}-\d{2}-\d{2}$/.test(pkk.kontrollfrist)) {
  console.log('\n  ⚠ kontrollfrist har et annet format enn yyyy-mm-dd.')
  console.log('    src/lib/vegvesen.ts må tilpasses.')
}

console.log('')
```

- [ ] **Steg 4: Kjør røyktesten**

```bash
node --env-file=.env.local scripts/sjekk-vegvesen.mjs EK12345
```

Uten nøkkel er forventet utfall exit 1 med bestillingsoppskriften — det er
et gyldig resultat på dette stadiet, og skal ikke «fikses». Med nøkkel:
les utskriften og rett `src/lib/vegvesen.ts` hvis formatet avviker.

- [ ] **Steg 5: Commit**

```bash
git add src/lib/vegvesen.ts scripts/sjekk-vegvesen.mjs
git commit -m "Vegvesen-oppslag, med manuell drift når nøkkelen mangler"
```

---

## Oppgave 3: Fristlogikk

Ren funksjon, ingen I/O. Både lista, dashbordet og e-posten bruker den, så
den skrives én gang.

**Filer:**
- Opprett: `src/lib/frister.ts`

**Grensesnitt:**
- Bruker: `Kjøretøy` fra oppgave 1, `dagerTil` fra `src/lib/dato.ts`.
- Produserer: `TERSKLER`, `type Frist`, `type FristType`,
  `fristerFor(k: Kjøretøy): Frist[]`,
  `kommendeFrister(liste: Kjøretøy[], innen?: number): Frist[]`,
  `treffserTerskel(frister: Frist[]): boolean`.

- [ ] **Steg 1: Skriv modulen**

Opprett `src/lib/frister.ts`:

```ts
import { dagerTil } from '@/lib/dato'
import type { Kjøretøy } from '@/lib/types'

/**
 * Fristene på et kjøretøy, samlet ett sted.
 *
 * Lista, dashbordet og e-posten stiller samme spørsmål – «hva forfaller
 * snart?» – og må gi samme svar. Regnes det ut tre steder, driver de fra
 * hverandre.
 */

/**
 * Dager før frist der varselet går ut.
 *
 * Nøyaktig treff, ikke «under 30». Alternativet ville sendt samme e-post
 * tretti dager på rad, og da slutter folk å lese den.
 */
export const TERSKLER = [30, 14, 3] as const

export type FristType = 'eu' | 'forsikring' | 'service' | 'dekkskift'

export type Frist = {
  kjøretøy: Kjøretøy
  type: FristType
  /** Menneskelig navn, til e-post og skjerm. */
  tekst: string
  /** yyyy-mm-dd */
  dato: string
  /** Negativt = forfalt. 0 = i dag. */
  dager: number
}

const TEKST: Record<FristType, string> = {
  eu: 'EU-kontroll',
  forsikring: 'Forsikring',
  service: 'Service',
  dekkskift: 'Dekkskift',
}

/** EU-kontroll først – den har en offentlig konsekvens, de andre ikke. */
const FELT: [FristType, keyof Kjøretøy][] = [
  ['eu', 'eu_frist'],
  ['forsikring', 'forsikring_forfall'],
  ['service', 'neste_service'],
  ['dekkskift', 'neste_dekkskift'],
]

export function fristerFor(k: Kjøretøy): Frist[] {
  const ut: Frist[] = []

  for (const [type, felt] of FELT) {
    const dato = k[felt]
    if (typeof dato !== 'string' || dato === '') continue
    ut.push({ kjøretøy: k, type, tekst: TEKST[type], dato, dager: dagerTil(dato) })
  }

  return ut
}

/**
 * Alle frister som forfaller innen `innen` dager, eller allerede har
 * forfalt. Bare kjøretøy i drift – en solgt bil skal ikke ligge og mase.
 */
export function kommendeFrister(liste: Kjøretøy[], innen = 30): Frist[] {
  return liste
    .filter((k) => k.status === 'i_drift')
    .flatMap(fristerFor)
    .filter((f) => f.dager <= innen)
    .sort((a, b) => a.dager - b.dager)
}

/**
 * Skal det sendes e-post i dag?
 *
 * Ja hvis noe treffer en terskel nøyaktig, eller nettopp har blitt
 * forfalt (i går var dager 0, i dag er den -1). Uten den siste regelen
 * ville en frist som glapp forbi 3-dagersvarselet aldri blitt nevnt.
 */
export function treffserTerskel(frister: Frist[]): boolean {
  return frister.some(
    (f) => (TERSKLER as readonly number[]).includes(f.dager) || f.dager === -1,
  )
}
```

- [ ] **Steg 2: Verifiser**

```bash
npx tsc --noEmit && npm run lint
```
Forventet: ingen feil.

- [ ] **Steg 3: Commit**

```bash
git add src/lib/frister.ts
git commit -m "Fristlogikk for kjøretøy, ett sted"
```

---

## Oppgave 4: Adminliste og opprettelse

Første synlige leveranse. Etter denne kan man legge inn kjøretøy.

**Filer:**
- Opprett: `src/app/admin/(panel)/kjoretoy/actions.ts`
- Opprett: `src/app/admin/(panel)/kjoretoy/nytt-kjoretoy.tsx`
- Opprett: `src/app/admin/(panel)/kjoretoy/page.tsx`
- Opprett: `src/app/admin/(panel)/kjoretoy/loading.tsx`
- Endre: `src/app/admin/(panel)/meny.tsx:6-15`

**Grensesnitt:**
- Bruker: `Kjøretøy`, `KJØRETØY_STATUS_TEKST`, `KJØRETØY_MERKE` (oppgave 1);
  `normaliserRegNr`, `hentKjøretøy`, `vegvesenErSattOpp` (oppgave 2);
  `kommendeFrister` (oppgave 3).
- Produserer: `opprettKjøretøy`, `type KjøretøyTilstand`.

- [ ] **Steg 1: Skriv actions**

Opprett `src/app/admin/(panel)/kjoretoy/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { hentKjøretøy, normaliserRegNr } from '@/lib/vegvesen'

/*
 * 2–7 tegn er Vegvesens egen grense på kjennemerke-parameteren. Vi
 * validerer ikke mot norsk skiltformat: utenlandske skilt og
 * prøveskilt skal kunne føres inn, og et register man ikke får lagt
 * bilen sin inn i er verdiløst.
 */
const REG_NR = /^[A-Z0-9]{2,7}$/

const valgfriDato = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: 'Ugyldig dato',
  })

const kjøretøySkjema = z.object({
  reg_nr: z
    .string()
    .trim()
    .transform(normaliserRegNr)
    .refine((v) => REG_NR.test(v), {
      message: 'Registreringsnummeret må være 2–7 bokstaver og tall',
    }),
  internt_navn: z.string().trim().optional(),
  ansvarlig_navn: z.string().trim().optional(),
  ansvarlig_epost: z.string().trim().optional(),
  eu_frist: valgfriDato,
})

export type KjøretøyTilstand = { feil?: string; ok?: string }

export async function opprettKjøretøy(
  _forrige: KjøretøyTilstand,
  formData: FormData,
): Promise<KjøretøyTilstand> {
  // Server actions er POST-ruter som kan treffes direkte. Tilgangen må
  // sjekkes her, ikke bare i layouten.
  await krevAdmin()

  const felter = kjøretøySkjema.safeParse({
    reg_nr: formData.get('reg_nr') ?? '',
    internt_navn: formData.get('internt_navn'),
    ansvarlig_navn: formData.get('ansvarlig_navn'),
    ansvarlig_epost: formData.get('ansvarlig_epost'),
    eu_frist: formData.get('eu_frist') ?? '',
  })
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const epost = felter.data.ansvarlig_epost
  if (epost && !z.email().safeParse(epost).success) {
    return { feil: `«${epost}» er ikke en gyldig e-postadresse` }
  }

  /*
   * Oppslaget skjer før innsettingen, ikke etter, slik at bilen er
   * ferdig utfylt første gang den vises. Feiler det, lagrer vi likevel
   * med det brukeren skrev inn – et halvt register er bedre enn ingen,
   * og cron-jobben prøver igjen.
   */
  const oppslag = await hentKjøretøy(felter.data.reg_nr)
  const fraSvv =
    oppslag.status === 'ok'
      ? { ...oppslag.data, svv_hentet: new Date().toISOString() }
      : {}

  const supabase = await lagServerKlient()
  const { error } = await supabase.from('kjoretoy').insert({
    reg_nr: felter.data.reg_nr,
    internt_navn: felter.data.internt_navn || null,
    ansvarlig_navn: felter.data.ansvarlig_navn || null,
    ansvarlig_epost: felter.data.ansvarlig_epost || null,
    eu_frist: felter.data.eu_frist,
    ...fraSvv,
  })

  if (error) {
    // 23505 er unik-brudd. Postgres sin egen tekst nevner indeksnavnet,
    // som ikke sier brukeren noe.
    if (error.code === '23505') {
      return { feil: `${felter.data.reg_nr} er allerede registrert.` }
    }
    return { feil: `Kunne ikke lagre kjøretøyet: ${error.message}` }
  }

  revalidatePath('/admin/kjoretoy')

  const hale =
    oppslag.status === 'ok'
      ? ' Data er hentet fra Vegvesen.'
      : oppslag.status === 'nøkkelfeil'
        ? ''
        : ' Vegvesen svarte ikke – fyll inn fristen selv, eller prøv igjen fra kjøretøysiden.'

  return { ok: `${felter.data.reg_nr} er lagt til.${hale}` }
}
```

- [ ] **Steg 2: Skriv opprettskjemaet**

Opprett `src/app/admin/(panel)/kjoretoy/nytt-kjoretoy.tsx`:

```tsx
'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { ETIKETT, FELT, KNAPP_SEKUNDÆR } from '@/components/ui'
import { opprettKjøretøy, type KjøretøyTilstand } from './actions'

const start: KjøretøyTilstand = {}

export function NyttKjøretøy({ vegvesen }: { vegvesen: boolean }) {
  const [åpen, settÅpen] = useState(false)
  const [tilstand, handling, venter] = useActionState(opprettKjøretøy, start)
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
          + Nytt kjøretøy
        </button>
        {tilstand.ok && (
          <p role="status" className="text-sm font-semibold text-hm-green">{tilstand.ok}</p>
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
      <h2 className="hm-display mb-4 text-xl">Nytt kjøretøy</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={ETIKETT}>Registreringsnummer</span>
          <input
            name="reg_nr"
            required
            autoCapitalize="characters"
            placeholder="EK12345"
            className={`${FELT} hm-tall uppercase`}
          />
        </label>

        <label>
          <span className={ETIKETT}>
            Internt navn <span className="normal-case">(valgfritt)</span>
          </span>
          <input name="internt_navn" placeholder="Servicebil 1" className={FELT} />
        </label>

        <label>
          <span className={ETIKETT}>Ansvarlig</span>
          <input
            name="ansvarlig_navn"
            autoComplete="name"
            placeholder="Ola Nordmann"
            className={FELT}
          />
        </label>

        <label>
          <span className={ETIKETT}>E-post til ansvarlig</span>
          <input
            name="ansvarlig_epost"
            type="email"
            autoComplete="email"
            placeholder="ola@haugemaskin.no"
            className={FELT}
          />
        </label>

        <label className="sm:col-span-2">
          <span className={ETIKETT}>
            EU-frist{' '}
            <span className="normal-case">
              {vegvesen ? '(hentes automatisk om den finnes)' : '(fylles inn manuelt)'}
            </span>
          </span>
          <input name="eu_frist" type="date" className={FELT} />
        </label>
      </div>

      {/* Sagt her framfor i en global banner: det er akkurat i det man
          legger inn en bil at man lurer på hvorfor feltene ikke fylles
          ut av seg selv. */}
      {!vegvesen && (
        <p className="mt-4 border-l-4 border-hm-amber p-3 text-sm text-[var(--blekk-svak)]">
          Vegvesen-oppslag er ikke satt opp. Merke, modell og EU-frist må fylles
          inn for hånd inntil <span className="hm-tall">SVV_API_KEY</span> er på plass.
        </p>
      )}

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
          {venter ? 'Lagrer …' : 'Lagre kjøretøy'}
        </button>
        <button type="button" onClick={() => settÅpen(false)} className={KNAPP_SEKUNDÆR}>
          Lukk
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Steg 3: Skriv listesiden**

Opprett `src/app/admin/(panel)/kjoretoy/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { vegvesenErSattOpp } from '@/lib/vegvesen'
import { fristerFor } from '@/lib/frister'
import { dagerTil, dato } from '@/lib/dato'
import {
  KJØRETØY_MERKE,
  KJØRETØY_STATUS_TEKST,
  type Kjøretøy,
  type KjøretøyStatus,
} from '@/lib/types'
import { Merke, Seksjonstittel, TomTilstand } from '@/components/ui'
import { Søkefelt } from '@/components/sokefelt'
import { NyttKjøretøy } from './nytt-kjoretoy'

export const metadata: Metadata = { title: 'Kjøretøy – HM Utleie' }
export const dynamic = 'force-dynamic'

const FILTRE = [
  { verdi: 'alle', tekst: 'Alle' },
  { verdi: 'frist', tekst: 'Frist snart' },
  { verdi: 'i_drift', tekst: 'I drift' },
  { verdi: 'avskiltet', tekst: 'Avskiltet' },
  { verdi: 'solgt', tekst: 'Solgt' },
] as const

export default async function KjøretøySide(props: PageProps<'/admin/kjoretoy'>) {
  await krevAdmin()

  const sp = await props.searchParams
  const søk = typeof sp.q === 'string' ? sp.q.trim() : ''
  const filter = typeof sp.status === 'string' ? sp.status : 'alle'

  const supabase = await lagServerKlient()
  const { data, error } = await supabase
    .from('kjoretoy')
    .select('*')
    .order('eu_frist', { ascending: true, nullsFirst: false })
    .limit(500)

  const alle = (data ?? []) as Kjøretøy[]

  const normalisert = søk.toLowerCase().replace(/\s/g, '')
  const treff = alle.filter((k) => {
    if (filter === 'frist') {
      if (k.status !== 'i_drift') return false
      if (!fristerFor(k).some((f) => f.dager <= 30)) return false
    } else if (filter !== 'alle' && k.status !== filter) {
      return false
    }

    if (!normalisert) return true
    return [k.reg_nr, k.internt_navn, k.merke, k.modell, k.ansvarlig_navn]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().replace(/\s/g, '').includes(normalisert))
  })

  const lenke = (verdi: string) => {
    const p = new URLSearchParams()
    if (søk) p.set('q', søk)
    if (verdi !== 'alle') p.set('status', verdi)
    const s = p.toString()
    return s ? `/admin/kjoretoy?${s}` : '/admin/kjoretoy'
  }

  return (
    <div className="space-y-6">
      <Seksjonstittel under="Egne kjøretøy, med EU-kontroll og andre frister.">
        Kjøretøy
      </Seksjonstittel>

      <NyttKjøretøy vegvesen={vegvesenErSattOpp()} />

      {error && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          Kunne ikke hente kjøretøyene: {error.message}
        </p>
      )}

      <div className="space-y-3">
        <Søkefelt verdi={søk} plassholder="Søk på skilt, navn, merke eller ansvarlig …" />
        <ul className="flex flex-wrap gap-2">
          {FILTRE.map((f) => {
            const aktiv = filter === f.verdi
            return (
              <li key={f.verdi}>
                <Link
                  href={lenke(f.verdi)}
                  aria-current={aktiv ? 'true' : undefined}
                  className={`inline-flex min-h-[2.25rem] items-center border-2 px-3 text-xs font-bold tracking-wider uppercase transition-colors ${
                    aktiv
                      ? 'border-[var(--kant-sterk)] bg-hm-black text-white'
                      : 'border-[var(--kant)] hover:border-[var(--kant-sterk)]'
                  }`}
                >
                  {f.tekst}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {treff.length === 0 ? (
        <TomTilstand tittel="Ingen kjøretøy">
          {søk
            ? `Fant ingen kjøretøy som matcher «${søk}».`
            : 'Legg inn det første kjøretøyet, så holder systemet styr på fristene.'}
        </TomTilstand>
      ) : (
        <ul className="divide-y-2 divide-[var(--kant)] border-2 border-[var(--kant)]">
          {treff.map((k) => (
            <li key={k.id}>
              <Link
                href={`/admin/kjoretoy/${k.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-[var(--flate-2)]"
              >
                <span className="hm-tall shrink-0 border-2 border-[var(--kant-sterk)] px-2 py-0.5 text-sm font-bold tracking-wider">
                  {k.reg_nr}
                </span>
                <span className="hm-display min-w-0 flex-1 truncate text-base">
                  {k.internt_navn || [k.merke, k.modell].filter(Boolean).join(' ') || '–'}
                </span>
                <EuFrist frist={k.eu_frist} />
                <Merke type={KJØRETØY_MERKE[k.status as KjøretøyStatus] ?? 'nøytral'}>
                  {KJØRETØY_STATUS_TEKST[k.status as KjøretøyStatus] ?? k.status}
                </Merke>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-[var(--blekk-svak)]">
        Kjøretøyopplysninger fra Statens vegvesen · CC BY 4.0
      </p>
    </div>
  )
}

/**
 * Fristen er det eneste tallet i lista folk faktisk leser, så den får
 * farge og ord – aldri farge alene, som ellers i appen.
 */
function EuFrist({ frist }: { frist: string | null }) {
  if (!frist) {
    return <span className="text-xs text-[var(--blekk-svak)]">EU-frist ukjent</span>
  }

  const dager = dagerTil(frist)
  const stil =
    dager < 0
      ? 'text-hm-red-ink font-bold'
      : dager <= 30
        ? 'text-hm-amber font-bold'
        : 'text-[var(--blekk-svak)]'

  return (
    <span className={`hm-tall text-xs ${stil}`}>
      EU {dato(frist)}
      {dager < 0 ? ` · forfalt for ${Math.abs(dager)} d siden` : dager <= 30 ? ` · om ${dager} d` : ''}
    </span>
  )
}
```

- [ ] **Steg 4: Skriv skjelettet**

Opprett `src/app/admin/(panel)/kjoretoy/loading.tsx`:

```tsx
import { ListeSkjelett } from '@/components/skjelett'

export default function Laster() {
  return <ListeSkjelett antall={6} />
}
```

- [ ] **Steg 5: Legg lenken i menyen**

I `src/app/admin/(panel)/meny.tsx`, legg til i `lenker`-arrayet mellom
`Maskiner` og `Kunder` (etter linje 10):

```ts
  { href: '/admin/kjoretoy', tekst: 'Kjøretøy' },
```

Aktiv-sjekken er `sti.startsWith(l.href)`. `/admin/kjoretoy` er ikke et
prefiks av noen annen lenke, og `/admin/kunder` er ikke et prefiks av den
— ingen konflikt.

- [ ] **Steg 6: Generer rutetypene og verifiser**

```bash
npx next typegen && npx tsc --noEmit && npm run lint
```
Forventet: ingen feil. Uten `typegen` finnes ikke `PageProps<'/admin/kjoretoy'>`,
og `<Link href="/admin/kjoretoy">` avvises av typede ruter.

- [ ] **Steg 7: Se at det virker**

```bash
npm run dev
```
Åpne `http://localhost:3000/admin/kjoretoy`. Legg inn et kjøretøy. Sjekk at
skiltet normaliseres, at duplikat gir en lesbar feil, at søk og filter virker,
og at siden ser riktig ut i både lys og mørk modus.

- [ ] **Steg 8: Commit**

```bash
git add "src/app/admin/(panel)/kjoretoy" "src/app/admin/(panel)/meny.tsx"
git commit -m "Kjøretøyliste i admin, med oppslag ved innlegging"
```

---

## Oppgave 5: Detaljside

**Filer:**
- Opprett: `src/app/admin/(panel)/kjoretoy/[id]/actions.ts`
- Opprett: `src/app/admin/(panel)/kjoretoy/[id]/rediger-skjema.tsx`
- Opprett: `src/app/admin/(panel)/kjoretoy/[id]/page.tsx`
- Opprett: `src/app/admin/(panel)/kjoretoy/[id]/loading.tsx`

**Grensesnitt:**
- Produserer: `lagreKjøretøy`, `oppdaterFraVegvesen`, `slettKjøretøy`,
  `type RedigerTilstand`.

- [ ] **Steg 1: Skriv actions**

Opprett `src/app/admin/(panel)/kjoretoy/[id]/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { hentKjøretøy } from '@/lib/vegvesen'

const valgfriDato = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: 'Ugyldig dato',
  })

const valgfriTall = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v.replace(/[\s.,]/g, ''))))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), {
    message: 'Må være et positivt tall',
  })

const redigerSkjema = z.object({
  internt_navn: z.string().trim().optional(),
  ansvarlig_navn: z.string().trim().optional(),
  ansvarlig_epost: z.string().trim().optional(),
  merke: z.string().trim().optional(),
  modell: z.string().trim().optional(),
  arsmodell: valgfriTall,
  km: valgfriTall,
  eu_frist: valgfriDato,
  forsikring_selskap: z.string().trim().optional(),
  forsikring_forfall: valgfriDato,
  neste_service: valgfriDato,
  neste_dekkskift: valgfriDato,
  status: z.enum(['i_drift', 'avskiltet', 'solgt']),
  notat: z.string().trim().optional(),
})

export type RedigerTilstand = { feil?: string; ok?: string }

export async function lagreKjøretøy(
  id: string,
  _forrige: RedigerTilstand,
  formData: FormData,
): Promise<RedigerTilstand> {
  await krevAdmin()

  if (!z.uuid().safeParse(id).success) return { feil: 'Ukjent kjøretøy.' }

  const felter = redigerSkjema.safeParse({
    internt_navn: formData.get('internt_navn'),
    ansvarlig_navn: formData.get('ansvarlig_navn'),
    ansvarlig_epost: formData.get('ansvarlig_epost'),
    merke: formData.get('merke'),
    modell: formData.get('modell'),
    arsmodell: formData.get('arsmodell') ?? '',
    km: formData.get('km') ?? '',
    eu_frist: formData.get('eu_frist') ?? '',
    forsikring_selskap: formData.get('forsikring_selskap'),
    forsikring_forfall: formData.get('forsikring_forfall') ?? '',
    neste_service: formData.get('neste_service') ?? '',
    neste_dekkskift: formData.get('neste_dekkskift') ?? '',
    status: formData.get('status') ?? 'i_drift',
    notat: formData.get('notat'),
  })
  if (!felter.success) {
    const f = felter.error.issues[0]
    return { feil: `${f.path.join('.') || 'Skjemaet'}: ${f.message}` }
  }

  const epost = felter.data.ansvarlig_epost
  if (epost && !z.email().safeParse(epost).success) {
    return { feil: `«${epost}» er ikke en gyldig e-postadresse` }
  }

  const supabase = await lagServerKlient()
  const { error } = await supabase
    .from('kjoretoy')
    .update({
      internt_navn: felter.data.internt_navn || null,
      ansvarlig_navn: felter.data.ansvarlig_navn || null,
      ansvarlig_epost: felter.data.ansvarlig_epost || null,
      merke: felter.data.merke || null,
      modell: felter.data.modell || null,
      arsmodell: felter.data.arsmodell,
      km: felter.data.km,
      eu_frist: felter.data.eu_frist,
      forsikring_selskap: felter.data.forsikring_selskap || null,
      forsikring_forfall: felter.data.forsikring_forfall,
      neste_service: felter.data.neste_service,
      neste_dekkskift: felter.data.neste_dekkskift,
      status: felter.data.status,
      notat: felter.data.notat || null,
      // Skjemaet har ingen trigger for dette. Settes fra applikasjonen,
      // som resten av tabellene.
      oppdatert: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { feil: `Kunne ikke lagre: ${error.message}` }

  revalidatePath('/admin/kjoretoy')
  revalidatePath(`/admin/kjoretoy/${id}`)
  return { ok: 'Lagret.' }
}

/**
 * Henter fristen på nytt fra Vegvesen.
 *
 * Bundet action uten returverdi: knappen skal bare oppdatere siden.
 * Feiler oppslaget, står de gamle verdiene igjen – det er riktigere enn
 * å tømme felter fordi et API var nede.
 */
export async function oppdaterFraVegvesen(id: string) {
  await krevAdmin()
  if (!z.uuid().safeParse(id).success) return

  const supabase = await lagServerKlient()
  const { data } = await supabase
    .from('kjoretoy')
    .select('reg_nr')
    .eq('id', id)
    .maybeSingle()

  if (!data?.reg_nr) return

  const oppslag = await hentKjøretøy(data.reg_nr as string)
  if (oppslag.status !== 'ok') return

  await supabase
    .from('kjoretoy')
    .update({
      ...oppslag.data,
      svv_hentet: new Date().toISOString(),
      oppdatert: new Date().toISOString(),
    })
    .eq('id', id)

  revalidatePath('/admin/kjoretoy')
  revalidatePath(`/admin/kjoretoy/${id}`)
}

export async function slettKjøretøy(id: string) {
  await krevAdmin()
  if (!z.uuid().safeParse(id).success) return

  const supabase = await lagServerKlient()
  await supabase.from('kjoretoy').delete().eq('id', id)

  revalidatePath('/admin/kjoretoy')
  // redirect kaster NEXT_REDIRECT og skal aldri stå i en try-blokk,
  // og alltid etter revalidatePath.
  redirect('/admin/kjoretoy')
}
```

- [ ] **Steg 2: Skriv redigeringsskjemaet**

Opprett `src/app/admin/(panel)/kjoretoy/[id]/rediger-skjema.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { ETIKETT, FELT } from '@/components/ui'
import { KJØRETØY_STATUS_TEKST, type Kjøretøy } from '@/lib/types'
import { lagreKjøretøy, type RedigerTilstand } from './actions'

const start: RedigerTilstand = {}

export function RedigerSkjema({ kjøretøy }: { kjøretøy: Kjøretøy }) {
  const [tilstand, handling, venter] = useActionState(
    lagreKjøretøy.bind(null, kjøretøy.id),
    start,
  )

  return (
    <form action={handling} className="space-y-6 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={ETIKETT}>Internt navn</span>
          <input
            name="internt_navn"
            defaultValue={kjøretøy.internt_navn ?? ''}
            placeholder="Servicebil 1"
            className={FELT}
          />
        </label>

        <label>
          <span className={ETIKETT}>Status</span>
          <select name="status" defaultValue={kjøretøy.status} className={FELT}>
            {Object.entries(KJØRETØY_STATUS_TEKST).map(([verdi, tekst]) => (
              <option key={verdi} value={verdi}>
                {tekst}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={ETIKETT}>Ansvarlig</span>
          <input
            name="ansvarlig_navn"
            defaultValue={kjøretøy.ansvarlig_navn ?? ''}
            autoComplete="name"
            className={FELT}
          />
        </label>

        <label>
          <span className={ETIKETT}>E-post til ansvarlig</span>
          <input
            name="ansvarlig_epost"
            type="email"
            defaultValue={kjøretøy.ansvarlig_epost ?? ''}
            autoComplete="email"
            className={FELT}
          />
        </label>

        <label>
          <span className={ETIKETT}>Merke</span>
          <input name="merke" defaultValue={kjøretøy.merke ?? ''} className={FELT} />
        </label>

        <label>
          <span className={ETIKETT}>Modell</span>
          <input name="modell" defaultValue={kjøretøy.modell ?? ''} className={FELT} />
        </label>

        <label>
          <span className={ETIKETT}>Årsmodell</span>
          <input
            name="arsmodell"
            inputMode="numeric"
            defaultValue={kjøretøy.arsmodell ?? ''}
            className={FELT}
          />
        </label>

        <label>
          <span className={ETIKETT}>Kilometerstand</span>
          <input
            name="km"
            inputMode="numeric"
            defaultValue={kjøretøy.km ?? ''}
            placeholder="184000"
            className={FELT}
          />
        </label>
      </div>

      <div>
        <h3 className="hm-display mb-3 text-lg">Frister</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={ETIKETT}>EU-kontroll</span>
            <input
              name="eu_frist"
              type="date"
              defaultValue={kjøretøy.eu_frist ?? ''}
              className={FELT}
            />
          </label>

          <label>
            <span className={ETIKETT}>Forsikring forfaller</span>
            <input
              name="forsikring_forfall"
              type="date"
              defaultValue={kjøretøy.forsikring_forfall ?? ''}
              className={FELT}
            />
          </label>

          <label>
            <span className={ETIKETT}>Neste service</span>
            <input
              name="neste_service"
              type="date"
              defaultValue={kjøretøy.neste_service ?? ''}
              className={FELT}
            />
          </label>

          <label>
            <span className={ETIKETT}>Neste dekkskift</span>
            <input
              name="neste_dekkskift"
              type="date"
              defaultValue={kjøretøy.neste_dekkskift ?? ''}
              className={FELT}
            />
          </label>

          <label className="sm:col-span-2">
            <span className={ETIKETT}>Forsikringsselskap</span>
            <input
              name="forsikring_selskap"
              defaultValue={kjøretøy.forsikring_selskap ?? ''}
              placeholder="Gjensidige"
              className={FELT}
            />
          </label>
        </div>
      </div>

      <label className="block">
        <span className={ETIKETT}>Notat</span>
        <textarea
          name="notat"
          rows={3}
          defaultValue={kjøretøy.notat ?? ''}
          placeholder="Hengerfeste, bomavtale, hvem som har nøkkel …"
          className={FELT}
        />
      </label>

      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}
      {tilstand.ok && (
        <p
          role="status"
          className="border-l-4 border-hm-green bg-hm-green/10 p-3 text-sm font-semibold text-hm-green"
        >
          {tilstand.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={venter}
        className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-5 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
      >
        {venter ? 'Lagrer …' : 'Lagre endringer'}
      </button>
    </form>
  )
}
```

- [ ] **Steg 3: Skriv detaljsiden**

Opprett `src/app/admin/(panel)/kjoretoy/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { vegvesenErSattOpp } from '@/lib/vegvesen'
import { fristerFor } from '@/lib/frister'
import { dato, tid } from '@/lib/dato'
import {
  KJØRETØY_MERKE,
  KJØRETØY_STATUS_TEKST,
  type Kjøretøy,
  type KjøretøyStatus,
} from '@/lib/types'
import { KNAPP_LITEN, Kort, KortTittel, Merke, Seksjonstittel } from '@/components/ui'
import { BekreftKnapp } from '@/components/bekreft-knapp'
import { RedigerSkjema } from './rediger-skjema'
import { oppdaterFraVegvesen, slettKjøretøy } from './actions'

export const metadata: Metadata = { title: 'Kjøretøy – HM Utleie' }
export const dynamic = 'force-dynamic'

export default async function KjøretøyDetaljSide(
  props: PageProps<'/admin/kjoretoy/[id]'>,
) {
  await krevAdmin()
  const { id } = await props.params

  const supabase = await lagServerKlient()
  const { data } = await supabase.from('kjoretoy').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()

  const k = data as Kjøretøy
  const frister = fristerFor(k)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Seksjonstittel
          under={[k.merke, k.modell, k.arsmodell].filter(Boolean).join(' · ') || 'Ingen tekniske data'}
        >
          {k.internt_navn ?? k.reg_nr}
        </Seksjonstittel>
        <Merke type={KJØRETØY_MERKE[k.status as KjøretøyStatus] ?? 'nøytral'}>
          {KJØRETØY_STATUS_TEKST[k.status as KjøretøyStatus] ?? k.status}
        </Merke>
      </div>

      <Link href="/admin/kjoretoy" className="inline-block text-sm font-semibold underline">
        ← Alle kjøretøy
      </Link>

      <Kort>
        <KortTittel>Registreringsnummer</KortTittel>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="hm-tall border-2 border-[var(--kant-sterk)] px-3 py-1 text-lg font-bold tracking-widest">
            {k.reg_nr}
          </span>
          {k.reg_status && (
            <span className="text-sm text-[var(--blekk-svak)]">
              Vegvesen: {k.reg_status}
            </span>
          )}
        </div>
      </Kort>

      <Kort>
        <KortTittel>Frister</KortTittel>
        {frister.length === 0 ? (
          <p className="p-5 text-sm text-[var(--blekk-svak)]">
            Ingen frister er lagt inn ennå.
          </p>
        ) : (
          <ul className="divide-y-2 divide-[var(--kant)]">
            {frister.map((f) => (
              <li key={f.type} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                <span className="hm-display min-w-0 flex-1 text-base">{f.tekst}</span>
                <span className="hm-tall text-sm">{dato(f.dato)}</span>
                <span
                  className={`text-xs font-bold tracking-wider uppercase ${
                    f.dager < 0
                      ? 'text-hm-red-ink'
                      : f.dager <= 30
                        ? 'text-hm-amber'
                        : 'text-[var(--blekk-svak)]'
                  }`}
                >
                  {f.dager < 0
                    ? `Forfalt for ${Math.abs(f.dager)} dager siden`
                    : f.dager === 0
                      ? 'I dag'
                      : `Om ${f.dager} dager`}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* ── Kilde ─────────────────────────────────────────
            Sagt eksplisitt, fordi et tall man ikke vet hvor kommer
            fra, ikke er verdt noe når fristen nærmer seg. */}
        <div className="flex flex-wrap items-center gap-3 border-t-2 border-[var(--kant)] p-5">
          <span className="text-xs text-[var(--blekk-svak)]">
            {k.svv_hentet
              ? `Hentet fra Vegvesen ${tid(k.svv_hentet)}`
              : 'Lagt inn manuelt · aldri bekreftet mot Vegvesen'}
          </span>
          {vegvesenErSattOpp() && (
            <form action={oppdaterFraVegvesen.bind(null, k.id)}>
              <button type="submit" className={KNAPP_LITEN}>
                Oppdater fra Vegvesen
              </button>
            </form>
          )}
        </div>
      </Kort>

      <Kort>
        <KortTittel>Rediger</KortTittel>
        <RedigerSkjema kjøretøy={k} />
      </Kort>

      <Kort className="!border-hm-red">
        <KortTittel>Slett</KortTittel>
        <div className="space-y-3 p-5">
          <p className="text-sm text-[var(--blekk-svak)]">
            Er kjøretøyet solgt eller avskiltet, sett heller status – da beholder
            du historikken uten at det maser om frister.
          </p>
          <form action={slettKjøretøy.bind(null, k.id)}>
            <BekreftKnapp
              etikett="Slett kjøretøyet"
              bekreft={`Slett ${k.reg_nr}`}
              fare
            />
          </form>
        </div>
      </Kort>
    </div>
  )
}
```

- [ ] **Steg 4: Skriv skjelettet**

Opprett `src/app/admin/(panel)/kjoretoy/[id]/loading.tsx`:

```tsx
import { DetaljSkjelett } from '@/components/skjelett'

/**
 * Må finnes selv om den er triviell: uten en egen loading.tsx her
 * arver detaljsiden listeskjelettet fra mappa over, og da blinker
 * feil form opp før innholdet.
 */
export default function Laster() {
  return <DetaljSkjelett kort={4} />
}
```

- [ ] **Steg 5: Verifiser**

```bash
npx next typegen && npx tsc --noEmit && npm run lint
```
Forventet: ingen feil.

- [ ] **Steg 6: Se at det virker**

Åpne et kjøretøy i `npm run dev`. Endre felter, lagre, sjekk at verdiene
står igjen. Sjekk at «Oppdater fra Vegvesen» bare vises når nøkkelen finnes.
Sjekk at sletting fører tilbake til lista.

- [ ] **Steg 7: Commit**

```bash
git add "src/app/admin/(panel)/kjoretoy/[id]"
git commit -m "Detaljside for kjøretøy med frister og manuell oppfrisking"
```

---

## Oppgave 6: Lesetilgang for verkstedet

`krevAdmin()` sender servicebrukere til `/verksted`, så en side inne i
`(panel)` kan de aldri se. Derfor en egen, skrivebeskyttet rute.

**Viktig:** `/verksted` har **ingen `layout.tsx`**. Sidene der rendrer sin
egen svarte `<header>` og sin egen `<main>`, og arver ellers bare
rotlayouten. En ny side under `/verksted` som bare returnerer en `<div>`
havner uten topp og uten sidepadding. Malen under kopierer strukturen fra
`src/app/verksted/page.tsx:87-114`.

**Filer:**
- Opprett: `src/app/verksted/kjoretoy/page.tsx`
- Opprett: `src/app/verksted/kjoretoy/loading.tsx`
- Endre: `src/app/verksted/page.tsx`

- [ ] **Steg 1: Skriv siden**

Opprett `src/app/verksted/kjoretoy/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { krevVerkstedBruker } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { fristerFor } from '@/lib/frister'
import { dato } from '@/lib/dato'
import { KJØRETØY_STATUS_TEKST, type Kjøretøy, type KjøretøyStatus } from '@/lib/types'
import { HMLogo } from '@/components/hm-logo'
import { TomTilstand } from '@/components/ui'
import { BrukerMeny } from '../bruker-meny'

export const metadata: Metadata = { title: 'Kjøretøy – Verksted' }
export const dynamic = 'force-dynamic'

/**
 * Skrivebeskyttet fristoversikt for servicearbeidere.
 *
 * krevVerkstedBruker framfor hentVerkstedBruker med vilje: resten av
 * verkstedet er lesbart uten innlogging, og en liste over firmaets
 * kjøretøy med ansvarlige personer skal ikke være det.
 */
export default async function VerkstedKjøretøySide() {
  const bruker = await krevVerkstedBruker()

  const supabase = await lagServerKlient()
  const { data } = await supabase
    .from('kjoretoy')
    .select('*')
    .eq('status', 'i_drift')
    .order('eu_frist', { ascending: true, nullsFirst: false })
    .limit(500)

  const alle = (data ?? []) as Kjøretøy[]
  const haster = alle.filter((k) =>
    fristerFor(k).some((f) => f.dager <= 30),
  ).length

  return (
    <>
      {/* Samme topp som /verksted – uten den henger siden i løse lufta,
          siden mappa ikke har noen layout.tsx. */}
      <header className="relative overflow-hidden bg-hm-black px-5 pt-6 pb-8 text-white">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-16 h-[160%] w-40 skew-x-[-18deg] bg-hm-red/90"
        />
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <HMLogo størrelse="sm" />
            <BrukerMeny bruker={bruker} />
          </div>

          <h1 className="hm-display mt-6 text-3xl">Kjøretøy</h1>
          <p className="mt-1 text-sm text-white/70">
            {alle.length} i drift ·{' '}
            {haster > 0 ? (
              <span className="font-bold text-hm-red">{haster} med frist snart</span>
            ) : (
              'ingen frister nær'
            )}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-7">
        <Link
          href="/verksted"
          className="mb-6 inline-block text-sm font-semibold underline"
        >
          ← Verkstedet
        </Link>

        {alle.length === 0 ? (
          <TomTilstand tittel="Ingen kjøretøy">
            Ingen kjøretøy er registrert ennå. En admin legger dem inn under
            Kjøretøy i adminpanelet.
          </TomTilstand>
        ) : (
          <ul className="divide-y-2 divide-[var(--kant)] border-2 border-[var(--kant)]">
            {alle.map((k) => {
              const eu = fristerFor(k).find((f) => f.type === 'eu')
              return (
                <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                  <span className="hm-tall shrink-0 border-2 border-[var(--kant-sterk)] px-2 py-0.5 text-sm font-bold tracking-wider">
                    {k.reg_nr}
                  </span>
                  <span className="hm-display min-w-0 flex-1 truncate text-base">
                    {k.internt_navn || [k.merke, k.modell].filter(Boolean).join(' ') || '–'}
                  </span>
                  <span className="text-xs text-[var(--blekk-svak)]">
                    {KJØRETØY_STATUS_TEKST[k.status as KjøretøyStatus] ?? k.status}
                  </span>
                  <span
                    className={`hm-tall text-xs ${
                      !eu
                        ? 'text-[var(--blekk-svak)]'
                        : eu.dager < 0
                          ? 'font-bold text-hm-red-ink'
                          : eu.dager <= 30
                            ? 'font-bold text-hm-amber'
                            : 'text-[var(--blekk-svak)]'
                    }`}
                  >
                    {eu ? `EU ${dato(eu.dato)}` : 'EU-frist ukjent'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        <p className="mt-6 text-xs text-[var(--blekk-svak)]">
          Skrivebeskyttet. Endringer gjøres i adminpanelet.
        </p>
      </main>
    </>
  )
}
```

- [ ] **Steg 2: Skriv skjelettet**

Opprett `src/app/verksted/kjoretoy/loading.tsx`:

```tsx
import { ListeSkjelett } from '@/components/skjelett'

export default function Laster() {
  return <ListeSkjelett antall={6} />
}
```

- [ ] **Steg 3: Lenke fra verkstedforsiden**

I `src/app/verksted/page.tsx`, i headeren: legg lenken rett etter
undertittelen med kategoriene (`<p className="mt-0.5 text-sm text-white/60">`,
rundt linje 100), altså før avsnittet som teller maskiner. Den skal se ut som
en del av den svarte headeren, ikke som en knapp fra det lyse innholdet:

```tsx
          <Link
            href="/verksted/kjoretoy"
            className="mt-3 inline-flex min-h-[2.75rem] items-center border-2 border-white/30 px-4 text-xs font-bold tracking-wider text-white uppercase transition-colors hover:border-white"
          >
            Kjøretøy og frister →
          </Link>
```

`Link` er allerede importert i fila (linje 2). Ikke importer den på nytt.

- [ ] **Steg 4: Verifiser**

```bash
npx next typegen && npx tsc --noEmit && npm run lint
```

- [ ] **Steg 5: Se at tilgangen stemmer**

Logg inn som en servicebruker. `/verksted/kjoretoy` skal vise lista.
`/admin/kjoretoy` skal sende deg til `/verksted`. Logg ut helt:
`/verksted/kjoretoy` skal sende deg til innlogging.

- [ ] **Steg 6: Commit**

```bash
git add src/app/verksted
git commit -m "Skrivebeskyttet kjøretøyliste for verkstedet"
```

---

## Oppgave 7: E-postvarsel

**Filer:**
- Endre: `src/lib/epost/send.ts:5-24`
- Endre: `src/lib/epost/maler.ts` (legg til nederst)
- Endre: `src/lib/epost/varsler.ts` (legg til nederst)

**Grensesnitt:**
- Bruker: `kommendeFrister`, `treffserTerskel` (oppgave 3).
- Produserer: `maler.euKontrollAdmin(...)`, `varsleEuKontroll()`.

- [ ] **Steg 1: Utvid varseltypen og innstillingene**

I `src/lib/epost/send.ts`, legg til i `Varseltype`-unionen (etter linje 11):

```ts
  | 'eu_kontroll_admin'
```

og i `Innstillinger`-typen (etter linje 23):

```ts
  varsle_eu_kontroll: boolean
```

`epost_logg.type` er `text` uten check-constraint, så typen krever ingen
migrasjon.

- [ ] **Steg 2: Skriv malen**

Legg til nederst i `src/lib/epost/maler.ts`:

```ts
/**
 * Samleoversikt over frister på egne kjøretøy.
 *
 * Kolonnen «hva» finnes fordi e-posten dekker EU-kontroll, forsikring,
 * service og dekkskift – uten den vet ikke mottakeren hvilken frist det
 * gjelder, bare at noe forfaller.
 */
export function euKontrollAdmin(
  firmanavn: string,
  nettadresse: string,
  rader: { reg_nr: string; navn: string; hva: string; frist: string; dager: number }[],
): Mal {
  const forfalte = rader.filter((r) => r.dager < 0).length
  const emne =
    forfalte > 0
      ? `${forfalte} ${forfalte === 1 ? 'frist er' : 'frister er'} forfalt på kjøretøy`
      : `${rader.length} ${rader.length === 1 ? 'frist' : 'frister'} nærmer seg på kjøretøy`

  const dagerTekst = (d: number) =>
    d < 0 ? `${Math.abs(d)} d over` : d === 0 ? 'i dag' : `${d} d`

  return {
    emne,
    html: ramme(
      'Frister på kjøretøy',
      h1(emne) +
        p('Fristene under gjelder kjøretøy som står som i drift.') +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #e4e4e7">
      <tr style="background:${SVART}">
        <td style="padding:8px 10px;color:#fff;font-size:11px;letter-spacing:.8px">KJØRETØY</td>
        <td style="padding:8px 10px;color:#fff;font-size:11px;letter-spacing:.8px">HVA</td>
        <td style="padding:8px 10px;color:#fff;font-size:11px;letter-spacing:.8px;text-align:right">FRIST</td>
      </tr>
      ${rader
        .map(
          (r, i) => `<tr${i % 2 ? ' style="background:#fafafa"' : ''}>
        <td style="padding:9px 10px;font-size:14px;font-weight:600">${esc(r.reg_nr)}<br><span style="color:#71717a;font-size:12px">${esc(r.navn)}</span></td>
        <td style="padding:9px 10px;font-size:14px">${esc(r.hva)}</td>
        <td style="padding:9px 10px;font-size:14px;text-align:right">${esc(dato(r.frist))}<br><span style="font-size:12px;font-weight:700;color:${r.dager < 0 ? RØD : '#71717a'}">${esc(dagerTekst(r.dager))}</span></td>
      </tr>`,
        )
        .join('')}
    </table>` +
        knapp(`${nettadresse}/admin/kjoretoy?status=frist`, 'Se alle frister'),
      firmanavn,
    ),
    tekst:
      `${emne}:\n\n` +
      rader
        .map((r) => `- ${r.reg_nr} · ${r.hva} · ${dato(r.frist)} (${dagerTekst(r.dager)})`)
        .join('\n') +
      `\n\n${nettadresse}/admin/kjoretoy?status=frist`,
  }
}
```

- [ ] **Steg 3: Skriv varselet**

Legg til nederst i `src/lib/epost/varsler.ts`:

```ts
/**
 * Samle-e-post om frister på egne kjøretøy.
 *
 * Sender bare på dager der noe treffer en terskel nøyaktig, eller
 * nettopp har forfalt. «Alt under 30 dager» ville gitt samme e-post
 * tretti dager på rad, og da leser ingen den den dagen det gjelder.
 */
export async function varsleEuKontroll(): Promise<{
  frister: number
  sendt: boolean
  hoppetOver: string | null
}> {
  const innst = await hentVarselInnstillinger()
  if (!innst) return { frister: 0, sendt: false, hoppetOver: 'ingen innstillinger' }
  if (!innst.varsle_eu_kontroll) {
    return { frister: 0, sendt: false, hoppetOver: 'avslått' }
  }

  const { data } = await supabaseAdmin
    .from('kjoretoy')
    .select('*')
    .eq('status', 'i_drift')
    .limit(500)

  const alle = kommendeFrister((data ?? []) as Kjøretøy[])
  if (alle.length === 0) return { frister: 0, sendt: false, hoppetOver: 'ingenting nær frist' }
  if (!treffserTerskel(alle)) {
    return { frister: alle.length, sendt: false, hoppetOver: 'ingen terskel i dag' }
  }

  /*
   * epost_logg.leie_id er fremmednøkkel mot leier og kan ikke peke på
   * et kjøretøy, så den unike indeksen som stopper dobbeltsending for
   * purringer dekker ikke denne typen. Dedup må derfor skje her.
   */
  const iDag = new Date().toISOString().slice(0, 10)
  const { data: alt } = await supabaseAdmin
    .from('epost_logg')
    .select('id')
    .eq('type', 'eu_kontroll_admin')
    .eq('status', 'sendt')
    .gte('sendt', `${iDag}T00:00:00`)
    .maybeSingle()

  if (alt) return { frister: alle.length, sendt: false, hoppetOver: 'allerede sendt i dag' }

  const m = maler.euKontrollAdmin(
    innst.firmanavn ?? '',
    env.NEXT_PUBLIC_SITE_URL,
    alle.map((f) => ({
      reg_nr: f.kjøretøy.reg_nr,
      navn:
        f.kjøretøy.internt_navn ??
        [f.kjøretøy.merke, f.kjøretøy.modell].filter(Boolean).join(' '),
      hva: f.tekst,
      frist: f.dato,
      dager: f.dager,
    })),
  )

  const sendt = await sendEpost({
    type: 'eu_kontroll_admin',
    til: adresser(innst.varsel_epost),
    kopi: adresser(innst.varsel_kopi),
    emne: m.emne,
    html: m.html,
    tekst: m.tekst,
    avsenderNavn: innst.avsender_navn,
  })

  return { frister: alle.length, sendt, hoppetOver: null }
}
```

Legg til øverst i samme fil, i importblokken:

```ts
import { kommendeFrister, treffserTerskel } from '@/lib/frister'
```

og utvid den eksisterende typeimporten på linje 3 til:

```ts
import type { Kjøretøy, Kunde, Leie, Maskin } from '@/lib/types'
```

- [ ] **Steg 4: Verifiser**

```bash
npx tsc --noEmit && npm run lint
```
Forventet: ingen feil. Merk at `maler.ts` allerede importerer `dato` fra
`@/lib/dato` på linje 2 — ikke importer den på nytt.

- [ ] **Steg 5: Commit**

```bash
git add src/lib/epost
git commit -m "Fristvarsel på e-post, kun på terskeldager"
```

---

## Oppgave 8: Cron og innstillingsbryter

**Filer:**
- Opprett: `src/app/api/kjoretoy/oppdater/route.ts`
- Endre: `vercel.json`
- Endre: `src/app/admin/(panel)/innstillinger/varsel-skjema.tsx:9-19, 96-115`
- Endre: `src/app/admin/(panel)/innstillinger/actions.ts` (`varselSkjema`, `lagreVarsling`)
- Endre: `src/app/admin/(panel)/innstillinger/page.tsx`

- [ ] **Steg 1: Skriv ruten**

Opprett `src/app/api/kjoretoy/oppdater/route.ts`:

```ts
import { hentAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hentKjøretøy } from '@/lib/vegvesen'
import { varsleEuKontroll } from '@/lib/epost/varsler'
import { dagerTil, osloDag } from '@/lib/dato'
import type { Kjøretøy } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Så mange oppslag rekker vi trygt innenfor maxDuration. */
const PER_KJØRING = 50

/**
 * Frisker opp kjøretøydata fra Vegvesen og sender fristvarselet.
 *
 * Kjøres daglig av Vercel Cron (se vercel.json), og kan kjøres manuelt
 * fra adminpanelet. Cron-kall autentiseres med CRON_SECRET. Uten den
 * sjekken kunne hvem som helst tømt API-kvoten deres.
 *
 * Hele parken friskes ikke opp hver natt. EU-fristen endres én gang
 * hvert eller annethvert år per bil – den kan ikke regnes ut lokalt,
 * men den endrer seg heller ikke ofte nok til å rettferdiggjøre
 * daglige oppslag på alt.
 */
export async function GET(request: Request) {
  const hemmelighet = process.env.CRON_SECRET
  const header = request.headers.get('authorization')
  const fraCron = Boolean(hemmelighet) && header === `Bearer ${hemmelighet}`

  if (!fraCron && !(await hentAdmin())) {
    return new Response(null, { status: 401 })
  }

  const oppdatert = await friskOpp()
  const varsel = await varsleEuKontroll()

  return Response.json({
    oppdatert,
    varsel,
    kilde: fraCron ? 'cron' : 'manuelt',
    tid: new Date().toISOString(),
  })
}

/**
 * Prioriteringen, i rekkefølge:
 *   1. aldri hentet
 *   2. frist innen 90 dager og ikke hentet i dag
 *   3. eldst hentet, over 7 dager gammel
 *
 * Sortert i minnet framfor tre SQL-spørringer. Parken er liten nok, og
 * én enkel sammenligningsfunksjon er lettere å ha rett enn tre
 * spørringer som skal utfylle hverandre uten overlapp.
 */
async function friskOpp(): Promise<{ forsøkt: number; endret: number; feilet: number }> {
  const { data } = await supabaseAdmin
    .from('kjoretoy')
    .select('*')
    .eq('status', 'i_drift')
    .limit(500)

  const alle = (data ?? []) as Kjøretøy[]
  const iDag = osloDag(new Date())

  const prioritet = (k: Kjøretøy): number => {
    if (!k.svv_hentet) return 0
    if (osloDag(k.svv_hentet) === iDag) return 3
    if (k.eu_frist && dagerTil(k.eu_frist) <= 90) return 1
    const alder = dagerTil(k.svv_hentet)
    return alder <= -7 ? 2 : 3
  }

  const kø = alle
    .map((k) => ({ k, p: prioritet(k) }))
    .filter((x) => x.p < 3)
    .sort((a, b) => a.p - b.p || (a.k.svv_hentet ?? '').localeCompare(b.k.svv_hentet ?? ''))
    .slice(0, PER_KJØRING)

  let endret = 0
  let feilet = 0
  let behandlet = 0

  for (const { k } of kø) {
    const oppslag = await hentKjøretøy(k.reg_nr)

    if (oppslag.status === 'nøkkelfeil') {
      // Uten gyldig nøkkel er hele køen nytteløs. Å kjøre gjennom resten
      // ville bare brent kjøretid på samme svar. Resten telles som
      // feilet, inkludert denne.
      feilet += kø.length - behandlet
      break
    }

    behandlet++

    if (oppslag.status !== 'ok') {
      feilet++
      continue
    }

    const { error } = await supabaseAdmin
      .from('kjoretoy')
      .update({
        ...oppslag.data,
        svv_hentet: new Date().toISOString(),
        oppdatert: new Date().toISOString(),
      })
      .eq('id', k.id)

    if (error) feilet++
    else endret++
  }

  return { forsøkt: kø.length, endret, feilet }
}
```

- [ ] **Steg 2: Legg til cron-jobben**

Erstatt innholdet i `vercel.json` med:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["fra1"],
  "crons": [
    {
      "path": "/api/varsler/forfalt",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/kjoretoy/oppdater",
      "schedule": "0 6 * * *"
    }
  ]
}
```

- [ ] **Steg 3: Valider vercel.json**

```bash
npm run sjekk:vercel
```
Forventet: OK. En ugyldig `vercel.json` har allerede kostet et helt bygg i
dette prosjektet — hopp aldri over dette steget.

- [ ] **Steg 4: Legg til bryteren i innstillingene**

I `src/app/admin/(panel)/innstillinger/varsel-skjema.tsx`, legg til i
`Varsling`-typen (etter `varsle_forfalt` på linje 15):

```ts
  varsle_eu_kontroll: boolean
```

og legg til en fjerde `<Bryter>` i «Til dere»-seksjonen. Endre samtidig
grid-klassen på den seksjonen fra `sm:grid-cols-3` til `sm:grid-cols-2`, så
fire brytere legger seg to og to i stedet for tre pluss én:

```tsx
          <Bryter
            navn="varsle_eu_kontroll"
            tittel="Frister på kjøretøy"
            beskrivelse="EU-kontroll, forsikring, service og dekkskift. Sendes 30, 14 og 3 dager før, og når noe forfaller."
            standard={varsling.varsle_eu_kontroll}
          />
```

- [ ] **Steg 5: Lagre feltet**

I `src/app/admin/(panel)/innstillinger/actions.ts`:

I `varselSkjema`, etter `varsle_forfalt: av,`:

```ts
  varsle_eu_kontroll: av,
```

I `safeParse`-objektet i `lagreVarsling`, etter
`varsle_forfalt: formData.get('varsle_forfalt'),`:

```ts
    varsle_eu_kontroll: formData.get('varsle_eu_kontroll'),
```

I `.update({...})`, etter `varsle_forfalt: felter.data.varsle_forfalt,`:

```ts
      varsle_eu_kontroll: felter.data.varsle_eu_kontroll,
```

Utvid også `varslerAdmin`-sjekken, slik at man ikke kan slå på fristvarsel
uten mottaker:

```ts
  const varslerAdmin =
    felter.data.varsle_ny_leie ||
    felter.data.varsle_retur ||
    felter.data.varsle_forfalt ||
    felter.data.varsle_eu_kontroll
```

- [ ] **Steg 6: Send feltet inn i skjemaet**

I `src/app/admin/(panel)/innstillinger/page.tsx`, i `varsling`-objektet som
sendes til `<VarselSkjema>` (linje 178–188), legg til rett etter
`varsle_forfalt: innst?.varsle_forfalt ?? true,` på linje 184:

```ts
            varsle_eu_kontroll: innst?.varsle_eu_kontroll ?? true,
```

Standarden `true` må matche `default true` i migrasjonen, ellers viser
skjemaet av mens databasen står på.

- [ ] **Steg 7: Verifiser**

```bash
npx next typegen && npx tsc --noEmit && npm run lint
```

- [ ] **Steg 8: Kjør jobben manuelt**

Med `npm run dev` og innlogget adminbrukers cookie, åpne
`http://localhost:3000/api/kjoretoy/oppdater` i nettleseren. Forventet: JSON
med `oppdatert` og `varsel`. Uten SVV-nøkkel skal `oppdatert.feilet` være
lik `forsøkt` og ingenting krasje. Uten Resend-nøkkel skal `varsel.sendt`
være `false` og en `feilet`-rad dukke opp i `epost_logg` — synlig under
Innstillinger.

- [ ] **Steg 9: Commit**

```bash
git add src/app/api/kjoretoy vercel.json "src/app/admin/(panel)/innstillinger"
git commit -m "Daglig oppfrisking fra Vegvesen og bryter for fristvarsel"
```

---

## Oppgave 9: Dashbord, personvern og sluttverifisering

**Filer:**
- Endre: `src/app/admin/(panel)/page.tsx`
- Endre: `src/app/personvern/page.tsx`

- [ ] **Steg 1: Hent fristene på dashbordet**

I `src/app/admin/(panel)/page.tsx`:

**a)** Utvid typeimporten på linje 8 — ikke legg til en ny importlinje:

```ts
import type { Kjøretøy, Kunde, Leie, Maskin } from '@/lib/types'
```

**b)** Legg til under den, etter linje 8:

```ts
import { kommendeFrister } from '@/lib/frister'
```

`dato` og `dagerTil` er allerede importert på linje 6. Ikke rør den linja.

**c)** Utvid `Promise.all`-blokken (linje 20–46). Destrukturering og array
må endres samtidig, ellers havner verdiene i feil variabel. Endre
destruktureringen på linje 20–21 til:

```ts
  const [
    { data: aktiveData },
    { data: venterData },
    { data: ufakturertData },
    ledige,
    { data: hendelser },
    { data: kjøretøyData },
  ] = await Promise.all([
```

og legg til som siste element i arrayet, etter `hendelser`-spørringen på
linje 45:

```ts
      supabase.from('kjoretoy').select('*').eq('status', 'i_drift').limit(500),
```

**d)** Regn ut lista sammen med de andre avledningene, etter
`const forfalt = ...` på linje 51:

```ts
  const kjøretøyFrister = kommendeFrister((kjøretøyData ?? []) as Kjøretøy[], 30)
```

- [ ] **Steg 2: Vis dem under «Krever handling»**

Legg til rett etter `forfalt`-kortet, som slutter med `)}` på linje 151 —
altså mellom det og `<div className="grid gap-6 lg:grid-cols-2">` på linje
153. Samme form som kortene over:

```tsx
      {kjøretøyFrister.length > 0 && (
        <Kort className="!border-hm-amber">
          <h2 className="hm-display bg-hm-amber px-5 py-3 text-lg text-white">
            Frister på kjøretøy · {kjøretøyFrister.length}
          </h2>
          <ul className="divide-y-2 divide-[var(--kant)]">
            {kjøretøyFrister.map((f) => (
              <li key={`${f.kjøretøy.id}-${f.type}`}>
                <Link
                  href={`/admin/kjoretoy/${f.kjøretøy.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition-colors hover:bg-[var(--flate-2)]"
                >
                  <span className="hm-tall shrink-0 text-sm font-bold tracking-wider">
                    {f.kjøretøy.reg_nr}
                  </span>
                  <span className="hm-display min-w-0 flex-1 truncate text-base">
                    {f.tekst}
                  </span>
                  <span className="hm-tall text-xs text-[var(--blekk-svak)]">
                    {dato(f.dato)}
                  </span>
                  <span
                    className={`text-xs font-bold tracking-wider uppercase ${
                      f.dager < 0 ? 'text-hm-red-ink' : 'text-hm-amber'
                    }`}
                  >
                    {f.dager < 0 ? 'Forfalt →' : `Om ${f.dager} d →`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Kort>
      )}
```

- [ ] **Steg 3: Nevn persondataene i personvernerklæringen**

`src/app/personvern/page.tsx` er skrevet til **kunden** («Navn, mobilnummer
… når du leier»). Ansattopplysninger hører ikke hjemme i den lista — de
gjelder en annen person enn den som leser. Legg dem derfor i et eget,
kort avsnitt til slutt framfor å blande dem inn.

Legg til et nytt `<Avsnitt>` etter det siste eksisterende avsnittet i
`<main>`-blokken, i samme form som de andre:

```tsx
        <Avsnitt tittel="Ansatte">
          For ansatte som står som ansvarlig for et av firmaets kjøretøy,
          lagrer vi navn og e-postadresse. Opplysningene er bare synlige for
          innloggede brukere, brukes utelukkende til å holde oversikt over
          frister som EU-kontroll, og slettes når kjøretøyet tas ut av
          registeret.
        </Avsnitt>
```

`Avsnitt` er allerede definert i fila. Ikke lag en ny variant.

- [ ] **Steg 4: Full verifisering**

```bash
npx next typegen && npx tsc --noEmit && npm run lint && npm run build
```
Forventet: bygget går gjennom uten feil. `next build` kjører ikke lint selv
— derfor kjøres begge.

```bash
npm run sjekk:vercel
```

```bash
node --env-file=.env.local scripts/sjekk-migrasjoner.mjs
```
Forventet: alle ni migrasjoner er kjørt.

- [ ] **Steg 5: Gå gjennom modulen i nettleseren**

Med `npm run dev`:

1. `/admin/kjoretoy` — legg inn to kjøretøy, ett med EU-frist om under 30
   dager og ett med frist langt fram.
2. Sjekk at «Frist snart»-filteret bare viser det første.
3. Sjekk at søk på skiltet treffer, også skrevet med mellomrom.
4. `/admin` — sjekk at fristkortet dukker opp, og at det ikke gjør det når
   ingenting forfaller innen 30 dager.
5. `/admin/innstillinger?fane=varsling` — slå bryteren av og på, lagre,
   last på nytt og sjekk at verdien står.
6. Sett den ene bilen til «Solgt» og sjekk at den forsvinner fra
   fristlista og fra verkstedlista.
7. Sjekk hele modulen i mørk modus og på mobilbredde.

- [ ] **Steg 6: Commit**

```bash
git add "src/app/admin/(panel)/page.tsx" src/app/personvern/page.tsx
git commit -m "Kjøretøyfrister på dashbordet, og personvern oppdatert"
```

---

## Etter at planen er kjørt

To ting gjenstår som ikke er kode, og som eier må gjøre:

1. **Migrasjonen** limes inn i Supabase SQL Editor (oppgave 1, steg 6).
2. **Nøklene** legges inn i Vercel: `SVV_API_KEY` for Vegvesen-oppslaget,
   og `RESEND_API_KEY` + `VARSEL_FRA` for at e-postene faktisk skal gå ut.
   Modulen virker uten begge, men da manuelt og uten varsel.

Første gang `SVV_API_KEY` finnes:

```bash
node --env-file=.env.local scripts/sjekk-vegvesen.mjs EK12345
```

Les utskriften og sammenlign med det speccen lister som ikke verifisert —
særlig formatet på `kontrollfrist` og hva et ukjent skilt faktisk svarer.
Avviker noe, er `src/lib/vegvesen.ts` det eneste stedet som må rettes.
