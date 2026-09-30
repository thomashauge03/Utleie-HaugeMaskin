import { supabaseAdmin } from '@/lib/supabase/admin'
import { osloDag } from '@/lib/dato'
import { slettGamleBilder } from '@/lib/bildesletting'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** «Tabellen finnes ikke» – migrasjon 0012 ikke kjørt; da er det ingenting å rydde. */
const FINNES_IKKE = ['PGRST205', '42P01']

/**
 * Daglig opprydding. Kjøres av Vercel Cron (vercel.json), autentisert med
 * CRON_SECRET som /api/varsler/forfalt.
 *
 * 1. Reservasjoner som ikke ble til leie – forespurt, avlyst, eller aktiv
 *    men aldri hentet – slettes 30 dager etter at perioden er over.
 *    Personvernsida på haugemaskin.no lover det. Hentede reservasjoner
 *    hører til en leie og blir stående.
 * 2. Bilder og posisjon eldre enn 24 måneder slettes, som personvernsida
 *    her lover – så lenge bryteren under Innstillinger → Personvern står
 *    på. Se slettGamleBilder.
 *
 * Stegene er uavhengige: feiler det ene, kjøres det andre likevel, og
 * svaret får status 500 så kjøringen står som feilet i Vercel.
 */
export async function GET(request: Request) {
  const hemmelighet = process.env.CRON_SECRET
  if (!hemmelighet || request.headers.get('authorization') !== `Bearer ${hemmelighet}`) {
    return new Response(null, { status: 401 })
  }

  const grense = osloDag(new Date(Date.now() - 30 * 86_400_000))
  const { count, error } = await supabaseAdmin
    .from('reservasjoner')
    .delete({ count: 'exact' })
    .in('status', ['forespurt', 'avlyst', 'aktiv'])
    .lt('til_dato', grense)
  const reservasjonFeil = error && !FINNES_IKKE.includes(error.code) ? error.message : undefined

  const bilder = await slettGamleBilder()
  const bildeFeil = typeof bilder === 'object' ? bilder.feil : undefined

  const feil = reservasjonFeil ?? bildeFeil
  return Response.json(
    { slettet: count ?? 0, grense, bilder, ...(feil ? { feil } : {}), tid: new Date().toISOString() },
    { status: feil ? 500 : 200 },
  )
}
