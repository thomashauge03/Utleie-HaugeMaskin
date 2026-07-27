import Link from 'next/link'

/**
 * Forsiden. Kundene kommer aldri hit – de lander på /m/<kode> via QR.
 * Denne siden er for den som skriver inn bare domenet, og skal først og
 * fremst ikke være forvirrende.
 */
export default function Forside() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Utleie</h1>

        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Skann QR-koden på maskinen du vil leie, så starter du leien der og da.
          Ingen innlogging.
        </p>

        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Skal du levere tilbake? Skann returkoden på arbeidsstedet.
        </p>

        <div className="mt-12 border-t border-slate-200 pt-6 dark:border-slate-800">
          <Link
            href="/admin"
            className="text-sm text-slate-500 underline underline-offset-4 transition hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-300"
          >
            Admininnlogging
          </Link>
        </div>
      </div>
    </main>
  )
}
