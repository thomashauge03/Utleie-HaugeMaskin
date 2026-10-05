# Kalenderen som tidslinje – implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Månedsrutenettet i `/admin/kalender` byttes ut med en tidslinje – én rad per maskin, én kolonne per dag – som viser alle leier og reservasjoner uten «+N til».

**Architecture:** Rene funksjoner i `src/lib/tidslinje.ts` plasserer en periode i måneden og fordeler overlappende stolper på baner (testet med node:test). En presentasjonskomponent tegner ferdige rader med CSS grid og `grid-cols-subgrid`; en liten klientkomponent ruller til i dag. Sida henter som før og gjør leier og reservasjoner om til rader.

**Tech Stack:** Next.js 16.2 (App Router, serverkomponenter), React 19, Tailwind CSS 4, Supabase, node:test.

**Spec:** `docs/superpowers/specs/2026-10-05-kalender-tidslinje-design.md`

## Global Constraints

- Ingen databaseendring og ingen migrasjon.
- All tekst i grensesnittet er bokmål. «På ubestemt tid» brukes om leier uten dato, aldri «til videre».
- Filer som testes med node:test (`src/lib/*.test.mjs`) importerer bare typer fra `@/` – node løser ikke opp `@/`-stier.
- Datoer er norske kalenderdager `yyyy-mm-dd` og sammenlignes som tekst; Oslo-dag fra tidspunkt med `osloDag`.
- Les `node_modules/next/dist/docs/` før Next-spesifikk kode (AGENTS.md).
- Verifisering skjer mot lokal Supabase i Docker, aldri produksjon, og bare på `localhost` (Next dev sperrer `127.0.0.1`).
- Commit-meldinger på bokmål, med `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Plassering og baner – `src/lib/tidslinje.ts`

**Files:**
- Create: `src/lib/tidslinje.ts`
- Test: `src/lib/tidslinje.test.mjs`

**Interfaces:**
- Produces:
  - `type Periode = { fra: string; til: string | null }`
  - `type Plassering = { fraKol: number; tilKol: number; førMåneden: boolean; etterMåneden: boolean }`
  - `plasser(p: Periode, førsteDag: string, sisteDag: string): Plassering | null`
  - `baner<T extends Pick<Plassering, 'fraKol' | 'tilKol'>>(stolper: T[]): T[][]`

- [ ] **Step 1: Skriv testene som feiler**

```js
// src/lib/tidslinje.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baner, plasser } from './tidslinje.ts'

const OKTOBER = ['2026-10-01', '2026-10-31']

test('periode inne i måneden får dagene sine som kolonner', () => {
  assert.deepEqual(plasser({ fra: '2026-10-03', til: '2026-10-09' }, ...OKTOBER), {
    fraKol: 3,
    tilKol: 9,
    førMåneden: false,
    etterMåneden: false,
  })
})

test('periode som begynte før måneden, starter i kolonne 1', () => {
  assert.deepEqual(plasser({ fra: '2026-09-28', til: '2026-10-02' }, ...OKTOBER), {
    fraKol: 1,
    tilKol: 2,
    førMåneden: true,
    etterMåneden: false,
  })
})

test('uten slutt går perioden ut måneden og fortsetter', () => {
  assert.deepEqual(plasser({ fra: '2026-09-20', til: null }, ...OKTOBER), {
    fraKol: 1,
    tilKol: 31,
    førMåneden: true,
    etterMåneden: true,
  })
})

test('uten slutt dekker den hele neste måned også', () => {
  assert.deepEqual(plasser({ fra: '2026-10-05', til: null }, '2026-11-01', '2026-11-30'), {
    fraKol: 1,
    tilKol: 30,
    førMåneden: true,
    etterMåneden: true,
  })
})

test('slutt på siste dag i måneden fortsetter ikke', () => {
  assert.equal(plasser({ fra: '2026-10-20', til: '2026-10-31' }, ...OKTOBER).etterMåneden, false)
})

test('periode helt før eller helt etter måneden tegnes ikke', () => {
  assert.equal(plasser({ fra: '2026-09-08', til: '2026-09-15' }, ...OKTOBER), null)
  assert.equal(plasser({ fra: '2026-11-02', til: '2026-11-04' }, ...OKTOBER), null)
  assert.equal(plasser({ fra: '2026-11-02', til: null }, ...OKTOBER), null)
})

