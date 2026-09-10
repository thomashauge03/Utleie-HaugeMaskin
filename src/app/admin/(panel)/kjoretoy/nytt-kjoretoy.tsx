'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { ETIKETT, FELT, KNAPP_SEKUNDÆR } from '@/components/ui'
import { opprettKjøretøy, type KjøretøyTilstand } from './actions'

const start: KjøretøyTilstand = {}

export function NyttKjøretøy({ vegvesen }: { vegvesen: boolean }) {
  const [åpen, settÅpen] = useState(false)
  const [tilstand, handling, venter] = useActionState(opprettKjøretøy, start)
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
          + Nytt kjøretøy
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
      <h2 className="hm-display mb-4 text-xl">Nytt kjøretøy</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={ETIKETT}>Registreringsnummer</span>
          <input
            name="reg_nr"
            required
            autoCapitalize="characters"
            placeholder="EK12345"
            className={`${FELT} hm-tall uppercase`}
          />
        </label>

        <label>
          <span className={ETIKETT}>
            Internt navn <span className="normal-case">(valgfritt)</span>
          </span>
          <input name="internt_navn" placeholder="Servicebil 1" className={FELT} />
        </label>

        <label>
          <span className={ETIKETT}>Ansvarlig</span>
          <input
            name="ansvarlig_navn"
            autoComplete="name"
            placeholder="Ola Nordmann"
            className={FELT}
          />
        </label>

        <label>
          <span className={ETIKETT}>E-post til ansvarlig</span>
          <input
            name="ansvarlig_epost"
            type="email"
            autoComplete="email"
            placeholder="ola@haugemaskin.no"
            className={FELT}
          />
        </label>

        <label className="sm:col-span-2">
          <span className={ETIKETT}>
            EU-frist{' '}
            <span className="normal-case">
              {vegvesen ? '(hentes automatisk om den finnes)' : '(fylles inn manuelt)'}
            </span>
          </span>
          <input name="eu_frist" type="date" className={FELT} />
        </label>
      </div>

      {/* Sagt her framfor i en global banner: det er akkurat i det man
          legger inn en bil at man lurer på hvorfor feltene ikke fylles
          ut av seg selv. */}
      {!vegvesen && (
        <p className="mt-4 border-l-4 border-hm-amber p-3 text-sm text-[var(--blekk-svak)]">
          Vegvesen-oppslag er ikke satt opp. Merke, modell og EU-frist må fylles
          inn for hånd inntil <span className="hm-tall">SVV_API_KEY</span> er på plass.
        </p>
      )}

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
          {venter ? 'Lagrer …' : 'Lagre kjøretøy'}
        </button>
        <button type="button" onClick={() => settÅpen(false)} className={KNAPP_SEKUNDÆR}>
          Lukk
        </button>
      </div>
    </form>
  )
}
