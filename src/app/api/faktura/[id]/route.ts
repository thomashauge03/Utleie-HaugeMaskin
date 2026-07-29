import { hentAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { lagFakturaPdf } from '@/lib/faktura-pdf'
import type { Bilde, Kunde, Leie, Maskin } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, ctx: RouteContext<'/api/faktura/[id]'>) {
  // Fakturagrunnlaget inneholder kundens navn, adresse og telefonnummer.
  if (!(await hentAdmin())) {
    return new Response(null, { status: 401 })
  }

  // ?vis=1 åpner PDF-en i nettleseren i stedet for å laste den ned.
  const vis = new URL(request.url).searchParams.get('vis') === '1'

  const { id } = await ctx.params
  const supabase = await lagServerKlient()

  const { data } = await supabase
    .from('leier')
    .select('*, maskiner(*), kunder(*)')
    .eq('id', id)
    .maybeSingle()

  if (!data) return new Response('Fant ikke leien', { status: 404 })

  const leie = data as Leie & { maskiner: Maskin | null; kunder: Kunde | null }

  if (leie.status !== 'avsluttet') {
    return new Response(
      'Fakturagrunnlag lages først når leien er godkjent og avsluttet.',
      { status: 409 },
    )
  }

  const { data: innst } = await supabase
    .from('innstillinger')
    .select('firmanavn')
    .maybeSingle()

  // Bildene lastes ned som bytes – PDF-en skal kunne sendes videre uten
  // at mottakeren trenger tilgang til Storage.
  const { data: bildeRader } = await supabase
    .from('bilder')
    .select('*')
    .eq('leie_id', leie.id)
    .order('mottatt_tid')

  const bilder: { type: string; data: Buffer }[] = []
  for (const b of (bildeRader ?? []) as Bilde[]) {
    const { data: fil } = await supabaseAdmin.storage.from('bilder').download(b.fil_sti)
    if (fil) {
      bilder.push({ type: b.type, data: Buffer.from(await fil.arrayBuffer()) })
    }
  }

  const pdf = await lagFakturaPdf({
    leie,
    kunde: leie.kunder,
    maskin: leie.maskiner,
    firmanavn: innst?.firmanavn ?? '',
    bilder,
  })

  const filnavn = `fakturagrunnlag-${leie.referanse}.pdf`

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${vis ? 'inline' : 'attachment'}; filename="${filnavn}"`,
      'Cache-Control': 'no-store',
    },
  })
}
