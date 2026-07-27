'use client'

import { useActionState } from 'react'
import { BildeOpplasting } from '@/components/bilde-opplasting'
import { leverTilbake, type ReturTilstand } from './actions'

const start: ReturTilstand = {}

export function ReturSkjema({
  referanse,
  maskinNavn,
}: {
  referanse: string
  maskinNavn: string
}) {
  const [tilstand, handling, venter] = useActionState(leverTilbake, start)

  return (
    <form action={handling} className="space-y-5">
      <input type="hidden" name="referanse" value={referanse} />

      <BildeOpplasting
        type="levering"
        etikett="Bilde av maskinen"
        hjelpetekst={`Ta et bilde av ${maskinNavn} slik den står nå ved innlevering. Bildet er påkrevd.`}
      />

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Kommentar <span className="font-normal text-slate-400">(valgfritt)</span>
        </span>
        <textarea
          name="kommentar"
          rows={3}
          placeholder="Er det noe utleier bør vite? Skader, mangler, tomt for drivstoff …"
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
        {venter ? 'Registrerer …' : 'Avslutt leien'}
      </button>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Leien stopper i det du trykker her. Utleier ser over bildet etterpå –
        du betaler ikke for ventetiden.
      </p>
    </form>
  )
}
