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
