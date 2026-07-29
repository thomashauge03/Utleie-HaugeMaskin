/**
 * Dato- og tidsformatering, alltid i norsk tid.
 *
 * Vercel kjører i UTC. Uten et eksplisitt `timeZone` ville alle
 * klokkeslett blitt vist 1–2 timer for tidlig i produksjon – på
 * fakturaen, i e-postene og i hele adminpanelet. Derfor går ALL
 * visning gjennom disse funksjonene, som låser tidssonen til
 * Europe/Oslo uansett hvor koden kjører.
 */

const OSLO = 'Europe/Oslo'

/** 27.07.2026 */
export function dato(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', {
    timeZone: OSLO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** 27.07 */
export function datoKort(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', {
    timeZone: OSLO,
    day: '2-digit',
    month: '2-digit',
  })
}

/** 27.07.2026, 16:44 */
export function tid(iso: string): string {
  return new Date(iso).toLocaleString('nb-NO', {
    timeZone: OSLO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 27.07, 16:44 – for kompakte lister */
export function tidKort(iso: string): string {
  return new Date(iso).toLocaleString('nb-NO', {
    timeZone: OSLO,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** yyyy-mm-dd i norsk tid – for å sammenligne kalenderdager. */
export function osloDag(d: Date | string): string {
  const dato = typeof d === 'string' ? new Date(d) : d
  // en-CA gir ISO-formatet yyyy-mm-dd.
  return dato.toLocaleDateString('en-CA', { timeZone: OSLO })
}

/**
 * Hele døgn fra i dag til datoen, regnet på norske kalenderdager.
 * Negativt = forfalt. 0 = i dag. Uavhengig av serverens tidssone.
 */
export function dagerTil(iso: string): number {
  const mål = osloDag(iso)
  const idag = osloDag(new Date())
  const ms = Date.parse(`${mål}T00:00:00Z`) - Date.parse(`${idag}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}
