import Link from 'next/link'

export default function IkkeFunnet() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <span className="hm-display block text-6xl text-hm-red">404</span>
        <h1 className="hm-display mt-2 text-2xl">Fant ikke siden</h1>
        <p className="mt-3 text-[var(--blekk-svak)]">
          Lenken kan være feil, eller så finnes ikke maskinen lenger. Skann
          QR-koden på maskinen på nytt, eller ta kontakt med utleier.
        </p>
        <Link
          href="/"
          className="hm-trykk hm-kant-skygge-sm mt-8 inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] px-5 text-sm font-bold tracking-wide uppercase"
        >
          Til forsiden
        </Link>
      </div>
    </main>
  )
}
