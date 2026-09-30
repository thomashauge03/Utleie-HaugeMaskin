import { supabaseAdmin } from '@/lib/supabase/admin'
import { osloDag } from '@/lib/dato'

export const dynamic = 'force-dynamic'

/** «Tabellen finnes ikke» – migrasjon 0012 ikke kjørt; da er det ingenting å rydde. */
const FINNES_IKKE = ['PGRST205', '42P01']

/**
 * Sletter reservasjoner som ikke ble til leie – forespurt, avlyst, eller
 * aktiv men aldri hentet – 30 dager etter at perioden er over.
 *
 * Personvernsida på haugemaskin.no lover det, så det må faktisk skje.
 * Hentede reservasjoner hører til en leie og blir stående. Kjøres daglig av
 * Vercel Cron (vercel.json), autentisert med CRON_SECRET som
 * /api/varsler/forfalt.
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

  if (error && !FINNES_IKKE.includes(error.code)) {
    return Response.json({ feil: error.message }, { status: 500 })
  }
  return Response.json({ slettet: count ?? 0, grense, tid: new Date().toISOString() })
}
