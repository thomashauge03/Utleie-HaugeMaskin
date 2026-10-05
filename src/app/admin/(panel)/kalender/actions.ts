'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { normaliserTelefon } from '@/lib/telefon'
import { osloDag } from '@/lib/dato'
import { kortDag } from '@/lib/reservasjon'

export type ReservasjonTilstand = { feil?: string; ok?: string; varsel?: string }

const DAG = /^\d{4}-\d{2}-\d{2}$/

const skjema = z.object({
  maskin_id: z.uuid('Velg maskin'),
  fra_dato: z.string().regex(DAG, 'Velg fra-dato'),
  til_dato: z.string().regex(DAG, 'Velg til-dato'),
  kunde_navn: z.string().trim().min(2, 'Kundens navn må fylles ut').max(100),
  kunde_telefon: z.string().trim().min(1, 'Mobilnummer må fylles ut'),
  notat: z.string().trim().max(500).optional(),
})

/** «Tabellen finnes ikke» – migrasjon 0012 er ikke kjørt. */
const FINNES_IKKE = ['PGRST205', '42P01']

function oppdater() {
  revalidatePath('/admin/kalender')
  revalidatePath('/admin/maskiner/[id]', 'page')
}

/**
 * Ny reservasjon, lagt inn av admin. Overlapp stoppes av databasen
 * (reservasjoner_uten_overlapp), så to faner kan ikke lure den.
 *
 * Er maskinen utleid med retur etter at reservasjonen starter, lagres den
 * likevel – det kan være avtalt – men admin får vite det.
 */
export async function nyReservasjon(
  _forrige: ReservasjonTilstand,
  formData: FormData,
): Promise<ReservasjonTilstand> {
  const admin = await krevAdmin()

  const felter = skjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }
  const { maskin_id, fra_dato, til_dato, kunde_navn, notat } = felter.data

  const telefon = normaliserTelefon(felter.data.kunde_telefon)
  if (!telefon) return { feil: 'Mobilnummeret må være åtte siffer' }
  if (til_dato < fra_dato) return { feil: 'Til-datoen kan ikke være før fra-datoen' }
  if (til_dato < osloDag(new Date())) return { feil: 'Den perioden er allerede over' }

  const supabase = await lagServerKlient()
  const { error } = await supabase.from('reservasjoner').insert({
    maskin_id,
    fra_dato,
    til_dato,
    kunde_navn,
    kunde_telefon: telefon,
    notat: notat || null,
    opprettet_av: admin.id,
  })

  if (error) {
    if (error.code === '23P01') return { feil: 'Maskinen er allerede reservert i den perioden.' }
    if (FINNES_IKKE.includes(error.code)) {
      return { feil: 'Reservasjoner er ikke slått på ennå – kjør migrasjon 0012 i Supabase.' }
    }
    return { feil: `Kunne ikke lagre: ${error.message}` }
  }

  const { data: leie } = await supabase
    .from('leier')
    .select('planlagt_slutt')
    .eq('maskin_id', maskin_id)
    .in('status', ['aktiv', 'venter_godkjenning'])
    .maybeSingle()

  let varsel: string | undefined
  if (leie) {
    const retur = leie.planlagt_slutt ? osloDag(leie.planlagt_slutt) : null
    if (retur === null) varsel = 'Obs: maskinen er ute på et prosjekt på ubestemt tid.'
    else if (retur >= fra_dato) {
      varsel = `Obs: maskinen er utleid til ${kortDag(retur)}, etter at reservasjonen starter.`
    }
  }

  oppdater()
  return {
    ok: `Reservert ${kortDag(fra_dato)}–${kortDag(til_dato)} for ${kunde_navn}.`,
    varsel,
  }
}

/** Avlyser en aktiv reservasjon. Brukes med .bind(null, id) i et skjema. */
export async function avlysReservasjon(id: string): Promise<void> {
  await krevAdmin()
  if (!z.uuid().safeParse(id).success) return

  const supabase = await lagServerKlient()
  await supabase.from('reservasjoner').update({ status: 'avlyst' }).eq('id', id).eq('status', 'aktiv')
  oppdater()
}
