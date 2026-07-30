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
  valgte,
}: {
  kategorier: string[]
  valgte: string[]
}) {
  const [tilstand, handling, venter] = useActionState(lagreVerkstedKategori, start)

  return (
    <form action={handling} className="space-y-4 p-5">
      <p className="text-sm text-[var(--blekk-svak)]">
        Maskinene i disse kategoriene leies ikke ut. De deler én QR-kode som
        viser hele lista, med statusoversikt over hva som må fikses. Fjern
        haken for å ta en kategori ut igjen.
      </p>

      <fieldset>
        <legend className={ETIKETT}>Kategorier i verkstedet</legend>
        {kategorier.length === 0 ? (
          <p className="text-sm text-[var(--blekk-svak)]">
            Ingen kategorier ennå. Legg dem inn under Varetyper først.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {kategorier.map((k) => (
              <label
                key={k}
                className="flex min-h-[2.75rem] cursor-pointer items-center gap-3 border-2 border-[var(--kant)] px-3"
              >
                <input
                  type="checkbox"
                  name="verksted"
                  value={k}
                  defaultChecked={valgte.includes(k)}
                  className="size-5 shrink-0 accent-[var(--color-hm-red)]"
                />
                <span className="text-sm font-semibold">{k}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

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

        {valgte.length > 0 && (
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
