# Lenker mellom utleie-appen og hovedsida – implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appens forside lenker til maskinlista på hovedsida, og utleiefilmen på hovedsida lenker til appen.

**Architecture:** Ren markup i to repoer, ingen data eller nye ruter. Hver side har adressen til den andre som én konstant. Hovedsida bruker den eksisterende `Filmband`-klossen med en ny valgfri `lenkje`, slik at filmen på forsida og på `/utleie` får lenken fra én endring.

**Tech Stack:** utleie-app: Next.js 16, React 19, Tailwind 4. hm-web-craft: TanStack Start (Vite), React, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-09-29-utleie-lenker-design.md`

## Global Constraints

- `HOVEDSIDE_URL = 'https://haugemaskin.vercel.app'` (utleie-app). haugemaskin.no er ikke koblet på ennå.
- `UTLEIE_APP_URL = "https://utleie-hauge-maskin.vercel.app"` (hm-web-craft), samme som i QR-kodene.
- Tekster, ordrett: «Se alle maskiner og hva som er ledig», «Hauge Maskin», «Slik leier du med QR-kode».
- Kommentarer og commit-meldinger: bokmål i utleie-app, nynorsk i hm-web-craft. UI-tekst er bokmål begge steder.
- De uncommitted promo-endringene i utleie-app (`eslint.config.mjs`, `src/app/globals.css`, `tsconfig.json`, `.vercelignore`, `promo/`, promo-specene) skal ikke stages eller endres. Stage bare filene oppgaven nevner.
- Ingen push før Thomas har sagt ja.
- Ingen enhetstest: endringene er markup, og testoppsettet i utleie-app (`node --test src/**/*.test.mjs`) dekker bare lib-funksjoner. Hovedsida har ingen testkjører. Beviset er lint, typesjekk, bygg og en DOM-sjekk av lenkene i nettleseren.

---

### Task 1: Appens forside lenker til hovedsida

**Files:**
- Modify: `src/app/page.tsx` (utleie-app)
- Create (midlertidig, slettes i Task 3): `.claude/launch.json` (utleie-app)

**Interfaces:**
- Consumes: ingenting.
- Produces: ingenting andre oppgaver bruker.

- [ ] **Step 1: Les Next-dokumentasjonen om lenker (AGENTS.md)**

Finn guiden for `next/link` under `node_modules/next/dist/docs/` og bekreft at eksterne adresser skal være vanlig `<a>`, ikke `<Link>`.

- [ ] **Step 2: Legg til konstantene under importene i `src/app/page.tsx`**

```tsx
// Hovedsida, der maskinlista med ledig/utleid ligger. haugemaskin.no er ikke
// koblet til Vercel ennå – per 29.09.2026 sender den til Facebook-sida. Bytt
// til https://haugemaskin.no når domenet er på plass.
const HOVEDSIDE_URL = 'https://haugemaskin.vercel.app'

// Toppen er svart i begge tema. KNAPP_SEKUNDÆR følger temaet og ville gitt
// hvit tekst på hvit flate her, så denne har faste farger.
const KNAPP_PÅ_SVART =
  'hm-trykk inline-flex min-h-[2.75rem] items-center justify-center gap-2 border-2 border-white bg-white px-4 text-sm font-semibold text-hm-black shadow-[3px_3px_0_0_var(--color-hm-red)] hover:bg-white/90'
```

- [ ] **Step 3: Knappen i toppen, rett etter avsnittet «Ingen konto, …»**

`hm-inn` ligger på en omsluttende `div`, ikke på lenka: animasjonen fyller `transform: none` og ville ellers slukt trykkeffekten fra `hm-trykk`.

```tsx
            <div className="hm-inn mt-8" style={{ animationDelay: '180ms' }}>
              <a href={`${HOVEDSIDE_URL}/utleie`} className={KNAPP_PÅ_SVART}>
                Se alle maskiner og hva som er ledig
                <span aria-hidden="true">→</span>
              </a>
            </div>
```

- [ ] **Step 4: Lenke først i bunnteksten, foran «Leievilkår»**

```tsx
            <a href={HOVEDSIDE_URL} className="hover:text-white">
              Hauge Maskin
            </a>
```

- [ ] **Step 5: Lint, bygg, typesjekk og tester**

Run: `npm run lint` – Expected: ingen feil.
Run: `npm run build` – Expected: «Compiled successfully», `/` fortsatt statisk (○).
Run: `npx tsc --noEmit` – Expected: ingen utskrift.
Run: `npm test` – Expected: alle tester består.

- [ ] **Step 6: Se siden i nettleseren**

`.claude/launch.json` i utleie-app:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "utleie", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 3000 },
    {
      "name": "hovedside",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["--prefix", "C:/Users/thoma/hm-web-craft", "run", "dev"],
      "port": 8080
    }
  ]
}
```

Start `utleie`, åpne `/`, og kjør i javascript_tool:

```js
[...document.querySelectorAll('a')]
  .filter((a) => a.href.includes('haugemaskin.vercel.app'))
  .map((a) => [a.textContent.trim(), a.href])
```

Expected: `[["Se alle maskiner og hva som er ledig→","https://haugemaskin.vercel.app/utleie"],["Hauge Maskin","https://haugemaskin.vercel.app/"]]`

