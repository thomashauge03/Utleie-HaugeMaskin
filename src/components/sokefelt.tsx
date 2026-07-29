import { FELT } from '@/components/ui'

/**
 * Vanlig GET-skjema. Søket havner i URL-en, som gjør treffet mulig å
 * bokmerke og dele, og lar siden bli rendret på server uten JavaScript.
 */
export function Søkefelt({
  verdi,
  plassholder,
  skjulteFelt,
}: {
  verdi: string
  plassholder: string
  /** Filtervalg som skal overleve et søk. */
  skjulteFelt?: Record<string, string | undefined>
}) {
  return (
    <form method="get" className="flex flex-wrap gap-3" role="search">
      {Object.entries(skjulteFelt ?? {}).map(([navn, v]) =>
        v ? <input key={navn} type="hidden" name={navn} value={v} /> : null,
      )}

      <input
        type="search"
        name="q"
        defaultValue={verdi}
        placeholder={plassholder}
        aria-label={plassholder}
        className={`${FELT} min-w-[14rem] flex-1`}
      />

      <button
        type="submit"
        className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-black px-5 text-sm font-bold tracking-wide text-white uppercase"
      >
        Søk
      </button>

      {verdi && (
        <a
          href="?"
          className="inline-flex min-h-[2.75rem] items-center px-2 text-sm font-semibold text-[var(--blekk-svak)] underline underline-offset-4"
        >
          Nullstill
        </a>
      )}
    </form>
  )
}
