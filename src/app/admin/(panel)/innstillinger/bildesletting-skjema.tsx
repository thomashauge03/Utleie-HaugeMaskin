'use client'

import { useActionState } from 'react'
import { utenNullstilling } from '@/lib/skjema'
import { lagreBildesletting, type Tilstand } from './actions'
import { Bryter } from './varsel-skjema'

const start: Tilstand = {}

export function BildeslettingSkjema({
  slettGamle,
  migrasjonKjort,
  eldste,
}: {
  slettGamle: boolean
  migrasjonKjort: boolean
  eldste: { dato: string; frist: string } | null
}) {
  const [tilstand, handling, venter] = useActionState(lagreBildesletting, start)

  return (
    <form action={handling} onSubmit={utenNullstilling(handling)} className="space-y-5 p-5">
      {!migrasjonKjort && (
        <div className="border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
          <p className="font-bold">Migrasjon 0014 er ikke kjørt ennå</p>
          <p className="mt-1 text-[var(--blekk-svak)]">
            Ingenting slettes, og bryteren kan ikke lagres før{' '}
            <code className="font-mono text-xs">0014_bildesletting.sql</code> er kjørt i
            Supabase.
          </p>
        </div>
      )}

      <Bryter
        navn="slett_gamle_bilder"
        tittel="Slett bilder og posisjon etter 24 måneder"
        beskrivelse="Sjekkes hver morgen. Bilder fra leier som ikke er avsluttet, venter til leien er ferdig. Personvernsida sier «slettes automatisk» bare når denne er på."
        standard={slettGamle}
      />

      <p className="text-sm text-[var(--blekk-svak)]">
        {!eldste
          ? 'Ingen bilder på avsluttede leier ennå.'
          : migrasjonKjort && slettGamle
            ? `Eldste bilde på en avsluttet leie er fra ${eldste.dato}, og det slettes ved første kjøring etter ${eldste.frist}.`
            : `Eldste bilde på en avsluttet leie er fra ${eldste.dato}.`}
      </p>

      {migrasjonKjort && !slettGamle && (
        <p className="border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
          Står av: bildene blir liggende til noen sletter dem, og personvernsida sier ikke
          lenger at de slettes automatisk.
        </p>
      )}

      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}
      {tilstand.ok && (
        <p role="status" className="border-l-4 border-hm-green bg-hm-green/10 p-3 text-sm font-semibold text-hm-green">
          {tilstand.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={venter || !migrasjonKjort}
        className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-5 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
      >
        {venter ? 'Lagrer …' : 'Lagre'}
      </button>
    </form>
  )
}
