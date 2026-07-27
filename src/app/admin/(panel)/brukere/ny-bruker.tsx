'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { ETIKETT, FELT, KNAPP_SEKUNDÆR } from '@/components/ui'
import { opprettBruker, type BrukerTilstand } from './actions'

const start: BrukerTilstand = {}

export function NyBruker() {
  const [åpen, settÅpen] = useState(false)
  const [tilstand, handling, venter] = useActionState(opprettBruker, start)
  const skjema = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (tilstand.ok) skjema.current?.reset()
  }, [tilstand.ok])

  if (!åpen) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => settÅpen(true)}
          className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-4 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover"
        >
          + Ny bruker
        </button>
        {tilstand.ok && (
          <p className="text-sm font-semibold text-hm-green">{tilstand.ok}</p>
        )}
      </div>
    )
  }

  return (
    <form
      ref={skjema}
      action={handling}
      className="border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-5"
    >
      <h2 className="hm-display mb-4 text-xl">Ny admin-bruker</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <label>
          <span className={ETIKETT}>Navn</span>
          <input name="navn" required className={FELT} />
        </label>
        <label>
          <span className={ETIKETT}>E-post</span>
          <input name="epost" type="email" required className={FELT} />
        </label>
        <label>
          <span className={ETIKETT}>Passord</span>
          <input name="passord" type="text" required minLength={8} className={FELT} />
        </label>
      </div>

      <p className="mt-3 border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-xs text-[var(--blekk-svak)]">
        Passordet vises i klartekst fordi du må formidle det videre selv. Be
        personen bytte det ved første innlogging.
      </p>

      {tilstand.feil && (
        <p
          role="alert"
          className="mt-4 border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}
      {tilstand.ok && (
        <p className="mt-4 text-sm font-semibold text-hm-green">{tilstand.ok}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={venter}
          className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-5 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
        >
          {venter ? 'Oppretter …' : 'Opprett bruker'}
        </button>
        <button type="button" onClick={() => settÅpen(false)} className={KNAPP_SEKUNDÆR}>
          Lukk
        </button>
      </div>
    </form>
  )
}
