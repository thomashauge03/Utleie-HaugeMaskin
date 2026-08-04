'use client'

import { useActionState } from 'react'
import { byttEgetPassord, type ByttTilstand } from './actions'

const start: ByttTilstand = {}

const felt =
  'w-full border-2 border-hm-200 bg-white px-3.5 py-3 text-base text-hm-black outline-none transition-colors focus:border-hm-red'

const etikett =
  'mb-1.5 block text-xs font-bold tracking-widest text-hm-500 uppercase'

export function ByttPassordSkjema() {
  const [tilstand, handling, venter] = useActionState(byttEgetPassord, start)

  return (
    <form action={handling} className="space-y-4">
      <label className="block">
        <span className={etikett}>Nytt passord</span>
        <input
          name="passord"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          autoFocus
          className={felt}
        />
        <span className="mt-1.5 block text-xs text-hm-500">Minst 8 tegn</span>
      </label>

      <label className="block">
        <span className={etikett}>Gjenta passordet</span>
        <input
          name="gjenta"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={felt}
        />
      </label>

      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}

      <button
        type="submit"
        disabled={venter}
        className="hm-trykk inline-flex min-h-[3.25rem] w-full items-center justify-center border-2 border-hm-black bg-hm-red px-6 text-base font-bold tracking-wide text-white uppercase shadow-[4px_4px_0_0_var(--color-hm-black)] hover:bg-hm-red-hover disabled:opacity-50"
      >
        {venter ? 'Lagrer …' : 'Sett nytt passord'}
      </button>
    </form>
  )
}
