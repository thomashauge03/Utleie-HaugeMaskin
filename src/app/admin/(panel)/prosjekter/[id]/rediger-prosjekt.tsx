'use client'

import { useActionState } from 'react'
import { ETIKETT, FELT, KNAPP_SEKUNDÆR } from '@/components/ui'
import { endreProsjekt, type ProsjektTilstand } from '../actions'

const start: ProsjektTilstand = {}

export function RedigerProsjekt({
  id,
  navn,
  nummer,
}: {
  id: string
  navn: string
  nummer: string | null
}) {
  const [tilstand, handling, venter] = useActionState(endreProsjekt.bind(null, id), start)

  return (
    <form action={handling} className="grid gap-4 p-5 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
      <label>
        <span className={ETIKETT}>Navn</span>
        <input name="navn" required defaultValue={navn} className={FELT} />
      </label>
      <label>
        <span className={ETIKETT}>Prosjektnummer</span>
        <input name="nummer" defaultValue={nummer ?? ''} className={FELT} />
      </label>
      <button type="submit" disabled={venter} className={KNAPP_SEKUNDÆR}>
        {venter ? 'Lagrer …' : 'Lagre'}
      </button>
      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink sm:col-span-3"
        >
          {tilstand.feil}
        </p>
      )}
      {tilstand.ok && (
        <p role="status" className="text-sm font-semibold text-hm-green sm:col-span-3">
          {tilstand.ok}
        </p>
      )}
    </form>
  )
}
