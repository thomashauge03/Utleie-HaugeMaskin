import { supabaseAdmin } from '@/lib/supabase/admin'
import 'server-only'

/**
 * Bøtta er privat, så bildene må hentes gjennom en signert URL som
 * utløper. Ellers ville en lekket lenke gitt varig innsyn i kundenes
 * bilder og posisjonsdata.
 */
export async function signertBildeUrl(
  sti: string,
  sekunder = 60 * 60,
): Promise<string | null> {
  const { data } = await supabaseAdmin.storage
    .from('bilder')
    .createSignedUrl(sti, sekunder)

  return data?.signedUrl ?? null
}

/**
 * Sjekker at bildet faktisk ble lastet opp før stien lagres på en leie.
 *
 * Format kontrolleres av en regex i skjemaet, men det garanterer bare
 * at strengen ser riktig ut – ikke at objektet finnes. Uten dette kunne
 * en leie registreres med en «bilde»-sti som ikke peker på noe, og
 * bevisdokumentasjonen – som er hele poenget – ville vært tom.
 */
export async function bildeFinnes(sti: string): Promise<boolean> {
  const skille = sti.lastIndexOf('/')
  if (skille < 1) return false
  const mappe = sti.slice(0, skille)
  const navn = sti.slice(skille + 1)

  const { data } = await supabaseAdmin.storage
    .from('bilder')
    .list(mappe, { search: navn, limit: 1 })

  return Boolean(data?.some((f) => f.name === navn))
}

/** Beregner antall døgn, der påbegynt døgn teller som helt. */
export function beregnDogn(start: string, slutt: string): number {
  const ms = new Date(slutt).getTime() - new Date(start).getTime()
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}
