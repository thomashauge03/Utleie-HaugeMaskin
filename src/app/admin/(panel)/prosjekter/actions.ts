'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'

export type ProsjektTilstand = { feil?: string; ok?: string }

const skjema = z.object({
  navn: z.string().trim().min(2, 'Navn må fylles ut').max(100),
  nummer: z.string().trim().max(40).optional(),
})

function lagringsfeil(error: { code?: string; message: string }): string {
  return error.code === '23505'
    ? 'Det finnes allerede et prosjekt med det navnet.'
    : `Kunne ikke lagre: ${error.message}`
}

export async function opprettProsjekt(
  _forrige: ProsjektTilstand,
  formData: FormData,
): Promise<ProsjektTilstand> {
  await krevAdmin()

  const felter = skjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const supabase = await lagServerKlient()
  const { error } = await supabase
    .from('prosjekter')
    .insert({ navn: felter.data.navn, nummer: felter.data.nummer || null })

  if (error) return { feil: lagringsfeil(error) }

  revalidatePath('/admin/prosjekter')
  return { ok: `${felter.data.navn} er lagt til.` }
}

export async function endreProsjekt(
  id: string,
  _forrige: ProsjektTilstand,
  formData: FormData,
): Promise<ProsjektTilstand> {
  await krevAdmin()

  const felter = skjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const supabase = await lagServerKlient()
  const { error } = await supabase
    .from('prosjekter')
    .update({ navn: felter.data.navn, nummer: felter.data.nummer || null })
    .eq('id', id)

  if (error) return { feil: lagringsfeil(error) }

  revalidatePath('/admin/prosjekter', 'layout')
  return { ok: 'Lagret.' }
}

/**
 * Avslutter eller åpner et prosjekt igjen. Utstyr som står ute på det,
 * blir der til det leveres – et avsluttet prosjekt forsvinner bare fra
 * de ansattes liste.
 */
export async function settProsjektAktiv(id: string, aktiv: boolean) {
  await krevAdmin()
  const supabase = await lagServerKlient()
  await supabase.from('prosjekter').update({ aktiv }).eq('id', id)
  revalidatePath('/admin/prosjekter', 'layout')
}

/**
 * Sletter et prosjekt uten leier – typisk et feilskrevet et. Har det
 * leier, skal det avsluttes i stedet, ikke slettes, så historikken
 * består.
 *
 * Knappen er skjult når prosjektet har leier, men et direkte POST eller
 * en leie som opprettes i samme øyeblikk kan komme hit likevel – da må
 * admin få beskjed, ikke bare se at ingenting skjedde.
 */
export async function slettProsjekt(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kreves av useActionState sin signatur
  _forrige: ProsjektTilstand,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kreves av useActionState sin signatur
  _formData: FormData,
): Promise<ProsjektTilstand> {
  await krevAdmin()
  const supabase = await lagServerKlient()
  const feilLeier = 'Prosjektet har leier og kan ikke slettes. Avslutt det i stedet.'

  const { count } = await supabase
    .from('leier')
    .select('id', { count: 'exact', head: true })
    .eq('prosjekt_id', id)
  if (count) return { feil: feilLeier }

  const { error } = await supabase.from('prosjekter').delete().eq('id', id)
  if (error) {
    return { feil: error.code === '23503' ? feilLeier : `Kunne ikke slette: ${error.message}` }
  }

  revalidatePath('/admin/prosjekter')
  redirect('/admin/prosjekter')
}
