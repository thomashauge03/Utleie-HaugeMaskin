'use client'

import { useActionState } from 'react'
import { KNAPP_LITEN } from '@/components/ui'
import { godkjennForesporsel, type ForesporselTilstand } from './actions'

const start: ForesporselTilstand = {}

/**
 * «Godkjenn» for én forespørsel. Egen klientkomponent fordi godkjenningen
 * kan stoppe – har noen fått dagene i mellomtiden, må admin få vite det.
 */
export function GodkjennKnapp({ id }: { id: string }) {
  const [tilstand, handling, venter] = useActionState(godkjennForesporsel.bind(null, id), start)

  return (
    <form action={handling} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={venter}
        className={`${KNAPP_LITEN} border-hm-green text-hm-green disabled:opacity-50`}
      >
        {venter ? 'Godkjenner …' : 'Godkjenn'}
      </button>
      {tilstand.feil && (
        <p role="alert" className="text-xs font-semibold text-hm-red-ink">
          {tilstand.feil}
        </p>
      )}
    </form>
  )
}
