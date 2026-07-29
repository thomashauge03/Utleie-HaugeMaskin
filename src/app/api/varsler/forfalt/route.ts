import { hentAdmin } from '@/lib/auth'
import { varsleForfalte } from '@/lib/epost/varsler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Sender ut varsler om maskiner på overtid.
 *
 * Kjøres daglig av Vercel Cron (se vercel.json), og kan kjøres manuelt
 * fra adminpanelet. Cron-kall autentiseres med CRON_SECRET, som Vercel
 * sender i Authorization-headeren. Uten den sjekken kunne hvem som
 * helst utløst e-post til kundene deres.
 */
export async function GET(request: Request) {
  const hemmelighet = process.env.CRON_SECRET
  const header = request.headers.get('authorization')
  const fraCron = Boolean(hemmelighet) && header === `Bearer ${hemmelighet}`

  if (!fraCron && !(await hentAdmin())) {
    return new Response(null, { status: 401 })
  }

  const resultat = await varsleForfalte()

  return Response.json({
    ...resultat,
    kilde: fraCron ? 'cron' : 'manuelt',
    tid: new Date().toISOString(),
  })
}
