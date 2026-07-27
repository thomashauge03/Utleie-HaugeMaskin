'use client'

import { useActionState } from 'react'
import { ETIKETT, FELT, KNAPP_SEKUNDÆR } from '@/components/ui'
import { godkjennLeie, sendTilbake, type GodkjennTilstand } from './actions'

const start: GodkjennTilstand = {}

export function GodkjennSkjema({
  leieId,
  foreslattDogn,
  foreslattBelop,
}: {
  leieId: string
  foreslattDogn: number
  foreslattBelop: number | null
}) {
  const [tilstand, handling, venter] = useActionState(godkjennLeie, start)

  return (
    <section className="border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)]">
      <h2 className="hm-display bg-hm-amber px-5 py-3 text-lg text-white">
        Godkjenn innlevering
      </h2>

      <div className="p-5">
        <p className="mb-5 text-sm text-[var(--blekk-svak)]">
          Tallene er forslag. Juster dem fritt — det du lagrer er det som
          gjelder for fakturaen.
        </p>

        <form action={handling} className="space-y-4">
          <input type="hidden" name="leie_id" value={leieId} />
          <input type="hidden" name="foreslatt_dogn" value={foreslattDogn} />
          <input type="hidden" name="foreslatt_belop" value={foreslattBelop ?? ''} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={ETIKETT}>Antall døgn</span>
              <input
                name="antall_dogn"
                inputMode="decimal"
                defaultValue={foreslattDogn}
                className={`${FELT} hm-tall`}
              />
            </label>
            <label>
              <span className={ETIKETT}>Beløp (kr)</span>
              <input
                name="belop"
                inputMode="decimal"
                defaultValue={foreslattBelop ?? ''}
                className={`${FELT} hm-tall`}
              />
            </label>
          </div>

          <label className="block">
            <span className={ETIKETT}>
              Avvik <span className="normal-case">(skade, mangler)</span>
            </span>
            <input name="avvik" className={FELT} />
          </label>

          <label className="block">
            <span className={ETIKETT}>
              Internt notat <span className="normal-case">(valgfritt)</span>
            </span>
            <input name="admin_notat" className={FELT} />
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
            <p className="border-l-4 border-hm-green bg-hm-green/10 p-3 text-sm font-semibold text-hm-green">
              {tilstand.ok}
            </p>
          )}

          <button
            type="submit"
            disabled={venter}
            className="hm-trykk hm-kant-skygge inline-flex min-h-[3.25rem] w-full items-center justify-center border-2 border-[var(--kant-sterk)] bg-hm-red px-6 text-base font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
          >
            {venter ? 'Godkjenner …' : 'Godkjenn og avslutt'}
          </button>
        </form>

        <form
          action={async (fd: FormData) => {
            await sendTilbake(leieId, String(fd.get('grunn') ?? ''))
          }}
          className="mt-6 border-t-2 border-[var(--kant)] pt-5"
        >
          <p className="mb-3 text-sm text-[var(--blekk-svak)]">
            Står ikke maskinen der? Send leien tilbake, så går klokka videre.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              name="grunn"
              placeholder="Hvorfor sendes den tilbake?"
              className={`${FELT} flex-1 min-w-[12rem]`}
            />
            <button type="submit" className={KNAPP_SEKUNDÆR}>
              Send tilbake
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