test('periode som slutter før den begynner, tegnes ikke', () => {
  assert.equal(plasser({ fra: '2026-10-10', til: '2026-10-08' }, ...OKTOBER), null)
})

test('stolper som overlapper, havner i hver sin bane', () => {
  const ubestemt = { id: 'ubestemt', fraKol: 1, tilKol: 31 }
  const reservasjon = { id: 'reservasjon', fraKol: 20, tilKol: 22 }
  assert.deepEqual(
    baner([reservasjon, ubestemt]).map((bane) => bane.map((s) => s.id)),
    [['ubestemt'], ['reservasjon']],
  )
})

test('stolper etter hverandre deler bane, men ikke når de deler en dag', () => {
  const a = { id: 'a', fraKol: 3, tilKol: 9 }
  const b = { id: 'b', fraKol: 10, tilKol: 12 }
  const c = { id: 'c', fraKol: 9, tilKol: 11 }
  assert.deepEqual(
    baner([b, c, a]).map((bane) => bane.map((s) => s.id)),
    [['a', 'b'], ['c']],
  )
})
```

- [ ] **Step 2: Kjør testene og se dem feile**

Run: `npm test`
Expected: `src/lib/tidslinje.test.mjs` feiler med «does not provide an export named 'baner'» (fila finnes ikke ennå). Legg så inn et skall som returnerer `null` / `[]`, og se påstandene feile.

- [ ] **Step 3: Skriv koden**

```ts
// src/lib/tidslinje.ts
/**
 * Tidslinja i admin-kalenderen: hvor en periode havner i en måned, og
 * hvordan stolper som overlapper fordeles på baner.
 *
 * Datoene er norske kalenderdager (yyyy-mm-dd) og kan sammenlignes som
 * tekst. Fila importerer ingenting, så den kan testes med node:test. Se
 * docs/superpowers/specs/2026-10-05-kalender-tidslinje-design.md.
 */

export type Periode = {
  /** Første dag, med. */
  fra: string
  /** Siste dag, med. Null er ingen slutt – på ubestemt tid. */
  til: string | null
}

export type Plassering = {
  /** Dagen i måneden stolpen begynner på (1–31). */
  fraKol: number
  /** Dagen i måneden stolpen slutter på (1–31). */
  tilKol: number
  /** Perioden begynte før måneden. */
  førMåneden: boolean
  /** Perioden fortsetter etter måneden, eller har ingen slutt. */
  etterMåneden: boolean
}

const dagIMåneden = (dag: string) => Number(dag.slice(8, 10))

/**
 * Hvor perioden havner i måneden fra førsteDag til sisteDag – eller null
 * når den ikke berører måneden.
 */
export function plasser(p: Periode, førsteDag: string, sisteDag: string): Plassering | null {
  if (p.fra > sisteDag) return null
  if (p.til !== null && (p.til < førsteDag || p.til < p.fra)) return null
  const etterMåneden = p.til === null || p.til > sisteDag
  return {
    fraKol: dagIMåneden(p.fra < førsteDag ? førsteDag : p.fra),
    tilKol: dagIMåneden(p.til === null || etterMåneden ? sisteDag : p.til),
    førMåneden: p.fra < førsteDag,
    etterMåneden,
  }
}

/**
 * Fordeler stolpene på baner så ingen overlapper: sortert etter start, og
 * hver stolpe i første bane der den får plass. To stolper som deler en
 * dag, overlapper.
 */
export function baner<T extends Pick<Plassering, 'fraKol' | 'tilKol'>>(stolper: T[]): T[][] {
  const ut: T[][] = []
  for (const s of [...stolper].sort((a, b) => a.fraKol - b.fraKol || a.tilKol - b.tilKol)) {
    const ledig = ut.find((bane) => bane[bane.length - 1].tilKol < s.fraKol)
    if (ledig) ledig.push(s)
    else ut.push([s])
  }
  return ut
}
```

- [ ] **Step 4: Kjør testene og se dem bestå**

Run: `npm test`
Expected: alle tester består (52 fra før + 9 nye = 61).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tidslinje.ts src/lib/tidslinje.test.mjs
git commit -m "Tidslinje: plassering i måneden og baner for overlapp, med tester"
```

