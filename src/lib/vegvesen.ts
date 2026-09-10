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
