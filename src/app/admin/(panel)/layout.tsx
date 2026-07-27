import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { loggUt } from '../logg-inn/actions'

// Alt i adminpanelet viser levende utleiestatus og skal aldri caches.
export const dynamic = 'force-dynamic'

const lenker = [
  { href: '/admin', tekst: 'Oversikt' },
  { href: '/admin/kalender', tekst: 'Kalender' },
  { href: '/admin/leier', tekst: 'Leier' },
  { href: '/admin/maskiner', tekst: 'Maskiner' },
  { href: '/admin/kunder', tekst: 'Kunder' },
  { href: '/admin/brukere', tekst: 'Brukere' },
]

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await krevAdmin()

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/admin" className="font-semibold tracking-tight">
            Utleie
          </Link>

          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {lenker.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                {l.tekst}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400">{admin.navn}</span>
            <form action={loggUt}>
              <button
                type="submit"
                className="text-slate-600 underline-offset-4 transition hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100"
              >
                Logg ut
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
