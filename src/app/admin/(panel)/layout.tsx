import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { HMLogo } from '@/components/hm-logo'
import { loggUt } from '../logg-inn/actions'
import { PanelMeny } from './meny'

// Alt i adminpanelet viser levende utleiestatus og skal aldri caches.
export const dynamic = 'force-dynamic'

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await krevAdmin()

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--flate-2)]">
      <header className="bg-hm-black text-white">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 xl:px-8">
          <Link href="/admin" aria-label="Til oversikten">
            <HMLogo størrelse="sm" />
          </Link>
          <span className="hidden text-xs font-bold tracking-widest text-white/40 uppercase sm:block">
            Utleie
          </span>

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden text-sm text-white/60 sm:block">
              {admin.navn}
            </span>
            <form action={loggUt}>
              <button
                type="submit"
                className="border-2 border-white/25 px-3 py-1.5 text-xs font-bold tracking-wider text-white/80 uppercase transition-colors hover:border-white hover:text-white"
              >
                Logg ut
              </button>
            </form>
          </div>
        </div>

        <PanelMeny />
      </header>

      {/* Bredt, fordi tabeller og kalender trenger plassen på storskjerm. */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 xl:px-8">
        {children}
      </main>
    </div>
  )
}
