'use client'

/**
 * Fanger uventede feil i hele appen – f.eks. når en kunde mister
 * dekning midt i en handling. Uten denne ville Next vist sin engelske,
 * ustylede standard-feilside, som er en blindvei for en kunde i felt.
 */
export default function Feil({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <span className="hm-skrastrek mx-auto mb-4 block" aria-hidden="true" />
        <h1 className="hm-display text-3xl">Noe gikk galt</h1>
        <p className="mt-3 text-[var(--blekk-svak)]">
          Det oppsto en feil. Ofte hjelper det å prøve på nytt – sjekk at du har
          dekning.
        </p>
        <button
          type="button"
          onClick={reset}
          className="hm-trykk hm-kant-skygge mt-8 inline-flex min-h-[3.25rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-6 text-base font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover"
        >
          Prøv igjen
        </button>
      </div>
    </main>
  )
}
