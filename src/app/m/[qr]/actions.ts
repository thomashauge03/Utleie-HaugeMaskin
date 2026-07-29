'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sikreEnhetsId } from '@/lib/enhet'
import { normaliserTelefon } from '@/lib/telefon'
import { varsleNyLeie } from '@/lib/epost/varsler'

export type LeieTilstand = { feil?: string }

const skjema = z.object({
  maskin_id: z.uuid(),
  navn: z.string().trim().min(2, 'Navn må fylles ut'),
  telefon: z.string().trim().min(1, 'Mobilnummer må fylles ut'),
  adresse: z.string().trim().min(4, 'Adresse må fylles ut'),
  epost: z.email('Ugyldig e-postadresse'),
  planlagt_slutt: z.string().min(1, 'Forventet leveringsdato må fylles ut'),
  kommentar: z.string().trim().optional(),
  bilde_sti: z.string().min(1, 'Du må ta bilde av maskinen før du starter leien'),
  lat: z.string().optional(),
  lng: z.string().optional(),
  noyaktighet: z.string().optional(),
  vilkar: z.literal('on', { message: 'Du må godta leievilkårene' }),
})

function tall(v: string | undefined): number | null {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function startLeie(
  _forrige: LeieTilstand,
  formData: FormData,
): Promise<LeieTilstand> {
  const felter = skjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const telefon = normaliserTelefon(felter.data.telefon)
  if (!telefon) {
    return { feil: 'Mobilnummeret må være åtte siffer' }
  }

  // Leveringsdato må være i dag eller senere. Datoen kommer fra et
  // <input type="date"> og settes til slutten av dagen.
  const slutt = new Date(`${felter.data.planlagt_slutt}T23:59:59`)
  if (Number.isNaN(slutt.getTime())) {
    return { feil: 'Ugyldig leveringsdato' }
  }
  if (slutt.getTime() < Date.now()) {
    return { feil: 'Leveringsdatoen kan ikke være tilbake i tid' }
  }

  const { data: maskin } = await supabaseAdmin
    .from('maskiner')
    .select('id, navn, status, aktiv')
    .eq('id', felter.data.maskin_id)
    .maybeSingle()

  if (!maskin || !maskin.aktiv || maskin.status !== 'ledig') {
    return { feil: 'Maskinen er ikke tilgjengelig for utleie akkurat nå.' }
  }

  const enhetsId = await sikreEnhetsId()

  // Kjenner vi nummeret fra før, gjenbruker vi kunden og oppdaterer
  // kontaktinfo. Ellers opprettes en ny med status «ny», som gir admin
  // et gult flagg i panelet.
  const { data: kunde, error: kundeFeil } = await supabaseAdmin
    .from('kunder')
    .upsert(
      {
        telefon,
        navn: felter.data.navn,
        adresse: felter.data.adresse,
        epost: felter.data.epost,
      },
      { onConflict: 'telefon' },
    )
    .select('id')
    .single()

  if (kundeFeil || !kunde) {
    return { feil: 'Kunne ikke lagre kontaktopplysningene. Prøv igjen.' }
  }

  const { data: leie, error: leieFeil } = await supabaseAdmin
    .from('leier')
    .insert({
      maskin_id: maskin.id,
      kunde_id: kunde.id,
      enhets_id: enhetsId,
      planlagt_slutt: slutt.toISOString(),
      kommentar_start: felter.data.kommentar || null,
    })
    .select('id, referanse')
    .single()

  if (leieFeil || !leie) {
    // Databasen har en unik indeks som hindrer to aktive leier på samme
    // maskin. Treffer vi den, har noen andre rukket å leie den akkurat nå.
    const samtidig = leieFeil?.code === '23505'
    return {
      feil: samtidig
        ? 'Noen andre rakk å leie denne maskinen akkurat nå.'
        : 'Kunne ikke starte leien. Prøv igjen.',
    }
  }

  await supabaseAdmin.from('bilder').insert({
    leie_id: leie.id,
    type: 'henting',
    fil_sti: felter.data.bilde_sti,
    lat: tall(felter.data.lat),
    lng: tall(felter.data.lng),
    noyaktighet_m: tall(felter.data.noyaktighet),
  })

  await supabaseAdmin.from('maskiner').update({ status: 'utleid' }).eq('id', maskin.id)

  await supabaseAdmin.from('hendelser').insert({
    leie_id: leie.id,
    type: 'startet',
    beskrivelse: `${felter.data.navn} startet leie av ${maskin.navn}`,
    aktor: `kunde:${enhetsId}`,
  })

  // Sendes etter at svaret er levert. Kunden står på anleggsplassen og
  // skal ikke vente på at en e-posttjeneste svarer.
  after(() => varsleNyLeie(leie.id))

  redirect(`/leie/${leie.referanse}`)
}
