import Link from 'next/link'
import type { AdminBruker, Rolle } from '@/lib/auth'
import { loggUt } from '@/app/admin/logg-inn/actions'

const ROLLE_TEKST: Record<Rolle, string> = {
  admin: 'Admin',
  service: 'Servicearbeider',
  ansatt: 'Ansatt',
}

// Panelet ligger oppå den svarte toppen, som er svart i begge tema. Med
// temafargene ble det nesten svart på svart i mørkt tema (1,1:1 mot toppen),
// og «Logg ut» mørkerødt på nesten svart (2,4:1). Variablene låses derfor til
// de lyse verdiene fra globals.css, så alt inni følger etter.
const ALLTID_LYS =
  '[--flate-opp:#ffffff] [--flate-2:#f4f4f5] [--blekk:#0b0b0c] [--blekk-svak:#52525b] [--kant:#e4e4e7] [--kant-sterk:#0b0b0c]'

/**
 * Brukermeny øverst på verkstedet og på uttakssiden.
 *
 * Begge ligger utenfor adminlayouten, så uten denne hadde en
 * servicearbeider verken kommet mellom verkstedet og uttak, til
 * passordbytte eller kunnet logge ut – bare stått fast på én side.
 *
 * Bruker <details> framfor egen klientkomponent: det gir en meny som
 * åpnes og lukkes uten JavaScript, og lukkes med Escape av seg selv.
 *
 * Panelet henger ut under den svarte toppen. Toppen kan derfor ikke ha
 * overflow-hidden – den skrå flata må klippes i sitt eget lag, ellers
 * kappes panelet der toppen slutter, og «Logg ut» med det.
 */
export function BrukerMeny({
  bruker,
  her,
}: {
  bruker: AdminBruker | null
  /** Siden menyen står på – lenken dit vises ikke. */
  her: 'verksted' | 'ansatt'
}) {
  if (!bruker) {
    return (
      <Link
        href={`/admin/logg-inn?neste=/${her}`}
        className="border-2 border-white/25 px-3 py-1.5 text-xs font-bold tracking-wider text-white/80 uppercase transition-colors hover:border-white hover:text-white"
      >
        Logg inn
      </Link>
    )
  }

  const lenke =
    'block px-4 py-3 text-sm font-semibold text-[var(--blekk)] transition-colors hover:bg-[var(--flate-2)]'

  const lenker = [
    { href: '/admin', tekst: 'Adminpanel', vis: bruker.rolle === 'admin' },
    {
      href: '/verksted',
      tekst: 'Verksted',
      vis: bruker.rolle !== 'ansatt' && her !== 'verksted',
    },
    { href: '/ansatt', tekst: 'Ta ut utstyr', vis: her !== 'ansatt' },
    { href: '/admin/bytt-passord', tekst: 'Bytt passord', vis: true },
  ]

  return (
    <details className="relative">
      <summary className="inline-flex min-h-[2.5rem] cursor-pointer list-none items-center gap-2 border-2 border-white/25 px-3 text-xs font-bold tracking-wider text-white/80 uppercase transition-colors hover:border-white hover:text-white [&::-webkit-details-marker]:hidden">
        {bruker.navn}
        <span aria-hidden="true">▾</span>
      </summary>

      <div
        className={`absolute right-0 z-20 mt-2 w-52 border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] shadow-[4px_4px_0_0_var(--kant-sterk)] ${ALLTID_LYS}`}
      >
        <p className="border-b-2 border-[var(--kant)] px-4 py-2 text-[10px] font-bold tracking-widest text-[var(--blekk-svak)] uppercase">
          {ROLLE_TEKST[bruker.rolle]}
        </p>

        {lenker
          .filter((l) => l.vis)
          .map((l) => (
            <Link key={l.href} href={l.href} className={lenke}>
              {l.tekst}
            </Link>
          ))}

        <form action={loggUt} className="border-t-2 border-[var(--kant)]">
          <button type="submit" className={`${lenke} w-full text-left text-hm-red-ink`}>
            Logg ut
          </button>
        </form>
      </div>
    </details>
  )
}
