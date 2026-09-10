import { hentAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { bareUtfylte, hentKjøretøy } from '@/lib/vegvesen'
import { varsleEuKontroll } from '@/lib/epost/varsler'
import { dagerTil, osloDag } from '@/lib/dato'
import type { Kjøretøy } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Så mange oppslag rekker vi trygt innenfor maxDuration. */
const PER_KJØRING = 50

/** Oppfriskingen får halve kjøretiden. Resten er varselets. */
const TIDSBUDSJETT_MS = 30_000

/**
 * Frisker opp kjøretøydata fra Vegvesen og sender fristvarselet.
 *
 * Kjøres daglig av Vercel Cron (se vercel.json), og kan kjøres manuelt
 * fra Innstillinger. Cron-kall autentiseres med CRON_SECRET. Uten den
 * sjekken kunne hvem som helst tømt API-kvoten deres.
 *
 * Hele parken friskes ikke opp hver natt. EU-fristen endres én gang
 * hvert eller annethvert år per bil – den kan ikke regnes ut lokalt,
 * men den endrer seg heller ikke ofte nok til å rettferdiggjøre
 * daglige oppslag på alt.
 */
export async function GET(request: Request) {
  const hemmelighet = process.env.CRON_SECRET
  const header = request.headers.get('authorization')
  const fraCron = Boolean(hemmelighet) && header === `Bearer ${hemmelighet}`

  /*
   * Strengere enn søsterruta /api/varsler/forfalt med vilje: den bare
   * sender e-post, denne skriver til kjoretoy gjennom supabaseAdmin og
   * bruker av Vegvesen-kvoten. Servicearbeidere har skrivebeskyttet
   * tilgang, og hentAdmin() slipper dem gjennom – rollen må sjekkes.
   */
  const bruker = fraCron ? null : await hentAdmin()
  if (!fraCron && bruker?.rolle !== 'admin') {
    return new Response(null, { status: 401 })
  }

  const oppdatert = await friskOpp()

  /*
   * Varselet er pakket inn, oppfriskingen ikke.
   *
   * Oppfriskingen har allerede skrevet til databasen når vi kommer hit.
   * Velter e-postutsendingen etterpå, skal svaret fortsatt fortelle hva
   * som faktisk ble oppdatert – ellers ser en cron-kjøring ut som en
   * total fiasko fordi et varsel ikke gikk ut.
   */
  let varsel: unknown
  try {
    varsel = await varsleEuKontroll()
  } catch (e) {
    varsel = { feil: e instanceof Error ? e.message : 'Ukjent feil' }
  }

  return Response.json({
    oppdatert,
    varsel,
    kilde: fraCron ? 'cron' : 'manuelt',
    tid: new Date().toISOString(),
  })
}

/**
 * Prioriteringen, i rekkefølge:
 *   1. aldri hentet
 *   2. frist innen 90 dager og ikke hentet i dag
 *   3. eldst hentet, over 7 dager gammel
 *
 * Sortert i minnet framfor tre SQL-spørringer. Parken er liten nok, og
 * én enkel sammenligningsfunksjon er lettere å ha rett enn tre
 * spørringer som skal utfylle hverandre uten overlapp.
 */
async function friskOpp(): Promise<{
  plukket: number
  endret: number
  feilet: number
  gjenstår: number
  rakkHeleKøen: boolean
}> {
  const { data } = await supabaseAdmin
    .from('kjoretoy')
    .select('*')
    .eq('status', 'i_drift')
    .limit(500)

  const alle = (data ?? []) as Kjøretøy[]
  const iDag = osloDag(new Date())

  const prioritet = (k: Kjøretøy): number => {
    if (!k.svv_hentet) return 0
    if (osloDag(k.svv_hentet) === iDag) return 3
    if (k.eu_frist && dagerTil(k.eu_frist) <= 90) return 1
    const alder = dagerTil(k.svv_hentet)
    return alder <= -7 ? 2 : 3
  }

  const kø = alle
    .map((k) => ({ k, p: prioritet(k) }))
    .filter((x) => x.p < 3)
    .sort((a, b) => a.p - b.p || (a.k.svv_hentet ?? '').localeCompare(b.k.svv_hentet ?? ''))
    .slice(0, PER_KJØRING)

  let endret = 0
  let feilet = 0
  let behandlet = 0
  let gjenstår = 0

  const frist = Date.now() + TIDSBUDSJETT_MS

  for (const { k } of kø) {
    /*
     * 50 sekvensielle oppslag à 10 s timeout er 500 s i verste fall, mot
     * maxDuration = 60. Blir ruta drept her inne, kjøres
     * varsleEuKontroll() aldri – og fordi utløseren er et eksakt treff
     * på 30/14/3 dager, er varselet for den terskelen tapt for godt.
     * Køen er prioritert, så det som blir stående er det minst
     * hastende, og neste kjøring plukker det opp av seg selv.
     */
    if (Date.now() >= frist) {
      gjenstår = kø.length - behandlet
      break
    }

    const oppslag = await hentKjøretøy(k.reg_nr)

    if (oppslag.status === 'nøkkelfeil') {
      // Uten gyldig nøkkel er hele køen nytteløs. Å kjøre gjennom resten
      // ville bare brent kjøretid på samme svar. Resten telles som
      // feilet, inkludert denne.
      feilet += kø.length - behandlet
      break
    }

    behandlet++

    if (oppslag.status !== 'ok') {
      feilet++
      continue
    }

    const { error } = await supabaseAdmin
      .from('kjoretoy')
      .update({
        // bareUtfylte, ikke rå spread: tolk() gir null for felter
        // Vegvesen mangler, og en nattlig jobb som skriver dem rått ville
        // slettet manuelt innlagte frister på kjøretøy uten kontrollplikt.
        ...bareUtfylte(oppslag.data),
        svv_hentet: new Date().toISOString(),
        oppdatert: new Date().toISOString(),
      })
      .eq('id', k.id)

    if (error) feilet++
    else endret++
  }

  /*
   * `gjenstår` og `rakkHeleKøen` er med fordi et stille kutt ser ut som
   * «ferdig». Regnestykket går alltid opp:
   * endret + feilet + gjenstår === plukket.
   */
  return { plukket: kø.length, endret, feilet, gjenstår, rakkHeleKøen: gjenstår === 0 }
}
