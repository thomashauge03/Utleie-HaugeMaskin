/**
 * Radtyper som speiler supabase/migrations/0001_init.sql.
 *
 * Skrevet for hånd framfor generert med `supabase gen types`, fordi
 * skjemaet er lite og stabilt, og fordi det holder prosjektet fritt for
 * et byggesteg som krever databasetilgang.
 * Endrer du migrasjonen, må du endre her også.
 */

export type MaskinStatus = 'ledig' | 'utleid' | 'service' | 'utrangert'
export type LeieStatus = 'aktiv' | 'venter_godkjenning' | 'avsluttet' | 'avvist'
export type KundeStatus = 'ny' | 'godkjent' | 'sperret'
export type BildeType = 'henting' | 'levering'

export type Maskin = {
  id: string
  qr_kode: string
  navn: string
  kategori: string | null
  underkategori: string | null
  kjeft_dimensjon: string | null
  verksted_status: string | null
  internnummer: string | null
  /** Pris per enhet – se pris_enhet for hvilken. */
  dogn_pris: number | null
  pris_enhet: 'dogn' | 'time'
  vis_pris: boolean
  status: MaskinStatus
  bilde_sti: string | null
  bruksanvisning_sti: string | null
  notat: string | null
  aktiv: boolean
  opprettet: string
}

export type Kunde = {
  id: string
  navn: string
  telefon: string
  adresse: string
  epost: string
  status: KundeStatus
  admin_notat: string | null
  opprettet: string
}

export type Leie = {
  id: string
  referanse: string
  maskin_id: string
  kunde_id: string
  enhets_id: string | null
  status: LeieStatus
  planlagt_slutt: string
  start_tid: string
  slutt_tid: string | null
  godkjent_tid: string | null
  godkjent_av: string | null
  antall_dogn: number | null
  belop: number | null
  manuelt_justert: boolean
  fakturert: boolean
  kommentar_start: string | null
  kommentar_retur: string | null
  admin_notat: string | null
  avvik: string | null
  opprettet: string
}

export type Bilde = {
  id: string
  leie_id: string
  type: BildeType
  fil_sti: string
  lat: number | null
  lng: number | null
  noyaktighet_m: number | null
  mottatt_tid: string
  ip: string | null
}

export const MASKIN_STATUS_TEKST: Record<MaskinStatus, string> = {
  ledig: 'Ledig',
  utleid: 'Utleid',
  service: 'På service',
  utrangert: 'Utrangert',
}

export const LEIE_STATUS_TEKST: Record<LeieStatus, string> = {
  aktiv: 'Aktiv',
  venter_godkjenning: 'Venter godkjenning',
  avsluttet: 'Avsluttet',
  avvist: 'Avvist',
}

/**
 * Status → merketype. Ett sted, så fargene ikke driver fra hverandre
 * mellom sidene. Merk: «forfalt» er ikke en egen status i databasen,
 * men en aktiv leie med passert leveringsdato – se erForfalt.
 */
export const LEIE_MERKE: Record<LeieStatus, 'grønn' | 'gul' | 'nøytral' | 'rød'> = {
  aktiv: 'grønn',
  venter_godkjenning: 'gul',
  avsluttet: 'nøytral',
  avvist: 'rød',
}

/** En aktiv leie hvis avtalte leveringsdato er passert. */
export function erForfalt(leie: Pick<Leie, 'status' | 'planlagt_slutt'>): boolean {
  return leie.status === 'aktiv' && new Date(leie.planlagt_slutt).getTime() < Date.now()
}
