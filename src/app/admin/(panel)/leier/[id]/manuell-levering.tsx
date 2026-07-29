'use client'

import { useState } from 'react'
import { KNAPP_SEKUNDÆR } from '@/components/ui'
import { registrerLeveringManuelt } from './actions'

/**
 * Lar admin avslutte en aktiv leie på kundens vegne – for de som ikke
 * får levert selv i appen. Krever ett bekreftelsestrykk, siden det
 * stopper klokka og fører leien til godkjenning.
 */
export function ManuellLevering({ leieId }: { leieId: string }) {
  const [bekrefter, settBekrefter] = useState(false)

  return (
    <section className="border-2 border-[var(--kant)] bg-[var(--flate-opp)] p-5">
      <h2 className="hm-display text-lg">Kunden får ikke levert selv?</h2>
      <p className="mt-1 mb-4 text-sm text-[var(--blekk-svak)]">
        Du kan registrere leveringen på kundens vegne. Klokka stopper nå, og
        leien går til godkjenning der du setter døgn og beløp.
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
