# Leieforespørsel fra haugemaskin.no – implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kunden velger datoer og sender en forespørsel fra maskinsida på haugemaskin.no; den blir en `forespurt` reservasjon i utleie-appen som admin godkjenner eller avslår.

**Architecture:** Nettleseren poster JSON rett til `POST /api/foresporsel` i utleie-appen (CORS for haugemaskin-domenene). Valideringen og overlappsjekken er rene funksjoner i `src/lib/foresporsel.ts`. Admin godkjenner i kalenderen. En daglig cron sletter gamle forespørsler.

**Tech Stack:** Next.js 16 route handlers, zod, Supabase (service role for endepunktet, RLS for admin), TanStack Start + react-day-picker 9 på hovedsida.

**Spec:** `docs/superpowers/specs/2026-09-30-leieforesporsel-design.md`

## Global Constraints

- Grenser: 5 forsøk/time/IP, 3 åpne forespørsler per mobil, høyst 60 dager, `til` høyst ett år fram, melding ≤ 500, navn 2–100, minst 3 s fra visning til innsending.
- CORS kun for `https://haugemaskin.no`, `https://www.haugemaskin.no`, `https://haugemaskin.vercel.app`, og `http://localhost:*` utenfor produksjon.
- En forespørsel sperrer ingenting; bare `aktiv` gjør det.
- Ingen skriving til produksjonsdatabasen under testing. Hovedsida bruker `VITE_UTLEIE_APP_URL` når den er satt.
- utleie-app: bokmål. hm-web-craft: kommentarer og commits på nynorsk, UI på bokmål.
- Worktrees: `utleie-app/.claude/worktrees/foresporsel` (gren `foresporsel`) og `hm-web-craft/.claude/worktrees/foresporsel` (gren `foresporsel`). Ingen push uten ja; migrasjon 0013 kjøres av Thomas.

---

### Task 1: Regler og tester (utleie-app)

`src/lib/foresporsel.ts` + `src/lib/foresporsel.test.mjs`:
- `validerForesporsel(kropp: unknown, iDag: string, nå: number)` → `{ ok: true; data: Forespørsel } | { ok: false; feil: string; status: number }`. Forespørsel: `maskin_id, fra, til, navn, telefon (normalisert), epost | null, melding | null`. Honningfelt `nettside` fylt eller `startet` mindre enn 3 000 ms før `nå` → generisk feil. Tester for hver rad i spec-tabellen som ikke trenger databasen.
- `overlapper(fra, til, perioder: { fra: string; til: string }[])` → boolean, begge dager med. Tester for kant-dager.
- `opptattePerioder(reservasjoner, leier, iDag)` → perioder: aktive reservasjoner som de er; leie fra `osloDag(start_tid)` til `max(osloDag(planlagt_slutt), iDag)`, eller til `iDag` uten slutt. Tester.

### Task 2: Migrasjon 0013 (utleie-app)

`supabase/migrations/0013_foresporsel.sql`: `alter table reservasjoner add column if not exists kunde_epost text` med kommentar. Kjør 0001–0013 i PGlite-harnessen, to ganger for 0013.

### Task 3: Endepunkt, varsel og sletting (utleie-app)

- `src/app/api/foresporsel/route.ts`: `OPTIONS` (preflight) og `POST` med CORS-hodene på alle svar; rekkefølge: tak per IP → JSON → `validerForesporsel` → maskin aktiv → `opptattePerioder` + `overlapper` → åpne per mobil → insert `forespurt` → `after(() => varsleNyForesporsel(id))` → `{ ok: true }`.
- `varsleNyForesporsel(id)` i `src/lib/epost/varsler.ts` + mal `nyForesporselAdmin` i `maler.ts` + type `ny_foresporsel_admin`; styres av `varsle_ny_leie`.
- `src/app/api/rydd/route.ts` (GET, `CRON_SECRET`) og cron i `vercel.json` kl. 07:30; `npm run sjekk:vercel`.

### Task 4: Admin (utleie-app)

- Oversikten: flisen «Nye forespørsler».
- Kalenderen: seksjonen «Nye forespørsler» øverst med `ForesporselRad` (klient-knapper: «Godkjenn» med `useActionState`, «Avslå» med `BekreftKnapp`); forespørsler i rutenettet med grå stiplet kant.
- Handlinger `godkjennForesporsel(id)` og `avslaForesporsel(id)` i `kalender/actions.ts`, med `23P01` → «Dagene er tatt i mellomtiden.»

### Task 5: Skjemaet på hovedsida (hm-web-craft)

- `Ledigkalender`: valgfri `valg`/`onValg` → `mode="range"`, `disabled` = før i dag + opptatte, `excludeDisabled`, `max={60}`.
- `Leieforesporsel` (ny): kalender + skjema + honningfelt + `startet`; `fetch` til `${VITE_UTLEIE_APP_URL ?? UTLEIE_APP_URL}/api/foresporsel`; kvittering og feil.
- Maskinsida bruker `Leieforesporsel` i «Lei …»-boksen; telefon og e-post står under.
- Personvernsida: skjemaet med felt, formål, grunnlag, lagring og sletting.

### Task 6: Prøv, rydd og fullfør

- utleie-app: eslint, tsc, `npm test`, bygg. hm-web-craft: typecheck, eslint på endrede filer, bygg.
- Nettleseren: hovedsida mot lokal utleie-app (CORS og valideringsfeil), kvittering med avskåret `fetch`, admin-visningen på prøveside; skjermbilder til Thomas.
- finishing-a-development-branch for begge; migrasjon 0013 kjøres før koden tas i bruk.
