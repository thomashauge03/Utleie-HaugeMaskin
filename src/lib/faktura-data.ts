import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { lagFakturaPdf } from '@/lib/faktura-pdf'
import type { Bilde, Kunde, Leie, Maskin } from '@/lib/types'
import 'server-only'

export type FakturaLeie = Leie & { maskiner: Maskin | null; kunder: Kunde | null }

/**
 * Fakturagrunnlaget som PDF, eller hvorfor det ikke finnes.
 *
 * Ett sted, så «Last ned PDF» og vedlegget i Tripletex alltid er den
 * samme fila. `supabase` er den innloggede klienten, så radsikkerheten
 * gjelder lesingen av leien.
 */
export async function byggFakturaPdf(
  supabase: SupabaseClient,
  leieId: string,
): Promise<
  | { leie: FakturaLeie; pdf: Buffer; filnavn: string }
  | { feil: string; status: number }
> {
  const { data } = await supabase
    .from('leier')
    .select('*, maskiner(*), kunder(*)')
    .eq('id', leieId)
    .maybeSingle()

  if (!data) return { feil: 'Fant ikke leien', status: 404 }

  const leie = data as FakturaLeie

  // Internleier faktureres ikke – de føres på prosjektet.
  if (leie.ansatt_id) {
    return { feil: 'Internleier har ikke fakturagrunnlag.', status: 404 }
  }

  if (leie.status !== 'avsluttet') {
    return {
      feil: 'Fakturagrunnlag lages først når leien er godkjent og avsluttet.',
      status: 409,
    }
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

  return { leie, pdf, filnavn: `fakturagrunnlag-${leie.referanse}.pdf` }
}