---

### Task 2: Tidslinja i kalendersida

**Files:**
- Create: `src/app/admin/(panel)/kalender/tidslinje.tsx`
- Create: `src/app/admin/(panel)/kalender/rull-til-i-dag.tsx`
- Modify: `src/app/admin/(panel)/kalender/page.tsx` (rutenettet ut, tidslinja inn)
- Modify: `src/app/admin/(panel)/kalender/reservasjon-rad.tsx:6-9` (`ReservasjonVisning.maskiner`)

**Interfaces:**
- Consumes: `plasser`, `baner`, `Plassering` fra Task 1.
- Produces:
  - `type Stolpe = Plassering & { id: string; tekst: string; tittel: string; href?: string; klasse: string; ubestemt?: boolean }`
  - `type TidslinjeRad = { id: string; navn: string; internnummer: string | null; kategori: string | null; baner: Stolpe[][] }`
  - `Tidslinje({ rader, antallDager, førsteUkedag, iDag, tomTekst })`
  - `RullTilIDag({ className, children })` (klient)

- [ ] **Step 1: Klientkomponenten som ruller til i dag**

```tsx
// src/app/admin/(panel)/kalender/rull-til-i-dag.tsx
'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Ruller tidslinja sidelengs fram til dagens kolonne når siden åpnes. På
 * mobil er bare en uke synlig om gangen, og det er i dag og dagene etter
 * man vil se. Gjør ingenting når i dag ikke er i måneden, eller alt får
 * plass.
 */
export function RullTilIDag({ className, children }: { className: string; children: ReactNode }) {
  const boks = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const b = boks.current
    const iDag = b?.querySelector<HTMLElement>('[data-idag]')
    const maskinkol = b?.querySelector<HTMLElement>('[data-maskinkol]')
    if (!b || !iDag || !maskinkol || b.scrollWidth <= b.clientWidth) return
    // To dager før i dag synes også, så man ser hva som nettopp skjedde.
    const venstre = iDag.getBoundingClientRect().left - b.getBoundingClientRect().left + b.scrollLeft
    b.scrollLeft = venstre - maskinkol.offsetWidth - 2 * iDag.offsetWidth
  }, [])

  return (
    <div ref={boks} className={className}>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Tidslinja**

```tsx
// src/app/admin/(panel)/kalender/tidslinje.tsx
import { Fragment } from 'react'
import Link from 'next/link'
import type { Plassering } from '@/lib/tidslinje'
import { RullTilIDag } from './rull-til-i-dag'

/** Én stolpe – en leie eller en reservasjon – klar til å tegnes. */
export type Stolpe = Plassering & {
  id: string
  /** Leietakeren, eller «Reservert · kunde». */
  tekst: string
  /** Tooltipen: maskin, hvem og datoer. */
  tittel: string
  /** Leia stolpen lenker til. Reservasjoner har ingen egen side. */
  href?: string
  /** Farge og kant. */
  klasse: string
  /** Leie på ubestemt tid: «på ubestemt tid ▸» ytterst til høyre. */
  ubestemt?: boolean
}

export type TidslinjeRad = {
  id: string
  navn: string
  internnummer: string | null
  kategori: string | null
  baner: Stolpe[][]
}

const UKEDAG = ['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø']

/**
 * Måneden som tidslinje: én rad per maskin, én kolonne per dag. Stolper
 * som overlapper på samme maskin ligger i hver sin bane, så ingenting
 * skjules – uansett hvor mange leier det er. Henter ingenting selv.
 *
 * Radene deler kolonnene med toppraden gjennom `grid-cols-subgrid`.
 * Maskinkolonnen er sticky, så navnet synes når tidslinja rulles
 * sidelengs på mobil.
 */
