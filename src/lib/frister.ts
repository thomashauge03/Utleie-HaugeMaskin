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

/**
 * De fire fristene et kjøretøy kan ha.
 *
 * Lukket mengde framfor fritekst, slik at hver visning kan slå opp både
 * navn og rekkefølge på den – da kan de ikke drifte fra hverandre.
 */
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

/**
 * Fristene som faktisk er lagt inn på ett kjøretøy, i fast rekkefølge.
 *
 * Tomme felter hoppes over framfor å gi en frist uten dato: en rad som
 * sier «Service – ingen dato» er støy i en liste som skal svare på hva
 * som haster.
 */
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
