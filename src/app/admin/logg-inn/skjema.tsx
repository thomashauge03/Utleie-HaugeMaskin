'use client'

import { useActionState } from 'react'
import { loggInn, type LoggInnTilstand } from './actions'

const start: LoggInnTilstand = {}

export function LoggInnSkjema() {
  const [tilstand, handling, venter] = useActionState(loggInn, start)

  return (
    <form action={handling} className="space-y-4">
      <div>
        <label htmlFor="epost" className="mb-1 block text-sm font-medium">
          E-post
        </label>
        <input
          id="epost"
          name="epost"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-400"
        />
      </div>

      <div>
        <label htmlFor="passord" className="mb-1 block text-sm font-medium">
          Passord
        </label>
        <input
          id="passord"
          name="passord"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-400"
        />
      </div>

      {tilstand.feil && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {tilstand.feil}
        </p>
      )}

      <button
        type="submit"
        disabled={venter}
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        {venter ? 'Logger inn …' : 'Logg inn'}
      </button>
    </form>
  )
}
