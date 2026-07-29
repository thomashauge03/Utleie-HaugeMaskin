'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'

export type GodkjennTilstand = { feil?: string; ok?: string }

const desimal = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v.replace(',', '.'))))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), {
    message: 'Må være et positivt tall',
  })

const skjema = z.object({
  leie_id: z.uuid(),
  antall_dogn: desimal,
  belop: desimal,
  admin_notat: z.string().trim().optional(),
  avvik: z.string().trim().optional(),
  foreslatt_dogn: z.string().optional(),
  foreslatt_belop: z.string().optional(),
})

export async function godkjennLeie(
  _forrige: GodkjennTilstand,
  formData: FormData,
): Promise<GodkjennTilstand> {
  const admin = await krevAdmin()

  const felter = skjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const supabase = await lagServerKlient()

  const { data: leie } = await supabase
    .from('leier')
    .select('id, maskin_id, status')
    .eq('id', felter.data.leie_id)
    .maybeSingle()

  if (!leie) return { feil: 'Fant ikke leien.' }
  if (leie.status !== 'venter_godkjenning') {
    return { feil: 'Denne leien venter ikke på godkjenning.' }
  }

  // Flagger om admin overstyrte systemets forslag, slik at det er
  // sporbart hvorfor beløpet avviker fra døgn × døgnpris.
  const justert =
    String(felter.data.antall_dogn ?? '') !== (felter.data.foreslatt_dogn ?? '') ||
    String(felter.data.belop ?? '') !== (felter.data.foreslatt_belop ?? '')

  // `.eq('status', ...)` + `.select()` gjør godkjenningen atomisk: to
  // admins som trykker samtidig, treffer bare én en rad. Den andre får
  // tomt svar og hopper ut, så maskinstatus og hendelseslogg ikke kjøres
  // dobbelt.
  const { data: oppdatert, error } = await supabase
    .from('leier')
    .update({
      status: 'avsluttet',
      godkjent_tid: new Date().toISOString(),
      godkjent_av: admin.id,
      antall_dogn: felter.data.antall_dogn,
      belop: felter.data.belop,
      manuelt_justert: justert,
      admin_notat: felter.data.admin_notat || null,
      avvik: felter.data.avvik || null,
    })
    .eq('id', leie.id)
    .eq('status', 'venter_godkjenning')
    .select('id')

  if (error) return { feil: `Kunne ikke godkjenne: ${error.message}` }
  if (!oppdatert?.length) {
    return { feil: 'Leien ble nettopp behandlet av noen andre. Last siden på nytt.' }
  }

  // Maskinen blir først ledig når noen har bekreftet at den står der.
  await supabase.from('maskiner').update({ status: 'ledig' }).eq('id', leie.maskin_id)

  await supabase.from('hendelser').insert({
    leie_id: leie.id,
    type: 'godkjent',
    beskrivelse: justert
      ? 'Godkjent med manuelt justerte tall'
      : 'Godkjent med systemets forslag',
    aktor: `admin:${admin.epost}`,
  })

  revalidatePath('/admin')
  revalidatePath('/admin/leier')
  revalidatePath(`/admin/leier/${leie.id}`)
  return { ok: 'Leien er godkjent og avsluttet.' }
}

/**
 * Setter leien tilbake til aktiv. Eneste tilfellet dette trengs er at
 * maskinen ikke faktisk er levert – da skal klokka gå videre.
 */
export async function sendTilbake(leieId: string, grunn: string) {
  const admin = await krevAdmin()
  const supabase = await lagServerKlient()

  await supabase
    .from('leier')
    .update({ status: 'aktiv', slutt_tid: null, avvik: grunn || null })
    .eq('id', leieId)
    .eq('status', 'venter_godkjenning')

  await supabase.from('hendelser').insert({
    leie_id: leieId,
    type: 'sendt_tilbake',
    beskrivelse: grunn || 'Sendt tilbake til kunden',
    aktor: `admin:${admin.epost}`,
  })

  revalidatePath(`/admin/leier/${leieId}`)
}

export async function settFakturert(leieId: string, fakturert: boolean) {
  const admin = await krevAdmin()
  const supabase = await lagServerKlient()

  await supabase.from('leier').update({ fakturert }).eq('id', leieId)

  await supabase.from('hendelser').insert({
    leie_id: leieId,
    type: fakturert ? 'fakturert' : 'fakturering_angret',
    aktor: `admin:${admin.epost}`,
  })

  revalidatePath(`/admin/leier/${leieId}`)
}
