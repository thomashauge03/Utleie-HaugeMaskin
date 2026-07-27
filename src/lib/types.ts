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
  internnummer: string | null
  dogn_pris: number | null
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
