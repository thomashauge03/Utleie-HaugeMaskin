'use client'

import { useState } from 'react'
import { KNAPP_LITEN } from '@/components/ui'

/**
 * Knapp som krever et ekstra bekreftelsestrykk før den sender skjemaet
 * sitt. Brukes på handlinger som er ubehagelige å angre – sperre en
 * kunde, ta fra en kollega tilgang. Selve handlingen ligger i
 * `<form action=...>` rundt knappen.
 */
export function BekreftKnapp({
  etikett,
  bekreft = 'Bekreft',
  fare = false,
}: {
  etikett: string
  bekreft?: string
  /** Rød styling for de mest inngripende handlingene. */
  fare?: boolean
}) {
  const [bekrefter, settBekrefter] = useState(false)

  if (!bekrefter) {
    return (
      <button
        type="button"
        onClick={() => settBekrefter(true)}
        className={`${KNAPP_LITEN} ${fare ? 'border-hm-red text-hm-red-ink' : ''}`}
      >
        {etikett}
      </button>
    )
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="submit"
        className={`${KNAPP_LITEN} border-hm-red bg-hm-red text-white`}
      >
        {bekreft}
      </button>
      <button
        type="button"
        onClick={() => settBekrefter(false)}
        className="text-sm text-[var(--blekk-svak)]"
      >
        Avbryt
      </button>
    </span>
  )
}