Skjermbilde i 375 px (preset mobile) og PC-bredde, både lyst og mørkt tema. Knappen skal ha svart tekst på hvit flate i begge.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "Forsida lenker til maskinlista på hovedsida" -m "Knappen «Se alle maskiner og hva som er ledig» i den svarte toppen går til /utleie på hovedsida, som viser hele maskinparken med ledig/utleid rett fra databasen her. Bunnteksten har fått «Hauge Maskin».

Adressen er haugemaskin.vercel.app til domenet er koblet på; haugemaskin.no sender i dag til Facebook-sida. Den står i HOVEDSIDE_URL øverst i page.tsx.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Utleiefilmen på hovedsida lenker til appen

**Files (alle i `C:\Users\thoma\hm-web-craft`):**
- Modify: `src/lib/site.ts` (ny konstant nederst)
- Modify: `src/components/Filmband.tsx` (ny valgfri prop `lenkje`)
- Modify: `src/components/Utleiefilm.tsx` (sender lenka)

**Interfaces:**
- Produces: `export const UTLEIE_APP_URL: string` i `@/lib/site`; `Filmband` tar `lenkje?: ReactNode`.

- [ ] **Step 1: Konstanten nederst i `src/lib/site.ts`**

```ts

/**
 * Utleige-appen, der kunden leiger og leverer med QR-kode. Same adresse som
 * står i QR-kodene på maskinene.
 */
export const UTLEIE_APP_URL = "https://utleie-hauge-maskin.vercel.app";
```

- [ ] **Step 2: `lenkje` i `Filmband`**

I parameterlista, mellom `tekst` og `film`:

```tsx
  tekst,
  lenkje,
  film,
```

I typen, etter `tekst: ReactNode;`:

```tsx
  /** Ferdig teikna lenkje under teksten, som i Seksjonstopp. */
  lenkje?: ReactNode;
```

I `md:col-span-8`-diven, rett etter `<Avslor i={1}>…</Avslor>` med teksten:

```tsx
          {lenkje && (
            <Avslor i={2} className="mt-6">
              {lenkje}
            </Avslor>
          )}
```

- [ ] **Step 3: Lenka i `Utleiefilm`**

Import øverst:

```tsx
import { UTLEIE_APP_URL } from "@/lib/site";
```

Nytt avsnitt sist i doc-kommentaren:

```tsx
 *
 * Lenkja under teksten går til utleige-appen. Maskinlista står her på
 * nettstaden; appen er der leiga skjer, og forsida der viser stega.
```

Ny prop på `<Filmband>`, etter `tekst=…`:

```tsx
      lenkje={
        <a
          href={UTLEIE_APP_URL}
          className={`group inline-flex items-center gap-3 text-display text-sm ${moerk ? "hover:text-on-surface-accent" : "hover:text-primary"}`}
        >
          <span
            className="h-px w-8 bg-current transition-all duration-300 group-hover:w-12"
            aria-hidden="true"
          />
          Slik leier du med QR-kode
        </a>
      }
```

- [ ] **Step 4: Format, lint, typesjekk og bygg**

Run: `node node_modules/prettier/bin/prettier.cjs --check src/lib/site.ts src/components/Filmband.tsx src/components/Utleiefilm.tsx` – Expected: «All matched files use Prettier code style!» (retter med `--write` hvis ikke).
Run: `npm run lint` – Expected: ingen feil.
Run: `npm run typecheck` – Expected: ingen utskrift.
Run: `npm run build` – Expected: bygget fullfører uten feil.

- [ ] **Step 5: Se sidene i nettleseren**

Start `hovedside` fra launch.json i Task 1. På `/` og `/utleie`:

```js
[...document.querySelectorAll('a[href^="https://utleie-hauge-maskin.vercel.app"]')]
  .map((a) => [a.textContent.trim(), a.href])
```

Expected på begge: `[["Slik leier du med QR-kode","https://utleie-hauge-maskin.vercel.app/"]]` – nøyaktig én, så leveringsseddelfilmen på forsida har ingen.

Skjermbilde av filmteksten med lenka: forsida (lys flate) og `/utleie` (mørk flate), i 375 px og PC-bredde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/site.ts src/components/Filmband.tsx src/components/Utleiefilm.tsx
git commit -m "Utleigefilmen lenkjer til utleige-appen" -m "Filmen om QR-utleige står på forsida og øvst på /utleie, men ingenting på nettstaden viste veg til appen der leiga skjer. No står «Slik leier du med QR-kode» under teksten begge stader, og peikar på utleie-hauge-maskin.vercel.app – same adresse som i QR-kodene.

Filmband har fått ei valfri lenkje, teikna som i Seksjonstopp. Leveringsseddelfilmen er uendra.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Vis Thomas, publiser etter ja, rydd

- [ ] **Step 1:** Send skjermbildene (SendUserFile) med én linje om hva som er hvor.
- [ ] **Step 2:** Sjekk hva en push tar med i hvert repo: `git fetch` og `git log --oneline origin/main..main`. Si fra om det ligger andre commits der enn disse.
- [ ] **Step 3:** Spør om push. Først ved ja: `git push` i begge.
- [ ] **Step 4:** Etter utrulling: `curl -s https://utleie-hauge-maskin.vercel.app/ | grep -c "haugemaskin.vercel.app/utleie"` og `curl -s https://haugemaskin.vercel.app/utleie | grep -c "utleie-hauge-maskin.vercel.app"` – begge ≥ 1.
- [ ] **Step 5:** Stopp forhåndsvisningene og slett `.claude/launch.json` i utleie-app.
