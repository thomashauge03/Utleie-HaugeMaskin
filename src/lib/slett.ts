import { supabaseAdmin } from '@/lib/supabase/admin'
import { slettLeier, type Sletteresultat } from '@/lib/slett-leier'
import 'server-only'

/**
 * Sletter leier for godt, inkludert bildefilene i Storage. Se
 * `slettLeier` for rekkefølgen og hvorfor.
 *
 * Service role, fordi bøtta «bilder» er privat uten tilgangsregler – bare
 * service role kan slette i den. Kallerne har allerede sjekket at det er
 * admin som spør.
 */
export function slettLeierMedFiler(leieIder: string[]): Promise<Sletteresultat> {
  return slettLeier(supabaseAdmin, leieIder)
}
