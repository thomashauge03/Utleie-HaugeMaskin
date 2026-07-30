'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type BrukerTilstand = { feil?: string; ok?: string }

const skjema = z.object({
  navn: z.string().trim().min(2, 'Navn må fylles ut'),
  epost: z.email('Ugyldig e-postadresse'),
  passord: z.string().min(8, 'Passordet må være minst 8 tegn'),
  rolle: z.enum(['admin', 'service']).default('admin'),
})

/**
 * Oppretter en ny admin-bruker.
 *
 * Vi setter passordet direkte i stedet for å sende invitasjon på
 * e-post, fordi Supabase sin innebygde e-posttjeneste har lave
 * ratebegrensninger og ikke er egnet i drift uten egen SMTP.
 * Passordet formidles av den som oppretter brukeren.
 */
export async function opprettBruker(
  _forrige: BrukerTilstand,
  formData: FormData,
): Promise<BrukerTilstand> {
  await krevAdmin()

  const felter = skjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: felter.data.epost,
    password: felter.data.passord,
    email_confirm: true,
  })

  if (error || !data.user) {
    return {
      feil: error?.message.includes('already')
        ? 'Det finnes allerede en bruker med denne e-postadressen.'
        : `Kunne ikke opprette bruker: ${error?.message ?? 'ukjent feil'}`,
    }
  }

  const { error: radFeil } = await supabaseAdmin.from('admin_brukere').insert({
    id: data.user.id,
    navn: felter.data.navn,
    epost: felter.data.epost,
    rolle: felter.data.rolle,
  })

  if (radFeil) {
    // Rydd opp, ellers står det igjen en auth-bruker uten admintilgang
    // som ingen kan gjøre noe med.
    await supabaseAdmin.auth.admin.deleteUser(data.user.id)
    return { feil: `Kunne ikke gi admintilgang: ${radFeil.message}` }
  }

  revalidatePath('/admin/brukere')
  return { ok: `${felter.data.navn} kan nå logge inn.` }
}

export async function settAktiv(brukerId: string, aktiv: boolean) {
  const admin = await krevAdmin()

  // Uten denne sjekken kunne siste admin deaktivert seg selv, og da er
  // det ingen igjen som kan slippe noen inn.
  if (brukerId === admin.id) return

  const supabase = await lagServerKlient()
  await supabase.from('admin_brukere').update({ aktiv }).eq('id', brukerId)
  revalidatePath('/admin/brukere')
}
