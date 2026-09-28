/**
 * Pris per døgn eller per time.
 *
 * Alt som gjelder prisenheten samles her – etiketter, beregning og
 * formatering – slik at en maskin som byttes fra døgn til time slår
 * gjennom likt i adminpanelet, på kundesiden, i PDF-en og i e-postene.
 */

export type PrisEnhet = 'dogn' | 'time'

/** Tåler at kolonnen mangler, slik at appen virker før migrasjon 0004. */
export function prisEnhet(verdi: string | null | undefined): PrisEnhet {
  return verdi === 'time' ? 'time' : 'dogn'
}

/** «per døgn» / «per time» */
export const perEnhet = (e: PrisEnhet) => (e === 'time' ? 'per time' : 'per døgn')

/** «kr / døgn» — brukt der plassen er trang */
export const krPer = (e: PrisEnhet) => (e === 'time' ? 'kr / time' : 'kr / døgn')

/** «Antall døgn» / «Antall timer» — feltetiketter */
export const antallEtikett = (e: PrisEnhet) =>
  e === 'time' ? 'Antall timer' : 'Antall døgn'

/** «3 døgn» / «5 timer» */
export function antallTekst(antall: number, e: PrisEnhet): string {
  if (e === 'time') return `${antall} ${antall === 1 ? 'time' : 'timer'}`
  return `${antall} ${antall === 1 ? 'døgn' : 'døgn'}`
}

/** Kolonneoverskrift i fakturagrunnlaget. */
export const enhetKolonne = (e: PrisEnhet) => (e === 'time' ? 'TIMER' : 'DØGN')

/** «12 500 kr» – kronebeløp med tusenskille, brukt på prosjektsidene. */
export const kroner = (n: number) => `${n.toLocaleString('nb-NO')} kr`

/**
 * Antall enheter mellom to tidspunkt, der påbegynt enhet teller som hel.
 *
 * Minimum én – en leie som varer ti minutter skal ikke bli gratis.
 */
export function beregnAntall(start: string, slutt: string, e: PrisEnhet): number {
  const ms = new Date(slutt).getTime() - new Date(start).getTime()
  const per = e === 'time' ? 1000 * 60 * 60 : 1000 * 60 * 60 * 24
  return Math.max(1, Math.ceil(ms / per))
}

/**
 * Antall enheter og beløp for en periode.
 *
 * Én regel for både forslaget på godkjenningssiden og internleie som
 * regnes ut ved levering, så de aldri kan regne ulikt. Hele kroner, som
 * forslaget alltid har vært. Uten pris på maskinen blir beløpet null,
 * ikke 0 – «mangler pris» er noe annet enn «gratis».
 */
export function beregnPris(
  start: string,
  slutt: string,
  e: PrisEnhet,
  pris: number | null,
): { antall: number; belop: number | null } {
  const antall = beregnAntall(start, slutt, e)
  return { antall, belop: pris === null ? null : Math.round(antall * pris) }
}

export type InternleieRad = {
  status: string
  start_tid: string
  /** Lagret ved levering. Null så lenge leien er ute. */
  belop: number | null
  /** Maskinens pris, for anslaget på det som fortsatt er ute. */
  pris: number | null
  enhet: PrisEnhet
}

/**
 * En internleie slik spørringene henter den, gjort om til det
 * summerInternleie trenger. Ett sted, så prosjektlista og prosjektsiden
 * aldri regner ulikt.
 */
export function internleieRad(l: {
  status: string
  start_tid: string
  belop: number | null
  maskiner: { dogn_pris: number | null; pris_enhet: string | null } | null
}): InternleieRad {
  return {
    status: l.status,
    start_tid: l.start_tid,
    belop: l.belop,
    pris: l.maskiner?.dogn_pris ?? null,
    enhet: prisEnhet(l.maskiner?.pris_enhet),
  }
}

/**
 * Hva et prosjekt har brukt på internleie.
 *
 * Levert er de lagrede beløpene. Løpende er et anslag fram til nå for det
 * som fortsatt er ute – det vokser hver dag til utstyret leveres.
 * manglerPris flagger en maskin uten pris, så summen ikke ser komplett
 * ut når den ikke er det.
 */
export function summerInternleie(
  rader: InternleieRad[],
  nå: string,
): { levert: number; løpende: number; ute: number; manglerPris: boolean } {
  let levert = 0
  let løpende = 0
  let ute = 0
  let manglerPris = false

  for (const r of rader) {
    if (r.status === 'aktiv') {
      ute++
      const { belop } = beregnPris(r.start_tid, nå, r.enhet, r.pris)
      if (belop === null) manglerPris = true
      else løpende += belop
    } else if (r.status === 'avsluttet') {
      if (r.belop === null) manglerPris = true
      else levert += r.belop
    }
  }

  return { levert, løpende, ute, manglerPris }
}
