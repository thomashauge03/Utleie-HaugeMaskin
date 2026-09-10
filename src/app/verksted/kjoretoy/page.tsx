import type { Metadata } from 'next'
import Link from 'next/link'
import { krevVerkstedBruker } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { fristerFor } from '@/lib/frister'
import { dato } from '@/lib/dato'
import { KJØRETØY_STATUS_TEKST, type Kjøretøy, type KjøretøyStatus } from '@/lib/types'
import { HMLogo } from '@/components/hm-logo'
import { TomTilstand } from '@/components/ui'
import { BrukerMeny } from '../bruker-meny'

export const metadata: Metadata = { title: 'Kjøretøy – Verksted' }
export const dynamic = 'force-dynamic'

/**
 * Skrivebeskyttet fristoversikt for servicearbeidere.
 *
 * krevVerkstedBruker framfor hentVerkstedBruker med vilje: resten av
 * verkstedet er lesbart uten innlogging, og en liste over firmaets
 * kjøretøy med ansvarlige personer skal ikke være det.
 */
export default async function VerkstedKjøretøySide() {
  const bruker = await krevVerkstedBruker()

  const supabase = await lagServerKlient()
  const { data } = await supabase
    .from('kjoretoy')
    .select('*')
    .eq('status', 'i_drift')
    .order('eu_frist', { ascending: true, nullsFirst: false })
    .limit(500)

  const alle = (data ?? []) as Kjøretøy[]
  const haster = alle.filter((k) =>
    fristerFor(k).some((f) => f.dager <= 30),
  ).length

  return (
    <>
      {/* Samme topp som /verksted – uten den henger siden i løse lufta,
          siden mappa ikke har noen layout.tsx. */}
      <header className="relative overflow-hidden bg-hm-black px-5 pt-6 pb-8 text-white">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-16 h-[160%] w-40 skew-x-[-18deg] bg-hm-red/90"
        />
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <HMLogo størrelse="sm" />
            <BrukerMeny bruker={bruker} />
          </div>

          <h1 className="hm-display mt-6 text-3xl">Kjøretøy</h1>
          <p className="mt-1 text-sm text-white/70">
            {alle.length} i drift ·{' '}
            {haster > 0 ? (
              <span className="font-bold text-hm-red">{haster} med frist snart</span>
            ) : (
              'ingen frister nær'
            )}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-7">
        <Link
          href="/verksted"
          className="mb-6 inline-block text-sm font-semibold underline"
        >
          ← Verkstedet
        </Link>

        {alle.length === 0 ? (
          <TomTilstand tittel="Ingen kjøretøy">
            Ingen kjøretøy er registrert ennå. En admin legger dem inn under
            Kjøretøy i adminpanelet.
          </TomTilstand>
        ) : (
          <ul className="divide-y-2 divide-[var(--kant)] border-2 border-[var(--kant)]">
            {alle.map((k) => {
              const eu = fristerFor(k).find((f) => f.type === 'eu')
              return (
                <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                  <span className="hm-tall shrink-0 border-2 border-[var(--kant-sterk)] px-2 py-0.5 text-sm font-bold tracking-wider">
                    {k.reg_nr}
                  </span>
                  <span className="hm-display min-w-0 flex-1 truncate text-base">
                    {k.internt_navn || [k.merke, k.modell].filter(Boolean).join(' ') || '–'}
                  </span>
                  <span className="text-xs text-[var(--blekk-svak)]">
                    {KJØRETØY_STATUS_TEKST[k.status as KjøretøyStatus] ?? k.status}
                  </span>
                  <span
                    className={`hm-tall text-xs ${
                      !eu
                        ? 'text-[var(--blekk-svak)]'
                        : eu.dager < 0
                          ? 'font-bold text-hm-red-ink'
                          : eu.dager <= 30
                            ? 'font-bold text-hm-amber'
                            : 'text-[var(--blekk-svak)]'
                    }`}
                  >
                    {eu ? `EU ${dato(eu.dato)}` : 'EU-frist ukjent'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        <p className="mt-6 text-xs text-[var(--blekk-svak)]">
          Skrivebeskyttet. Endringer gjøres i adminpanelet.
        </p>
      </main>
    </>
  )
}
