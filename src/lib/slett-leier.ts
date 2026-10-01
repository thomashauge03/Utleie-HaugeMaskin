import type { SupabaseClient } from '@supabase/supabase-js'

export type Sletteresultat =
  | { feil: string }
  | {
      /** Leiene som faktisk ble slettet. Færre enn bedt om når noen alt var borte. */
      slettet: number
      /** Bildefiler Storage ikke fjernet. Radene er borte, så ingenting peker på dem. */
      filerIgjen: string[]
    }

/** Nøklene 0015 gir cascade. Stopper de slettingen, er 0015 ikke kjørt. */
const RESERVASJONSNØKKEL = /"reservasjoner_(leie|maskin)_id_fkey"/

/**
 * Hvorfor databasen nektet, sagt slik at admin vet hva som må gjøres.
 * Ingenting er slettet når denne brukes – en delete er én transaksjon.
 */
export function slettefeil(feil: { code?: string; message: string }): string {
  if (feil.code === '23503' && RESERVASJONSNØKKEL.test(feil.message)) {
    return (
      'Databasen mangler migrasjon 0015, så reservasjoner stopper slettingen. ' +
      'Kjør supabase/migrations/0015_reservasjoner_slettes_med.sql i Supabase og prøv igjen.'
    )
  }
  return `Databasen svarte: ${feil.message}`
}

/** Halen på hendelsen: filer som ble liggende i Storage, eller ingenting. */
export function filerIgjenTekst(filerIgjen: string[]): string {
  const n = filerIgjen.length
  if (n === 0) return ''
  return ` – ${n} ${n === 1 ? 'bildefil' : 'bildefiler'} ble liggende i Storage`
}

/**
 * Sletter leier for godt, inkludert bildefilene i Storage.
 *
 * Radene for bilder, hendelser, e-postlogg og hentede reservasjoner
 * forsvinner av seg selv via `on delete cascade`. Selve filene gjør det
 * ikke – databasen vet ikke om dem.
 *
 * Radene først, filene etterpå. Nekter databasen, er ingenting rørt, og
 * leien har fortsatt bildene sine – de dokumenterer hvordan maskinen så
 * ut. Feiler Storage etterpå, blir filene liggende uten noe som peker på
 * dem. Det koster litt lagringsplass; motsatt rekkefølge kostet bildene
 * til en leie som aldri ble slettet.
 *
 * Tar klienten som parameter, så logikken kan testes uten database.
 */
export async function slettLeier(
  db: SupabaseClient,
  leieIder: string[],
): Promise<Sletteresultat> {
  if (leieIder.length === 0) return { slettet: 0, filerIgjen: [] }

  const { data: bilder, error: bildeFeil } = await db
    .from('bilder')
    .select('fil_sti')
    .in('leie_id', leieIder)
  if (bildeFeil) return { feil: slettefeil(bildeFeil) }

  const stier = (bilder ?? []).map((b) => b.fil_sti as string)

  // `.select('id')` gir radene som faktisk forsvant. Uten den sier et
  // tomt svar ingenting om hvorvidt noe ble slettet.
  const { data: slettet, error } = await db
    .from('leier')
    .delete()
    .in('id', leieIder)
    .select('id')
  if (error) return { feil: slettefeil(error) }

  const antall = slettet?.length ?? 0
  if (stier.length === 0) return { slettet: antall, filerIgjen: [] }

  const { error: filFeil } = await db.storage.from('bilder').remove(stier)
  if (filFeil) {
    // Radene er borte, så dette er det eneste stedet stiene står igjen.
    console.error(`Bildefilene ble liggende i Storage (${filFeil.message}):`, stier)
    return { slettet: antall, filerIgjen: stier }
  }

  return { slettet: antall, filerIgjen: [] }
}
