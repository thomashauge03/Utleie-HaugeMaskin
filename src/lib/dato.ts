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

/**
 * Legger til hele måneder slik Postgres gjør med `+ interval 'N months'`:
 * finnes ikke dagen i målmåneden, blir det siste dag i den
 * (29.02.2024 + 24 måneder = 28.02.2026). Viser når et bilde slettes, og
 * må gi samme dag som databasen, som regner i UTC.
 */
export function leggTilManeder(iso: string, maneder: number): string {
  const d = new Date(iso)
  const dag = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + maneder)
  const sisteDag = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(dag, sisteDag))
  return d.toISOString()
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

/**
 * Avtalt levering, eller «til videre» for internleier uten dato.
 *
 * Kundeleier har alltid dato – databasen krever det – så for dem er
 * dette det samme som dato().
 */
export function returDato(iso: string | null): string {
  return iso ? dato(iso) : 'til videre'
}

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
