'use client'

import { useActionState, useState } from 'react'
import { ETIKETT, FELT } from '@/components/ui'
import type { Maskin } from '@/lib/types'
import {
  deaktiverMaskin,
  lagreMaskin,
  slettMaskin,
  type MaskinTilstand,
} from './actions'

const start: MaskinTilstand = {}

export function RedigerSkjema({
  maskin,
  kategorier,
  utleid,
  harHistorikk,
}: {
  maskin: Maskin
  kategorier: string[]
  utleid: boolean
  harHistorikk: boolean
}) {
  const [tilstand, handling, venter] = useActionState(lagreMaskin, start)

  return (
    <form action={handling} className="space-y-5 p-5">
      <input type="hidden" name="id" value={maskin.id} />

      <label className="block">
        <span className={ETIKETT}>Navn</span>
        <input name="navn" required defaultValue={maskin.navn} className={FELT} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={ETIKETT}>Kategori</span>
          {/* Liste med forslag, men fritekst er fortsatt tillatt – da
              blir ikke admin stående fast om kategorien mangler. */}
          <input
            name="kategori"
            list="kategoriliste"
            defaultValue={maskin.kategori ?? ''}
            placeholder="Komprimering"
            className={FELT}
          />
          <datalist id="kategoriliste">
            {kategorier.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className={ETIKETT}>Internnummer</span>
          <input
            name="internnummer"
            defaultValue={maskin.internnummer ?? ''}
            placeholder="HM-14"
            className={FELT}
          />
        </label>

        <label className="block">
          <span className={ETIKETT}>Døgnpris (kr)</span>
          <input
            name="dogn_pris"
            inputMode="decimal"
            defaultValue={maskin.dogn_pris ?? ''}
            className={`${FELT} hm-tall`}
          />
        </label>

        <label className="block">
          <span className={ETIKETT}>Status</span>
          <select
            name="status"
            defaultValue={maskin.status}
            disabled={utleid}
            className={`${FELT} disabled:opacity-60`}
          >
            <option value="ledig">Ledig</option>
            <option value="utleid">Utleid</option>
            <option value="service">På service</option>
            <option value="utrangert">Utrangert</option>
          </select>
          {utleid && (
            <span className="mt-1.5 block text-xs text-[var(--blekk-svak)]">
              Låst mens maskinen er ute på leie
            </span>
          )}
        </label>
      </div>

      <div className="border-2 border-[var(--kant)] p-4">
        <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="vis_pris"
            defaultChecked={maskin.vis_pris}
            className="size-5 shrink-0 accent-[var(--color-hm-red)]"
          />
          <span className="text-sm font-semibold">Vis prisen for kunden</span>
        </label>
        <p className="mt-1 pl-8 text-xs text-[var(--blekk-svak)]">
          Er den av, kan kunden leie som normalt — men uten å se prisen.
        </p>
      </div>

      <label className="block">
        <span className={ETIKETT}>Notat</span>
        <textarea
          name="notat"
          rows={3}
          defaultValue={maskin.notat ?? ''}
          placeholder="Serienummer, serviceintervall, kjente feil …"
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
        <p role="status" className="border-l-4 border-hm-green bg-hm-green/10 p-3 text-sm font-semibold text-hm-green">
          {tilstand.ok}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t-2 border-[var(--kant)] pt-5">
        <button
          type="submit"
          disabled={venter}
          className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[3rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-6 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover disabled:opacity-50"
        >
          {venter ? 'Lagrer …' : 'Lagre endringer'}
        </button>

        <FjernMaskin
          maskinId={maskin.id}
          utleid={utleid}
          harHistorikk={harHistorikk}
        />
      </div>
    </form>
  )
}

/**
 * To ulike måter å fjerne en maskin, avhengig av om den har historikk.
 *
 * Har den vært utleid, kan den ikke slettes – da ville fakturagrunnlaget
 * på gamle leier mistet maskinen de gjaldt. Da er «ta ut av bruk» det
 * riktige, og det er reversibelt.
 */
function FjernMaskin({
  maskinId,
  utleid,
  harHistorikk,
}: {
  maskinId: string
  utleid: boolean
  harHistorikk: boolean
}) {
  const [bekrefter, settBekrefter] = useState(false)

  if (utleid) {
    return (
      <span className="ml-auto text-xs text-[var(--blekk-svak)]">
        Kan ikke fjernes mens den er utleid
      </span>
    )
  }

  // Aldri utleid: trygt å slette for godt. Krever bekreftelse siden det
  // ikke kan angres.
  if (!harHistorikk) {
    return bekrefter ? (
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <span className="text-xs text-[var(--blekk-svak)]">
          Slettes for godt. Kan ikke angres.
        </span>
        <form action={slettMaskin.bind(null, maskinId)}>
          <button
            type="submit"
            className="hm-trykk inline-flex min-h-[2.25rem] items-center border-2 border-hm-red bg-hm-red px-3 text-xs font-bold tracking-wider text-white uppercase"
          >
            Bekreft sletting
          </button>
        </form>
        <button
          type="button"
          onClick={() => settBekrefter(false)}
          className="text-sm text-[var(--blekk-svak)]"
        >
          Avbryt
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => settBekrefter(true)}
        className="ml-auto text-sm font-semibold text-hm-red-ink underline underline-offset-4"
      >
        Slett maskin
      </button>
    )
  }

  // Har historikk: kun deaktivering. Reversibelt, derfor ett trykk.
  return (
    <div className="ml-auto flex flex-wrap items-center gap-3">
      <span className="text-xs text-[var(--blekk-svak)]">
        Har leiehistorikk og kan ikke slettes
      </span>
      <form action={deaktiverMaskin.bind(null, maskinId)}>
        <button
          type="submit"
          className="text-sm font-semibold text-hm-red-ink underline underline-offset-4"
        >
          Ta ut av bruk
        </button>
      </form>
    </div>
  )
}
