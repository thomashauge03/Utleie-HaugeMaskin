'use client'

/**
 * Mellomlagring av utfylte skjemaer.
 *
 * Uten dette mister kunden alt hvis de trykker tilbake, låser telefonen,
 * eller bytter app midt i utfyllingen. På en anleggsplass skjer det hele
 * tiden – og skal de i tillegg ta bildet på nytt, gir folk opp.
 *
 * Tekstfeltene lagres i localStorage: de er de samme fra gang til gang,
 * og planen sier de skal forhåndsutfylles ved neste leie uansett.
 *
 * Bildestien lagres i sessionStorage med kort levetid. Den må ikke
 * overleve inn i en ny leie – da ville et gammelt bilde blitt hengt på
 * feil leieforhold.
 */

const TEKST_GYLDIG_MS = 3 * 60 * 60 * 1000 // 3 timer
const BILDE_GYLDIG_MS = 30 * 60 * 1000 // 30 minutter

type Kladd = { lagret: number; verdi: unknown }

function les(lager: Storage, nøkkel: string, gyldigMs: number): unknown {
  try {
    const rå = lager.getItem(nøkkel)
    if (!rå) return null
    const k = JSON.parse(rå) as Kladd
    if (Date.now() - k.lagret > gyldigMs) {
      lager.removeItem(nøkkel)
      return null
    }
    return k.verdi
  } catch {
    return null
  }
}

function skriv(lager: Storage, nøkkel: string, verdi: unknown) {
  try {
    lager.setItem(nøkkel, JSON.stringify({ lagret: Date.now(), verdi } as Kladd))
  } catch {
    // Privat modus eller full kvote. Kladd er en bekvemmelighet,
    // ikke noe skjemaet er avhengig av – så vi lar det gå stille.
  }
}

/* ── Tekstfelter ─────────────────────────────────────────── */

export function lesFelter(nøkkel: string): Record<string, string> | null {
  const v = les(localStorage, `kladd:${nøkkel}`, TEKST_GYLDIG_MS)
  return v && typeof v === 'object' ? (v as Record<string, string>) : null
}

export function lagreFelter(nøkkel: string, felter: Record<string, string>) {
  skriv(localStorage, `kladd:${nøkkel}`, felter)
}

/* ── Opplastet bilde ─────────────────────────────────────── */

export function lesBildeSti(nøkkel: string): string | null {
  const v = les(sessionStorage, `bilde:${nøkkel}`, BILDE_GYLDIG_MS)
  return typeof v === 'string' ? v : null
}

export function lagreBildeSti(nøkkel: string, sti: string) {
  skriv(sessionStorage, `bilde:${nøkkel}`, sti)
}

export function glemBildeSti(nøkkel: string) {
  try {
    sessionStorage.removeItem(`bilde:${nøkkel}`)
  } catch {
    /* ingen konsekvens */
  }
}

/**
 * Fjerner alle mellomlagrede bildestier.
 *
 * Kalles når en leie er registrert. Uten dette kunne bildet fra forrige
 * leie blitt hengt på neste, dersom kunden rakk å skanne samme maskin
 * igjen før mellomlagringen gikk ut på tid.
 */
export function glemAlleBilder() {
  try {
    for (const nøkkel of Object.keys(sessionStorage)) {
      if (nøkkel.startsWith('bilde:')) sessionStorage.removeItem(nøkkel)
    }
  } catch {
    /* ingen konsekvens */
  }
}