export function Tidslinje({
  rader,
  antallDager,
  førsteUkedag,
  iDag,
  tomTekst,
}: {
  rader: TidslinjeRad[]
  antallDager: number
  /** Ukedagen den 1. faller på, mandag = 0. */
  førsteUkedag: number
  /** Dagens kolonne, eller null når i dag ikke er i måneden. */
  iDag: number | null
  tomTekst: string
}) {
  const dager = Array.from({ length: antallDager }, (_, i) => i + 1)
  const ukedag = (d: number) => (førsteUkedag + d - 1) % 7
  const helg = (d: number) => ukedag(d) >= 5

  return (
    <RullTilIDag className="overflow-x-auto border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] [--maskinkol:8.5rem] md:[--maskinkol:13rem]">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `var(--maskinkol) repeat(${antallDager}, minmax(2rem, 1fr))`,
          minWidth: `calc(var(--maskinkol) + ${antallDager * 2}rem)`,
        }}
      >
        <div className="col-span-full grid grid-cols-subgrid bg-hm-black text-white">
          <div
            data-maskinkol
            className="sticky left-0 z-20 flex items-end bg-hm-black px-3 py-2 text-[11px] font-bold tracking-widest uppercase"
          >
            Maskin
          </div>
          {dager.map((d) => (
            <div
              key={d}
              data-idag={d === iDag ? '' : undefined}
              className={`flex flex-col items-center py-1.5 ${helg(d) ? 'bg-white/10' : ''}`}
            >
              <span className="text-[10px] font-bold tracking-wider text-white/60 uppercase">
                {UKEDAG[ukedag(d)]}
              </span>
              <span
                className={`hm-tall inline-flex size-6 items-center justify-center text-sm font-bold ${
                  d === iDag ? 'bg-hm-red' : ''
                }`}
              >
                {d}
              </span>
            </div>
          ))}
        </div>

        {rader.length === 0 && (
          <p className="col-span-full p-6 text-sm text-[var(--blekk-svak)]">{tomTekst}</p>
        )}

        {rader.map((rad, i) => (
          <Fragment key={rad.id}>
            {(i === 0 || rad.kategori !== rader[i - 1].kategori) && (
              <div className="col-span-full border-t-2 border-[var(--kant-sterk)] bg-[var(--flate-2)]">
                <span className="sticky left-0 inline-block px-3 py-1.5 text-[11px] font-bold tracking-widest text-[var(--blekk-svak)] uppercase">
                  {rad.kategori ?? 'Uten kategori'}
                </span>
              </div>
            )}
            <div
              className="col-span-full grid grid-cols-subgrid border-t border-[var(--kant)]"
              style={{ gridTemplateRows: `repeat(${Math.max(rad.baner.length, 1)}, minmax(2rem, auto))` }}
            >
              <div
                className="sticky left-0 z-10 flex min-w-0 flex-col justify-center border-r border-[var(--kant)] bg-[var(--flate-opp)] px-3 py-1"
                style={{ gridColumn: 1, gridRow: '1 / -1' }}
              >
                <span className="truncate text-sm font-bold">{rad.navn}</span>
                {rad.internnummer && (
                  <span className="truncate text-[11px] text-[var(--blekk-svak)]">
                    {rad.internnummer}
                  </span>
                )}
              </div>
              {/* Helg og i dag, i hele radens høyde. */}
              {dager
                .filter((d) => helg(d) || d === iDag)
                .map((d) => (
                  <div
                    key={d}
                    aria-hidden
                    className={d === iDag ? 'bg-hm-red/10' : 'bg-[var(--flate-2)]'}
                    style={{ gridColumn: d + 1, gridRow: '1 / -1' }}
                  />
                ))}
              {rad.baner.map((bane, b) =>
                bane.map((s) => <StolpeVisning key={s.id} s={s} bane={b} />),
              )}
            </div>
          </Fragment>
        ))}
      </div>
    </RullTilIDag>
  )
}

