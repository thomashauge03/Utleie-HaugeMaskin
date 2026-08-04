'use client'

import { useState } from 'react'
import { FELT, KNAPP_LITEN, Merke } from '@/components/ui'
import { endreBruker, settAktiv, settPassord } from './actions'

export type Bruker = {
  id: string
  navn: string
  epost: string
  aktiv: boolean
  rolle: 'admin' | 'service'
  ma_bytte_passord: boolean
}

/**
 * Én brukerrad med redigering av navn, rolle og passord.
 *
 * Egen komponent framfor en egen side – lista er kort, og å hoppe fram
 * og tilbake for å endre et navn er mer friksjon enn det er verdt.
 */
export function RedigerBruker({ bruker, erMeg }: { bruker: Bruker; erMeg: boolean }) {
  const [redigerer, settRedigerer] = useState(false)
  const [passordApen, settPassordApen] = useState(false)
  const [melding, settMelding] = useState('')

  if (redigerer) {
    return (
      <form
        action={async (fd: FormData) => {
          await endreBruker(bruker.id, fd)
          settRedigerer(false)
        }}
        className="flex flex-wrap items-end gap-3 p-4"
      >
        <div className="min-w-[10rem] flex-1">
          <label className="mb-1 block text-[10px] font-bold tracking-widest text-[var(--blekk-svak)] uppercase">
            Navn
          </label>
          <input name="navn" defaultValue={bruker.navn} required className={FELT} />
        </div>

        <div className="min-w-[12rem]">
          <label className="mb-1 block text-[10px] font-bold tracking-widest text-[var(--blekk-svak)] uppercase">
            Tilgang
          </label>
          <select
            name="rolle"
            defaultValue={bruker.rolle}
            /* Siste utvei hvis du fratar deg selv admin er å redigere
               databasen direkte. Derfor låst på egen bruker. */
            disabled={erMeg}
            className={`${FELT} disabled:opacity-60`}
          >
            <option value="admin">Admin — full tilgang</option>
            <option value="service">Servicearbeider — kun verkstedet</option>
          </select>
        </div>

        <button type="submit" className={KNAPP_LITEN}>
          Lagre
        </button>
        <button
          type="button"
          onClick={() => settRedigerer(false)}
          className="pb-2 text-sm text-[var(--blekk-svak)]"
        >
          Avbryt
        </button>

        {erMeg && (
          <p className="w-full text-xs text-[var(--blekk-svak)]">
            Du kan ikke frata deg selv admintilgang.
          </p>
        )}
      </form>
    )
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">
          {bruker.navn}
          {erMeg && (
            <span className="ml-2 text-xs font-normal text-[var(--blekk-svak)]">
              (deg)
            </span>
          )}
        </span>
        <span className="text-sm text-[var(--blekk-svak)]">{bruker.epost}</span>

        <Merke type={bruker.rolle === 'admin' ? 'svart' : 'nøytral'}>
          {bruker.rolle === 'admin' ? 'Admin' : 'Service'}
        </Merke>
        {!bruker.aktiv && <Merke type="nøytral">Deaktivert</Merke>}
        {bruker.ma_bytte_passord && (
          <Merke type="gul">Midlertidig passord</Merke>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => settRedigerer(true)}
            className={KNAPP_LITEN}
          >
            Endre
          </button>
          <button
            type="button"
            onClick={() => settPassordApen((v) => !v)}
            className={KNAPP_LITEN}
          >
            Nytt passord
          </button>
          {!erMeg && (
            <form action={settAktiv.bind(null, bruker.id, !bruker.aktiv)}>
              <button className={KNAPP_LITEN}>
                {bruker.aktiv ? 'Deaktiver' : 'Aktiver'}
              </button>
            </form>
          )}
        </div>
      </div>

      {passordApen && (
        <form
          action={async (fd: FormData) => {
            const r = await settPassord(bruker.id, fd)
            settMelding(r.feil ?? r.ok ?? '')
            if (r.ok) settPassordApen(false)
          }}
          className="mt-3 flex flex-wrap items-center gap-3 border-t-2 border-[var(--kant)] pt-3"
        >
          <input
            name="passord"
            type="text"
            required
            minLength={8}
            placeholder="Nytt passord, minst 8 tegn"
            className={`${FELT} min-w-[12rem] flex-1`}
          />
          <button type="submit" className={KNAPP_LITEN}>
            Sett passord
          </button>
          <span className="w-full text-xs text-[var(--blekk-svak)]">
            Vises i klartekst fordi du må gi det videre selv.
          </span>
        </form>
      )}

      {melding && (
        <p role="status" className="mt-2 text-sm font-semibold text-hm-green">
          {melding}
        </p>
      )}
    </div>
  )
}
