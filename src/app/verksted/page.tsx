import type { Metadata } from 'next'
import Link from 'next/link'
import { hentAdmin } from '@/lib/auth'
import { hentVerksted, grupperPaaType } from '@/lib/verksted-data'
import { HMLogo } from '@/components/hm-logo'
import { Merke, TomTilstand } from '@/components/ui'
import { Søkefelt } from '@/components/sokefelt'
import {
  DEL_MERKE,
  DEL_STATUS_TEKST,
  VERKSTED_MERKE,
  VERKSTED_STATUS_TEKST,
  krevesArbeid,
  verkstedStatusAv,
  type DelStatus,
  type VerkstedStatus,
} from '@/lib/verksted'

export const metadata: Metadata = { title: 'Verksted – HM' }
export const dynamic = 'force-dynamic'

/**
 * QR-koden i verkstedet peker hit. Viser hele lista, ikke én maskin –
 * skuffene har ikke hver sin kode.
 */
export default async function VerkstedSide(props: PageProps<'/verksted'>) {
  const sp = await props.searchParams
  const søk = typeof sp.q === 'string' ? sp.q.trim() : ''
  const kunArbeid = sp.filter === 'arbeid'

  const [{ kategorier, deler, maskiner: alle }, bruker] = await Promise.all([
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

  const harArbeid = (m: (typeof alle)[number]) =>
    krevesArbeid(
      m.verksted_status,
      Object.values(m.deler).map((s) => ({ status: s })),
    )

  const trengerArbeid = alle.filter(harArbeid)

  // Søket treffer også målene på delene, så «S70» finner alt med den
  // festetypen selv om den bare står registrert på tannholderen.
  let maskiner = alle
  if (kunArbeid) maskiner = maskiner.filter(harArbeid)
  if (søk) {
    const n = søk.toLowerCase().replace(/\s/g, '')
    maskiner = maskiner.filter((m) =>
      [
        m.navn,
        m.internnummer,
        m.underkategori,
        m.kjeft_dimensjon,
        m.qr_kode,
        ...Object.values(m.delMal),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().replace(/\s/g, '').includes(n)),
    )
  }

  const filtrerer = søk !== '' || kunArbeid

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
            <div className="flex flex-wrap items-center gap-3">
              {/* Verkstedet ligger utenfor adminlayouten, så uten denne
                  står en admin uten vei tilbake til menyen. */}
              {bruker?.rolle === 'admin' && (
                <Link
                  href="/admin"
                  className="border-2 border-white/25 px-3 py-1.5 text-xs font-bold tracking-wider text-white/80 uppercase transition-colors hover:border-white hover:text-white"
                >
                  ← Adminpanel
                </Link>
              )}
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
          </div>

          <h1 className="hm-display mt-6 text-3xl">Verksted</h1>
          <p className="mt-0.5 text-sm text-white/60">{kategorier.join(' · ')}</p>
          <p className="mt-1 text-sm text-white/70">
            {filtrerer ? `${maskiner.length} av ${alle.length}` : `${alle.length} i lista`}{' '}
            ·{' '}
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

        <div className="mb-6 space-y-3">
          <Søkefelt
            verdi={søk}
            plassholder="Søk på navn, internnummer, type eller mål"
          />

          <div className="flex flex-wrap gap-2">
            <Link
              href={søk ? `/verksted?q=${encodeURIComponent(søk)}` : '/verksted'}
              aria-current={!kunArbeid ? 'true' : undefined}
              className={`inline-flex min-h-[2.75rem] items-center border-2 px-4 text-xs font-bold tracking-wider uppercase ${
                !kunArbeid
                  ? 'border-[var(--kant-sterk)] bg-hm-black text-white'
                  : 'border-[var(--kant)] bg-[var(--flate-opp)]'
              }`}
            >
              Alle
            </Link>
            <Link
              href={`/verksted?filter=arbeid${søk ? `&q=${encodeURIComponent(søk)}` : ''}`}
              aria-current={kunArbeid ? 'true' : undefined}
              className={`inline-flex min-h-[2.75rem] items-center border-2 px-4 text-xs font-bold tracking-wider uppercase ${
                kunArbeid
                  ? 'border-[var(--kant-sterk)] bg-hm-red text-white'
                  : 'border-[var(--kant)] bg-[var(--flate-opp)]'
              }`}
            >
              Trenger arbeid ({trengerArbeid.length})
            </Link>
          </div>
        </div>

        {maskiner.length === 0 && filtrerer ? (
          <TomTilstand
            tittel="Ingen treff"
            handling={{ href: '/verksted', tekst: 'Nullstill' }}
          >
            {søk
              ? `Fant ingenting som matcher «${søk}».`
              : 'Ingenting trenger arbeid akkurat nå.'}
          </TomTilstand>
        ) : maskiner.length === 0 ? (
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

                      <Merke type={VERKSTED_MERKE[verkstedStatusAv(m.verksted_status)]}>
                        {VERKSTED_STATUS_TEKST[verkstedStatusAv(m.verksted_status)]}
                      </Merke>
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
