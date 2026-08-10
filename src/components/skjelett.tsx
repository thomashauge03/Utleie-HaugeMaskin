/**
 * Plassholdere som vises mens en side hentes.
 *
 * Uten disse står den forrige siden helt stille til serveren er ferdig,
 * og et trykk føles som om det ikke ble registrert. Formene under er
 * grovt like det som kommer, slik at innholdet ikke hopper når det
 * lander.
 *
 * Skjelettene er skjult for skjermlesere – de leser «Laster …» i stedet,
 * som er den faktiske informasjonen.
 */

function Strek({ bredde, høyde = 'h-4' }: { bredde: string; høyde?: string }) {
  return <div className={`hm-skjelett ${høyde} ${bredde}`} />
}

/** Kort med tittel og et par linjer – grunnformen i lista. */
function Rad() {
  return (
    <div className="border-2 border-[var(--kant)] bg-[var(--flate-opp)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2.5">
          <Strek bredde="w-2/5" høyde="h-6" />
          <Strek bredde="w-3/5" />
          <Strek bredde="w-1/4" høyde="h-3" />
        </div>
        <Strek bredde="w-24" høyde="h-7" />
      </div>
    </div>
  )
}

export function Laster({ tekst = 'Laster …' }: { tekst?: string }) {
  return (
    <span role="status" className="sr-only">
      {tekst}
    </span>
  )
}

/** Liste med søkefelt og filterknapper – leier, kunder, maskiner. */
export function ListeSkjelett({ antall = 5 }: { antall?: number }) {
  return (
    <div className="space-y-6">
      <Laster />

      <div aria-hidden="true" className="space-y-2">
        <Strek bredde="w-52" høyde="h-8" />
        <Strek bredde="w-72" høyde="h-4" />
      </div>

      <div aria-hidden="true" className="hm-skjelett h-11 w-full" />

      <div aria-hidden="true" className="flex flex-wrap gap-2">
        {['w-20', 'w-32', 'w-24', 'w-28'].map((b) => (
          <div key={b} className={`hm-skjelett h-11 ${b}`} />
        ))}
      </div>

      <div aria-hidden="true" className="space-y-4">
        {Array.from({ length: antall }, (_, i) => (
          <Rad key={i} />
        ))}
      </div>
    </div>
  )
}

/** Oversiktssiden: nøkkeltall øverst, så innhold. */
export function OversiktSkjelett() {
  return (
    <div className="space-y-6">
      <Laster />

      <div aria-hidden="true" className="space-y-2">
        <Strek bredde="w-44" høyde="h-8" />
        <Strek bredde="w-64" høyde="h-4" />
      </div>

      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="space-y-3 border-2 border-[var(--kant)] bg-[var(--flate-opp)] p-5"
          >
            <Strek bredde="w-24" høyde="h-3" />
            <Strek bredde="w-16" høyde="h-9" />
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="grid gap-6 xl:grid-cols-2">
        {[0, 1].map((k) => (
          <div key={k} className="border-2 border-[var(--kant)] bg-[var(--flate-opp)]">
            <div className="border-b-2 border-[var(--kant)] p-4">
              <Strek bredde="w-40" høyde="h-5" />
            </div>
            <div className="space-y-4 p-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Strek bredde="w-3/5" />
                  <Strek bredde="w-2/5" høyde="h-3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Ett kort med tittelrad og innhold. */
function KortSkjelett({ linjer = 3 }: { linjer?: number }) {
  return (
    <div className="border-2 border-[var(--kant)] bg-[var(--flate-opp)]">
      <div className="border-b-2 border-[var(--kant)] p-4">
        <Strek bredde="w-36" høyde="h-4" />
      </div>
      <div className="space-y-3 p-5">
        {Array.from({ length: linjer }, (_, i) => (
          <Strek key={i} bredde={i % 2 ? 'w-3/5' : 'w-4/5'} />
        ))}
      </div>
    </div>
  )
}

/**
 * Detaljside – én ting, ikke en liste.
 *
 * Egen form er ikke pynt: arver detaljsiden listeskjelettet, tegner vi
 * søkefelt og maskinkort mens brukeren venter på én maskin, og alt
 * hopper når innholdet lander.
 */
export function DetaljSkjelett({ kort = 3 }: { kort?: number }) {
  return (
    <div className="space-y-6">
      <Laster />
      <div aria-hidden="true" className="space-y-6">
        {Array.from({ length: kort }, (_, i) => (
          <KortSkjelett key={i} linjer={i === 0 ? 2 : 3} />
        ))}
      </div>
    </div>
  )
}

/** Kundeflyten: én ting og et skjema, på mobil i felt. */
export function KundeSkjelett() {
  return (
    <div className="space-y-6">
      <Laster />
      <div aria-hidden="true" className="space-y-3">
        <Strek bredde="w-3/4" høyde="h-8" />
        <Strek bredde="w-1/2" høyde="h-4" />
      </div>
      <div aria-hidden="true">
        <KortSkjelett linjer={4} />
      </div>
      <div aria-hidden="true" className="hm-skjelett h-12 w-full" />
    </div>
  )
}

/** Verkstedlista: grupper med maskinkort og målrutenett. */
export function VerkstedSkjelett() {
  return (
    <div className="space-y-7">
      <Laster tekst="Henter verkstedlista …" />

      <div aria-hidden="true" className="space-y-3">
        <div className="hm-skjelett h-11 w-full" />
        <div className="flex flex-wrap gap-2">
          {['w-20', 'w-40', 'w-32'].map((b) => (
            <div key={b} className={`hm-skjelett h-11 ${b}`} />
          ))}
        </div>
      </div>

      {[0, 1].map((g) => (
        <section key={g} aria-hidden="true">
          <div className="mb-3 flex items-center gap-3">
            <span className="hm-skrastrek !h-1 !w-5" />
            <Strek bredde="w-40" høyde="h-6" />
          </div>

          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="border-2 border-[var(--kant)] bg-[var(--flate-opp)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Strek bredde="w-1/2" høyde="h-5" />
                    <Strek bredde="w-2/3" høyde="h-3" />
                  </div>
                  <Strek bredde="w-28" høyde="h-6" />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t-2 border-[var(--kant)] pt-3 sm:grid-cols-4">
                  {Array.from({ length: 4 }, (_, d) => (
                    <div key={d} className="space-y-1.5">
                      <Strek bredde="w-16" høyde="h-2.5" />
                      <Strek bredde="w-20" høyde="h-4" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
