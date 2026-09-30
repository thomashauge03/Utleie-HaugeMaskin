# Kameraskanner på /ansatt – implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En ansatt skanner QR-kodene på utstyret inne i /ansatt, flere på rad, og tar ut alt til ett prosjekt med skjemaet som finnes.

**Architecture:** En ren funksjon tolker teksten i koden (`tolkKode`). En klientkomponent (`Skanner`) eier kamera, dialog og lesesløyfe, og vet ingenting om maskiner – den gir teksten til `onKode` og viser svaret. `UttakListe` slår opp i lista si og krysser av i det samme `valgte`-settet som avkrysningsboksene bruker.

**Tech Stack:** Next.js 16, React 19.2 (`useEffectEvent`), Tailwind 4, `jsqr` 1.4.0, nettleserens `BarcodeDetector`.

**Spec:** `docs/superpowers/specs/2026-09-30-skanner-ansatt-design.md`

## Global Constraints

- Skanneren krysser bare av, aldri av igjen.
- Samme kode leses ikke på nytt før den har vært ute av bildet i 2 500 ms (`SAMME_KODE_MS`).
- Et bilde hvert 200. ms (`PAUSE_MS`) via `setTimeout`, nedskalert til høyst 640 px (`MAKS_BREDDE`).
- `jsqr` lastes med `import()` først når skanneren åpnes, og bare når `BarcodeDetector` mangler eller ikke kan `qr_code`.
- Teksten fra en kode brukes bare til oppslag, aldri til å navigere.
- Tekster, ordrett: «Skann QR-kode», «Ferdig (N valgt)», «Hold kameraet mot QR-koden på utstyret.», «✓ Navn», «Navn er allerede valgt», «Navn: grunn», «Fant ikke maskinen», «Viser <kategori> – kryss av i lista», «Fant ingen <kategori> i lista», «Dette er returkoden. Lever under «Hos deg nå».», «Ukjent kode».
- Arbeidet skjer i worktree `.claude/worktrees/skanner` på grenen `skanner`. `jsqr` legges i worktreens package.json/lock med `--package-lock-only`, og i hovedmappas `node_modules` med `--no-save`, så hovedmappas package-filer ikke røres før sammenslåing.
- Commit-meldinger og kommentarer på bokmål. Ingen push før Thomas sier ja.

---

### Task 1: `tolkKode`

**Files:**
- Create: `src/lib/skannet-kode.ts`
- Test: `src/lib/skannet-kode.test.mjs`

**Interfaces:**
- Produces: `export type SkannetKode = { type: 'maskin'; qr: string } | { type: 'kategori'; navn: string } | { type: 'retur' } | { type: 'ukjent' }` og `export function tolkKode(tekst: string): SkannetKode`.

- [ ] **Step 1: Skriv testene**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tolkKode } from './skannet-kode.ts'

test('maskinkoden gir qr-koden', () => {
  assert.deepEqual(tolkKode('https://utleie-hauge-maskin.vercel.app/m/M-0007'), {
    type: 'maskin',
    qr: 'M-0007',
  })
})

test('verten spiller ingen rolle – koder med eldre adresse virker', () => {
  assert.deepEqual(tolkKode('http://localhost:3000/m/M-0001'), { type: 'maskin', qr: 'M-0001' })
})

test('spørring, anker, skråstrek til slutt og mellomrom tåles', () => {
  assert.deepEqual(tolkKode('  https://x.no/m/M-0007/?utm=1#a \n'), { type: 'maskin', qr: 'M-0007' })
})

test('kategorinavnet dekodes', () => {
  assert.deepEqual(tolkKode('https://x.no/kategori/Skuffer%20og%20grab'), {
    type: 'kategori',
    navn: 'Skuffer og grab',
  })
})

test('returkoden', () => {
  assert.deepEqual(tolkKode('https://x.no/retur'), { type: 'retur' })
})

test('alt annet er ukjent', () => {
  for (const tekst of [
    '',
    'M-0007',
    'hei',
    'https://x.no/',
    'https://x.no/m/',
    'https://x.no/m/a/b',
    'https://x.no/leie/L-2609-0001',
    'javascript:alert(1)',
    'https://x.no/kategori/%E0%A4%A',
  ]) {
    assert.deepEqual(tolkKode(tekst), { type: 'ukjent' }, tekst)
  }
})
```

- [ ] **Step 2: Kjør – skal feile**

Run: `npm test` – Expected: FAIL, modulen `./skannet-kode.ts` finnes ikke.

- [ ] **Step 3: Implementer**

```ts
/**
 * Hva en skannet QR-kode peker på.
 *
 * Kodene er lenker: maskinene har /m/<qr>, skuffer og annet uten egen kode
 * har /kategori/<navn>, og returkoden på anlegget har /retur. Bare stien
 * leses, ikke verten – koder printet med en eldre adresse skal virke.
 *
 * Teksten kommer fra hva som helst kameraet ser. Den brukes bare til
 * oppslag, aldri til å navigere.
 */
