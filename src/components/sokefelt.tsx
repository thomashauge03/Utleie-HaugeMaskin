'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FELT } from '@/components/ui'

/**
 * Søker mens du skriver.
 *
 * Treffet ligger fortsatt i URL-en, så det kan bokmerkes og deles, og
 * siden rendres på server. Vi bruker `replace` framfor `push` slik at
 * hvert tastetrykk ikke legger igjen et steg i nettleserhistorikken –
 * ellers måtte du trykke tilbake like mange ganger som du skrev.
 *
 * Uten JavaScript fungerer feltet fortsatt som et vanlig GET-skjema.
 */
export function Søkefelt({
  verdi,
  plassholder,
}: {
  verdi: string
  plassholder: string
}) {
  const router = useRouter()
  const sti = usePathname()
  const params = useSearchParams()
  const [venter, startOvergang] = useTransition()
  const [tekst, settTekst] = useState(verdi)
  const førsteRender = useRef(true)

  // Nullstill feltet når URL-en endres utenfra (filterknapp, tilbake).
  useEffect(() => {
    settTekst(verdi)
  }, [verdi])

  useEffect(() => {
    if (førsteRender.current) {
      førsteRender.current = false
      return
    }
    if (tekst === verdi) return

    const tidsavbrudd = setTimeout(() => {
      const p = new URLSearchParams(params.toString())
      if (tekst.trim()) p.set('q', tekst.trim())
      else p.delete('q')

      startOvergang(() => {
        const s = p.toString()
        router.replace(s ? `${sti}?${s}` : sti, { scroll: false })
      })
    }, 250)

    return () => clearTimeout(tidsavbrudd)
    // `verdi` bevisst utelatt: den endres som følge av navigasjonen
    // under, og ville ellers startet en ny runde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tekst, params, sti, router])

  return (
    <form
      method="get"
      role="search"
      onSubmit={(e) => e.preventDefault()}
      className="relative flex flex-wrap items-center gap-3"
    >
      {/* Bevarer filtervalget når skjemaet sendes uten JavaScript. */}
      {[...params.entries()]
        .filter(([n]) => n !== 'q')
        .map(([n, v]) => (
          <input key={n} type="hidden" name={n} value={v} />
        ))}

      <div className="relative min-w-[16rem] flex-1">
        <input
          type="search"
          name="q"
          value={tekst}
          onChange={(e) => settTekst(e.target.value)}
          placeholder={plassholder}
          aria-label={plassholder}
          autoComplete="off"
          className={`${FELT} pr-24`}
        />

        <span
          aria-live="polite"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold tracking-wider text-[var(--blekk-svak)] uppercase"
        >
          {venter ? 'Søker …' : tekst ? 'Treff nedenfor' : ''}
        </span>
      </div>

      {tekst && (
        <button
          type="button"
          onClick={() => settTekst('')}
          className="inline-flex min-h-[2.75rem] items-center px-2 text-sm font-semibold text-[var(--blekk-svak)] underline underline-offset-4"
        >
          Nullstill
        </button>
      )}

      {/* Synlig kun uten JavaScript, der debounce-effekten aldri kjører. */}
      <noscript>
        <button
          type="submit"
          className="inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-black px-5 text-sm font-bold tracking-wide text-white uppercase"
        >
          Søk
        </button>
      </noscript>
    </form>
  )
}
