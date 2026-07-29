'use client'

import { useActionState } from 'react'
import { ETIKETT, FELT, KNAPP_PRIMÆR } from '@/components/ui'
import { dato } from '@/lib/dato'
import { finnLeier, knyttTilEnhet, type FinnTilstand } from './actions'

const start: FinnTilstand = {}

export function FinnSkjema() {
  const [tilstand, handling, venter] = useActionState(finnLeier, start)

  if (tilstand.treff?.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--blekk-svak)]">
          Velg hvilken maskin du leverer:
        </p>
        {tilstand.treff.map((t) => (
          <form
            key={t.referanse}
            action={knyttTilEnhet.bind(null, t.referanse, tilstand.telefon ?? '')}
          >
            <button
              type="submit"
              className="hm-trykk hm-kant-skygge-sm w-full border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-4 text-left"
            >
              <span className="hm-display block text-lg">{t.maskinNavn}</span>
              <span className="mt-0.5 block text-sm text-[var(--blekk-svak)]">
                Leid siden {dato(t.startet)}
              </span>
            </button>
          </form>
        ))}
      </div>
    )
  }

  return (
    <form action={handling} className="space-y-5">
      <label className="block">
        <span className={ETIKETT}>Mobilnummer</span>
        <input
          name="telefon"
          required
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="900 00 000"
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
        {venter ? 'Søker …' : 'Finn leien min'}
      </button>
    </form>
  )
}
