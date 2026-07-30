'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

/**
 * Nedtrekksfilter som navigerer ved valg.
 *
 * Brukes der alternativene er mange nok til at knapperader brytes over
 * flere linjer. Elleve kategorichips tok mer plass enn tabellen de
 * filtrerte, og rakk aldri å bli lest.
 *
 * Beholder andre parametre i URL-en, så filter og søk kan kombineres.
 */
export function Filtervelger({
  navn,
  etikett,
  alleTekst = 'Alle',
  valg,
  valgt,
}: {
  navn: string
  etikett: string
  alleTekst?: string
  valg: string[]
  valgt: string
}) {
  const router = useRouter()
  const sti = usePathname()
  const params = useSearchParams()
  const [venter, start] = useTransition()

  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
        {etikett}
      </span>
      <select
        value={valgt}
        disabled={venter}
        onChange={(e) => {
          const p = new URLSearchParams(params.toString())
          if (e.target.value) p.set(navn, e.target.value)
          else p.delete(navn)
          const s = p.toString()
          start(() => router.replace(s ? `${sti}?${s}` : sti, { scroll: false }))
        }}
        className="min-h-[2.75rem] border-2 border-[var(--kant)] bg-[var(--flate-opp)] px-3 text-sm font-semibold outline-none focus:border-hm-red disabled:opacity-50"
      >
        <option value="">{alleTekst}</option>
        {valg.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </label>
  )
}
