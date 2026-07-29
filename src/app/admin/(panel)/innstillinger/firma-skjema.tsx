'use client'

import { useActionState } from 'react'
import { ETIKETT, FELT } from '@/components/ui'
import { lagreInnstillinger, type Tilstand } from './actions'

const start: Tilstand = {}

export type Innstillinger = {
  firmanavn: string
  varsel_epost: string | null
  vis_pris_standard: boolean
  vilkar_tekst: string
}

export function FirmaSkjema({ innstillinger }: { innstillinger: Innstillinger }) {
  const [tilstand, handling, venter] = useActionState(lagreInnstillinger, start)

  return (
    <form action={handling} className="space-y-5 p-5">
      <label className="block">
        <span className={ETIKETT}>Firmanavn</span>
        <input
          name="firmanavn"
          defaultValue={innstillinger.firmanavn}
          placeholder="Hauge Maskin AS"
          className={FELT}
        />
        <span className="mt-1.5 block text-xs text-[var(--blekk-svak)]">
          Brukes på fakturagrunnlaget
        </span>
      </label>

      <label className="block">
        <span className={ETIKETT}>Varsling til e-post</span>
        <input
          name="varsel_epost"
          type="email"
          defaultValue={innstillinger.varsel_epost ?? ''}
          placeholder="utleie@haugemaskin.no"
          className={FELT}
        />
        <span className="mt-1.5 block text-xs text-[var(--blekk-svak)]">
          Adressen som skal ha beskjed ved ny leie, innlevering og forfall.
          Selve utsendingen er ikke bygget ennå.
        </span>
      </label>

      <div className="border-2 border-[var(--kant)] p-4">
        <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="vis_pris_standard"
            defaultChecked={innstillinger.vis_pris_standard}
            className="size-5 shrink-0 accent-[var(--color-hm-red)]"
          />
          <span className="text-sm font-semibold">
            Vis pris til kunden som standard
          </span>
        </label>
        <p className="mt-1 pl-8 text-xs text-[var(--blekk-svak)]">
          Gjelder nye maskiner. Hver maskin kan overstyres for seg.
        </p>
      </div>

      <label className="block">
        <span className={ETIKETT}>Egen tekst i leievilkårene</span>
        <textarea
          name="vilkar_tekst"
          rows={5}
          defaultValue={innstillinger.vilkar_tekst}
          placeholder="Tillegg som skal vises nederst på vilkårssiden …"
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
        <p className="border-l-4 border-hm-green bg-hm-green/10 p-3 text-sm font-semibold text-hm-green">
          {tilstand.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={venter}
        className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-5 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
      >
        {venter ? 'Lagrer …' : 'Lagre innstillinger'}
      </button>
    </form>
  )
}
