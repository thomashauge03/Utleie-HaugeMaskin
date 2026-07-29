'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const lenker = [
  { href: '/admin', tekst: 'Oversikt' },
  { href: '/admin/kalender', tekst: 'Kalender' },
  { href: '/admin/leier', tekst: 'Leier' },
  { href: '/admin/maskiner', tekst: 'Maskiner' },
  { href: '/admin/kunder', tekst: 'Kunder' },
  { href: '/admin/brukere', tekst: 'Brukere' },
  { href: '/admin/innstillinger', tekst: 'Innstillinger' },
]

/**
 * Hvor man befinner seg må være synlig, ikke noe man skal gjette.
 * Aktiv side får rød understrek og aria-current for skjermlesere.
 */
export function PanelMeny() {
  const sti = usePathname()

  return (
    <nav className="border-t border-white/10">
      <ul className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-2 xl:px-6">
        {lenker.map((l) => {
          const aktiv =
            l.href === '/admin' ? sti === '/admin' : sti.startsWith(l.href)

          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={aktiv ? 'page' : undefined}
                className={`inline-flex min-h-[2.75rem] items-center border-b-4 px-3 text-sm font-semibold tracking-wide whitespace-nowrap uppercase transition-colors ${
                  aktiv
                    ? 'border-hm-red text-white'
                    : 'border-transparent text-white/55 hover:text-white'
                }`}
              >
                {l.tekst}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
