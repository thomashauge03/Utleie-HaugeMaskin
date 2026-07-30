import { supabaseAdmin } from '@/lib/supabase/admin'
import 'server-only'

/**
 * Sletter leier for godt, inkludert bildefilene i Storage.
 *
 * Radene for bilder, hendelser og e-postlogg forsvinner av seg selv via
 * `on delete cascade`. Selve filene gjør det ikke – databasen vet ikke
 * om dem. Uten denne opprydningen ville hvert slettede leieforhold
 * etterlatt bilder som ligger og koster lagringsplass for alltid, uten
 * at noe i systemet peker på dem.
 *
 * Returnerer antall slettede leier.
 */
export async function slettLeierMedFiler(leieIder: string[]): Promise<number> {
  if (leieIder.length === 0) return 0

  const { data: bilder } = await supabaseAdmin
    .from('bilder')
    .select('fil_sti')
    .in('leie_id', leieIder)

  const stier = (bilder ?? []).map((b) => b.fil_sti as string).filter(Boolean)

  // Filene først. Feiler databasesletten etterpå, sitter vi igjen med
  // rader som peker på borte filer – synlig og rettbart. Motsatt
  // rekkefølge ville gitt usynlige foreldreløse filer.
  if (stier.length > 0) {
    await supabaseAdmin.storage.from('bilder').remove(stier)
  }

  const { data: slettet } = await supabaseAdmin
    .from('leier')
    .delete()
    .in('id', leieIder)
    .select('id')

  return slettet?.length ?? 0
}
