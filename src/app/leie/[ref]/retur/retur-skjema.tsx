'use client'

import { useActionState } from 'react'
import { BildeOpplasting } from '@/components/bilde-opplasting'
import { ETIKETT, FELT, KNAPP_PRIMÆR } from '@/components/ui'
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
    <form action={handling} className="space-y-6">
      <input type="hidden" name="referanse" value={referanse} />

      <BildeOpplasting
        type="levering"
        kladdNøkkel={`retur:${referanse}`}
        etikett="Bilde av maskinen"
        hjelpetekst={`Ta bilde av ${maskinNavn} slik den står nå. Bildet er påkrevd for å avslutte leien.`}
      />

      <label className="block">
        <span className={ETIKETT}>
          Kommentar <span className="normal-case">(valgfritt)</span>
        </span>
        <textarea
          name="kommentar"
          rows={3}
          placeholder="Skader, mangler, tomt for drivstoff …"
          className={FELT}
        />
      </label>

      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}

      <button type="submit" disabled={venter} className={KNAPP_PRIMÆR}>
        {venter ? 'Registrerer …' : 'Avslutt leien'}
      </button>

      <p className="text-center text-sm text-[var(--blekk-svak)]">
        Leien stopper i det du trykker. Utleier ser over bildet etterpå — du
        betaler ikke for ventetiden.
      </p>
    </form>
  )
}
