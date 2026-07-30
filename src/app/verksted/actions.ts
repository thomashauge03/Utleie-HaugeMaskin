'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { hentAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sikreEnhetsId } from '@/lib/enhet'
import { kanSettesAvAlle, type VerkstedStatus } from '@/lib/verksted'

export type VerkstedTilstand = { feil?: string; ok?: string }

const statusSkjema = z.enum(['ma_sveises', 'deler_bestilt', 'klar'])
const delStatusSkjema = z.enum(['ok', 'ma_byttes', 'bestilt', 'byttet'])

/**
 * Setter verkstedstatus på en maskin.
 *
 * Alle kan melde fra om at noe må sveises – det er å rapportere et
 * problem, og terskelen skal være lav for den som står med skuffa.
 * Å sette «deler bestilt» eller «klar for drift» er en beslutning, og
 * krever innlogget service- eller adminbruker.
 */
export async function settVerkstedStatus(
  maskinId: string,
  status: string,
): Promise<VerkstedTilstand> {
  const gyldig = statusSkjema.safeParse(status)
  if (!gyldig.success) return { feil: 'Ugyldig status' }

  const bruker = await hentAdmin()

  if (!bruker && !kanSettesAvAlle(gyldig.data as VerkstedStatus)) {
    return { feil: 'Du må være innlogget for å sette denne statusen.' }
  }

  const { data: maskin } = await supabaseAdmin
    .from('maskiner')
    .select('navn, verksted_status')
    .eq('id', maskinId)
    .maybeSingle()

  if (!maskin) return { feil: 'Fant ikke maskinen' }
  if (maskin.verksted_status === gyldig.data) return {}

  const { error } = await supabaseAdmin
    .from('maskiner')
    .update({ verksted_status: gyldig.data })
    .eq('id', maskinId)

  if (error) return { feil: `Kunne ikke lagre: ${error.message}` }

  // Anonyme meldinger spores på enhets-ID, så det i det minste er
  // mulig å se om alt kommer fra samme telefon.
  const aktor = bruker
    ? `${bruker.rolle}:${bruker.epost}`
    : `melder:${await sikreEnhetsId()}`

  await supabaseAdmin.from('verksted_logg').insert({
    maskin_id: maskinId,
    beskrivelse: `Status satt til ${gyldig.data.replace('_', ' ')}`,
    aktor,
  })

  revalidatePath('/verksted')
  revalidatePath(`/verksted/${maskinId}`)
  return { ok: 'Status oppdatert.' }
}

/**
 * Setter status på én del. Krever innlogging – dette er verkstedets
 * egen vurdering, ikke en melding fra den som fant feilen.
 */
export async function settDelStatus(
  maskinId: string,
  delId: string,
  status: string,
): Promise<VerkstedTilstand> {
  const bruker = await hentAdmin()
  if (!bruker) return { feil: 'Krever innlogging.' }

  const gyldig = delStatusSkjema.safeParse(status)
  if (!gyldig.success) return { feil: 'Ugyldig status' }

  const { data: del } = await supabaseAdmin
    .from('verksted_deler')
    .select('navn')
    .eq('id', delId)
    .maybeSingle()

  const { error } = await supabaseAdmin.from('maskin_delstatus').upsert(
    {
      maskin_id: maskinId,
      del_id: delId,
      status: gyldig.data,
      oppdatert: new Date().toISOString(),
    },
    { onConflict: 'maskin_id,del_id' },
  )

  if (error) return { feil: `Kunne ikke lagre: ${error.message}` }

  await supabaseAdmin.from('verksted_logg').insert({
    maskin_id: maskinId,
    del_navn: del?.navn ?? null,
    beskrivelse: `${del?.navn ?? 'Del'}: ${gyldig.data.replace('_', ' ')}`,
    aktor: `${bruker.rolle}:${bruker.epost}`,
  })

  revalidatePath('/verksted')
  revalidatePath(`/verksted/${maskinId}`)
  return { ok: 'Lagret.' }
}

/**
 * Målet på en del – f.eks. tannstørrelse eller lengde på slitestål.
 *
 * Egen handling framfor å ligge i settDelStatus, slik at målet kan
 * fylles ut uten å endre status. Delen kan være helt i orden og likevel
 * trenge et registrert mål for framtidig bestilling.
 */
export async function settDelMal(
  maskinId: string,
  delId: string,
  mal: string,
): Promise<VerkstedTilstand> {
  const bruker = await hentAdmin()
  if (!bruker) return { feil: 'Krever innlogging.' }

  const verdi = mal.trim().slice(0, 120)

  const { error } = await supabaseAdmin.from('maskin_delstatus').upsert(
    {
      maskin_id: maskinId,
      del_id: delId,
      mal: verdi || null,
      oppdatert: new Date().toISOString(),
    },
    { onConflict: 'maskin_id,del_id' },
  )

  if (error) return { feil: `Kunne ikke lagre: ${error.message}` }

  revalidatePath('/verksted')
  revalidatePath(`/verksted/${maskinId}`)
  return { ok: 'Mål lagret.' }
}

/** Fritekstnotat i loggen, f.eks. hva som faktisk ble gjort. */
export async function leggTilNotat(
  maskinId: string,
  formData: FormData,
): Promise<VerkstedTilstand> {
  const bruker = await hentAdmin()
  if (!bruker) return { feil: 'Krever innlogging.' }

  const tekst = String(formData.get('notat') ?? '').trim()
  if (tekst.length < 2) return { feil: 'Skriv litt mer.' }

  await supabaseAdmin.from('verksted_logg').insert({
    maskin_id: maskinId,
    beskrivelse: tekst.slice(0, 500),
    aktor: `${bruker.rolle}:${bruker.epost}`,
  })

  revalidatePath(`/verksted/${maskinId}`)
  return { ok: 'Notat lagt til.' }
}

/** Kjeft-dimensjon er en spesifikasjon, ikke en status. */
export async function settKjeftDimensjon(
  maskinId: string,
  formData: FormData,
): Promise<VerkstedTilstand> {
  const bruker = await hentAdmin()
  if (!bruker) return { feil: 'Krever innlogging.' }

  const verdi = String(formData.get('kjeft_dimensjon') ?? '').trim()

  await supabaseAdmin
    .from('maskiner')
    .update({ kjeft_dimensjon: verdi || null })
    .eq('id', maskinId)

  revalidatePath(`/verksted/${maskinId}`)
  return { ok: 'Lagret.' }
}
