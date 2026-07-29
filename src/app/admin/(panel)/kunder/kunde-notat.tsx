'use client'

import { useState } from 'react'
import { FELT, KNAPP_LITEN } from '@/components/ui'
import { lagreKundeNotat } from './actions'

/**
 * Varig merknad om kunden, kun synlig for admin. Skjult bak en knapp
 * når den er tom, så kundelista ikke fylles med tomme felter.
 */
export function KundeNotat({
  kundeId,
  notat,
}: {
  kundeId: string
  notat: string | null
}) {
  const [redigerer, settRedigerer] = useState(false)

  if (redigerer) {
    return (
      <form
        action={async (fd: FormData) => {
          await lagreKundeNotat(kundeId, String(fd.get('notat') ?? ''))
          settRedigerer(false)
        }}
        className="mt-4 border-t-2 border-[var(--kant)] pt-4"
      >
        <label className="mb-1.5 block text-xs font-bold tracking-widest text-[var(--blekk-svak)] uppercase">
          Internt notat
        </label>
        <textarea
          name="notat"
          rows={2}
          defaultValue={notat ?? ''}
          autoFocus
          placeholder="Betaler alltid i tide · ring før levering · fast avtalepris …"
          className={FELT}
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="submit" className={KNAPP_LITEN}>
            Lagre notat
          </button>
          <button
            type="button"
            onClick={() => settRedigerer(false)}
            className="text-sm text-[var(--blekk-svak)]"
          >
            Avbryt
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="mt-4 border-t-2 border-[var(--kant)] pt-4">
      {notat ? (
        <div className="flex flex-wrap items-start gap-3">
          <p className="min-w-0 flex-1 border-l-4 border-[var(--kant)] bg-[var(--flate-2)] p-3 text-sm">
            {notat}
          </p>
          <button
            type="button"
            onClick={() => settRedigerer(true)}
            className={KNAPP_LITEN}
          >
            Endre notat
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => settRedigerer(true)}
          className="text-sm font-semibold text-[var(--blekk-svak)] underline underline-offset-4"
        >
          + Legg til internt notat
        </button>
      )}
    </div>
  )
}
