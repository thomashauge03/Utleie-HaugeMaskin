'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { ETIKETT, FELT, KNAPP_SEKUNDÆR } from '@/components/ui'
import { utenNullstilling } from '@/lib/skjema'
import { nyReservasjon, type ReservasjonTilstand } from './actions'

const start: ReservasjonTilstand = {}

export type ReservasjonMaskin = { id: string; navn: string; internnummer: string | null }

const KNAPP_RØD =
  'hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-4 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50'

/** «+ Ny reservasjon» – samme form som «+ Nytt prosjekt». */
export function NyReservasjon({ maskiner, iDag }: { maskiner: ReservasjonMaskin[]; iDag: string }) {
  const [åpen, settÅpen] = useState(false)
  const [tilstand, handling, venter] = useActionState(nyReservasjon, start)
  const skjema = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (tilstand.ok) skjema.current?.reset()
  }, [tilstand])

  if (!åpen) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => settÅpen(true)} className={KNAPP_RØD}>
          + Ny reservasjon
        </button>
        <Svar tilstand={tilstand} />
      </div>
    )
  }

  return (
    <form
      ref={skjema}
      action={handling}
      onSubmit={utenNullstilling(handling)}
      className="border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-5"
    >
      <h2 className="hm-display mb-4 text-xl">Ny reservasjon</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={ETIKETT}>Maskin</span>
          <select name="maskin_id" required defaultValue="" className={FELT}>
            <option value="" disabled>
              Velg maskin
            </option>
            {maskiner.map((m) => (
              <option key={m.id} value={m.id}>
                {m.internnummer ? `${m.navn} (${m.internnummer})` : m.navn}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={ETIKETT}>Fra</span>
          <input name="fra_dato" type="date" required min={iDag} className={FELT} />
        </label>
        <label>
          <span className={ETIKETT}>Til og med</span>
          <input name="til_dato" type="date" required min={iDag} className={FELT} />
        </label>
        <label>
          <span className={ETIKETT}>Kundens navn</span>
          <input name="kunde_navn" required autoComplete="off" className={FELT} />
        </label>
        <label>
          <span className={ETIKETT}>Mobil</span>
          <input
            name="kunde_telefon"
            required
            type="tel"
            inputMode="numeric"
            placeholder="900 00 000"
            className={FELT}
          />
          <span className="mt-1.5 block text-xs text-[var(--blekk-svak)]">
            Kunden kjennes igjen på den når den henter
          </span>
        </label>
        <label className="sm:col-span-2">
          <span className={ETIKETT}>
            Notat <span className="normal-case">(valgfritt)</span>
          </span>
          <input name="notat" maxLength={500} className={FELT} />
        </label>
      </div>

      <div className="mt-4">
        <Svar tilstand={tilstand} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={venter} className={KNAPP_RØD}>
          {venter ? 'Lagrer …' : 'Reserver'}
        </button>
        <button type="button" onClick={() => settÅpen(false)} className={KNAPP_SEKUNDÆR}>
          Lukk
        </button>
      </div>
    </form>
  )
}

function Svar({ tilstand }: { tilstand: ReservasjonTilstand }) {
  return (
    <div className="space-y-2">
      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}
      {tilstand.ok && (
        <p role="status" className="text-sm font-semibold text-hm-green">
          {tilstand.ok}
        </p>
      )}
      {tilstand.varsel && (
        <p className="border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm font-semibold">
          {tilstand.varsel}
        </p>
      )}
    </div>
  )
}
