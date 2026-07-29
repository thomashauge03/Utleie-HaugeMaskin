'use client'

import { useActionState } from 'react'
import { ETIKETT, FELT } from '@/components/ui'
import { lagreVarsling, type Tilstand } from './actions'

const start: Tilstand = {}

export type Varsling = {
  varsel_epost: string | null
  varsel_kopi: string | null
  avsender_navn: string
  varsle_ny_leie: boolean
  varsle_retur: boolean
  varsle_forfalt: boolean
  kvittering_start: boolean
  kvittering_retur: boolean
  purring_forfalt: boolean
}

function Bryter({
  navn,
  tittel,
  beskrivelse,
  standard,
}: {
  navn: string
  tittel: string
  beskrivelse: string
  standard: boolean
}) {
  return (
    <div className="border-2 border-[var(--kant)] p-4">
      <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name={navn}
          defaultChecked={standard}
          className="size-5 shrink-0 accent-[var(--color-hm-red)]"
        />
        <span className="text-sm font-semibold">{tittel}</span>
      </label>
      <p className="mt-1 pl-8 text-xs text-[var(--blekk-svak)]">{beskrivelse}</p>
    </div>
  )
}

export function VarselSkjema({ varsling }: { varsling: Varsling }) {
  const [tilstand, handling, venter] = useActionState(lagreVarsling, start)

  return (
    <form action={handling} className="space-y-6 p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={ETIKETT}>Varsler sendes til</span>
          <input
            name="varsel_epost"
            defaultValue={varsling.varsel_epost ?? ''}
            placeholder="utleie@haugemaskin.no"
            className={FELT}
          />
          <span className="mt-1.5 block text-xs text-[var(--blekk-svak)]">
            Flere adresser skilles med komma
          </span>
        </label>

        <label className="block">
          <span className={ETIKETT}>Kopi til</span>
          <input
            name="varsel_kopi"
            defaultValue={varsling.varsel_kopi ?? ''}
            placeholder="regnskap@haugemaskin.no"
            className={FELT}
          />
          <span className="mt-1.5 block text-xs text-[var(--blekk-svak)]">
            Får kopi av alle varsler til admin
          </span>
        </label>
      </div>

      <label className="block">
        <span className={ETIKETT}>Avsendernavn</span>
        <input
          name="avsender_navn"
          defaultValue={varsling.avsender_navn}
          placeholder="HM Utleie"
          className={FELT}
        />
        <span className="mt-1.5 block text-xs text-[var(--blekk-svak)]">
          Navnet mottakeren ser i innboksen
        </span>
      </label>

      <div>
        <h3 className="hm-display mb-3 text-lg">Til dere</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Bryter
            navn="varsle_ny_leie"
            tittel="Ny utleie"
            beskrivelse="Når en kunde skanner og starter en leie. Nye kunder flagges."
            standard={varsling.varsle_ny_leie}
          />
          <Bryter
            navn="varsle_retur"
            tittel="Innlevering venter"
            beskrivelse="Når en kunde har levert og bildet venter på godkjenning."
            standard={varsling.varsle_retur}
          />
          <Bryter
            navn="varsle_forfalt"
            tittel="Daglig oversikt over forfalte"
            beskrivelse="Én samlet e-post hver morgen, kun hvis noe faktisk er på overtid."
            standard={varsling.varsle_forfalt}
          />
        </div>
      </div>

      <div>
        <h3 className="hm-display mb-3 text-lg">Til kunden</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Bryter
            navn="kvittering_start"
            tittel="Kvittering ved leiestart"
            beskrivelse="Bekreftelse med maskin, referanse og forventet leveringsdato."
            standard={varsling.kvittering_start}
          />
          <Bryter
            navn="kvittering_retur"
            tittel="Kvittering ved innlevering"
            beskrivelse="Bekreftelse på at innleveringen er registrert og klokka stoppet."
            standard={varsling.kvittering_retur}
          />
          <Bryter
            navn="purring_forfalt"
            tittel="Påminnelse ved overtid"
            beskrivelse="Vennlig purring til kunden. Maks én per leie per dag."
            standard={varsling.purring_forfalt}
          />
        </div>
      </div>

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
        className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-5 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
      >
        {venter ? 'Lagrer …' : 'Lagre varsling'}
      </button>
    </form>
  )
}
