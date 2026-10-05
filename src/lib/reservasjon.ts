/**
 * Reglene for reservasjoner, som rene funksjoner.
 *
 * Datoene er norske kalenderdager som yyyy-mm-dd (kolonnetypen date), og
 * slike datoer kan sammenlignes som tekst. Se
 * docs/superpowers/specs/2026-09-30-reservasjoner-design.md.
 */

export type ReservasjonStatus = 'forespurt' | 'aktiv' | 'hentet' | 'avlyst'

export type Reservasjon = {
  id: string
  maskin_id: string
  fra_dato: string
  til_dato: string
  kunde_navn: string
  kunde_telefon: string
  status: ReservasjonStatus
}

/** «2026-10-14» → «2026-10-13». I UTC, så sommertid ikke spiller inn. */
export function dagFør(dag: string): string {
  const [år, mnd, d] = dag.split('-').map(Number)
  return new Date(Date.UTC(år, mnd - 1, d - 1)).toISOString().slice(0, 10)
}

/** «2026-10-14» → «14.10.» */
export function kortDag(dag: string): string {
  const [, mnd, d] = dag.split('-')
  return `${d}.${mnd}.`
}

/**
 * Den aktive reservasjonen som kommer først og ikke er over. `unntatt` er
 * et mobilnummer: kundens egen reservasjon skal ikke sperre kunden.
 */
export function nesteReservasjon(
  liste: Reservasjon[],
  iDag: string,
  unntatt?: string,
): Reservasjon | null {
  return (
    liste
      .filter((r) => r.status === 'aktiv' && r.til_dato >= iDag && r.kunde_telefon !== unntatt)
      .sort((a, b) => a.fra_dato.localeCompare(b.fra_dato))[0] ?? null
  )
}

export type KundeGrense =
  | { type: 'fri' }
  | { type: 'sperret'; til: string }
  | { type: 'frist'; fra: string; sisteDag: string }

/** Hvor lenge en kunde kan leie maskinen fra i dag. */
export function kundeGrense(liste: Reservasjon[], iDag: string, telefon?: string): KundeGrense {
  const r = nesteReservasjon(liste, iDag, telefon)
  if (!r) return { type: 'fri' }
  if (r.fra_dato <= iDag) return { type: 'sperret', til: r.til_dato }
  return { type: 'frist', fra: r.fra_dato, sisteDag: dagFør(r.fra_dato) }
}

/** Det ansatte og kunder får se. Aldri kundens navn. */
export function reservasjonTekst(r: Reservasjon, iDag: string): string {
  return r.fra_dato <= iDag
    ? `Reservert for en kunde til ${kortDag(r.til_dato)}`
    : `Reservert fra ${kortDag(r.fra_dato)} – lever innen ${kortDag(dagFør(r.fra_dato))}`
}

/**
 * Varsel etter et uttak, bare når returen går inn i reservasjonen.
 * `sluttDag` null er «på ubestemt tid», som alltid gjør det.
 */
export function ansattVarsel(
  liste: Reservasjon[],
  iDag: string,
  sluttDag: string | null,
): string | null {
  const r = nesteReservasjon(liste, iDag)
  if (!r) return null
  if (sluttDag !== null && sluttDag < r.fra_dato) return null
  return reservasjonTekst(r, iDag)
}

/** Kundens egne aktive reservasjoner som en leie fra i dag til sluttDag dekker. */
export function egneReservasjoner(
  liste: Reservasjon[],
  telefon: string,
  iDag: string,
  sluttDag: string,
): string[] {
  return liste
    .filter(
      (r) =>
        r.status === 'aktiv' &&
        r.kunde_telefon === telefon &&
        r.fra_dato <= sluttDag &&
        r.til_dato >= iDag,
    )
    .map((r) => r.id)
}
