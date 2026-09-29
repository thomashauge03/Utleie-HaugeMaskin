'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
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

  // Tilbake til utgangspunktet når skjemaet er sendt og handlingen ferdig.
  // Siden tegnes på nytt med knappen på samme plass, så ellers ble
  // bekreftelsen stående – og på prosjektsiden, der teksten bytter, sto
  // «Ja, åpne» klar rett etter «Ja, avslutt».
  //
  // `=== true`: etter en fullført handling kan useFormStatus gi Reacts
  // interne løfte i stedet for status, uten `pending`, når bare knappen
  // tegnes på nytt. Det er ferdig, ikke venter – ellers slukte neste
  // trykk seg selv.
  const venter = useFormStatus().pending === true
  const [ventet, settVentet] = useState(venter)
  if (venter !== ventet) {
    settVentet(venter)
    if (!venter) settBekrefter(false)
  }

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
