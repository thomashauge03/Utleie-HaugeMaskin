'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { opprettBruker, type BrukerTilstand } from './actions'

const start: BrukerTilstand = {}

const felt =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-400'

export function NyBruker() {
  const [åpen, settÅpen] = useState(false)
  const [tilstand, handling, venter] = useActionState(opprettBruker, start)
  const skjema = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (tilstand.ok) skjema.current?.reset()
  }, [tilstand.ok])

  if (!åpen) {
    return (
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => settÅpen(true)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
        >
          Ny bruker
        </button>
        {tilstand.ok && (
          <p className="text-sm text-green-700 dark:text-green-400">{tilstand.ok}</p>
        )}
      </div>
    )
  }

  return (
    <form
      ref={skjema}
      action={handling}
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="mb-1 block text-sm font-medium">Navn</span>
          <input name="navn" required className={felt} />
        </label>
        <label>
          <span className="mb-1 block text-sm font-medium">E-post</span>
          <input name="epost" type="email" required className={felt} />
        </label>
        <label>
          <span className="mb-1 block text-sm font-medium">Passord</span>
          <input name="passord" type="text" required minLength={8} className={felt} />
        </label>
      </div>

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Passordet vises i klartekst her fordi du må formidle det videre til
        personen selv. Be dem bytte det ved første innlogging.
      </p>

      {tilstand.feil && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {tilstand.feil}
        </p>
      )}
      {tilstand.ok && (
        <p className="mt-3 text-sm text-green-700 dark:text-green-400">{tilstand.ok}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={venter}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {venter ? 'Oppretter …' : 'Opprett bruker'}
        </button>
        <button
          type="button"
          onClick={() => settÅpen(false)}
          className="text-sm text-slate-600 dark:text-slate-400"
        >
          Lukk
        </button>
      </div>
    </form>
  )
}
