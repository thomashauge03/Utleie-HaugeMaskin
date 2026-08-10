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

  /*
   * Siste søk denne komponenten selv la i URL-en.
   *
   * Uten dette kan vi ikke skille «URL-en endret seg fordi jeg nettopp
   * søkte» fra «URL-en endret seg utenfra» – tilbake-knappen, en
   * filterlenke, Nullstill. Feltet ble tidligere satt tilbake til
   * serverens verdi hver gang et søk landet, og skrev du videre mens
   * svaret var i lufta, forsvant bokstavene du hadde rukket å taste.
   */
  const egetSøk = useRef(verdi)

  useEffect(() => {
    // Kom endringen utenfra? Bare da skal feltet følge etter.
    if (verdi !== egetSøk.current) {
      egetSøk.current = verdi
      settTekst(verdi)
    }
  }, [verdi])

  useEffect(() => {
    /*
     * Sammenlignes trimmet, fordi det er den trimmede teksten som
     * havner i URL-en. Utrimmet ville «grav » aldri se likt ut som
     * «grav», og feltet hadde søkt om igjen i det uendelige.
     */
    if (tekst.trim() === egetSøk.current) return

    const tidsavbrudd = setTimeout(() => {
      const nytt = tekst.trim()
      egetSøk.current = nytt

      const p = new URLSearchParams(params.toString())
      if (nytt) p.set('q', nytt)
      else p.delete('q')

      startOvergang(() => {
        const s = p.toString()
        router.replace(s ? `${sti}?${s}` : sti, { scroll: false })
      })
    }, 250)

    return () => clearTimeout(tidsavbrudd)
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
