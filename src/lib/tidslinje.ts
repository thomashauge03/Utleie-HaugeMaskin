/**
 * Tidslinja i admin-kalenderen: hvor en periode havner i en måned, og
 * hvordan stolper som overlapper fordeles på baner.
 *
 * Datoene er norske kalenderdager (yyyy-mm-dd) og kan sammenlignes som
 * tekst. Fila importerer ingenting, så den kan testes med node:test. Se
 * docs/superpowers/specs/2026-10-05-kalender-tidslinje-design.md.
 */

export type Periode = {
  /** Første dag, med. */
  fra: string
  /** Siste dag, med. Null er ingen slutt – på ubestemt tid. */
  til: string | null
}

export type Plassering = {
  /** Dagen i måneden stolpen begynner på (1–31). */
  fraKol: number
  /** Dagen i måneden stolpen slutter på (1–31). */
  tilKol: number
  /** Perioden begynte før måneden. */
  førMåneden: boolean
  /** Perioden fortsetter etter måneden, eller har ingen slutt. */
  etterMåneden: boolean
}

const dagIMåneden = (dag: string) => Number(dag.slice(8, 10))

/**
 * Hvor perioden havner i måneden fra førsteDag til sisteDag – eller null
 * når den ikke berører måneden.
 */
export function plasser(p: Periode, førsteDag: string, sisteDag: string): Plassering | null {
  if (p.fra > sisteDag) return null
  if (p.til !== null && (p.til < førsteDag || p.til < p.fra)) return null
  const etterMåneden = p.til === null || p.til > sisteDag
  return {
    fraKol: dagIMåneden(p.fra < førsteDag ? førsteDag : p.fra),
    tilKol: dagIMåneden(p.til === null || etterMåneden ? sisteDag : p.til),
    førMåneden: p.fra < førsteDag,
    etterMåneden,
  }
}

/**
 * Fordeler stolpene på baner så ingen overlapper: sortert etter start, og
 * hver stolpe i første bane der den får plass. To stolper som deler en
 * dag, overlapper.
 */
export function baner<T extends Pick<Plassering, 'fraKol' | 'tilKol'>>(stolper: T[]): T[][] {
  const ut: T[][] = []
  for (const s of [...stolper].sort((a, b) => a.fraKol - b.fraKol || a.tilKol - b.tilKol)) {
    const ledig = ut.find((bane) => bane[bane.length - 1].tilKol < s.fraKol)
    if (ledig) ledig.push(s)
    else ut.push([s])
  }
  return ut
}
