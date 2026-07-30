import type { Metadata } from 'next'
import Link from 'next/link'
import { hentAdmin } from '@/lib/auth'
import { hentVerksted, grupperPaaType } from '@/lib/verksted-data'
import { HMLogo } from '@/components/hm-logo'
import { Merke, TomTilstand } from '@/components/ui'
import {
  DEL_MERKE,
  DEL_STATUS_TEKST,
  VERKSTED_MERKE,
  VERKSTED_STATUS_TEKST,
  krevesArbeid,
  type DelStatus,
  type VerkstedStatus,
} from '@/lib/verksted'

export const metadata: Metadata = { title: 'Verksted – HM' }
export const dynamic = 'force-dynamic'

/**
 * QR-koden i verkstedet peker hit. Viser hele lista, ikke én maskin –
 * skuffene har ikke hver sin kode.
 */
export default async function VerkstedSide() {
  const [{ kategorier, deler, maskiner }, bruker] = await Promise.all([
    hentVerksted(),
    hentAdmin(),
  ])

  if (kategorier.length === 0) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <HMLogo størrelse="sm" />
        <div className="mt-6">
          <TomTilstand tittel="Verkstedet er ikke satt opp">
            En admin må velge hvilke kategorier verkstedet gjelder, under
            Innstillinger → Verksted.
          </TomTilstand>
        </div>
      </main>
    )
  }

  const trengerArbeid = maskiner.filter((m) =>
    krevesArbeid(
      m.verksted_status,
      Object.values(m.deler).map((s) => ({ status: s })),
    ),
  )

  return (
    <>
      <header className="relative overflow-hidden bg-hm-black px-5 pt-6 pb-8 text-white">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-16 h-[160%] w-40 skew-x-[-18deg] bg-hm-red/90"
        />
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <HMLogo størrelse="sm" />
            {bruker ? (
              <span className="text-xs font-bold tracking-widest text-white/60 uppercase">
                {bruker.navn}
              </span>
            ) : (
              <Link
                href="/admin/logg-inn"
                className="border-2 border-white/25 px-3 py-1.5 text-xs font-bold tracking-wider text-white/80 uppercase"
              >
                Logg inn
              </Link>
            )}
          </div>

          <h1 className="hm-display mt-6 text-3xl">Verksted</h1>
          <p className="mt-0.5 text-sm text-white/60">{kategorier.join(' · ')}</p>
          <p className="mt-1 text-sm text-white/70">
            {maskiner.length} i lista ·{' '}
            {trengerArbeid.length > 0 ? (
              <span className="font-bold text-hm-red">
                {trengerArbeid.length} trenger arbeid
              </span>
            ) : (
              'alt er klart for drift'
            )}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-7">
        {!bruker && (
          <p className="mb-6 border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
            Du kan melde fra om at noe må sveises. For å sette «deler bestilt»
            eller «klar for drift» må du logge inn.
          </p>
        )}

        {maskiner.length === 0 ? (
          <TomTilstand tittel="Ingenting i verkstedet ennå">
            Legg inn maskiner under Maskiner, med {kategorier.join(' eller ')} som
            kategori.
          </TomTilstand>
        ) : (
          <div className="space-y-7">
            {grupperPaaType(maskiner).map(([type, liste]) => (
              <section key={type}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="hm-skrastrek !h-1 !w-5" aria-hidden="true" />
                  <h2 className="hm-display text-xl">{type}</h2>
                  <span className="hm-tall text-xs font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
                    {liste.length}
                  </span>
                </div>

                <ul className="space-y-3">
                  {liste.map((m) => {
                    const åpneDeler = deler.filter(
                      (d) => m.deler[d.id] && m.deler[d.id] !== 'ok',
                    )

                    return (
                      <li key={m.id}>
                  <Link
                    href={`/verksted/${m.id}`}
                    className="hm-trykk hm-kant-skygge-sm block border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="hm-display block text-lg">{m.navn}</span>
                        <span className="mt-0.5 block text-sm text-[var(--blekk-svak)]">
                          {[m.internnummer, m.kjeft_dimensjon]
                            .filter(Boolean)
                            .join(' · ') || m.qr_kode}
                        </span>
                      </div>

                      {m.verksted_status ? (
                        <Merke type={VERKSTED_MERKE[m.verksted_status as VerkstedStatus]}>
                          {VERKSTED_STATUS_TEKST[m.verksted_status as VerkstedStatus]}
                        </Merke>
                      ) : (
                        <Merke type="nøytral">Ingen sak</Merke>
                      )}
                    </div>

                    {åpneDeler.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t-2 border-[var(--kant)] pt-3">
                        {åpneDeler.map((d) => (
                          <span
                            key={d.id}
                            className="text-[11px] font-bold tracking-wider uppercase"
                          >
                            <Merke type={DEL_MERKE[m.deler[d.id] as DelStatus]}>
                              {d.navn}: {DEL_STATUS_TEKST[m.deler[d.id] as DelStatus]}
                            </Merke>
                          </span>
                        ))}
                      </div>
                    )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
