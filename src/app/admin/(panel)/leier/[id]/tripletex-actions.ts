'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { byggFakturaPdf } from '@/lib/faktura-data'
import { osloDag } from '@/lib/dato'
import {
  FORLATT_MS,
  TripletexFeil,
  byggOrdre,
  finnKunde,
  leggVedOrdre,
  opprettOrdre,
  sesjonstoken,
} from '@/lib/tripletex'

/*
 * Oppretter en ordre i Tripletex fra en avsluttet kundeleie, og legger
 * fakturagrunnlagets PDF ved den. Ingenting faktureres eller sendes: det
 * gjør et menneske i Tripletex. Se src/lib/tripletex.ts.
 *
 * DOBBEL ORDRE ER DEN DYRE FEILEN. Derfor:
 *   - Leien låses med en betinget oppdatering før Tripletex kalles. To
 *     trykk samtidig gir én ordre: basen avgjør hvem som vant.
 *   - Uten svar fra Tripletex blir leien «ukjent», ikke «feilet». Den
 *     opprettes ikke på nytt før kontoret har sett i Tripletex og bekreftet.
 *   - Et kall som døde midt i (over fem minutter som «oppretter») regnes
 *     som ukjent, av samme grunn.
 */

export type TripletexTilstand = {
  feil?: string
  ok?: string
  /** Teksten fra Tripletex. Bare til visning – lagres aldri. */
  tripletexTekst?: string
}

/** Vår egen grense, som i grus. */
const MAKS_PDF = 8 * 1024 * 1024
const FORSOK_LAGRING = 3

const skjema = z.object({
  kundenr: z
    .string()
    .trim()
    .regex(/^\d{1,9}$/, 'Skriv kundenummeret fra Tripletex, bare tall.')
    .transform(Number)
    .refine((n) => n > 0, 'Skriv kundenummeret fra Tripletex, bare tall.'),
  bekreftet: z.string().optional(),
})

function hentNokkel(): string | null {
  // trim(): en nøkkel limt inn med linjeskift bak kjennes ikke igjen.
  return process.env.TRIPLETEX_NOKKEL?.trim() || null
}

/** ASCII og ingen anførselstegn – filnavnet havner i en multipart-header. */
const rensFilnavn = (navn: string) => navn.replace(/[^A-Za-z0-9._-]/g, '-')

