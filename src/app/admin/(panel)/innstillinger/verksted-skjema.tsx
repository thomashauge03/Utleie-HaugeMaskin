'use client'

import { useActionState } from 'react'
import { ETIKETT, FELT } from '@/components/ui'
import { lagreVerkstedKategori, type Tilstand } from './actions'

const start: Tilstand = {}

/**
 * Velger hvilken kategori som følger verkstedflyten.
 *
 * Maskinene i kategorien leies ikke ut – de får én felles QR-kode og
 * en statusliste for hva som må fikses.
 */
export function VerkstedSkjema({
  kategorier,
  valgt,
}: {
  kategorier: string[]
  valgt: string | null
}) {
  const [tilstand, handling, venter] = useActionState(lagreVerkstedKategori, start)

  return (
    <form action={handling} className="space-y-4 p-5">
      <p className="text-sm text-[var(--blekk-svak)]">
        Maskinene i denne kategorien leies ikke ut. De får én felles QR-kode
        som viser hele lista, og en statusoversikt over hva som må fikses.
      </p>

      <label className="block">
        <span className={ETIKETT}>Verkstedkategori</span>
        <select
          name="verksted_kategori"
          defaultValue={valgt ?? ''}
          className={FELT}
        >
          <option value="">Ingen — modulen er av</option>
          {kategorier.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>

      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}
      {tilstand.ok && (
        <p
          role="status"
          className="border-l-4 border-hm-green bg-hm-green/10 p-3 text-sm font-semibold text-hm-green"
        >
          {tilstand.ok}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={venter}
          className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-5 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
        >
          {venter ? 'Lagrer …' : 'Lagre'}
        </button>

        {valgt && (
          <a
            href="/verksted"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold underline underline-offset-4"
          >
            Åpne verkstedlista →
          </a>
        )}
      </div>
    </form>
  )
}
