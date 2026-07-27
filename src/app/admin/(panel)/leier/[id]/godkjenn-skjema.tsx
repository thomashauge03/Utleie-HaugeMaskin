'use client'

import { useActionState } from 'react'
import { godkjennLeie, sendTilbake, type GodkjennTilstand } from './actions'

const start: GodkjennTilstand = {}

const felt =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-400'

export function GodkjennSkjema({
  leieId,
  foreslattDogn,
  foreslattBelop,
}: {
  leieId: string
  foreslattDogn: number
  foreslattBelop: number | null
}) {
  const [tilstand, handling, venter] = useActionState(godkjennLeie, start)

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
      <h2 className="font-medium">Godkjenn innlevering</h2>
      <p className="mt-1 mb-4 text-sm text-slate-600 dark:text-slate-400">
        Tallene under er forslag. Juster dem fritt – det du lagrer er det som
        gjelder for fakturaen.
      </p>

      <form action={handling} className="space-y-4">
        <input type="hidden" name="leie_id" value={leieId} />
        <input type="hidden" name="foreslatt_dogn" value={foreslattDogn} />
        <input type="hidden" name="foreslatt_belop" value={foreslattBelop ?? ''} />

        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-medium">Antall døgn</span>
            <input
              name="antall_dogn"
              inputMode="decimal"
              defaultValue={foreslattDogn}
              className={felt}
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium">Beløp (kr)</span>
            <input
              name="belop"
              inputMode="decimal"
              defaultValue={foreslattBelop ?? ''}
              className={felt}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Avvik <span className="font-normal text-slate-400">(skade, mangler)</span>
          </span>
          <input name="avvik" className={felt} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Internt notat <span className="font-normal text-slate-400">(valgfritt)</span>
          </span>
          <input name="admin_notat" className={felt} />
        </label>

        {tilstand.feil && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {tilstand.feil}
          </p>
        )}
        {tilstand.ok && (
          <p className="text-sm text-green-700 dark:text-green-400">{tilstand.ok}</p>
        )}

        <button
          type="submit"
          disabled={venter}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {venter ? 'Godkjenner …' : 'Godkjenn og avslutt'}
        </button>
      </form>

      <form
        action={async (fd: FormData) => {
          await sendTilbake(leieId, String(fd.get('grunn') ?? ''))
        }}
        className="mt-4 border-t border-amber-200 pt-4 dark:border-amber-900"
      >
        <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
          Står ikke maskinen der? Send leien tilbake, så går klokka videre.
        </p>
        <div className="flex gap-2">
          <input
            name="grunn"
            placeholder="Hvorfor sendes den tilbake?"
            className={felt}
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm transition hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Send tilbake
          </button>
        </div>
      </form>
    </div>
  )
}
