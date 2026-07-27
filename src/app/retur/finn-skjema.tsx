'use client'

import { useActionState } from 'react'
import { finnLeier, knyttTilEnhet, type FinnTilstand } from './actions'

const start: FinnTilstand = {}

export function FinnSkjema() {
  const [tilstand, handling, venter] = useActionState(finnLeier, start)

  if (tilstand.treff?.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Velg hvilken maskin du leverer:
        </p>
        {tilstand.treff.map((t) => (
          <form key={t.referanse} action={knyttTilEnhet.bind(null, t.referanse)}>
            <button
              type="submit"
              className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
            >
              <span className="block font-medium">{t.maskinNavn}</span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">
                Leid siden{' '}
                {new Date(t.startet).toLocaleDateString('nb-NO', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
            </button>
          </form>
        ))}
      </div>
    )
  }

  return (
    <form action={handling} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Mobilnummer</span>
        <input
          name="telefon"
          required
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="900 00 000"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-400"
        />
      </label>

      {tilstand.feil && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {tilstand.feil}
        </p>
      )}

      <button
        type="submit"
        disabled={venter}
        className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        {venter ? 'Søker …' : 'Finn leien min'}
      </button>
    </form>
  )
}
