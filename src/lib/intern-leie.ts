import { after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { varsleMerknadIntern } from '@/lib/epost/varsler'
import { beregnPris, prisEnhet } from '@/lib/pris'
import { kanLeiesUt } from '@/lib/verksted'
import { opptattGrunn, prosjektNavn } from '@/lib/leietaker'
import { osloDag } from '@/lib/dato'
import {
  ansattVarsel,
  nesteReservasjon,
  reservasjonTekst,
  type Reservasjon,
} from '@/lib/reservasjon'
import { hentReservasjoner } from '@/lib/reservasjon-data'
import type { AdminBruker } from '@/lib/auth'
import type { ProsjektInnbygd } from '@/lib/types'
import 'server-only'

/*
 * Uttak og levering for egne folk.
 *
 * Går gjennom service role, som kundeflyten og verkstedet: en ansatt har
 * ingen leserettigheter i databasen (se er_admin i 0011). Derfor sjekker
 * hver funksjon her selv at det den gjør, gjelder den innloggede.
 * Kallstedet har allerede krevd innlogging med krevAnsatt.
 *
 * Denne fila må ALDRI få `'use server'` øverst. `avsluttInternLeie` sin
 * `somAdmin`-modus har ingen eierskapssjekk – den stoler på at kalleren
 * (en adminhandling som selv har kjørt krevAdmin) allerede har sjekket
 * det. Som en server action ville funksjonen vært en åpen POST-rute som
 * hvem som helst kunne truffet direkte, uten noen tilgangskontroll.
 */

/** PostgREST- og Postgres-kodene for «tabellen finnes ikke». */
const FINNES_IKKE = ['PGRST205', '42P01']

export type ProsjektValg = { id: string; navn: string }

export type MinLeie = {
  id: string
  maskin: string
  internnummer: string | null
  prosjekt: string
  startTid: string
  planlagtSlutt: string | null
}

export type UttakMaskin = {
  id: string
  /** Koden på maskinen (qr_kode) – skanneren slår opp på den. */
  qr: string
  navn: string
  internnummer: string | null
  kategori: string
  underkategori: string | null
  /** null når den kan tas ut. Ellers grunnen, klar til å vises. */
  opptatt: string | null
  /** Neste reservasjon som tekst, eller null. Et varsel, ikke en sperre. */
  reservert: string | null
}

/** Reservasjonene gruppert per maskin. */
function reservasjonerPerMaskin(liste: Reservasjon[]): Map<string, Reservasjon[]> {
  const kart = new Map<string, Reservasjon[]>()
  for (const r of liste) {
    if (!kart.has(r.maskin_id)) kart.set(r.maskin_id, [])
    kart.get(r.maskin_id)!.push(r)
  }
  return kart
}

export type Uttaksside =
  | { sattOpp: false }
  | {
      sattOpp: true
      prosjekter: ProsjektValg[]
      sistProsjektId: string | null
      mine: MinLeie[]
      maskiner: UttakMaskin[]
    }

type AktivRad = {
  id: string
  maskin_id: string
  ansatt_id: string | null
  start_tid: string
  planlagt_slutt: string | null
  maskiner: { navn: string; internnummer: string | null } | null
  ansatt: { navn: string } | null
  prosjekter: ProsjektInnbygd | null
}

type MaskinRad = {
  id: string
  qr_kode: string
  navn: string
  internnummer: string | null
  kategori: string | null
  underkategori: string | null
  status: string
  verksted_status: string | null
}

/**
 * Aktive prosjekter å velge mellom, og prosjektet brukeren tok ut til
 * sist – forhåndsvalgt, siden det som regel er det samme i dag.
 *
 * null betyr at prosjekttabellen ikke finnes ennå (0011 er ikke kjørt).
 * Andre feil kastes, så de ikke forkles som «ikke satt opp».
 */
export async function hentProsjektvalg(brukerId: string): Promise<{
  prosjekter: ProsjektValg[]
  sistProsjektId: string | null
} | null> {
  const [{ data: prosjekter, error }, { data: siste }] = await Promise.all([
    supabaseAdmin.from('prosjekter').select('id, navn, nummer').eq('aktiv', true).order('navn'),
    supabaseAdmin
      .from('leier')
      .select('prosjekt_id')
      .eq('ansatt_id', brukerId)
      .order('start_tid', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (error) {
    if (FINNES_IKKE.includes(error.code)) return null
    throw new Error(`Kunne ikke hente prosjekter: ${error.message}`)
  }

  const valg = ((prosjekter ?? []) as (ProsjektInnbygd & { id: string })[]).map((p) => ({
    id: p.id,
    navn: prosjektNavn(p),
  }))

  // Et avsluttet prosjekt står ikke i lista, og kan ikke forhåndsvelges.
  const sistId = (siste as { prosjekt_id: string | null } | null)?.prosjekt_id ?? null
  const sistProsjektId = sistId && valg.some((p) => p.id === sistId) ? sistId : null

  return { prosjekter: valg, sistProsjektId }
}

/**
 * Alt /ansatt trenger, hentet i én runde. Hver tur til databasen koster
 * mer enn spørringen selv – se hentVerksted.
 */
export async function hentUttaksside(bruker: AdminBruker): Promise<Uttaksside> {
  const [
    valg,
    { data: maskinRader, error: maskinFeil },
    { data: aktiveRader, error: aktiveFeil },
    reservasjoner,
  ] = await Promise.all([
    hentProsjektvalg(bruker.id),
    supabaseAdmin
      .from('maskiner')
      .select('id, qr_kode, navn, internnummer, kategori, underkategori, status, verksted_status')
      .eq('aktiv', true)
      .neq('status', 'utrangert')
      .order('kategori', { nullsFirst: false })
      .order('underkategori', { nullsFirst: false })
      .order('internnummer')
      .order('navn'),
    supabaseAdmin
      .from('leier')
      .select(
        'id, maskin_id, ansatt_id, start_tid, planlagt_slutt, maskiner(navn, internnummer), ansatt:admin_brukere!leier_ansatt_id_fkey(navn), prosjekter(navn, nummer)',
      )
      .in('status', ['aktiv', 'venter_godkjenning'])
      .order('start_tid'),
    // Reservasjonene er bare varsler her. Feiler de, skal lista likevel
    // vises – uten varsel, ikke med en feilside.
    hentReservasjoner().catch(() => [] as Reservasjon[]),
  ])

  // «Ikke satt opp ennå» skal vinne når prosjekttabellen mangler, selv om
  // de andre spørringene skulle feile av samme grunn.
  if (!valg) return { sattOpp: false }
  if (maskinFeil) throw new Error(`Kunne ikke hente maskiner: ${maskinFeil.message}`)
  if (aktiveFeil) throw new Error(`Kunne ikke hente leier: ${aktiveFeil.message}`)

  const aktive = (aktiveRader ?? []) as unknown as AktivRad[]
  const perMaskin = new Map(aktive.map((l) => [l.maskin_id, l]))

  const mine: MinLeie[] = aktive
    .filter((l) => l.ansatt_id === bruker.id)
    .map((l) => ({
      id: l.id,
      maskin: l.maskiner?.navn ?? 'Ukjent maskin',
      internnummer: l.maskiner?.internnummer ?? null,
      prosjekt: l.prosjekter ? prosjektNavn(l.prosjekter) : '–',
      startTid: l.start_tid,
      planlagtSlutt: l.planlagt_slutt,
    }))

  const iDag = osloDag(new Date())
  const resPerMaskin = reservasjonerPerMaskin(reservasjoner)

  const maskiner: UttakMaskin[] = ((maskinRader ?? []) as MaskinRad[]).map((m) => {
    const l = perMaskin.get(m.id)
    const neste = nesteReservasjon(resPerMaskin.get(m.id) ?? [], iDag)
    return {
      id: m.id,
      qr: m.qr_kode,
      navn: m.navn,
      internnummer: m.internnummer,
      kategori: m.kategori?.trim() || 'Uten kategori',
      underkategori: m.underkategori,
      opptatt: opptattGrunn({
        status: m.status,
        påVerksted: !kanLeiesUt(m.verksted_status),
        leie: l
          ? {
              ansatt_id: l.ansatt_id,
              ansattNavn: l.ansatt?.navn ?? null,
              prosjekt: l.prosjekter ? prosjektNavn(l.prosjekter) : null,
            }
          : null,
        megId: bruker.id,
      }),
      reservert: neste ? reservasjonTekst(neste, iDag) : null,
    }
  })

  return { sattOpp: true, ...valg, mine, maskiner }
}

/**
 * Tar ut én eller flere maskiner til et prosjekt.
 *
 * Maskin for maskin, ikke alt eller ingenting: rakk en kollega å ta én
 * av dem, skal ikke de andre falle bort. Den unike indeksen på aktive
 * leier er det som faktisk hindrer dobbeltuttak – sjekkene før er der
 * for å gi en grunn folk forstår.
 */
export async function taUtUtstyr(
  bruker: AdminBruker,
  maskinIder: string[],
  prosjektId: string,
  planlagtSlutt: Date | null,
): Promise<{ feil: string } | { tattUt: string[]; ikkeTatt: string[]; varsler: string[] }> {
  const { data: prosjektRad } = await supabaseAdmin
    .from('prosjekter')
    .select('id, navn, nummer, aktiv')
    .eq('id', prosjektId)
    .maybeSingle()

  const prosjekt = prosjektRad as (ProsjektInnbygd & { id: string; aktiv: boolean }) | null
  if (!prosjekt) return { feil: 'Fant ikke prosjektet.' }
  if (!prosjekt.aktiv) return { feil: 'Prosjektet er avsluttet. Velg et annet.' }

  const { data: rader } = await supabaseAdmin
    .from('maskiner')
    .select('id, navn, aktiv, status, verksted_status')
    .in('id', maskinIder)

  type Rad = { id: string; navn: string; aktiv: boolean; status: string; verksted_status: string | null }
  const maskiner = new Map(((rader ?? []) as Rad[]).map((m) => [m.id, m]))

  // Varsler, aldri sperre: feiler oppslaget, tas utstyret ut uten varsel.
  const iDag = osloDag(new Date())
  const sluttDag = planlagtSlutt ? osloDag(planlagtSlutt) : null
  const resPerMaskin = reservasjonerPerMaskin(
    await hentReservasjoner(maskinIder).catch(() => [] as Reservasjon[]),
  )

  const tattUt: string[] = []
  const ikkeTatt: string[] = []
  const varsler: string[] = []

  for (const id of maskinIder) {
    const m = maskiner.get(id)
    if (!m || !m.aktiv) {
      ikkeTatt.push(`${m?.navn ?? 'En maskin'} finnes ikke lenger`)
      continue
    }
    if (!kanLeiesUt(m.verksted_status)) {
      ikkeTatt.push(`${m.navn} står til reparasjon`)
      continue
    }
    if (m.status !== 'ledig') {
      ikkeTatt.push(`${m.navn} er ikke ledig`)
      continue
    }

    const { data: leie, error } = await supabaseAdmin
      .from('leier')
      .insert({
        maskin_id: m.id,
        ansatt_id: bruker.id,
        prosjekt_id: prosjekt.id,
        planlagt_slutt: planlagtSlutt?.toISOString() ?? null,
      })
      .select('id')
      .single()

    if (error || !leie) {
      ikkeTatt.push(
        error?.code === '23505'
          ? `${m.navn} rakk noen andre å ta`
          : `${m.navn} kunne ikke registreres`,
      )
      continue
    }

    // `.eq('status','ledig')`: satte admin maskinen til service i
    // mellomtiden, skal ikke dette overskrive det.
    await supabaseAdmin
      .from('maskiner')
      .update({ status: 'utleid' })
      .eq('id', m.id)
      .eq('status', 'ledig')
    await supabaseAdmin.from('hendelser').insert({
      leie_id: leie.id,
      type: 'startet',
      beskrivelse: `${bruker.navn} tok ut ${m.navn} til ${prosjektNavn(prosjekt)}`,
      aktor: `${bruker.rolle}:${bruker.epost}`,
    })
    tattUt.push(m.navn)

    const varsel = ansattVarsel(resPerMaskin.get(m.id) ?? [], iDag, sluttDag)
    if (varsel) varsler.push(`${m.navn}: ${varsel}`)
  }

  return { tattUt, ikkeTatt, varsler }
}

/**
 * Avslutter en internleie: klokka stopper nå, prisen regnes ut og føres
 * på prosjektet, og maskinen er ledig med én gang.
 *
 * Brukes både når den ansatte leverer selv og når admin registrerer
 * levering på vegne av noen. Med `ansattId` må leien være deres – ellers
 * kunne hvem som helst levere en kollegas utstyr med en direkte POST.
 *
 * Modusen er eksplisitt i typen (`ansattId` eller `somAdmin: true`), så en
 * ny kaller ikke kan glemme eierskapssjekken ved å utelate begge.
 */
export async function avsluttInternLeie(
  opts: { leieId: string; aktor: string; kommentar?: string | null } & (
    | { ansattId: string }
    | { somAdmin: true }
  ),
): Promise<{ feil: string } | { ok: true; maskin: string }> {
  let spørring = supabaseAdmin
    .from('leier')
    .select('id, status, start_tid, maskin_id, ansatt_id, maskiner(navn, dogn_pris, pris_enhet)')
    .eq('id', opts.leieId)
    .not('ansatt_id', 'is', null)
  if ('ansattId' in opts) spørring = spørring.eq('ansatt_id', opts.ansattId)

  const { data } = await spørring.maybeSingle()
  const leie = data as unknown as {
    id: string
    status: string
    start_tid: string
    maskin_id: string
    maskiner: { navn: string; dogn_pris: number | null; pris_enhet: string | null } | null
  } | null

  if (!leie) return { feil: 'Fant ikke leien.' }
  if (leie.status !== 'aktiv') return { feil: 'Denne er allerede levert.' }

  // Servertid, som i kundereturen. Se docs/TEKNISK-PLAN.md, designvalg 1.
  const slutt = new Date().toISOString()
  const { antall, belop } = beregnPris(
    leie.start_tid,
    slutt,
    prisEnhet(leie.maskiner?.pris_enhet),
    leie.maskiner?.dogn_pris ?? null,
  )

  // `.eq('status','aktiv')` + `.select()` gjør leveringen atomisk: sendes
  // skjemaet to ganger, treffer den andre ingen rad.
  const { data: oppdatert, error } = await supabaseAdmin
    .from('leier')
    .update({
      status: 'avsluttet',
      slutt_tid: slutt,
      antall_dogn: antall,
      belop,
      kommentar_retur: opts.kommentar || null,
    })
    .eq('id', leie.id)
    .eq('status', 'aktiv')
    .select('id')

  if (error) return { feil: 'Kunne ikke registrere leveringen. Prøv igjen.' }
  if (!oppdatert?.length) return { feil: 'Denne er allerede levert.' }

  // Satt til service i mellomtiden? Da skal den ikke bli ledig av dette.
  await supabaseAdmin
    .from('maskiner')
    .update({ status: 'ledig' })
    .eq('id', leie.maskin_id)
    .eq('status', 'utleid')

  const maskin = leie.maskiner?.navn ?? 'Maskinen'
  await supabaseAdmin.from('hendelser').insert({
    leie_id: leie.id,
    type: 'levert',
    beskrivelse: opts.kommentar ? `${maskin} levert – «${opts.kommentar}»` : `${maskin} levert`,
    aktor: opts.aktor,
  })

  if (opts.kommentar) after(() => varsleMerknadIntern(leie.id))

  return { ok: true, maskin }
}