export type SkannetKode =
  | { type: 'maskin'; qr: string }
  | { type: 'kategori'; navn: string }
  | { type: 'retur' }
  | { type: 'ukjent' }

const UKJENT: SkannetKode = { type: 'ukjent' }

export function tolkKode(tekst: string): SkannetKode {
  let url: URL
  try {
    url = new URL(tekst.trim())
  } catch {
    return UKJENT
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return UKJENT

  const deler = url.pathname.split('/').filter(Boolean)
  if (deler.length === 1 && deler[0] === 'retur') return { type: 'retur' }
  if (deler.length !== 2) return UKJENT

  let verdi: string
  try {
    verdi = decodeURIComponent(deler[1])
  } catch {
    return UKJENT
  }
  if (deler[0] === 'm') return { type: 'maskin', qr: verdi }
  if (deler[0] === 'kategori') return { type: 'kategori', navn: verdi }
  return UKJENT
}
```

- [ ] **Step 4: Kjør – skal bestå**

Run: `npm test` – Expected: alle tester består (33 fra før + 6 nye).

- [ ] **Step 5: Commit**

```bash
git add src/lib/skannet-kode.ts src/lib/skannet-kode.test.mjs
git commit -m "tolkKode: hva en skannet QR-kode peker på"
```

---

### Task 2: `Skanner`-komponenten og `jsqr`

**Files:**
- Create: `src/app/ansatt/skanner.tsx`
- Modify: `package.json`, `package-lock.json` (via npm)

**Interfaces:**
- Produces: `export type SkannSvar = { tone: 'ok' | 'info' | 'feil'; tekst: string }` og `export function Skanner(props: { onKode: (tekst: string) => SkannSvar; antallValgt: number })`.

- [ ] **Step 1: Les Next-guiden om lat lasting (AGENTS.md)**

`node_modules/next/dist/docs/` – guiden om lazy loading, avsnittet om eksterne biblioteker med `import()`.

- [ ] **Step 2: Legg til `jsqr`**

I worktreen: `npm install jsqr@^1.4.0 --package-lock-only`. I hovedmappa: `npm install jsqr@1.4.0 --no-save`, og sjekk at `git status` der ikke viser `package.json` eller `package-lock.json`.

- [ ] **Step 3: Skriv komponenten**

```tsx
'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { KNAPP_PRIMÆR, KNAPP_SEKUNDÆR } from '@/components/ui'

/** Svaret på én skannet kode, vist nederst i skanneren. */
export type SkannSvar = { tone: 'ok' | 'info' | 'feil'; tekst: string }

type Leser = (video: HTMLVideoElement) => Promise<string | null>

// Ikke i lib.dom ennå. Bare det som brukes her.
type BarcodeDetectorKlasse = {
  new (valg: { formats: string[] }): {
    detect(kilde: HTMLVideoElement): Promise<{ rawValue: string }[]>
  }
  getSupportedFormats(): Promise<string[]>
}

const PAUSE_MS = 200
// Så lenge koden er i bildet, leses den ikke på nytt. Først når den har
// vært ute av bildet så lenge, teller den som en ny skanning.
const SAMME_KODE_MS = 2500
const MAKS_BREDDE = 640

const TONE: Record<SkannSvar['tone'], string> = {
  ok: 'border-hm-green',
  info: 'border-hm-amber',
  feil: 'border-hm-red',
}

/**
 * Nettleserens egen QR-leser der den finnes (Android, Chrome på Mac).
 * Ellers jsQR, som lastes først her – iPhone og PC betaler ikke for den
 * før skanneren åpnes, og resten av /ansatt ikke i det hele tatt.
 */
async function lagLeser(): Promise<Leser> {
  const BD = (globalThis as { BarcodeDetector?: BarcodeDetectorKlasse }).BarcodeDetector
  if (BD) {
    const formater = await BD.getSupportedFormats().catch(() => [] as string[])
    if (formater.includes('qr_code')) {
      const detektor = new BD({ formats: ['qr_code'] })
      return async (video) => (await detektor.detect(video))[0]?.rawValue ?? null
    }
  }

  const { default: jsQR } = await import('jsqr')
  const lerret = document.createElement('canvas')
  const ktx = lerret.getContext('2d', { willReadFrequently: true })
  return async (video) => {
    const skala = Math.min(1, MAKS_BREDDE / video.videoWidth)
    const b = Math.round(video.videoWidth * skala)
    const h = Math.round(video.videoHeight * skala)
    if (!ktx || !b || !h) return null
    lerret.width = b
    lerret.height = h
    ktx.drawImage(video, 0, 0, b, h)
    return jsQR(ktx.getImageData(0, 0, b, h).data, b, h)?.data ?? null
  }
}

function kameraFeil(e: unknown): string {
  const navn = e instanceof DOMException ? e.name : ''
  if (navn === 'NotAllowedError' || navn === 'SecurityError') {
    return 'Fikk ikke bruke kameraet. Gi siden tilgang til kameraet i nettleseren, og prøv igjen.'
  }
  if (navn === 'NotFoundError' || navn === 'OverconstrainedError') {
    return 'Fant ikke noe kamera på denne enheten.'
  }
  if (navn === 'NotReadableError') return 'Kameraet er i bruk av en annen app.'
  return 'Kameraet startet ikke. Du kan fortsatt krysse av i lista.'
}

/**
 * Kameraskanner for uttak: les QR-kodene på utstyret, én etter én.
 *
 * Komponenten vet ingenting om maskiner. Den gir teksten til `onKode`, som
 * svarer med hva som skal stå på skjermen – slik bor all logikken om lista
 * i lista.
 *
 * <dialog> med showModal() gir fokus, Esc og tilbakeknappen på Android.
 * Kameraet stoppes når dialogen lukkes, uansett hvordan.
 */
export function Skanner({
  onKode,
  antallValgt,
}: {
  onKode: (tekst: string) => SkannSvar
  antallValgt: number
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [åpen, settÅpen] = useState(false)
  const [svar, settSvar] = useState<SkannSvar | null>(null)

  const vedKode = useEffectEvent((tekst: string) => {
    const s = onKode(tekst)
    settSvar(s)
    if (s.tone === 'ok') navigator.vibrate?.(60)
  })
  const vedFeil = useEffectEvent((tekst: string) => settSvar({ tone: 'feil', tekst }))

  useEffect(() => {
    const v = video.current
    if (!åpen || !v) return
    let avbrutt = false
    let strøm: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const sistSett = new Map<string, number>()

    async function start(v: HTMLVideoElement) {
      if (!navigator.mediaDevices?.getUserMedia) {
        vedFeil('Nettleseren gir ikke tilgang til kameraet her.')
        return
      }
      let s: MediaStream
      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch (e) {
        if (!avbrutt) vedFeil(kameraFeil(e))
        return
      }
      // Lukket mens nettleseren spurte om lov: slipp kameraet med en gang.
      if (avbrutt) {
        s.getTracks().forEach((t) => t.stop())
        return
      }
      strøm = s
      v.srcObject = s
      await v.play().catch(() => {})
      const les = await lagLeser()

      const runde = async () => {
        if (avbrutt) return
        const tekst = v.readyState >= 2 ? await les(v).catch(() => null) : null
        if (tekst && !avbrutt) {
          const nå = Date.now()
          if (nå - (sistSett.get(tekst) ?? 0) > SAMME_KODE_MS) vedKode(tekst)
          sistSett.set(tekst, nå)
        }
        if (!avbrutt) timer = setTimeout(runde, PAUSE_MS)
      }
      runde()
    }

    start(v)
    return () => {
      avbrutt = true
      clearTimeout(timer)
      strøm?.getTracks().forEach((t) => t.stop())
      v.srcObject = null
    }
  }, [åpen])

  function åpne() {
    settSvar(null)
    dialog.current?.showModal()
    settÅpen(true)
  }

  return (
    <>
      <button type="button" onClick={åpne} className={`${KNAPP_SEKUNDÆR} w-full`}>
        <QrIkon />
        Skann QR-kode
      </button>

      {/* open:flex, ikke flex: en lukket dialog skal beholde display: none. */}
      <dialog
        ref={dialog}
        onClose={() => settÅpen(false)}
        aria-label="Skann QR-kode"
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col border-0 bg-hm-black p-0 text-white open:flex backdrop:bg-hm-black"
      >
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={video}
            playsInline
            muted
            className="absolute inset-0 size-full object-cover"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid place-items-center"
          >
            <div className="aspect-square w-[70vmin] max-w-80 border-4 border-white/90 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
          </div>
        </div>

        <div className="space-y-3 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p
            role="status"
            className={`min-h-[3.25rem] border-l-4 bg-white/10 p-3 text-sm font-semibold ${svar ? TONE[svar.tone] : 'border-white/30'}`}
          >
            {svar?.tekst ?? 'Hold kameraet mot QR-koden på utstyret.'}
          </p>
          <button type="button" onClick={() => dialog.current?.close()} className={KNAPP_PRIMÆR}>
            Ferdig ({antallValgt} valgt)
          </button>
        </div>
      </dialog>
    </>
  )
}

function QrIkon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-5"
    >
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
    </svg>
  )
}
```

- [ ] **Step 4: Lint og typer**

Run: `node <hovedmappe>/node_modules/eslint/bin/eslint.js src/app/ansatt/skanner.tsx` og `tsc --noEmit` – Expected: ingen feil.

- [ ] **Step 5: Commit**

```bash
git add src/app/ansatt/skanner.tsx package.json package-lock.json
git commit -m "Skanner: kamera og QR-lesing i en dialog, jsqr der nettleseren mangler egen leser"
```

---

### Task 3: Skanneren i uttakslista

**Files:**
- Modify: `src/lib/intern-leie.ts` (`UttakMaskin`, `MaskinRad`, spørringen i `hentUttaksside`)
- Modify: `src/app/ansatt/uttak-skjema.tsx` (`UttakListe`)

**Interfaces:**
- Consumes: `tolkKode` (Task 1), `Skanner`, `SkannSvar` (Task 2).
- Produces: `UttakMaskin.qr: string`.

- [ ] **Step 1: `qr` på `UttakMaskin`**

I `UttakMaskin`, etter `id`:

```ts
  /** Koden på maskinen (qr_kode) – skanneren slår opp på den. */
  qr: string
