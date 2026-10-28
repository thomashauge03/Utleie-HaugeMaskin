/**
 * Samtalen med Tripletex: bytte nøkkelen mot et sesjonstoken, finne
 * kunden, opprette en ordre og legge fakturagrunnlagets PDF ved den.
 *
 * Bygd etter integrasjonen i hauge-maskin-grus, som er prøvd mot det
 * samme regnskapet. Det finnes ikke noe testselskap: hvert ekte kall
 * skriver i det levende regnskapet. Derfor kommer fetch inn som argument,
 * så alt her kan prøves uten nett (tripletex.test.mjs).
 *
 * TRE REGLER HOLDES HER:
 *
 *   1. INGENTING FAKTURERES ELLER SENDES. Fila kaller fire adresser:
 *      tokenbyttet, kundelista (GET), /order (POST) og /order/{id}/:attach
 *      (PUT). Vedlegget følger neste faktura et menneske lager i Tripletex
 *      (addToInvoiceMode=NEXT), og står ikke på ordrebekreftelsen
 *      (addToOrderMode=NONE).
 *
 *   2. SVARTEKSTEN FRA TRIPLETEX LAGRES ALDRI. Valideringsfeil gjentar
 *      verdiene de avviste (navn, adresser, beløp), og utviklervilkårene
 *      (punkt 2.2.4) forbyr å samle dem. `melding` er vår egen tekst og kan
 *      lagres. `tripletexTekst` kan bare vises mens feilen skjer.
 *
 *   3. PRISEN ER UTEN MVA, OG BARE ÉN PRIS PER LINJE. Sendes begge
 *      prisfeltene, avviser Tripletex ordren.
 */

const BASE = 'https://tripletex.no/v2'

/** Tripletex godtar 300–28800 sekunder. Tokenet lever bare i minnet. */
const TTL_SEKUNDER = 3600
const TIDSGRENSE_MS = 20_000

/** Én side med kunder. Tripletex sitt `customerNumber`-filter blir ignorert. */
const KUNDESIDE = 1000
const MAKS_KUNDESIDER = 50

/** Linjeteksten på ordren. Detaljene står i PDF-en som legges ved. */
export const LINJETEKST = 'Pris ihht vedlegg'

/** Tripletex' mva-type 3: utgående mva, høy sats (25 %). */
const MVA_HOY = 3

/** Samme forfall som grus-ordrene. */
const FORFALL_DAGER = 14

/**
 * Et kall som har stått som «oppretter» eller «laster_opp» så lenge, er
 * dødt, og utfallet er ukjent. Langt mer enn de fire kallene kan ta.
 */
export const FORLATT_MS = 5 * 60_000

export function erForlatt(endret: string | null | undefined, naa = Date.now()): boolean {
  return !!endret && naa - new Date(endret).getTime() > FORLATT_MS
}

type Steg = 'token' | 'kunde' | 'ordre' | 'vedlegg'

/**
 * En feil i samtalen med Tripletex.
 *
 * `kanVaereUtfort` sier at ordren (eller vedlegget) KAN finnes selv om vi
 * ikke fikk vite det: ingen svar, eller en serverfeil. Da skal ingenting
 * gjøres på nytt før et menneske har sett i Tripletex.
 */
export class TripletexFeil extends Error {
  /** HTTP-status, eller 0 når Tripletex ikke svarte. */
  status: number
  kanVaereUtfort: boolean
  /**
   * Teksten fra Tripletex, til visning og aldri til basen. Ikke-enumerabel,
   * så en logger eller JSON.stringify som tar med alle feltene ikke får den.
   */
  declare tripletexTekst: string

  constructor(melding: string, status: number, kanVaereUtfort: boolean, tripletexTekst = '') {
    super(melding)
    this.name = 'TripletexFeil'
    this.status = status
    this.kanVaereUtfort = kanVaereUtfort
    Object.defineProperty(this, 'tripletexTekst', { value: tripletexTekst, enumerable: false })
  }
}

