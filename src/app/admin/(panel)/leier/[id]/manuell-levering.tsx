'use client'

import { useState } from 'react'
import { KNAPP_SEKUNDÆR } from '@/components/ui'
import { registrerLeveringManuelt } from './actions'

/**
 * Lar admin avslutte en aktiv leie på kundens (eller en ansatts) vegne –
 * for de som ikke får levert selv i appen. Krever ett bekreftelsestrykk,
 * siden det stopper klokka. En kundeleie føres til godkjenning, som før.
 * En internleie går rett til avsluttet med utregnet pris – det er ingen
 * som skal godkjenne en internpris.
 */
export function ManuellLevering({ leieId, intern }: { leieId: string; intern: boolean }) {
  const [bekrefter, settBekrefter] = useState(false)

  return (
    <section className="border-2 border-[var(--kant)] bg-[var(--flate-opp)] p-5">
      <h2 className="hm-display text-lg">
        {intern ? 'Levert uten at det er registrert?' : 'Kunden får ikke levert selv?'}
      </h2>
      <p className="mt-1 mb-4 text-sm text-[var(--blekk-svak)]">
        {intern
          ? 'Du kan registrere leveringen på den ansattes vegne. Klokka stopper nå, prisen føres på prosjektet, og maskinen blir ledig.'
          : 'Du kan registrere leveringen på kundens vegne. Klokka stopper nå, og leien går til godkjenning der du setter døgn og beløp.'}
      </p>

      {bekrefter ? (
        <form action={registrerLeveringManuelt.bind(null, leieId)} className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-4 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover"
          >
            Bekreft – stopp klokka nå
          </button>
          <button
            type="button"
            onClick={() => settBekrefter(false)}
            className="text-sm text-[var(--blekk-svak)]"
          >
            Avbryt
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => settBekrefter(true)} className={KNAPP_SEKUNDÆR}>
          Registrer levering
        </button>
      )}
    </section>
  )
}
