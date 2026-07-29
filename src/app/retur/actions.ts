'use server'

import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sikreEnhetsId } from '@/lib/enhet'
import { normaliserTelefon } from '@/lib/telefon'
import { innenforGrense } from '@/lib/rategrense'

export type Treff = { referanse: string; maskinNavn: string; startet: string }
export type FinnTilstand = { feil?: string; treff?: Treff[]; telefon?: string }

/**
 * Finner aktive leier på et mobilnummer.
 *
 * Brukes når kunden har byttet telefon eller slettet nettleserdata, og
 * dermed mangler enhets-cookien. Vi viser bevisst kun maskinnavn og
 * startdato – ikke navn, adresse eller e-post – slik at et tilfeldig
 * nummer ikke avslører hvem kunden er.
 *
 * Kjent svakhet: uten SMS-verifisering er mobilnummeret et svakt bevis.
 * Men det ER et bevis: for å knytte en leie til telefonen din må du
 * oppgi nummeret leien står på. Se docs/TEKNISK-PLAN.md pkt. 8.2.
 */
export async function finnLeier(
  _forrige: FinnTilstand,
  formData: FormData,
): Promise<FinnTilstand> {
  // Uten tak kunne noen prøvd seg gjennom nummerserier for å se hvilke
  // som har en aktiv leie. 15 forsøk i timen rekker en ekte kunde som
  // taster feil et par ganger, men ikke en høsting.
  if (!(await innenforGrense('finn', 15, 60 * 60 * 1000))) {
    return { feil: 'For mange forsøk. Vent litt og prøv igjen.' }
  }

  const telefon = normaliserTelefon(String(formData.get('telefon') ?? ''))
  if (!telefon) return { feil: 'Skriv mobilnummeret ditt med åtte siffer' }

  const { data: kunde } = await supabaseAdmin
    .from('kunder')
    .select('id, status')
    .eq('telefon', telefon)
    .maybeSingle()

  // Sperrede kunder skal ikke kunne finne eller avslutte leier selv.
  if (!kunde || kunde.status === 'sperret') {
    return { feil: 'Fant ingen aktiv leie på dette nummeret.' }
  }

  const { data: leier } = await supabaseAdmin
    .from('leier')
    .select('referanse, start_tid, maskiner(navn)')
    .eq('kunde_id', kunde.id)
    .eq('status', 'aktiv')
    .order('start_tid')

  if (!leier?.length) return { feil: 'Fant ingen aktiv leie på dette nummeret.' }

  // Oppslaget er bevisst lesende – det knytter ingenting. Selve
  // knytningen skjer først når kunden trykker på en leie i lista, også
  // når det bare er én. Da har ikke et oppslag noen bivirkning, og en
  // enumerering av numre kan ikke kapre leier som en sideeffekt.
  const treff: Treff[] = leier.map((l) => ({
    referanse: l.referanse,
    maskinNavn: (l.maskiner as unknown as { navn: string }).navn,
    startet: l.start_tid,
  }))

  // Nummeret sendes tilbake, slik at valget i lista kan bevise
  // tilhørighet uten at kunden må taste det om igjen.
  return { treff, telefon }
}

/**
 * Knytter en leie til telefonen som står her nå.
 *
 * Krever mobilnummeret leien står på. Uten den sjekken kunne hvem som
 * helst gjettet en referanse (de er sekvensielle: L-ÅÅMM-NNNN) og
 * kapret en fremmed sin aktive leie – låst eieren ute og tvangslevert
 * maskinen. Referansen alene er ikke nok.
 */
export async function knyttTilEnhet(referanse: string, telefon: string) {
  const nummer = normaliserTelefon(telefon)
  if (!nummer || !(await bindTilEnhet(referanse, nummer))) {
    redirect('/retur')
  }
  redirect(`/leie/${referanse}/retur`)
}

/**
 * Selve knytningen. Returnerer true om leien fantes, var aktiv, og
 * tilhørte en kunde med det oppgitte nummeret. Kaster aldri redirect,
 * så den kan brukes fra begge inngangene over.
 */
async function bindTilEnhet(referanse: string, nummer: string): Promise<boolean> {
  const { data: leie } = await supabaseAdmin
    .from('leier')
    .select('id, kunder!inner(telefon)')
    .eq('referanse', referanse)
    .eq('status', 'aktiv')
    .maybeSingle()

  const kundeTelefon = (leie?.kunder as unknown as { telefon: string } | null)?.telefon
  if (!leie || kundeTelefon !== nummer) return false

  const enhetsId = await sikreEnhetsId()
  await supabaseAdmin
    .from('leier')
    .update({ enhets_id: enhetsId })
    .eq('id', leie.id)
    .eq('status', 'aktiv')

  return true
}
