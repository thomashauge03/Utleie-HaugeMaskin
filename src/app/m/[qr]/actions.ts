'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sikreEnhetsId } from '@/lib/enhet'
import { normaliserTelefon } from '@/lib/telefon'
import { BILDE_STI, MAKS_KOMMENTAR } from '@/lib/validering'
import { bildeFinnes } from '@/lib/bilder'
import { innenforGrense } from '@/lib/rategrense'
import { varsleNyLeie } from '@/lib/epost/varsler'

export type LeieTilstand = { feil?: string }

const skjema = z.object({
  maskin_id: z.uuid(),
  navn: z.string().trim().min(2, 'Navn må fylles ut').max(100),
  telefon: z.string().trim().min(1, 'Mobilnummer må fylles ut'),
  adresse: z.string().trim().min(4, 'Adresse må fylles ut').max(200),
  epost: z.email('Ugyldig e-postadresse').max(200),
  planlagt_slutt: z.string().min(1, 'Forventet leveringsdato må fylles ut'),
  kommentar: z.string().trim().max(MAKS_KOMMENTAR).optional(),
  // Stien må ha formatet route-handleren genererer. Uten det kunne en
  // vilkårlig streng lagres som «bilde» på leien.
  bilde_sti: z
    .string()
    .regex(BILDE_STI, 'Du må ta bilde av maskinen før du starter leien'),
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

/**
 * «2026-07-30» → tidspunktet 23:59:59 den dagen i norsk tid, som et
 * korrekt UTC-instant – uavhengig av hvilken tidssone serveren står i.
 *
 * Vi finner Oslos offset ved å formatere kl. 12 UTC den dagen i
 * Europe/Oslo: klokka blir 13 (vinter, UTC+1) eller 14 (sommer, UTC+2).
 * Da vet vi at 23:59:59 Oslo = (23 − offset):59:59 UTC samme dato.
 * Kl. 12 UTC unngår all døgnkryssing.
 */
function norskSluttAvDag(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null

  const [år, mnd, dag] = ymd.split('-').map(Number)
  const klokka12 = new Date(Date.UTC(år, mnd - 1, dag, 12, 0, 0))

  const osloTime = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Oslo',
      hour: '2-digit',
      hour12: false,
    }).format(klokka12),
  )
  const offset = osloTime - 12 // 1 om vinteren, 2 om sommeren

  const instant = new Date(Date.UTC(år, mnd - 1, dag, 23 - offset, 59, 59))
  return Number.isNaN(instant.getTime()) ? null : instant
}

export async function startLeie(
  _forrige: LeieTilstand,
  formData: FormData,
): Promise<LeieTilstand> {
  // Bremser spam av leier og kunder fra samme maskin.
  if (!(await innenforGrense('start', 10, 60 * 60 * 1000))) {
    return { feil: 'For mange forsøk. Vent litt og prøv igjen.' }
  }

  const felter = skjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const telefon = normaliserTelefon(felter.data.telefon)
  if (!telefon) {
    return { feil: 'Mobilnummeret må være åtte siffer' }
  }

  // Datoen kommer fra et <input type="date"> som yyyy-mm-dd, og skal
  // bety «slutten av den dagen i norsk tid». Vi kan ikke bruke
  // new Date('...T23:59:59') – den tolkes i serverens tidssone, og
  // Vercel kjører UTC. Da ville fristen bli satt til 01:59 norsk tid
  // natten etter. Norge er UTC+1 (+2 om sommeren), så vi bygger
  // tidspunktet eksplisitt.
  const slutt = norskSluttAvDag(felter.data.planlagt_slutt)
  if (!slutt) return { feil: 'Ugyldig leveringsdato' }
  if (slutt.getTime() < Date.now()) {
    return { feil: 'Leveringsdatoen kan ikke være tilbake i tid' }
  }

  // Stien har riktig format (regex over), men vi krever også at bildet
  // faktisk ligger i lageret før leien opprettes.
  if (!(await bildeFinnes(felter.data.bilde_sti))) {
    return { feil: 'Fant ikke bildet. Ta bildet på nytt og prøv igjen.' }
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
    .select('id, status')
    .single()

  if (kundeFeil || !kunde) {
    return { feil: 'Kunne ikke lagre kontaktopplysningene. Prøv igjen.' }
  }

  // upsert rører ikke status-kolonnen, så en sperret kunde forblir
  // sperret og kan ikke starte en ny leie ved å fylle ut skjemaet.
  if (kunde.status === 'sperret') {
    return { feil: 'Ta kontakt med utleier for å leie denne maskinen.' }
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
