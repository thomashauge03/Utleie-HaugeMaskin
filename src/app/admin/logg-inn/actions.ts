'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { lagServerKlient } from '@/lib/supabase/server'

const skjema = z.object({
  epost: z.email('Ugyldig e-postadresse'),
  passord: z.string().min(1, 'Passord må fylles ut'),
})

export type LoggInnTilstand = { feil?: string }

export async function loggInn(
  _forrige: LoggInnTilstand,
  formData: FormData,
): Promise<LoggInnTilstand> {
  const felter = skjema.safeParse({
    epost: formData.get('epost'),
    passord: formData.get('passord'),
  })

  if (!felter.success) {
    return { feil: felter.error.issues[0].message }
  }

  const supabase = await lagServerKlient()

  const { data: økt, error } = await supabase.auth.signInWithPassword({
    email: felter.data.epost,
    password: felter.data.passord,
  })

  // Samme feilmelding uansett om e-posten finnes eller passordet er feil.
  // Ellers blir innloggingsskjemaet et verktøy for å kartlegge hvem som
  // har konto hos oss.
  if (error || !økt.user) {
    return { feil: 'Feil e-post eller passord.' }
  }

  const { data: admin } = await supabase
    .from('admin_brukere')
    .select('id')
    .eq('id', økt.user.id)
    .eq('aktiv', true)
    .single()

  if (!admin) {
    await supabase.auth.signOut()
    return { feil: 'Denne kontoen har ikke admintilgang.' }
  }

  redirect('/admin')
}

export async function loggUt() {
  const supabase = await lagServerKlient()
  await supabase.auth.signOut()
  redirect('/admin/logg-inn')
}
