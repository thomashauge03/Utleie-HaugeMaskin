'use client'

import { useActionState, useRef } from 'react'
import { BildeOpplasting } from '@/components/bilde-opplasting'
import { useSkjemakladd } from '@/lib/bruk-kladd'
import { ETIKETT, FELT, KNAPP_PRIMÆR } from '@/components/ui'
import { startLeie, type LeieTilstand } from './actions'

const start: LeieTilstand = {}

/** Ikonet forteller at lenken åpner et nytt vindu, ikke bare i teksten. */
function NyFane() {
  return (
    <>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </svg>
      <span className="sr-only">(åpnes i ny fane)</span>
    </>
  )
}

/** I dag som yyyy-mm-dd i lokal tid – input[type=date] krever det formatet. */
function iDag() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export function LeieSkjema({
  maskinId,
  maskinNavn,
}: {
  maskinId: string
  maskinNavn: string
}) {
  const [tilstand, handling, venter] = useActionState(startLeie, start)
  const skjema = useRef<HTMLFormElement>(null)

  // Skjemaet skal overleve at kunden låser telefonen, bytter app eller
  // trykker tilbake. Nøkkelen er per maskin, så to samtidige leier ikke
  // overskriver hverandre.
  useSkjemakladd(`leie:${maskinId}`, skjema)

  return (
    <form ref={skjema} action={handling} className="space-y-6">
      <input type="hidden" name="maskin_id" value={maskinId} />

      <fieldset className="space-y-4">
        <legend className="hm-display mb-3 flex items-center gap-3 text-xl">
          <span className="hm-skrastrek !h-1 !w-6" aria-hidden="true" />
          Dine opplysninger
        </legend>

        <label className="block">
          <span className={ETIKETT}>Navn</span>
          <input name="navn" required autoComplete="name" className={FELT} />
        </label>

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

        <label className="block">
          <span className={ETIKETT}>Adresse</span>
          <input
            name="adresse"
            required
            autoComplete="street-address"
            placeholder="Storgata 14, 5003 Bergen"
            className={FELT}
          />
          <span className="mt-1.5 block text-xs text-[var(--blekk-svak)]">
            Brukes til fakturaen
          </span>
        </label>

        <label className="block">
          <span className={ETIKETT}>E-post</span>
          <input
            name="epost"
            required
            type="email"
            autoComplete="email"
            className={FELT}
          />
        </label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="hm-display mb-3 flex items-center gap-3 text-xl">
          <span className="hm-skrastrek !h-1 !w-6" aria-hidden="true" />
          Leien
        </legend>

        <label className="block">
          <span className={ETIKETT}>Når leverer du tilbake?</span>
          <input
            name="planlagt_slutt"
            required
            type="date"
            min={iDag()}
            defaultValue={iDag()}
            className={FELT}
          />
        </label>

        <label className="block">
          <span className={ETIKETT}>
            Kommentar <span className="normal-case">(valgfritt)</span>
          </span>
          <textarea
            name="kommentar"
            rows={2}
            placeholder="Hvor skal maskinen brukes?"
            className={FELT}
          />
        </label>

        <BildeOpplasting
          type="henting"
          kladdNøkkel={`leie:${maskinId}`}
          etikett="Bilde av maskinen"
          hjelpetekst={`Ta bilde av ${maskinNavn} slik den ser ut nå. Da har både du og utleier dokumentasjon på tilstanden.`}
        />
      </fieldset>

      {/*
        Lenkene ligger utenfor <label>. Lå de inni, ville ett trykk på
        «leievilkårene» både navigert og huket av boksen.
      */}
      <div className="border-2 border-[var(--kant)] p-4">
        <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="vilkar"
            required
            className="size-6 shrink-0 accent-[var(--color-hm-red)]"
          />
          <span className="text-sm font-semibold">
            Jeg godtar leievilkårene og personvernerklæringen
          </span>
        </label>

        {/*
          Åpnes i ny fane. Navigerte de bort herfra, ville skjemaet blitt
          remontert og alt de har fylt ut vært borte når de kom tilbake.
        */}
        <p className="mt-1 flex flex-wrap gap-x-5 pl-9">
          <a
            href="/vilkar"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[2.75rem] items-center gap-1.5 text-sm font-semibold text-hm-red-ink underline underline-offset-4"
          >
            Les vilkårene
            <NyFane />
          </a>
          <a
            href="/personvern"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[2.75rem] items-center gap-1.5 text-sm font-semibold text-hm-red-ink underline underline-offset-4"
          >
            Les personvern
            <NyFane />
          </a>
        </p>
      </div>

      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}

      <button type="submit" disabled={venter} className={KNAPP_PRIMÆR}>
        {venter ? 'Starter …' : 'Start leien'}
      </button>
    </form>
  )
}
