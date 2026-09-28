'use client'

import { useState } from 'react'
import { FELT, KNAPP_LITEN, Merke } from '@/components/ui'
import { visTelefon } from '@/lib/telefon'
import { endreBruker, settAktiv, settPassord } from './actions'

export type Bruker = {
  id: string
  navn: string
  epost: string
  aktiv: boolean
  rolle: 'admin' | 'service' | 'ansatt'
  telefon: string | null
  ma_bytte_passord: boolean
}

const ROLLE: Record<Bruker['rolle'], { tekst: string; merke: 'svart' | 'nøytral' }> = {
  admin: { tekst: 'Admin', merke: 'svart' },
  service: { tekst: 'Service', merke: 'nøytral' },
  ansatt: { tekst: 'Ansatt', merke: 'nøytral' },
}

const LITEN_ETIKETT =
  'mb-1 block text-[10px] font-bold tracking-widest text-[var(--blekk-svak)] uppercase'

/**
 * Én brukerrad med redigering av navn, mobil, rolle og passord.
 *
 * Egen komponent framfor en egen side – lista er kort, og å hoppe fram
 * og tilbake for å endre et navn er mer friksjon enn det er verdt.
 */
export function RedigerBruker({
  bruker,
  erMeg,
  ute,
}: {
  bruker: Bruker
  erMeg: boolean
  /** Internleier brukeren har ute nå. */
  ute: number
}) {
  const [redigerer, settRedigerer] = useState(false)
  const [passordApen, settPassordApen] = useState(false)
  const [melding, settMelding] = useState('')
  const [feil, settFeil] = useState('')

  if (redigerer) {
    return (
      <form
        action={async (fd: FormData) => {
          const r = await endreBruker(bruker.id, fd)
          if (r.feil) {
            settFeil(r.feil)
            return
          }
          settFeil('')
          settRedigerer(false)
        }}
        className="flex flex-wrap items-end gap-3 p-4"
      >
        <div className="min-w-[10rem] flex-1">
          <label className={LITEN_ETIKETT}>Navn</label>
          <input name="navn" defaultValue={bruker.navn} required className={FELT} />
        </div>

        <div className="min-w-[9rem]">
          <label className={LITEN_ETIKETT}>Mobil</label>
          <input
            name="telefon"
            type="tel"
            inputMode="numeric"
            defaultValue={bruker.telefon ?? ''}
            placeholder="Valgfritt"
            className={FELT}
          />
        </div>

        <div className="min-w-[12rem]">
          <label className={LITEN_ETIKETT}>Tilgang</label>
          <select
            name="rolle"
            defaultValue={bruker.rolle}
            /* Siste utvei hvis du fratar deg selv admin er å redigere
               databasen direkte. Derfor låst på egen bruker. */
            disabled={erMeg}
            className={`${FELT} disabled:opacity-60`}
          >
            <option value="admin">Admin — full tilgang</option>
            <option value="service">Servicearbeider — verkstedet og uttak</option>
            <option value="ansatt">Ansatt — uttak til prosjekter</option>
          </select>
          {/* Et låst felt sendes ikke med skjemaet. Uten denne manglet
              rollen, og du fikk ikke endret ditt eget navn. */}
          {erMeg && <input type="hidden" name="rolle" value={bruker.rolle} />}
        </div>

        <button type="submit" className={KNAPP_LITEN}>
          Lagre
        </button>
        <button
          type="button"
          onClick={() => {
            settFeil('')
            settRedigerer(false)
          }}
          className="pb-2 text-sm text-[var(--blekk-svak)]"
        >
          Avbryt
        </button>

        {feil && (
          <p
            role="alert"
            className="w-full border-l-4 border-hm-red bg-hm-red/10 p-2 text-sm font-semibold text-hm-red-ink"
          >
            {feil}
          </p>
        )}

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
        {bruker.telefon && (
          <span className="hm-tall text-sm text-[var(--blekk-svak)]">
            {visTelefon(bruker.telefon)}
          </span>
        )}

        <Merke type={ROLLE[bruker.rolle].merke}>{ROLLE[bruker.rolle].tekst}</Merke>
        {!bruker.aktiv && <Merke type="nøytral">Deaktivert</Merke>}
        {bruker.ma_bytte_passord && <Merke type="gul">Midlertidig passord</Merke>}
        {/* Synlig før noen deaktiveres – ellers står utstyret ute på en
            bruker som ikke lenger kan levere det. */}
        {ute > 0 && <Merke type="gul">{ute} ting ute</Merke>}

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
