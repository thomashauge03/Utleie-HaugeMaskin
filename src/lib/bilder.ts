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

/** Beregner antall døgn, der påbegynt døgn teller som helt. */
export function beregnDogn(start: string, slutt: string): number {
  const ms = new Date(slutt).getTime() - new Date(start).getTime()
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}
