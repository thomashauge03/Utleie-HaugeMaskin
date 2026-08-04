'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { krevInnlogget } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type ByttTilstand = { feil?: string }

const skjema = z
  .object({
    passord: z.string().min(8, 'Passordet må være minst 8 tegn'),
    gjenta: z.string(),
  })
  .refine((d) => d.passord === d.gjenta, {
    message: 'De to passordene er ikke like',
  })

/**
 * Brukeren setter sitt eget passord.
 *
 * Går gjennom brukerens egen sesjon, ikke admin-API-et – da er det
 * kontoen som er logget inn som endres, og skjemaet kan ikke brukes
 * til å sette passord for andre.
 */
export async function byttEgetPassord(
  _forrige: ByttTilstand,
  formData: FormData,
): Promise<ByttTilstand> {
  const bruker = await krevInnlogget()

  const felter = skjema.safeParse({
    passord: formData.get('passord') ?? '',
    gjenta: formData.get('gjenta') ?? '',
  })
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const supabase = await lagServerKlient()
  const { error } = await supabase.auth.updateUser({
    password: felter.data.passord,
  })

  if (error) {
    // Supabase avviser blant annet et passord likt det forrige.
    return { feil: `Kunne ikke endre passord: ${error.message}` }
  }

  // Flagget fjernes med service role: brukeren har ikke skrivetilgang
  // til admin_brukere, og skal heller ikke ha det.
  await supabaseAdmin
    .from('admin_brukere')
    .update({ ma_bytte_passord: false })
    .eq('id', bruker.id)

  redirect(bruker.rolle === 'service' ? '/verksted' : '/admin')
}
