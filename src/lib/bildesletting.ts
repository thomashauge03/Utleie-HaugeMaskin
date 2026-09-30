import { supabaseAdmin } from '@/lib/supabase/admin'
import 'server-only'

/** Samme frist som i migrasjon 0014 og på personvernsida. */
export const BILDE_MANEDER = 24

/**
 * Resultatet av én kjøring. `rader` er bilder som hadde passert 24
 * måneder, `foreldrelose` filer i bøtta uten rad, og `filer` hvor mange
 * Storage faktisk fjernet.
 */
export type Bildesletting =
  | 'av'
  | 'ikke satt opp'
  | { rader: number; foreldrelose: number; filer: number; feil?: string }

/** Kolonnen eller funksjonen finnes ikke – migrasjon 0014 er ikke kjørt. */
const FINNES_IKKE = ['42703', 'PGRST204', 'PGRST202', '42883']

/**
 * Sletter bilder og posisjon eldre enn 24 måneder, slik personvernsida
 * lover. Kalles hver morgen fra /api/rydd, og gjør bare noe når bryteren
 * under Innstillinger → Personvern står på.
 *
 * Databasen sletter radene og skriver hendelsene (slett_utlopte_bilder),
 * og gir tilbake stiene. Filene slettes her, etterpå. Feiler det, er
 * filene foreldreløse og eldre enn 24 måneder – og kommer med neste
 * morgen.
 */
export async function slettGamleBilder(): Promise<Bildesletting> {
  const { data: innst, error: innstFeil } = await supabaseAdmin
    .from('innstillinger')
    .select('slett_gamle_bilder')
    .maybeSingle()

  if (innstFeil) {
    return FINNES_IKKE.includes(innstFeil.code)
      ? 'ikke satt opp'
      : { rader: 0, foreldrelose: 0, filer: 0, feil: innstFeil.message }
  }
  if (!innst?.slett_gamle_bilder) return 'av'

  const { data, error } = await supabaseAdmin.rpc('slett_utlopte_bilder')
  if (error) {
    return FINNES_IKKE.includes(error.code)
      ? 'ikke satt opp'
      : { rader: 0, foreldrelose: 0, filer: 0, feil: error.message }
  }

  const utlopte = (data ?? []) as { sti: string; foreldrelos: boolean }[]
  const resultat = {
    rader: utlopte.filter((u) => !u.foreldrelos).length,
    foreldrelose: utlopte.filter((u) => u.foreldrelos).length,
    filer: 0,
  }

  const stier = utlopte.map((u) => u.sti)
  for (let i = 0; i < stier.length; i += 100) {
    const { data: fjernet, error: feil } = await supabaseAdmin.storage
      .from('bilder')
      .remove(stier.slice(i, i + 100))
    if (feil) return { ...resultat, feil: `Storage: ${feil.message}` }
    resultat.filer += fjernet?.length ?? 0
  }

  return resultat
}
