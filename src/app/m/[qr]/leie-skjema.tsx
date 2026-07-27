'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { BildeOpplasting } from '@/components/bilde-opplasting'
import { startLeie, type LeieTilstand } from './actions'

const start: LeieTilstand = {}

const felt =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-400'

/** I dag, som yyyy-mm-dd i lokal tid – input[type=date] vil ha det slik. */
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

  return (
    <form action={handling} className="space-y-5">
      <input type="hidden" name="maskin_id" value={maskinId} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Navn</span>
        <input name="navn" required autoComplete="name" className={felt} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Mobilnummer</span>
        <input
          name="telefon"
          required
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="900 00 000"
          className={felt}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Adresse</span>
        <input
          name="adresse"
          required
          autoComplete="street-address"
          placeholder="Storgata 14, 5003 Bergen"
          className={felt}
        />
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
          Brukes til fakturaen
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">E-post</span>
        <input
          name="epost"
          required
          type="email"
          autoComplete="email"
          className={felt}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Når regner du med å levere tilbake?
        </span>
        <input
          name="planlagt_slutt"
          required
          type="date"
          min={iDag()}
          defaultValue={iDag()}
          className={felt}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Kommentar <span className="font-normal text-slate-400">(valgfritt)</span>
        </span>
        <textarea name="kommentar" rows={2} className={felt} />
      </label>

      <BildeOpplasting
        type="henting"
        etikett="Bilde av maskinen"
        hjelpetekst={`Ta et bilde av ${maskinNavn} slik den ser ut nå. Da har begge parter dokumentasjon på tilstanden.`}
      />

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="vilkar"
          required
          className="mt-0.5 size-5 shrink-0 rounded border-slate-300 dark:border-slate-700"
        />
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Jeg godtar{' '}
          <Link href="/vilkar" className="underline underline-offset-4">
            leievilkårene
          </Link>{' '}
          og at opplysningene lagres slik det står i{' '}
          <Link href="/personvern" className="underline underline-offset-4">
            personvernerklæringen
          </Link>
          .
        </span>
      </label>

      {tilstand.feil && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {tilstand.feil}
        </p>
      )}

      <button
        type="submit"
        disabled={venter}
        className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        {venter ? 'Starter leien …' : 'Start leien'}
      </button>
    </form>
  )
}