```

I `MaskinRad`: `qr_kode: string`. I spørringen: `'id, qr_kode, navn, internnummer, kategori, underkategori, status, verksted_status'`. I mappingen, etter `id: m.id,`: `qr: m.qr_kode,`.

- [ ] **Step 2: Oppslaget i `UttakListe`**

Importer:

```tsx
import { tolkKode } from '@/lib/skannet-kode'
import { Skanner, type SkannSvar } from './skanner'
```

Etter `veksle`:

```tsx
  const perQr = new Map(maskiner.map((m) => [m.qr, m]))

  // Skanneren krysser bare av, aldri av igjen: holdes kameraet mot samme
  // kode to ganger, skal ikke maskinen forsvinne fra uttaket.
  function vedSkann(tekst: string): SkannSvar {
    const kode = tolkKode(tekst)
    if (kode.type === 'maskin') {
      const m = perQr.get(kode.qr)
      if (!m) return { tone: 'feil', tekst: 'Fant ikke maskinen' }
      if (m.opptatt) return { tone: 'info', tekst: `${m.navn}: ${m.opptatt}` }
      if (valgte.has(m.id)) return { tone: 'info', tekst: `${m.navn} er allerede valgt` }
      settValgte((før) => new Set(før).add(m.id))
      return { tone: 'ok', tekst: `✓ ${m.navn}` }
    }
    if (kode.type === 'kategori') {
      const navn = kode.navn.trim()
      if (!maskiner.some((m) => m.kategori.toLowerCase() === navn.toLowerCase())) {
        return { tone: 'feil', tekst: `Fant ingen ${navn} i lista` }
      }
      settSøk(navn)
      return { tone: 'info', tekst: `Viser ${navn} – kryss av i lista` }
    }
    if (kode.type === 'retur') {
      return { tone: 'info', tekst: 'Dette er returkoden. Lever under «Hos deg nå».' }
    }
    return { tone: 'feil', tekst: 'Ukjent kode' }
  }