/** Vår egen melding for en feil, valgt av steg og status alene. */
export function vurder(steg: Steg, status: number): { melding: string; kanVaereUtfort: boolean } {
  const nei = (melding: string) => ({ melding, kanVaereUtfort: false })
  const kanskje = (melding: string) => ({ melding, kanVaereUtfort: true })

  if (steg === 'token') {
    if (status === 0) return nei('Fikk ikke kontakt med Tripletex. Ingenting er opprettet. Prøv igjen.')
    if (status === 429 || status >= 500) {
      return nei('Tripletex svarte ikke på innloggingen akkurat nå. Ingenting er opprettet. Prøv igjen om litt.')
    }
    return nei('Tripletex godtok ikke API-nøkkelen (TRIPLETEX_NOKKEL). Ingenting er opprettet.')
  }

  if (steg === 'kunde') {
    if (status === 403) return nei('API-nøkkelen har ikke tilgang til kundene i Tripletex. Ingenting er opprettet.')
    return nei('Fikk ikke lest kundene i Tripletex. Ingenting er opprettet. Prøv igjen.')
  }

  if (steg === 'vedlegg') {
    if (status === 0) return kanskje('Fikk ikke svar fra Tripletex. PDF-en kan være lagt ved: se på ordren i Tripletex.')
    if (status === 403) return nei('API-nøkkelen har ikke tilgang til å legge ved filer. Ingenting er lagt ved.')
    if (status === 404) return nei('Fant ikke ordren i Tripletex. Ingenting er lagt ved.')
    if (status === 413) return nei('PDF-en var for stor for Tripletex. Legg den ved for hånd.')
    if (status >= 400 && status < 500) return nei('Tripletex avviste vedlegget. Ingenting er lagt ved.')
    return kanskje('Tripletex svarte med en feil. PDF-en kan være lagt ved: se på ordren i Tripletex.')
  }

  // Ordren. Fra her kan forespørselen ha nådd Tripletex.
  if (status === 0) return kanskje('Fikk ikke svar fra Tripletex. Ordren kan være opprettet: sjekk i Tripletex før du prøver igjen.')
  if (status === 401) return nei('Tripletex avviste innloggingen. Ingenting er opprettet.')
  if (status === 403) return nei('API-nøkkelen har ikke tilgang til å opprette ordre. Ingenting er opprettet.')
  if (status === 429) return nei('For mange kall mot Tripletex. Ingenting er opprettet. Vent litt og prøv igjen.')
  if (status >= 400 && status < 500) return nei('Tripletex avviste ordren. Ingenting er opprettet.')
  if (status >= 500) return kanskje('Tripletex svarte med en serverfeil. Ordren kan være opprettet: sjekk i Tripletex før du prøver igjen.')
  return kanskje('Tripletex svarte uten ordre-id. Ordren kan være opprettet: sjekk i Tripletex før du prøver igjen.')
}

type Json = Record<string, unknown>

const sti = (x: unknown, ...nokler: string[]): unknown =>
  nokler.reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Json)[k] : undefined), x)

/** JSON.parse uten feilen: den siterer teksten fra Tripletex. */
function lesJson(tekst: string): Json | null {
  try {
    const j: unknown = JSON.parse(tekst)
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Json) : null
  } catch {
    return null
  }
}

/** Meldingene fra Tripletex når ordren eller vedlegget avvises. Bare til visning. */
function visningstekst(j: Json | null): string {
  if (!j) return ''
  const deler: string[] = []
  if (typeof j.message === 'string') deler.push(j.message)
  if (Array.isArray(j.validationMessages)) {
    for (const v of j.validationMessages as unknown[]) {
      const felt = sti(v, 'field')
      const melding = sti(v, 'message')
      if (typeof melding !== 'string') continue
      deler.push(typeof felt === 'string' && felt ? `${felt}: ${melding}` : melding)
    }
  }
  return deler.join('; ').slice(0, 1500)
}

function lagFeil(steg: Steg, status: number, tekst: string): TripletexFeil {
  const { melding, kanVaereUtfort } = vurder(steg, status)
  // Svar på tokenbyttet, 401, 403 og 429 kan gjenta nøkkelen eller noe
  // fra innsiden av Tripletex, og vises ikke.
  const vises =
    (steg === 'ordre' || steg === 'vedlegg') &&
    status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 429
  return new TripletexFeil(melding, status, kanVaereUtfort, vises ? visningstekst(lesJson(tekst)) : '')
}

const erOk = (status: number) => status >= 200 && status < 300

/** Ett kall, med tidsgrense som også dekker en kropp som aldri blir ferdig. */
async function kall(hent: typeof fetch, steg: Steg, url: string, init: RequestInit) {
  const styring = new AbortController()
  const klokke = setTimeout(() => styring.abort(), TIDSGRENSE_MS)
  let status = 0
  try {
    const r = await hent(url, { ...init, signal: styring.signal })
    status = r.status
    return { status, tekst: await r.text() }
  } catch {
    if (status !== 0) return { status, tekst: '' }
    throw lagFeil(steg, 0, '')
  } finally {
    clearTimeout(klokke)
  }
}

/** Brukernavn 0 betyr selskapet bak nøkkelen. Passordet er sesjonstokenet. */
const innlogging = (token: string) => `Basic ${btoa(`0:${token}`)}`

/**
 * Bytter nøkkelen mot et kortlevd sesjonstoken. Nøkkelen står i kroppen
 * og aldri i adressen, som havner i logger.
 */