function StolpeVisning({ s, bane }: { s: Stolpe; bane: number }) {
  const stil = { gridColumn: `${s.fraKol + 1} / ${s.tilKol + 2}`, gridRow: bane + 1 }
  const klasse = `relative z-[1] mx-px flex h-6 min-w-0 items-center gap-1.5 self-center overflow-hidden px-1.5 text-[11px] leading-none font-bold ${s.klasse}`
  const innhold = (
    <>
      <span className="min-w-0 truncate">
        {s.førMåneden && '◂ '}
        {s.tekst}
      </span>
      {s.ubestemt ? (
        <span className="ml-auto shrink-0 text-[9px] font-semibold tracking-wide uppercase">
          på ubestemt tid ▸
        </span>
      ) : (
        s.etterMåneden && <span className="ml-auto shrink-0">▸</span>
      )}
    </>
  )
  return s.href ? (
    <Link href={s.href} title={s.tittel} style={stil} className={`${klasse} hover:brightness-110`}>
      {innhold}
    </Link>
  ) : (
    <span title={s.tittel} style={stil} className={klasse}>
      {innhold}
    </span>
  )
}
```

- [ ] **Step 3: Reservasjonene får kategori og internnummer**

I `reservasjon-rad.tsx`, bytt typen:

```ts
export type ReservasjonVisning = Reservasjon & {
  notat: string | null
  maskiner?: { navn: string; kategori?: string | null; internnummer?: string | null } | null
}
```

I `page.tsx`, i spørringen mot `reservasjoner`, bytt `maskiner(navn)` med `maskiner(navn, kategori, internnummer)`.

- [ ] **Step 4: Sida bygger radene og tegner tidslinja**

I `page.tsx`:

1. Importer `import { baner, plasser } from '@/lib/tidslinje'` og `import { Tidslinje, type Stolpe, type TidslinjeRad } from './tidslinje'`.
2. Fjern `LEIER_PER_RUTE` og `UKEDAGER`. I kommentarene: `celleDag` gjelder «en dag i måneden», `farge` brukes «i tidslinja og i lista under».
3. Bytt blokken fra `/* Rutenettet starter på mandagen …` til og med `const ruter = …` med:

```ts
  const iDag = osloDag(nå)

  /*
   * Tidslinja: én rad per maskin med leie eller reservasjon i måneden.
   * Leiene strekkes som før (sluttFor); en leie på ubestemt tid har ingen
   * slutt og går ut til høyre kant.
   */
  const førsteDag = celleDag(førsteIMnd)
  const sisteDag = celleDag(new Date(år, måned + 1, 0))
  type Maskininfo = { navn: string; kategori?: string | null; internnummer?: string | null }
  const perMaskin = new Map<string, { info: Omit<TidslinjeRad, 'baner'>; stolper: Stolpe[] }>()
  const leggTil = (maskinId: string, maskin: Maskininfo | null | undefined, stolpe: Stolpe) => {
    const m = perMaskin.get(maskinId) ?? {
      info: {
        id: maskinId,
        navn: maskin?.navn ?? 'Ukjent maskin',
        kategori: maskin?.kategori ?? null,
        internnummer: maskin?.internnummer ?? null,
      },
      stolper: [],
    }
    m.stolper.push(stolpe)
    perMaskin.set(maskinId, m)
  }

  for (const l of leier) {
    const slutt = sluttFor(l, nå)
    const plass = plasser(
      { fra: osloDag(l.start_tid), til: slutt && osloDag(slutt) },
      førsteDag,
      sisteDag,
    )
    if (!plass) continue
    leggTil(l.maskin_id, l.maskiner, {
      ...plass,
      id: l.id,
      tekst: `${erForfalt(l) ? '⚠ ' : ''}${leietakerTekst(l)}`,
      tittel: `${l.maskiner?.navn ?? l.referanse} · ${leietakerTekst(l)} · ${datoKort(l.start_tid)} → ${tilTekst(l)}`,
      href: `/admin/leier/${l.id}`,
      klasse: `border border-[var(--kant-sterk)] ${farge(l)}`,
      ubestemt: påUbestemtTid(l),
    })
  }
  for (const r of reservasjoner) {
    const plass = plasser({ fra: r.fra_dato, til: r.til_dato }, førsteDag, sisteDag)
    if (!plass) continue
    // Forespørsler fra nettsida (reservasjoner del 3) er grå og sperrer ingenting.
    const forespurt = r.status === 'forespurt'
    leggTil(r.maskin_id, r.maskiner, {
      ...plass,
      id: r.id,
      tekst: `${forespurt ? '? Forespurt' : 'Reservert'} · ${r.kunde_navn}`,
      tittel: `${r.maskiner?.navn ?? 'Maskin'} · ${forespurt ? 'forespurt av' : 'reservert for'} ${r.kunde_navn} · ${kortDag(r.fra_dato)}–${kortDag(r.til_dato)}`,
      klasse: forespurt
        ? 'border border-dashed border-[var(--blekk-svak)] bg-[var(--flate-opp)] text-[var(--blekk-svak)]'
        : 'border border-dashed border-hm-amber bg-[var(--flate-opp)]',
    })
  }
  // Kategoriene alfabetisk og uten kategori sist; maskinene på navn.
  const rader: TidslinjeRad[] = [...perMaskin.values()]
    .map(({ info, stolper }) => ({ ...info, baner: baner(stolper) }))
    .sort(
      (a, b) =>
        Number(a.kategori === null) - Number(b.kategori === null) ||
        (a.kategori ?? '').localeCompare(b.kategori ?? '', 'nb') ||
        a.navn.localeCompare(b.navn, 'nb'),
    )
  const dagIDag = iDag.slice(0, 7) === førsteDag.slice(0, 7) ? Number(iDag.slice(8, 10)) : null