export async function opprettTripletexOrdre(
  leieId: string,
  _forrige: TripletexTilstand,
  formData: FormData,
): Promise<TripletexTilstand> {
  const admin = await krevAdmin()
  const nokkel = hentNokkel()
  if (!nokkel) return { feil: 'Tripletex er ikke satt opp: TRIPLETEX_NOKKEL mangler.' }

  const felter = skjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }
  const { kundenr } = felter.data
  const bekreftet = felter.data.bekreftet === '1'

  const supabase = await lagServerKlient()

  // PDF-en bygges først. Feiler den, er ingenting låst og ingenting sendt.
  const grunnlag = await byggFakturaPdf(supabase, leieId)
  if ('feil' in grunnlag) return { feil: grunnlag.feil }
  const { leie, pdf, filnavn } = grunnlag

  if (leie.tripletex_ordre_id) return { feil: 'Leien har alt en ordre i Tripletex.' }
  if (!leie.belop || leie.belop <= 0) {
    return { feil: 'Leien mangler beløp. Ingenting er opprettet.' }
  }

  /* --- Lås leien ------------------------------------------------------ */

  const naa = new Date()
  const oppdater = () =>
    supabase
      .from('leier')
      .update({
        tripletex_status: 'oppretter',
        tripletex_kundenr: kundenr,
        tripletex_feil: null,
        tripletex_endret: naa.toISOString(),
      })
      .eq('id', leieId)
      .is('tripletex_ordre_id', null)
  const ta = (filter: (q: ReturnType<typeof oppdater>) => ReturnType<typeof oppdater>) =>
    filter(oppdater()).select('id')

  // To oppdateringer og ikke én med or(): eldre PostgREST avviser or() i
  // en skriving (funnet i grus). Hver av dem er udelelig.
  let tatt = await ta((q) => q.is('tripletex_status', null))
  if (!tatt.error && !tatt.data?.length) tatt = await ta((q) => q.eq('tripletex_status', 'feilet'))
  if (!tatt.error && !tatt.data?.length && bekreftet) {
    tatt = await ta((q) => q.eq('tripletex_status', 'ukjent'))
    if (!tatt.error && !tatt.data?.length) {
      const forlatt = new Date(naa.getTime() - FORLATT_MS).toISOString()
      tatt = await ta((q) => q.eq('tripletex_status', 'oppretter').lt('tripletex_endret', forlatt))
    }
  }
  if (tatt.error) {
    console.error('tripletex: fikk ikke låst leien', tatt.error.code)
    return { feil: 'Fikk ikke låst leien. Er migrasjon 0017 kjørt? Ingenting er opprettet.' }
  }
  if (!tatt.data?.length) {
    return {
      feil: 'Leien er i gang med å bli sendt, eller ordren kan alt finnes. Last siden på nytt.',
    }
  }

  /** Skriver til leien mens den er låst av oss. Prøver flere ganger. */
  const skriv = async (felt: Record<string, unknown>) => {
    for (let i = 0; i < FORSOK_LAGRING; i++) {
      const { data } = await supabase
        .from('leier')
        .update({ ...felt, tripletex_endret: new Date().toISOString() })
        .eq('id', leieId)
        .eq('tripletex_status', 'oppretter')
        .select('id')
      if (data?.length) return true
    }
    return false
  }

  /* --- Tripletex ------------------------------------------------------ */

  let token: string
  let kundeNavn: string
  let ordre: { id: number; nummer: string | null }
  // Fra dette punktet kan ordren finnes, uansett hva som går galt.
  let ordreSendt = false
  try {
    token = await sesjonstoken(nokkel, fetch)
    const kunde = await finnKunde(token, kundenr, fetch)
    if (!kunde) {
      const melding = `Fant ingen kunde med kundenummer ${kundenr} i Tripletex. Ingenting er opprettet.`
      await skriv({ tripletex_status: 'feilet', tripletex_feil: melding })
      revalidatePath(`/admin/leier/${leieId}`)
      return { feil: melding }
    }
    kundeNavn = kunde.navn
    const body = byggOrdre({
      kundeId: kunde.id,
      belop: leie.belop,
      dato: osloDag(leie.slutt_tid ?? leie.godkjent_tid ?? naa),
      referanse: leie.referanse,
      maskin: leie.maskiner?.navn ?? '',
    })
    ordreSendt = true
    ordre = await opprettOrdre(token, body, fetch)
  } catch (e) {
    const feil = e instanceof TripletexFeil ? e : null
    if (!feil) console.error('tripletex: uventet feil av typen', e instanceof Error ? e.name : typeof e)
    const ukjent = feil ? feil.kanVaereUtfort : ordreSendt
    const melding =
      feil?.message ??
      (ukjent
        ? 'Uventet feil. Ordren kan være opprettet: sjekk i Tripletex før du prøver igjen.'
        : 'Uventet feil. Ingenting er opprettet.')
    await skriv({ tripletex_status: ukjent ? 'ukjent' : 'feilet', tripletex_feil: melding })
    revalidatePath(`/admin/leier/${leieId}`)
    return { feil: melding, ...(feil?.tripletexTekst ? { tripletexTekst: feil.tripletexTekst } : {}) }
  }

  /* --- Ordren finnes. Alt herfra handler om å ikke miste den ---------- */

  const nr = ordre.nummer ?? String(ordre.id)
  const lagret = await skriv({
    tripletex_status: 'opprettet',
    tripletex_ordre_id: ordre.id,
    tripletex_ordrenr: ordre.nummer,
    tripletex_feil: null,
    tripletex_vedlegg: 'laster_opp',
  })
  if (!lagret) {
    // Leien blir stående som «oppretter», og regnes som ukjent om fem
    // minutter. Da kan den ikke opprettes på nytt uten at noen bekrefter.
    console.error(`tripletex: ordre ${ordre.id} er opprettet, men leie ${leieId} fikk ikke id-en`)
    return {
      feil: `Ordre ${nr} ble opprettet i Tripletex, men ble ikke lagret her. Ikke opprett på nytt: legg ved PDF-en for hånd i Tripletex.`,
    }
  }

  if (leie.kunde_id) {
    await supabase.from('kunder').update({ tripletex_kundenr: kundenr }).eq('id', leie.kunde_id)
  }

  await supabase.from('hendelser').insert({
    leie_id: leieId,
    type: 'tripletex_ordre',
    beskrivelse: `Ordre ${nr} opprettet i Tripletex på kundenr. ${kundenr}`,
    aktor: `admin:${admin.epost}`,
  })

  const vedlegg = await leggVed(supabase, leieId, token, ordre.id, pdf, filnavn)
  revalidatePath(`/admin/leier/${leieId}`)

  const hvem = kundeNavn ? `${kundeNavn} (kundenr. ${kundenr})` : `kundenr. ${kundenr}`
  if ('feil' in vedlegg) {
    return {
      ok: `Ordre ${nr} er opprettet i Tripletex på ${hvem}.`,
      feil: vedlegg.feil,
      ...(vedlegg.tripletexTekst ? { tripletexTekst: vedlegg.tripletexTekst } : {}),
    }
  }
  return { ok: `Ordre ${nr} er opprettet i Tripletex på ${hvem}, med PDF-en lagt ved.` }
}