export async function sesjonstoken(nokkel: string, hent: typeof fetch): Promise<string> {
  const r = await kall(hent, 'token', `${BASE}/token/session/:createFromRefreshToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken: nokkel, ttlSeconds: TTL_SEKUNDER }),
  })
  if (!erOk(r.status)) throw lagFeil('token', r.status, r.tekst)
  const token = sti(lesJson(r.tekst), 'value', 'token')
  if (typeof token !== 'string' || token === '') throw lagFeil('token', r.status, '')
  return token
}

/**
 * Kunden med dette kundenummeret, eller null.
 *
 * `?customerNumber=` blir ignorert av Tripletex (funnet i grus), så lista
 * leses side for side og filtreres her. Navnet er bare til visning.
 */
export async function finnKunde(
  token: string,
  kundenr: number,
  hent: typeof fetch,
): Promise<{ id: number; navn: string } | null> {
  for (let side = 0; side < MAKS_KUNDESIDER; side++) {
    const url = `${BASE}/customer?from=${side * KUNDESIDE}&count=${KUNDESIDE}&fields=id,customerNumber,name`
    const r = await kall(hent, 'kunde', url, {
      method: 'GET',
      headers: { Authorization: innlogging(token), Accept: 'application/json' },
    })
    if (!erOk(r.status)) throw lagFeil('kunde', r.status, '')
    const verdier = sti(lesJson(r.tekst), 'values')
    if (!Array.isArray(verdier)) throw lagFeil('kunde', r.status, '')

    for (const k of verdier) {
      const id = sti(k, 'id')
      if (sti(k, 'customerNumber') === kundenr && typeof id === 'number' && Number.isSafeInteger(id) && id > 0) {
        const navn = sti(k, 'name')
        return { id, navn: typeof navn === 'string' ? navn : '' }
      }
    }
    if (verdier.length < KUNDESIDE) return null
  }
  return null
}

export type OrdreGrunnlag = {
  /** Kundens interne id i Tripletex, fra finnKunde. */
  kundeId: number
  /** Leiens beløp eks. mva. */
  belop: number
  /** yyyy-mm-dd, leveringsdagen. */
  dato: string
  referanse: string
  maskin: string
}

/**
 * Ordren slik Tripletex vil ha den: én linje, «Pris ihht vedlegg», med
 * hele beløpet. Kaster når beløpet ikke er et positivt kronebeløp, så en
 * ordre på 0 kr eller NaN aldri lages.
 */
export function byggOrdre(g: OrdreGrunnlag) {
  if (!Number.isFinite(g.belop) || g.belop <= 0) throw new Error('Leien mangler beløp.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.dato)) throw new Error('Leien mangler leveringsdato.')
  return {
    customer: { id: g.kundeId },
    orderDate: g.dato,
    deliveryDate: g.dato,
    invoicesDueIn: FORFALL_DAGER,
    invoicesDueInType: 'DAYS',
    // Bare internt. Står ikke på dokumenter som går til kunden.
    internalComment: `Fra HM Utleie: ${g.referanse} – ${g.maskin}`.slice(0, 1000),
    // Uten denne forventer Tripletex priser med mva.
    isPrioritizeAmountsIncludingVat: false,
    orderLines: [
      {
        description: LINJETEKST,
        count: 1,
        unitPriceExcludingVatCurrency: Math.round(g.belop * 100) / 100,
        vatType: { id: MVA_HOY },
      },
    ],
  }
}

/**
 * Oppretter ordren og gir id-en og ordrenummeret kontoret ser.
 *
 * Prøves aldri på nytt her: en 5xx kan ha laget ordren før den falt, og
 * et nytt forsøk ville gitt to. Den avgjørelsen tar et menneske.
 */
export async function opprettOrdre(
  token: string,
  ordre: ReturnType<typeof byggOrdre>,
  hent: typeof fetch,
): Promise<{ id: number; nummer: string | null }> {
  const r = await kall(hent, 'ordre', `${BASE}/order`, {
    method: 'POST',
    headers: {
      Authorization: innlogging(token),
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
    },
    body: JSON.stringify(ordre),
  })
  if (!erOk(r.status)) throw lagFeil('ordre', r.status, r.tekst)

  const verdi = sti(lesJson(r.tekst), 'value')
  const id = sti(verdi, 'id')
  // Et ok-svar uten id er ikke en ordre vi kan huske. Den finnes nok likevel.
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) throw lagFeil('ordre', r.status, '')
  const nummer = sti(verdi, 'number')
  const nr = typeof nummer === 'number' ? String(nummer) : nummer
  return { id, nummer: typeof nr === 'string' && /^\d{1,20}$/.test(nr) ? nr : null }
}

/**
 * Legger PDF-en ved ordren. Følger neste faktura (NEXT), står ikke på
 * ordrebekreftelsen (NONE). Prøves ikke på nytt, av samme grunn som ordren.
 */
export async function leggVedOrdre(
  token: string,
  ordreId: number,
  pdf: Uint8Array,
  filnavn: string,
  hent: typeof fetch,
): Promise<void> {
  if (!Number.isSafeInteger(ordreId) || ordreId <= 0) {
    throw new TripletexFeil('Ordre-id-en er ikke gyldig. Ingenting er lagt ved.', 0, false)
  }
  const skjema = new FormData()
  skjema.append('file', new Blob([pdf as BlobPart], { type: 'application/pdf' }), filnavn)
  const r = await kall(
    hent,
    'vedlegg',
    `${BASE}/order/${ordreId}/:attach?addToInvoiceMode=NEXT&addToOrderMode=NONE`,
    // Content-Type settes av fetch, med grensen (boundary).
    { method: 'PUT', headers: { Authorization: innlogging(token), Accept: 'application/json' }, body: skjema },
  )
  if (!erOk(r.status)) throw lagFeil('vedlegg', r.status, r.tekst)
}
