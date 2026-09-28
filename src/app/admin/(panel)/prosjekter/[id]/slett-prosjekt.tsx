'use client'

import { useActionState } from 'react'
import { BekreftKnapp } from '@/components/bekreft-knapp'
import { slettProsjekt, type ProsjektTilstand } from '../actions'

const start: ProsjektTilstand = {}

export function SlettProsjekt({ id }: { id: string }) {
  const [tilstand, handling] = useActionState(slettProsjekt.bind(null, id), start)

  return (
    <form action={handling}>
      <BekreftKnapp etikett="Slett prosjektet" bekreft="Slett for godt" fare />
      {tilstand.feil && (
        <p
          role="alert"
          className="mt-2 border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}
    </form>
  )
}