```

4. Bytt hele `{/* ── Månedsrutenett … */}`-blokken (fra `<div className="overflow-x-auto">` til og med dens avsluttende `</div>`) med:

```tsx
      {/* ── Tidslinje: én rad per maskin ──────────────────── */}
      <Tidslinje
        rader={rader}
        antallDager={antallDager}
        førsteUkedag={ukedagIndeks(førsteIMnd)}
        iDag={dagIDag}
        tomTekst={`Ingen leier eller reservasjoner i ${MND[måned]}.`}
      />
```

5. I forklaringen: `tekst="Forfalt · ⚠ = dag på overtid"` blir `tekst="Forfalt ⚠"`, og etter «Reservert» kommer `<span>◂ ▸ fortsetter fra forrige / til neste måned</span>`.
6. Under «Leier i …»: «Samme utleie som i rutenettet» blir «Samme utleie som i tidslinja».

- [ ] **Step 5: lint, typer, tester**

Run: `node <hovedmappa>/node_modules/next/dist/bin/next typegen && node <hovedmappa>/node_modules/typescript/bin/tsc --noEmit && node <hovedmappa>/node_modules/eslint/bin/eslint.js . && npm test`
Expected: ingen feil, 61 tester består.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/(panel)/kalender"
git commit -m "Kalenderen er en tidslinje: én rad per maskin, alle leier synes"
```

---

### Task 3: Verifisering med mange leier

**Files:** ingen i repoet. Prøvedata og nettleserskript ligger i øktens scratchpad og committes ikke.

- [ ] **Step 1: Mange prøveleier i den lokale basen**

Etter `seed.mjs` (7 maskiner, 6 leier, 1 reservasjon): legg til 10 maskiner til – én uten kategori og én ny kategori (Tilhengere) – og leier som dekker alle tilfellene: på ubestemt tid siden august (hele september–november), kundeleie over månedsskiftet, reservasjon rett etter en leie på samme maskin (samme bane), avsluttet leie som overlapper en ny (to baner), venter godkjenning, internleie med dato og en reservasjon som overlapper den (to baner), kundeleie på overtid, reservasjon over månedsskiftet, endagsleie. Skriptet nekter andre adresser enn `127.0.0.1`/`localhost`.

- [ ] **Step 2: Se tidslinja i nettleseren**

Med `next dev -p 3100` mot den lokale basen og playwright-core med Chrome headless (se minnet «lokal-rolletest»):
- Oktober 1280 px lyst og mørkt, og 375 px lyst og mørkt: ingen «+N til», alle stolper synes, overlapp ligger i egen bane, «på ubestemt tid ▸» ytterst til høyre, maskinnavnet blir stående når man ruller sidelengs, og 375 px åpner rullet fram til i dag.
- September og november: leia på ubestemt tid går gjennom hele måneden med «◂»; reservasjonen over månedsskiftet har «▸» i oktober og «◂» i november.
- En stolpe lenker til leia; reservasjonsskjemaet og listene under virker som før.

- [ ] **Step 3: Bygg**

Run: `npm run build` (med plassholdere for de fire miljøvariablene, se minnet «worktree-verifisering»)
Expected: exit 0.
