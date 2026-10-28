import { hentFullAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { byggFakturaPdf } from '@/lib/faktura-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, ctx: RouteContext<'/api/faktura/[id]'>) {
  // Fakturagrunnlaget inneholder kundens navn, adresse og telefonnummer.
  if (!(await hentFullAdmin())) {
    return new Response(null, { status: 401 })
  }

  // ?vis=1 åpner PDF-en i nettleseren i stedet for å laste den ned.
  const vis = new URL(request.url).searchParams.get('vis') === '1'

  const { id } = await ctx.params
  const resultat = await byggFakturaPdf(await lagServerKlient(), id)
  if ('feil' in resultat) return new Response(resultat.feil, { status: resultat.status })

  return new Response(new Uint8Array(resultat.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${vis ? 'inline' : 'attachment'}; filename="${resultat.filnavn}"`,
      'Cache-Control': 'no-store',
    },
  })
}
