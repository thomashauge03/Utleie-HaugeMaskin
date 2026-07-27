import Link from 'next/link'
import { HMLogo } from '@/components/hm-logo'
import { KNAPP_SEKUNDÆR } from '@/components/ui'

const steg = [
  { n: '01', tittel: 'Skann', tekst: 'Hold kameraet mot QR-koden på maskinen.' },
  { n: '02', tittel: 'Bekreft', tekst: 'Fyll ut, ta bilde av maskinen, og leien starter.' },
  { n: '03', tittel: 'Lever', tekst: 'Skann returkoden på anlegget og ta bilde. Ferdig.' },
]

export default function Forside() {
  return (
    <>
      <main className="flex-1">
        {/* ── Hero ────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-hm-black px-6 py-16 text-white sm:py-24">
          {/* Skrå rød flate – logoens kursiv i stor skala */}
          <div
            aria-hidden="true"
            className="absolute -top-24 -right-32 h-[130%] w-80 skew-x-[-18deg] bg-hm-red/90 sm:w-[26rem]"
          />
          <div
            aria-hidden="true"
            className="absolute -top-24 right-52 h-[130%] w-6 skew-x-[-18deg] bg-white/10 sm:right-80 sm:w-10"
          />

          <div className="relative mx-auto max-w-5xl">
            <HMLogo størrelse="xl" className="hm-inn" />

            <h1
              className="hm-display hm-inn mt-8 max-w-2xl text-4xl sm:text-6xl"
              style={{ animationDelay: '60ms' }}
            >
              Leie maskin?
              <br />
              <span className="text-hm-red">Skann. Kjør.</span>
            </h1>

            <p
              className="hm-inn mt-5 max-w-md text-lg text-white/70"
              style={{ animationDelay: '120ms' }}
            >
              Ingen konto, ingen skjemaer på forhånd, ingen venting på nøkkel.
              QR-koden sitter på maskinen.
            </p>
          </div>
        </section>

        {/* ── Slik gjør du ────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
          <span className="hm-skrastrek mb-4" aria-hidden="true" />
          <h2 className="hm-display text-2xl sm:text-3xl">Slik gjør du</h2>

          <ol className="mt-8 grid gap-5 sm:grid-cols-3">
            {steg.map((s, i) => (
              <li
                key={s.n}
                className="hm-inn border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-5"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="hm-display hm-tall block text-4xl text-hm-red">
                  {s.n}
                </span>
                <h3 className="hm-display mt-2 text-xl">{s.tittel}</h3>
                <p className="mt-1.5 text-sm text-[var(--blekk-svak)]">{s.tekst}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Retur ───────────────────────────────────────── */}
        <section className="border-t-2 border-[var(--kant)] bg-[var(--flate-2)]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-5 px-6 py-10">
            <div>
              <h2 className="hm-display text-xl">Skal du levere tilbake?</h2>
              <p className="mt-1 text-sm text-[var(--blekk-svak)]">
                Returkoden henger på arbeidsstedet. Du trenger bare å ta et bilde.
              </p>
            </div>
            <Link href="/retur" className={KNAPP_SEKUNDÆR}>
              Til retursiden
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-[var(--kant-sterk)] bg-hm-black text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-7">
          <HMLogo størrelse="sm" />
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
            <Link href="/vilkar" className="hover:text-white">
              Leievilkår
            </Link>
            <Link href="/personvern" className="hover:text-white">
              Personvern
            </Link>
            <Link href="/admin" className="hover:text-white">
              Admin
            </Link>
          </nav>
        </div>
        <div className="hm-varselstriper h-2" aria-hidden="true" />
      </footer>
    </>
  )
}
