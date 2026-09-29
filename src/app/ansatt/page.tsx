import type { Metadata } from 'next'
import { krevAnsatt } from '@/lib/auth'
import { hentUttaksside } from '@/lib/intern-leie'
import { dato, osloDag } from '@/lib/dato'
import { HMLogo } from '@/components/hm-logo'
import { BrukerMeny } from '@/components/bruker-meny'
import { TomTilstand } from '@/components/ui'
import { LeverKnapp } from './lever-knapp'
import { LevertRamme } from './levert-melding'
import { UttakListe } from './uttak-skjema'

export const metadata: Metadata = { title: 'Utstyr – HM' }
export const dynamic = 'force-dynamic'

/**
 * Egne folk tar ut utstyr til prosjekter her – uten kundeskjemaet. Hvem
 * de er, vet vi fra innloggingen.
 */
export default async function AnsattSide() {
  const bruker = await krevAnsatt()
  const side = await hentUttaksside(bruker)
  // Regnes på serveren, så datovelgeren og serveren er enige om «i dag».
  const iDag = osloDag(new Date())

  return (
    <>
      <header className="relative bg-hm-black px-5 pt-6 pb-8 text-white">
        {/* Den skrå flata klippes i sitt eget lag. Med overflow-hidden på
            selve toppen ble brukermenyen kappet der toppen slutter. */}
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-16 h-[160%] w-40 skew-x-[-18deg] bg-hm-red/90" />
        </div>
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <HMLogo størrelse="sm" />
            <BrukerMeny bruker={bruker} her="ansatt" />
          </div>
          <h1 className="hm-display mt-6 text-3xl">Utstyr</h1>
          <p className="mt-1 text-sm text-white/70">
            Ta ut til et prosjekt, og lever når du er ferdig.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-5 py-7">
        {!side.sattOpp ? (
          <TomTilstand tittel="Ikke satt opp ennå">
            Uttak til prosjekter er ikke slått på i databasen ennå. Si fra til
            en admin.
          </TomTilstand>
        ) : (
          <>
            <section>
              <Overskrift antall={side.mine.length}>Hos deg nå</Overskrift>
              <LevertRamme>
                {side.mine.length === 0 ? (
                  <p className="text-sm text-[var(--blekk-svak)]">Du har ikke noe ute.</p>
                ) : (
                  <ul className="space-y-3">
                    {side.mine.map((l) => (
                      <li
                        key={l.id}
                        className="flex flex-wrap items-start justify-between gap-3 border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="hm-display block text-lg">{l.maskin}</span>
                          <span className="mt-0.5 block text-sm text-[var(--blekk-svak)]">
                            {[l.internnummer, l.prosjekt].filter(Boolean).join(' · ')}
                          </span>
                          <span className="mt-1 block text-sm">
                            Ute siden {dato(l.startTid)}
                            {l.planlagtSlutt && ` · ventet tilbake ${dato(l.planlagtSlutt)}`}
                          </span>
                        </div>
                        <LeverKnapp leieId={l.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </LevertRamme>
            </section>

            <section>
              <Overskrift>Ta ut utstyr</Overskrift>
              <UttakListe
                maskiner={side.maskiner}
                prosjekter={side.prosjekter}
                sistProsjektId={side.sistProsjektId}
                iDag={iDag}
              />
            </section>
          </>
        )}
      </main>
    </>
  )
}

function Overskrift({ children, antall }: { children: React.ReactNode; antall?: number }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="hm-skrastrek !h-1 !w-5" aria-hidden="true" />
      <h2 className="hm-display text-xl">{children}</h2>
      {antall !== undefined && antall > 0 && (
        <span className="hm-tall text-xs font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
          {antall}
        </span>
      )}
    </div>
  )
}
