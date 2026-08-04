import Link from 'next/link'
import type { AdminBruker } from '@/lib/auth'
import { loggUt } from '@/app/admin/logg-inn/actions'

/**
 * Brukermeny i verkstedhodet.
 *
 * Verkstedet ligger utenfor adminlayouten, så uten denne hadde en
 * servicearbeider hverken kommet til passordbytte eller kunnet logge
 * ut – bare stått fast på lista.
 *
 * Bruker <details> framfor egen klientkomponent: det gir en meny som
 * åpnes og lukkes uten JavaScript, og lukkes med Escape av seg selv.
 */
export function BrukerMeny({ bruker }: { bruker: AdminBruker | null }) {
  if (!bruker) {
    return (
      <Link
        href="/admin/logg-inn"
        className="border-2 border-white/25 px-3 py-1.5 text-xs font-bold tracking-wider text-white/80 uppercase transition-colors hover:border-white hover:text-white"
      >
        Logg inn
      </Link>
    )
  }

  const lenke =
    'block px-4 py-3 text-sm font-semibold text-[var(--blekk)] transition-colors hover:bg-[var(--flate-2)]'

  return (
    <details className="relative">
      <summary className="inline-flex min-h-[2.5rem] cursor-pointer list-none items-center gap-2 border-2 border-white/25 px-3 text-xs font-bold tracking-wider text-white/80 uppercase transition-colors hover:border-white hover:text-white [&::-webkit-details-marker]:hidden">
        {bruker.navn}
        <span aria-hidden="true">▾</span>
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-52 border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] shadow-[4px_4px_0_0_var(--kant-sterk)]">
        <p className="border-b-2 border-[var(--kant)] px-4 py-2 text-[10px] font-bold tracking-widest text-[var(--blekk-svak)] uppercase">
          {bruker.rolle === 'admin' ? 'Admin' : 'Servicearbeider'}
        </p>

        {bruker.rolle === 'admin' && (
          <Link href="/admin" className={lenke}>
            Adminpanel
          </Link>
        )}

        <Link href="/admin/bytt-passord" className={lenke}>
          Bytt passord
        </Link>

        <form action={loggUt} className="border-t-2 border-[var(--kant)]">
          <button type="submit" className={`${lenke} w-full text-left text-hm-red-ink`}>
            Logg ut
          </button>
        </form>
      </div>
    </details>
  )
}
