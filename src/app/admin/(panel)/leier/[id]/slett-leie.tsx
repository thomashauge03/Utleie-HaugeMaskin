'use client'

import { useState } from 'react'
import { slettLeie } from './actions'

/**
 * Permanent sletting av en leie.
 *
 * Advarselen skjerpes når leien er fakturert, fordi den da er
 * regnskapsdokumentasjon med fem års oppbevaringsplikt. Vi hindrer det
 * ikke – det er utleiers avgjørelse – men skillet skal være synlig i
 * øyeblikket man trykker, ikke bare i en veiledning ingen leser.
 */
export function SlettLeie({
  leieId,
  referanse,
  fakturert,
}: {
  leieId: string
  referanse: string
  fakturert: boolean
}) {
  const [bekrefter, settBekrefter] = useState(false)

  return (
    <section className="border-2 border-[var(--kant)] p-5">
      <h2 className="hm-display text-lg">Slett leien</h2>
      <p className="mt-1 text-sm text-[var(--blekk-svak)]">
        Fjerner {referanse} for godt, med bilder og historikk. Kan ikke angres.
      </p>

      {fakturert && (
        <p className="mt-3 border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
          <strong>Denne leien er fakturert.</strong> Da er den
          regnskapsdokumentasjon, og bokføringsloven krever fem års
          oppbevaring. Slett den bare hvis du vet at den er feilregistrert.
        </p>
      )}

      {bekrefter ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <form action={slettLeie.bind(null, leieId)}>
            <button
              type="submit"
              className="hm-trykk inline-flex min-h-[2.75rem] items-center border-2 border-hm-red bg-hm-red px-4 text-xs font-bold tracking-wider text-white uppercase"
            >
              Ja, slett {referanse} permanent
            </button>
          </form>
          <button
            type="button"
            onClick={() => settBekrefter(false)}
            className="text-sm text-[var(--blekk-svak)]"
          >
            Avbryt
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => settBekrefter(true)}
          className="mt-4 inline-flex min-h-[2.75rem] items-center border-2 border-hm-red px-4 text-xs font-bold tracking-wider text-hm-red-ink uppercase"
        >
          Slett leien
        </button>
      )}
    </section>
  )
}
