'use client'

import { useActionState } from 'react'
import { KNAPP_LITEN } from '@/components/ui'
import { oppdaterFraVegvesen, type VegvesenTilstand } from './actions'

const start: VegvesenTilstand = {}

/**
 * Knappen «Oppdater fra Vegvesen».
 *
 * Skilt ut som klientkomponent fordi detaljsiden er en server-komponent
 * og ikke kan holde på svaret fra actionen. Uten en tilstand her finnes
 * det ingen observerbar forskjell mellom «oppslaget lyktes» og «kvoten
 * er tom» – siden rendres identisk begge veier.
 */
export function OppdaterFraVegvesen({ id }: { id: string }) {
  const [tilstand, handling, venter] = useActionState(
    oppdaterFraVegvesen.bind(null, id),
    start,
  )

  return (
    <form action={handling} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={venter}
        className={`${KNAPP_LITEN} disabled:opacity-50`}
      >
        {venter ? 'Henter …' : 'Oppdater fra Vegvesen'}
      </button>

      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}
      {tilstand.ok && (
        <p
          role="status"
          className="border-l-4 border-hm-green bg-hm-green/10 p-3 text-sm font-semibold text-hm-green"
        >
          {tilstand.ok}
        </p>
      )}
    </form>
  )
}
