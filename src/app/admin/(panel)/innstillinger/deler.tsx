'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { ETIKETT, FELT, KNAPP_LITEN } from '@/components/ui'
import { endreDel, opprettDel, slettDel, type Tilstand } from './actions'

const start: Tilstand = {}

export type Del = { id: string; navn: string; antallRegistrert: number }

/**
 * Delene verkstedet holder styr på.
 *
 * Egen tabell framfor faste kolonner nettopp for at dette skal kunne
 * endres uten en migrasjon – da må det også finnes et sted å gjøre det.
 */
export function Deler({ deler }: { deler: Del[] }) {
  const [tilstand, handling, venter] = useActionState(opprettDel, start)
  const skjema = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (tilstand.ok) skjema.current?.reset()
  }, [tilstand.ok])

  return (
    <div className="p-5">
      <p className="mb-5 text-sm text-[var(--blekk-svak)]">
        Hver del får status og et målfelt på hvert utstyr i verkstedet.
        Rekkefølgen her er den samme som i verkstedlista.
      </p>

      {deler.length > 0 && (
        <ul className="mb-6 divide-y-2 divide-[var(--kant)] border-2 border-[var(--kant)]">
          {deler.map((d) => (
            <li key={d.id}>
              <DelRad del={d} />
            </li>
          ))}
        </ul>
      )}

      <form
        ref={skjema}
        action={handling}
        className="border-t-2 border-[var(--kant)] pt-5"
      >
        <span className={ETIKETT}>Ny del</span>
        <div className="flex flex-wrap gap-3">
          <input
            name="navn"
            required
            placeholder="Sideskjær, bolter, sylinder …"
            className={`${FELT} min-w-[12rem] flex-1`}
          />
          <button
            type="submit"
            disabled={venter}
            className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-4 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
          >
            {venter ? 'Legger til …' : 'Legg til'}
          </button>
        </div>

        {tilstand.feil && (
          <p
            role="alert"
            className="mt-3 border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
          >
            {tilstand.feil}
          </p>
        )}
        {tilstand.ok && (
          <p role="status" className="mt-3 text-sm font-semibold text-hm-green">
            {tilstand.ok}
          </p>
        )}
      </form>
    </div>
  )
}

function DelRad({ del }: { del: Del }) {
  const [redigerer, settRedigerer] = useState(false)
  const [bekrefter, settBekrefter] = useState(false)

  if (redigerer) {
    return (
      <form
        action={async (fd: FormData) => {
          await endreDel(del.id, fd)
          settRedigerer(false)
        }}
        className="flex flex-wrap items-center gap-3 p-3"
      >
        <input
          name="navn"
          defaultValue={del.navn}
          required
          autoFocus
          className={`${FELT} min-w-[10rem] flex-1`}
        />
        <button type="submit" className={KNAPP_LITEN}>
          Lagre
        </button>
        <button
          type="button"
          onClick={() => settRedigerer(false)}
          className="text-sm text-[var(--blekk-svak)]"
        >
          Avbryt
        </button>
      </form>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <span className="font-semibold">{del.navn}</span>
      <span className="text-xs text-[var(--blekk-svak)]">
        {del.antallRegistrert} registrert
      </span>

      <div className="ml-auto flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => settRedigerer(true)}
          className={KNAPP_LITEN}
        >
          Endre navn
        </button>

        {bekrefter ? (
          <form action={slettDel.bind(null, del.id)} className="flex gap-2">
            <button
              type="submit"
              className={`${KNAPP_LITEN} border-hm-red bg-hm-red text-white`}
            >
              Bekreft
            </button>
            <button
              type="button"
              onClick={() => settBekrefter(false)}
              className="text-sm text-[var(--blekk-svak)]"
            >
              Avbryt
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => settBekrefter(true)}
            className={`${KNAPP_LITEN} border-hm-red text-hm-red-ink`}
            /* Sletting tar med seg statuser og mål på alt utstyr. */
            title="Statuser og mål registrert på denne delen slettes også"
          >
            Slett
          </button>
        )}
      </div>
    </div>
  )
}
