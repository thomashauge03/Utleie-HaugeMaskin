import { Fragment } from 'react'
import Link from 'next/link'
import type { Plassering } from '@/lib/tidslinje'
import { RullTilIDag } from './rull-til-i-dag'

/** Én stolpe – en leie eller en reservasjon – klar til å tegnes. */
export type Stolpe = Plassering & {
  id: string
  /** Leietakeren, eller «Reservert · kunde». */
  tekst: string
  /** Tooltipen: maskin, hvem og datoer. */
  tittel: string
  /** Leia stolpen lenker til. Reservasjoner har ingen egen side. */
  href?: string
  /** Farge og kant. */
  klasse: string
  /** Leie på ubestemt tid: «på ubestemt tid ▸» ytterst til høyre. */
  ubestemt?: boolean
}

export type TidslinjeRad = {
  id: string
  navn: string
  internnummer: string | null
  kategori: string | null
  baner: Stolpe[][]
}

const UKEDAG = ['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø']

/**
 * Måneden som tidslinje: én rad per maskin, én kolonne per dag. Stolper
 * som overlapper på samme maskin ligger i hver sin bane, så ingenting
 * skjules – uansett hvor mange leier det er. Henter ingenting selv.
 *
 * Radene deler kolonnene med toppraden gjennom `grid-cols-subgrid`.
 * Maskinkolonnen er sticky, så navnet synes når tidslinja rulles
 * sidelengs på mobil.
 */
export function Tidslinje({
  rader,
  antallDager,
  førsteUkedag,
  iDag,
  tomTekst,
}: {
  rader: TidslinjeRad[]
  antallDager: number
  /** Ukedagen den 1. faller på, mandag = 0. */
  førsteUkedag: number
  /** Dagens kolonne, eller null når i dag ikke er i måneden. */
  iDag: number | null
  tomTekst: string
}) {
  const dager = Array.from({ length: antallDager }, (_, i) => i + 1)
  const ukedag = (d: number) => (førsteUkedag + d - 1) % 7
  const helg = (d: number) => ukedag(d) >= 5

  return (
    <RullTilIDag className="overflow-x-auto border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] [--maskinkol:8.5rem] md:[--maskinkol:13rem]">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `var(--maskinkol) repeat(${antallDager}, minmax(2rem, 1fr))`,
          minWidth: `calc(var(--maskinkol) + ${antallDager * 2}rem)`,
        }}
      >
        <div className="col-span-full grid grid-cols-subgrid bg-hm-black text-white">
          <div
            data-maskinkol
            className="sticky left-0 z-20 flex items-end bg-hm-black px-3 py-2 text-[11px] font-bold tracking-widest uppercase"
          >
            Maskin
          </div>
          {dager.map((d) => (
            <div
              key={d}
              data-idag={d === iDag ? '' : undefined}
              className={`flex flex-col items-center py-1.5 ${helg(d) ? 'bg-white/10' : ''}`}
            >
              <span className="text-[10px] font-bold tracking-wider text-white/60 uppercase">
                {UKEDAG[ukedag(d)]}
              </span>
              <span
                className={`hm-tall inline-flex size-6 items-center justify-center text-sm font-bold ${
                  d === iDag ? 'bg-hm-red' : ''
                }`}
              >
                {d}
              </span>
            </div>
          ))}
        </div>

        {rader.length === 0 && (
          <p className="col-span-full p-6 text-sm text-[var(--blekk-svak)]">{tomTekst}</p>
        )}

        {rader.map((rad, i) => (
          <Fragment key={rad.id}>
            {(i === 0 || rad.kategori !== rader[i - 1].kategori) && (
              <div className="col-span-full border-t-2 border-[var(--kant-sterk)] bg-[var(--flate-2)]">
                <span className="sticky left-0 inline-block px-3 py-1.5 text-[11px] font-bold tracking-widest text-[var(--blekk-svak)] uppercase">
                  {rad.kategori ?? 'Uten kategori'}
                </span>
              </div>
            )}
            <div
              className="col-span-full grid grid-cols-subgrid border-t border-[var(--kant)]"
              style={{ gridTemplateRows: `repeat(${Math.max(rad.baner.length, 1)}, minmax(2rem, auto))` }}
            >
              <div
                className="sticky left-0 z-10 flex min-w-0 flex-col justify-center border-r border-[var(--kant)] bg-[var(--flate-opp)] px-3 py-1"
                style={{ gridColumn: 1, gridRow: '1 / -1' }}
              >
                {/* To linjer: på mobil er kolonnen smal, og «Minigraver Ku…» to
                    ganger sier ingenting. */}
                <span className="line-clamp-2 text-sm leading-tight font-bold">{rad.navn}</span>
                {rad.internnummer && (
                  <span className="truncate text-[11px] text-[var(--blekk-svak)]">
                    {rad.internnummer}
                  </span>
                )}
              </div>
              {/* Helg og i dag, i hele radens høyde. */}
              {dager
                .filter((d) => helg(d) || d === iDag)
                .map((d) => (
                  <div
                    key={d}
                    aria-hidden
                    className={d === iDag ? 'bg-hm-red/10' : 'bg-[var(--flate-2)]'}
                    style={{ gridColumn: d + 1, gridRow: '1 / -1' }}
                  />
                ))}
              {rad.baner.map((bane, b) =>
                bane.map((s) => <StolpeVisning key={s.id} s={s} bane={b} />),
              )}
            </div>
          </Fragment>
        ))}
      </div>
    </RullTilIDag>
  )
}

/**
 * overflow-clip, ikke -hidden: hidden ville gjort stolpen til en egen
 * rulleboks, og da kunne ikke teksten være sticky mot tidslinja. Nå blir
 * teksten stående rett ved maskinkolonnen når stolpens start er rullet
 * ut av syne på mobil.
 */
function StolpeVisning({ s, bane }: { s: Stolpe; bane: number }) {
  const stil = { gridColumn: `${s.fraKol + 1} / ${s.tilKol + 2}`, gridRow: bane + 1 }
  const klasse = `relative z-[1] mx-px flex h-6 min-w-0 items-center gap-1.5 self-center overflow-clip px-1.5 text-[11px] leading-none font-bold ${s.klasse}`
  const innhold = (
    <>
      <span className="sticky left-[calc(var(--maskinkol)+0.375rem)] min-w-0 truncate">
        {s.førMåneden && '◂ '}
        {s.tekst}
      </span>
      {s.ubestemt ? (
        <span className="ml-auto shrink-0 text-[9px] font-semibold tracking-wide uppercase">
          på ubestemt tid ▸
        </span>
      ) : (
        s.etterMåneden && <span className="ml-auto shrink-0">▸</span>
      )}
    </>
  )
  return s.href ? (
    <Link href={s.href} title={s.tittel} style={stil} className={`${klasse} hover:brightness-110`}>
      {innhold}
    </Link>
  ) : (
    <span title={s.tittel} style={stil} className={klasse}>
      {innhold}
    </span>
  )
}