```

- [ ] **Step 3: Knappen over søkefeltet**

Bytt det frittstående søkefeltet ut med:

```tsx
      <div className="space-y-3">
        <Skanner onKode={vedSkann} antallValgt={valgte.size} />
        <input
          type="search"
          value={søk}
          onChange={(e) => settSøk(e.target.value)}
          placeholder="Søk på navn, internnummer eller type"
          aria-label="Søk i utstyret"
          className={FELT}
        />
      </div>
```

- [ ] **Step 4: Lint, typer, tester**

Run: eslint, `tsc --noEmit`, `npm test` – Expected: ingen feil, alle tester består.

- [ ] **Step 5: Commit**

```bash
git add src/lib/intern-leie.ts src/app/ansatt/uttak-skjema.tsx
git commit -m "Skann QR-kode øverst i uttakslista på /ansatt"
```

---

### Task 4: Prøv skanneren i nettleseren

**Files:**
- Create (midlertidig, slettes i Step 6): `src/app/skanner-proeve/page.tsx`

- [ ] **Step 1: Prøvesida**

```tsx
import { UttakListe } from '@/app/ansatt/uttak-skjema'
import type { UttakMaskin } from '@/lib/intern-leie'

// MIDLERTIDIG prøveside: skanneren med oppdiktede maskiner. Committes ikke.
const maskiner: UttakMaskin[] = [
  { id: 'a', qr: 'M-0001', navn: 'Vibroplate 90 kg', internnummer: 'VP-1', kategori: 'Komprimering', underkategori: null, opptatt: null },
  { id: 'b', qr: 'M-0002', navn: 'Minigraver 1,8 t', internnummer: 'MG-1', kategori: 'Gravemaskiner', underkategori: null, opptatt: 'Utleid' },
  { id: 'c', qr: 'M-0003', navn: 'Graveskuff 40 cm', internnummer: null, kategori: 'Skuffer', underkategori: 'Graveskuff', opptatt: null },
  { id: 'd', qr: 'M-0004', navn: 'Hoppetusse', internnummer: 'HT-2', kategori: 'Komprimering', underkategori: null, opptatt: null },
]

