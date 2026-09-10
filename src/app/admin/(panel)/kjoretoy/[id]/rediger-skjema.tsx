'use client'

import { useActionState } from 'react'
import { ETIKETT, FELT } from '@/components/ui'
import { KJØRETØY_STATUS_TEKST, type Kjøretøy } from '@/lib/types'
import { lagreKjøretøy, type RedigerTilstand } from './actions'

const start: RedigerTilstand = {}

export function RedigerSkjema({ kjøretøy }: { kjøretøy: Kjøretøy }) {
  const [tilstand, handling, venter] = useActionState(
    lagreKjøretøy.bind(null, kjøretøy.id),
    start,
  )

  return (
    <form action={handling} className="space-y-6 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={ETIKETT}>Internt navn</span>
          <input
            name="internt_navn"
            defaultValue={kjøretøy.internt_navn ?? ''}
            placeholder="Servicebil 1"
            className={FELT}
          />
        </label>

        <label>
          <span className={ETIKETT}>Status</span>
          <select name="status" defaultValue={kjøretøy.status} className={FELT}>
            {Object.entries(KJØRETØY_STATUS_TEKST).map(([verdi, tekst]) => (
              <option key={verdi} value={verdi}>
                {tekst}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={ETIKETT}>Ansvarlig</span>
          <input
            name="ansvarlig_navn"
            defaultValue={kjøretøy.ansvarlig_navn ?? ''}
            autoComplete="name"
            className={FELT}
          />
        </label>

        <label>
          <span className={ETIKETT}>E-post til ansvarlig</span>
          <input
            name="ansvarlig_epost"
            type="email"
            defaultValue={kjøretøy.ansvarlig_epost ?? ''}
            autoComplete="email"
            className={FELT}
          />
        </label>

        <label>
          <span className={ETIKETT}>Merke</span>
          <input name="merke" defaultValue={kjøretøy.merke ?? ''} className={FELT} />
        </label>

        <label>
          <span className={ETIKETT}>Modell</span>
          <input name="modell" defaultValue={kjøretøy.modell ?? ''} className={FELT} />
        </label>

        <label>
          <span className={ETIKETT}>Årsmodell</span>
          <input
            name="arsmodell"
            inputMode="numeric"
            defaultValue={kjøretøy.arsmodell ?? ''}
            className={FELT}
          />
        </label>

        <label>
          <span className={ETIKETT}>Kilometerstand</span>
          <input
            name="km"
            inputMode="numeric"
            defaultValue={kjøretøy.km ?? ''}
            placeholder="184000"
            className={FELT}
          />
        </label>
      </div>

      <div>
        <h3 className="hm-display mb-3 text-lg">Frister</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={ETIKETT}>EU-kontroll</span>
            <input
              name="eu_frist"
              type="date"
              defaultValue={kjøretøy.eu_frist ?? ''}
              className={FELT}
            />
          </label>

          <label>
            <span className={ETIKETT}>Forsikring forfaller</span>
            <input
              name="forsikring_forfall"
              type="date"
              defaultValue={kjøretøy.forsikring_forfall ?? ''}
              className={FELT}
            />
          </label>

          <label>
            <span className={ETIKETT}>Neste service</span>
            <input
              name="neste_service"
              type="date"
              defaultValue={kjøretøy.neste_service ?? ''}
              className={FELT}
            />
          </label>

          <label>
            <span className={ETIKETT}>Neste dekkskift</span>
            <input
              name="neste_dekkskift"
              type="date"
              defaultValue={kjøretøy.neste_dekkskift ?? ''}
              className={FELT}
            />
          </label>

          <label className="sm:col-span-2">
            <span className={ETIKETT}>Forsikringsselskap</span>
            <input
              name="forsikring_selskap"
              defaultValue={kjøretøy.forsikring_selskap ?? ''}
              placeholder="Gjensidige"
              className={FELT}
            />
          </label>
        </div>
      </div>

      <label className="block">
        <span className={ETIKETT}>Notat</span>
        <textarea
          name="notat"
          rows={3}
          defaultValue={kjøretøy.notat ?? ''}
          placeholder="Hengerfeste, bomavtale, hvem som har nøkkel …"
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
      {tilstand.ok && (
        <p
          role="status"
          className="border-l-4 border-hm-green bg-hm-green/10 p-3 text-sm font-semibold text-hm-green"
        >
          {tilstand.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={venter}
        className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-5 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
      >
        {venter ? 'Lagrer …' : 'Lagre endringer'}
      </button>
    </form>
  )
}
