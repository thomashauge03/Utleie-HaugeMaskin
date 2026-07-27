import Link from 'next/link'

/* ═══════════════════════════════════════════════════════════
   Delte byggeklosser. Ett sted å endre, så følger hele appen
   etter – i stedet for at klasserekker driver fra hverandre.
   ═══════════════════════════════════════════════════════════ */

/** Kunden bruker hansker i sollys. Derfor 56 px høyde, ikke 44. */
export const KNAPP_PRIMÆR =
  'hm-trykk hm-kant-skygge inline-flex min-h-[3.5rem] w-full items-center justify-center gap-2 border-2 border-[var(--kant-sterk)] bg-hm-red px-6 text-base font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-hm-red'

export const KNAPP_SEKUNDÆR =
  'hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center justify-center gap-2 border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] px-4 text-sm font-semibold hover:bg-[var(--flate-2)] disabled:opacity-50'

export const KNAPP_LITEN =
  'hm-trykk inline-flex min-h-[2.25rem] items-center justify-center gap-1.5 border-2 border-[var(--kant)] bg-[var(--flate-opp)] px-3 text-xs font-semibold hover:border-[var(--kant-sterk)]'

/** 16 px hindrer at iOS zoomer inn når feltet får fokus. */
export const FELT =
  'w-full border-2 border-[var(--kant)] bg-[var(--flate-opp)] px-3.5 py-3 text-base text-[var(--blekk)] outline-none transition-colors placeholder:text-[var(--blekk-svak)] focus:border-hm-red'

export const ETIKETT =
  'mb-1.5 block text-xs font-bold tracking-widest text-[var(--blekk-svak)] uppercase'

export function Kort({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`border-2 border-[var(--kant)] bg-[var(--flate-opp)] ${className}`}
    >
      {children}
    </section>
  )
}

export function KortTittel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="hm-display border-b-2 border-[var(--kant)] px-5 py-3 text-lg">
      {children}
    </h2>
  )
}

type MerkeType = 'nøytral' | 'grønn' | 'rød' | 'gul' | 'svart'

const merkeStil: Record<MerkeType, string> = {
  nøytral: 'border-[var(--kant)] bg-[var(--flate-2)] text-[var(--blekk-svak)]',
  grønn: 'border-hm-green bg-hm-green text-white',
  rød: 'border-hm-red bg-hm-red text-white',
  gul: 'border-hm-amber bg-hm-amber text-white',
  svart: 'border-[var(--kant-sterk)] bg-hm-black text-white',
}

/**
 * Status vises alltid med tekst, aldri farge alene – ellers går
 * informasjonen tapt for de som ikke skiller rødt fra grønt.
 */
export function Merke({
  type = 'nøytral',
  children,
}: {
  type?: MerkeType
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center border-2 px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase ${merkeStil[type]}`}
    >
      {children}
    </span>
  )
}

/** Seksjonstittel med den skrå røde streken fra logoen. */
export function Seksjonstittel({
  children,
  under,
}: {
  children: React.ReactNode
  under?: React.ReactNode
}) {
  return (
    <div>
      <span className="hm-skrastrek mb-3" aria-hidden="true" />
      <h1 className="hm-display text-3xl">{children}</h1>
      {under && (
        <p className="mt-1.5 text-sm text-[var(--blekk-svak)]">{under}</p>
      )}
    </div>
  )
}

export function TomTilstand({
  tittel,
  children,
  handling,
}: {
  tittel: string
  children: React.ReactNode
  handling?: { href: string; tekst: string }
}) {
  return (
    <div className="border-2 border-dashed border-[var(--kant)] px-6 py-14 text-center">
      <p className="hm-display text-xl">{tittel}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--blekk-svak)]">
        {children}
      </p>
      {handling && (
        <Link href={handling.href} className={`${KNAPP_SEKUNDÆR} mt-5 w-auto`}>
          {handling.tekst}
        </Link>
      )}
    </div>
  )
}
