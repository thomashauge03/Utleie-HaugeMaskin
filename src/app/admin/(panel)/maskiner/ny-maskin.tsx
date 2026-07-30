'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { ETIKETT, FELT, KNAPP_SEKUNDÆR } from '@/components/ui'
import { opprettMaskin, type MaskinTilstand } from './actions'

const start: MaskinTilstand = {}

export function NyMaskin({ kategorier }: { kategorier: string[] }) {
  const [åpen, settÅpen] = useState(false)
  const [tilstand, handling, venter] = useActionState(opprettMaskin, start)
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
          + Ny maskin
        </button>
        {tilstand.ok && (
          <p role="status" className="text-sm font-semibold text-hm-green">{tilstand.ok}</p>
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
      <h2 className="hm-display mb-4 text-xl">Ny maskin</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={ETIKETT}>Navn</span>
          <input
            name="navn"
            required
            placeholder="Wacker hoppetusse BS60-4"
            className={FELT}
          />
        </label>

        <label>
          <span className={ETIKETT}>Kategori</span>
          {/* Forslag fra kategoriene admin styrer under Innstillinger,
              men fritekst er fortsatt lov om en mangler. */}
          <input
            name="kategori"
            list="ny-maskin-kategorier"
            placeholder={kategorier[0] ?? 'Motorsager'}
            className={FELT}
          />
          <datalist id="ny-maskin-kategorier">
            {kategorier.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </label>

        <label>
          <span className={ETIKETT}>Internnummer</span>
          <input name="internnummer" placeholder="HM-14" className={FELT} />
        </label>

        <label>
          <span className={ETIKETT}>Døgnpris (kr)</span>
          <input name="dogn_pris" inputMode="decimal" placeholder="850" className={FELT} />
        </label>

        <label className="flex min-h-[2.75rem] items-center gap-3 self-end">
          <input
            type="checkbox"
            name="vis_pris"
            defaultChecked
            className="size-5 accent-[var(--color-hm-red)]"
          />
          <span className="text-sm font-semibold">Vis prisen for kunden</span>
        </label>

        <label className="sm:col-span-2">
          <span className={ETIKETT}>Notat</span>
          <input
            name="notat"
            placeholder="Serienummer, serviceintervall …"
            className={FELT}
          />
        </label>
      </div>

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
          {venter ? 'Lagrer …' : 'Lagre maskin'}
        </button>
        <button
          type="button"
          onClick={() => settÅpen(false)}
          className={KNAPP_SEKUNDÆR}
        >
          Lukk
        </button>
      </div>
    </form>
  )
}
