'use client'

import { useActionState, useState } from 'react'
import { ETIKETT, FELT, KNAPP_LITEN } from '@/components/ui'
import { MAKS_KOMMENTAR } from '@/lib/validering'
import { lever, type LeverTilstand } from './actions'

const start: LeverTilstand = {}

/**
 * Lever-knapp med et valgfritt felt om skade.
 *
 * Ett ekstra trykk før leveringen går, fordi den stopper klokka og fører
 * prisen på prosjektet – og det er ingen godkjenning etterpå som fanger
 * et feiltrykk.
 */
export function LeverKnapp({ leieId }: { leieId: string }) {
  const [åpen, settÅpen] = useState(false)
  const [tilstand, handling, venter] = useActionState(lever.bind(null, leieId), start)

  if (!åpen) {
    return (
      <button
        type="button"
        onClick={() => settÅpen(true)}
        className={`${KNAPP_LITEN} min-h-[2.75rem] px-4`}
      >
        Lever
      </button>
    )
  }

  return (
    <form action={handling} className="w-full space-y-3 border-t-2 border-[var(--kant)] pt-3">
      <label className="block">
        <span className={ETIKETT}>
          Noe som bør fikses? <span className="normal-case">(valgfritt)</span>
        </span>
        <textarea name="kommentar" rows={2} maxLength={MAKS_KOMMENTAR} className={FELT} />
      </label>

      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={venter}
          className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-4 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
        >
          {venter ? 'Leverer …' : 'Bekreft levering'}
        </button>
        <button
          type="button"
          onClick={() => settÅpen(false)}
          className="min-h-[2.75rem] text-sm text-[var(--blekk-svak)]"
        >
          Avbryt
        </button>
      </div>
    </form>
  )
}
