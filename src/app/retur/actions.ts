'use server'

import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sikreEnhetsId } from '@/lib/enhet'
import { normaliserTelefon } from '@/lib/telefon'

export type Treff = { referanse: string; maskinNavn: string; startet: string }
export type FinnTilstand = { feil?: string; treff?: Treff[] }

/**
 * Finner aktive leier på et mobilnummer.
 *
 * Brukes når kunden har byttet telefon eller slettet nettleserdata, og
 * dermed mangler enhets-cookien. Vi viser bevisst kun maskinnavn og
 * startdato – ikke navn, adresse eller e-post – slik at et tilfeldig
 * nummer ikke avslører hvem kunden er.
 *
 * Kjent svakhet: uten SMS-verifisering er nummeret et svakt bevis, og
 * det finnes ingen ratebegrensning på oppslaget. Se docs/TEKNISK-PLAN.md
 * pkt. 8.2. Skaden er begrenset til å avslutte en leie, som krever
 * bilde og uansett går til godkjenning hos admin.
 */
export async function finnLeier(
  _forrige: FinnTilstand,
  formData: FormData,
): Promise<FinnTilstand> {
  const telefon = normaliserTelefon(String(formData.get('telefon') ?? ''))
  if (!telefon) return { feil: 'Skriv mobilnummeret ditt med åtte siffer' }

  const { data: kunde } = await supabaseAdmin
    .from('kunder')
    .select('id')
    .eq('telefon', telefon)
    .maybeSingle()

  if (!kunde) return { feil: 'Fant ingen aktiv leie på dette nummeret.' }

  const { data: leier } = await supabaseAdmin
    .from('leier')
    .select('referanse, start_tid, maskiner(navn)')
    .eq('kunde_id', kunde.id)
    .eq('status', 'aktiv')
    .order('start_tid')

  if (!leier?.length) return { feil: 'Fant ingen aktiv leie på dette nummeret.' }

  const treff: Treff[] = leier.map((l) => ({
    referanse: l.referanse,
    maskinNavn: (l.maskiner as unknown as { navn: string }).navn,
    startet: l.start_tid,
  }))

  if (treff.length === 1) {
    await knyttTilEnhet(treff[0].referanse)
  }

  return { treff }
}

/**
 * Knytter leien til telefonen som står her nå, slik at retursiden og
 * kvitteringen virker videre uten at kunden må taste nummeret igjen.
 */
export async function knyttTilEnhet(referanse: string) {
  const enhetsId = await sikreEnhetsId()

  await supabaseAdmin
    .from('leier')
    .update({ enhets_id: enhetsId })
    .eq('referanse', referanse)
    .eq('status', 'aktiv')

  redirect(`/leie/${referanse}/retur`)
}
