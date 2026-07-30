/**
 * Verkstedflyten for skuffer og annet utstyr som ikke leies ut, men
 * vedlikeholdes internt.
 *
 * Statuser, etiketter og farger samles her, slik at listevisning,
 * detaljside og eventuelle rapporter viser det samme.
 */

export type VerkstedStatus = 'ma_sveises' | 'deler_bestilt' | 'klar'
export type DelStatus = 'ok' | 'ma_byttes' | 'bestilt' | 'byttet'

export const VERKSTED_STATUS_TEKST: Record<VerkstedStatus, string> = {
  ma_sveises: 'Må sveises',
  deler_bestilt: 'Deler bestilt',
  klar: 'Klar for drift',
}

export const DEL_STATUS_TEKST: Record<DelStatus, string> = {
  ok: 'OK',
  ma_byttes: 'Må byttes',
  bestilt: 'Bestilt',
  byttet: 'Byttet',
}

/** Merketype i UI-komponenten Merke. */
export const VERKSTED_MERKE: Record<VerkstedStatus, 'rød' | 'gul' | 'grønn'> = {
  ma_sveises: 'rød',
  deler_bestilt: 'gul',
  klar: 'grønn',
}

export const DEL_MERKE: Record<DelStatus, 'rød' | 'gul' | 'grønn' | 'nøytral'> = {
  ok: 'grønn',
  ma_byttes: 'rød',
  bestilt: 'gul',
  byttet: 'nøytral',
}

/**
 * Statusene alle kan sette uten innlogging.
 *
 * Hvem som helst kan melde fra om at noe må sveises – det er å
 * rapportere et problem. Å erklære noe bestilt eller klart for drift
 * er en beslutning, og krever service- eller adminbruker.
 */
/**
 * Hvilende tilstand er «klar for drift».
 *
 * En maskin uten registrert sak er i orden – null betyr ikke «ukjent»,
 * det betyr at ingen har meldt noe galt. Uten dette ville alt nyopprettet
 * utstyr vært usynlig sperret for utleie.
 */
export function verkstedStatusAv(
  verdi: string | null | undefined,
): VerkstedStatus {
  return verdi === 'ma_sveises' || verdi === 'deler_bestilt' ? verdi : 'klar'
}

/**
 * Utstyr i verkstedet kan bare leies ut når det er klart for drift.
 * Må det sveises, eller venter det på deler, skal det ikke ut til kunde.
 */
export function kanLeiesUt(verkstedStatus: string | null | undefined): boolean {
  return verkstedStatusAv(verkstedStatus) === 'klar'
}

export const APEN_STATUS: VerkstedStatus[] = ['ma_sveises']

export function kanSettesAvAlle(status: VerkstedStatus): boolean {
  return APEN_STATUS.includes(status)
}

/** Trenger maskinen oppmerksomhet? Styrer sortering og telling. */
export function krevesArbeid(
  status: string | null | undefined,
  deler: { status: string }[],
): boolean {
  if (status === 'ma_sveises' || status === 'deler_bestilt') return true
  return deler.some((d) => d.status === 'ma_byttes' || d.status === 'bestilt')
}