/**
 * Legger PDF-en ved på nytt, når første forsøk feilet. `bekreftet` trengs
 * når utfallet er ukjent: da kan den bli liggende to ganger.
 */
export async function leggVedPaNytt(
  leieId: string,
  bekreftet: boolean,
): Promise<TripletexTilstand> {
  await krevAdmin()
  const nokkel = hentNokkel()
  if (!nokkel) return { feil: 'Tripletex er ikke satt opp: TRIPLETEX_NOKKEL mangler.' }

  const supabase = await lagServerKlient()
  const grunnlag = await byggFakturaPdf(supabase, leieId)
  if ('feil' in grunnlag) return { feil: grunnlag.feil }
  const { leie, pdf, filnavn } = grunnlag
  const ordreId = leie.tripletex_ordre_id
  if (!ordreId) return { feil: 'Leien har ingen ordre i Tripletex.' }

  const naa = new Date()
  const ta = (vedlegg: string, forlatt = false) => {
    let q = supabase
      .from('leier')
      .update({ tripletex_vedlegg: 'laster_opp', tripletex_endret: naa.toISOString() })
      .eq('id', leieId)
      .eq('tripletex_ordre_id', ordreId)
      .eq('tripletex_vedlegg', vedlegg)
    if (forlatt) q = q.lt('tripletex_endret', new Date(naa.getTime() - FORLATT_MS).toISOString())
    return q.select('id')
  }

  let tatt = await ta('feilet')
  if (!tatt.error && !tatt.data?.length && bekreftet) {
    tatt = await ta('ukjent')
    if (!tatt.error && !tatt.data?.length) tatt = await ta('laster_opp', true)
  }
  if (tatt.error) return { feil: 'Fikk ikke låst leien. Ingenting er lagt ved.' }
  if (!tatt.data?.length) {
    return { feil: 'PDF-en er i gang med å bli lagt ved, eller ligger der alt. Last siden på nytt.' }
  }

  let token: string
  try {
    token = await sesjonstoken(nokkel, fetch)
  } catch (e) {
    const melding = e instanceof TripletexFeil ? e.message : 'Uventet feil. Ingenting er lagt ved.'
    await supabase
      .from('leier')
      .update({ tripletex_vedlegg: 'feilet', tripletex_feil: melding })
      .eq('id', leieId)
      .eq('tripletex_vedlegg', 'laster_opp')
    revalidatePath(`/admin/leier/${leieId}`)
    return { feil: melding }
  }

  const resultat = await leggVed(supabase, leieId, token, ordreId, pdf, filnavn)
  revalidatePath(`/admin/leier/${leieId}`)
  return 'feil' in resultat ? resultat : { ok: 'PDF-en er lagt ved ordren.' }
}

/**
 * Legger PDF-en ved en ordre leien alt er låst for (vedlegg = laster_opp),
 * og skriver utfallet.
 */
async function leggVed(
  supabase: SupabaseClient,
  leieId: string,
  token: string,
  ordreId: number,
  pdf: Buffer,
  filnavn: string,
): Promise<{ ok: true } | { feil: string; tripletexTekst?: string }> {
  const skriv = (vedlegg: string, feil: string | null) =>
    supabase
      .from('leier')
      .update({
        tripletex_vedlegg: vedlegg,
        tripletex_feil: feil,
        tripletex_endret: new Date().toISOString(),
      })
      .eq('id', leieId)
      .eq('tripletex_vedlegg', 'laster_opp')

  if (pdf.length > MAKS_PDF) {
    const melding = 'PDF-en er over 8 MB. Ingenting er lagt ved: legg den ved for hånd i Tripletex.'
    await skriv('feilet', melding)
    return { feil: melding }
  }

  try {
    await leggVedOrdre(token, ordreId, new Uint8Array(pdf), rensFilnavn(filnavn), fetch)
  } catch (e) {
    const feil = e instanceof TripletexFeil ? e : null
    const ukjent = feil ? feil.kanVaereUtfort : true
    const melding =
      feil?.message ?? 'Uventet feil. PDF-en kan være lagt ved: se på ordren i Tripletex.'
    await skriv(ukjent ? 'ukjent' : 'feilet', melding)
    return { feil: melding, ...(feil?.tripletexTekst ? { tripletexTekst: feil.tripletexTekst } : {}) }
  }

  await skriv('lagt_ved', null)
  return { ok: true }
}
