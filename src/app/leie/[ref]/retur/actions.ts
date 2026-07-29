'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hentEnhetsId } from '@/lib/enhet'
import { varsleRetur } from '@/lib/epost/varsler'

export type ReturTilstand = { feil?: string }

const skjema = z.object({
  referanse: z.string().min(1),
  bilde_sti: z.string().min(1, 'Du må ta bilde av maskinen før du kan levere'),
  kommentar: z.string().trim().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  noyaktighet: z.string().optional(),
})

function tall(v: string | undefined): number | null {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function leverTilbake(
  _forrige: ReturTilstand,
  formData: FormData,
): Promise<ReturTilstand> {
  const felter = skjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const enhetsId = await hentEnhetsId()
  if (!enhetsId) return { feil: 'Fant ikke leien din på denne telefonen.' }

  const { data: leie } = await supabaseAdmin
    .from('leier')
    .select('id, referanse, status, enhets_id')
    .eq('referanse', felter.data.referanse)
    .maybeSingle()

  if (!leie || leie.enhets_id !== enhetsId) {
    return { feil: 'Fant ikke leien din på denne telefonen.' }
  }
  if (leie.status !== 'aktiv') {
    return { feil: 'Denne leien er allerede levert inn.' }
  }

  /*
   * Servertid, ikke tidsstempelet i bildefila. Telefonens klokke kan
   * stilles, og et gammelt bilde kan lastes opp på nytt. Se
   * docs/TEKNISK-PLAN.md, designvalg 1.
   */
  const nå = new Date().toISOString()

  await supabaseAdmin.from('bilder').insert({
    leie_id: leie.id,
    type: 'levering',
    fil_sti: felter.data.bilde_sti,
    lat: tall(felter.data.lat),
    lng: tall(felter.data.lng),
    noyaktighet_m: tall(felter.data.noyaktighet),
  })

  /*
   * Klokka stopper her – ikke når admin godkjenner. Kunden skal ikke
   * betale for utleiers responstid. Maskinen forblir «utleid» til
   * godkjenning, så den ikke kan leies ut på nytt før noen har sett
   * at den faktisk står der.
   */
  const { error } = await supabaseAdmin
    .from('leier')
    .update({
      status: 'venter_godkjenning',
      slutt_tid: nå,
      kommentar_retur: felter.data.kommentar || null,
    })
    .eq('id', leie.id)
    .eq('status', 'aktiv')

  if (error) return { feil: 'Kunne ikke registrere leveringen. Prøv igjen.' }

  await supabaseAdmin.from('hendelser').insert({
    leie_id: leie.id,
    type: 'retur_sendt',
    beskrivelse: 'Kunden leverte inn og lastet opp bilde',
    aktor: `kunde:${enhetsId}`,
  })

  after(() => varsleRetur(leie.id))

  redirect(`/leie/${leie.referanse}`)
}
