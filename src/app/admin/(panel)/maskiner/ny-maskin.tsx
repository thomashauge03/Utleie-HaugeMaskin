'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { opprettMaskin, type MaskinTilstand } from './actions'

const start: MaskinTilstand = {}

const felt =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-400'

export function NyMaskin() {
  const [åpen, settÅpen] = useState(false)
  const [tilstand, handling, venter] = useActionState(opprettMaskin, start)
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
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Ny maskin
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium">Navn</span>
          <input name="navn" required placeholder="Wacker hoppetusse BS60-4" className={felt} />
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium">Kategori</span>
          <input name="kategori" placeholder="Komprimering" className={felt} />
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium">Internnummer</span>
          <input name="internnummer" placeholder="HM-14" className={felt} />
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium">Døgnpris (kr)</span>
          <input name="dogn_pris" inputMode="decimal" placeholder="850" className={felt} />
        </label>

        <label className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            name="vis_pris"
            defaultChecked
            className="size-4 rounded border-slate-300 dark:border-slate-700"
          />
          <span className="text-sm">Vis prisen for kunden</span>
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium">Notat</span>
          <input name="notat" placeholder="Serienummer, service-intervall …" className={felt} />
        </label>
      </div>

      {tilstand.feil && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {tilstand.feil}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={venter}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          {venter ? 'Lagrer …' : 'Lagre maskin'}
        </button>
        <button
          type="button"
          onClick={() => settÅpen(false)}
          className="text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Lukk
        </button>
        {tilstand.ok && (
          <p className="text-sm text-green-700 dark:text-green-400">{tilstand.ok}</p>
        )}
      </div>
    </form>
  )
}