export default function SkannerProeve() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-7">
      <UttakListe
        maskiner={maskiner}
        prosjekter={[{ id: 'p1', navn: 'Testprosjekt' }]}
        sistProsjektId={null}
        iDag="2026-09-30"
      />
    </main>
  )
}
```

- [ ] **Step 2: QR-bilder og falskt kamera**

Lag data-URL-er med `C:/Users/thoma/utleie-app/promo/node_modules/qrcode` for `…/m/M-0001`, `…/m/M-0002`, `…/m/M-9999`, `…/kategori/Skuffer`, `…/retur` og `https://example.com/`. I nettleseren: et 640×480-lerret som tegnes på nytt hvert 100. ms med gjeldende kode (eller hvitt), og `navigator.mediaDevices.getUserMedia = async () => (window.falskStrøm = lerret.captureStream(15))`.

- [ ] **Step 3: Sjekk hver rad i spec-tabellen (jsQR-veien)**

Åpne skanneren og vis kodene etter tur, med hvitt i 3 s mellom. Forventet `role=status` og avkrysning:
M-0001 «✓ Vibroplate 90 kg» (a krysset) · M-0001 igjen «Vibroplate 90 kg er allerede valgt» (a fortsatt krysset) · M-0002 «Minigraver 1,8 t: Utleid» (b ikke krysset) · M-9999 «Fant ikke maskinen» · Skuffer «Viser Skuffer – kryss av i lista» (søket = Skuffer) · retur «Dette er returkoden. Lever under «Hos deg nå».» · example.com «Ukjent kode». «Ferdig (1 valgt)» lukker, og `falskStrøm.getTracks()[0].readyState === 'ended'`.

- [ ] **Step 4: BarcodeDetector-veien og kamerafeil**

Last sida på nytt, sett en falsk `window.BarcodeDetector` (`getSupportedFormats` → `['qr_code']`, `detect` → `[{ rawValue: window.bdKode }]`) med `bdKode` = M-0004 → «✓ Hoppetusse». Last på nytt, la `getUserMedia` avvise med `new DOMException('', 'NotAllowedError')` → «Fikk ikke bruke kameraet. …».

- [ ] **Step 5: Skjermbilder**

Dialogen og lista etter skanning, 375 px, lyst og mørkt tema. Send til Thomas.

- [ ] **Step 6: Rydd**

Slett `src/app/skanner-proeve/`, stopp serveren, slett `.next` (sjekk lenker først), kjør eslint, `tsc`, `npm test`, `next build`.

---

### Task 5: Fullfør grenen

- [ ] superpowers:finishing-a-development-branch: spør Thomas om sammenslåing og push. Etter sammenslåing: `npm install` i hovedmappa, så `node_modules` følger lockfila. Fjern junction-lenka i worktreens `.next` før `git worktree remove`.
