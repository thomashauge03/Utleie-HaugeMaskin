import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { MASKIN_STATUS_TEKST, type Maskin } from '@/lib/types'
import { prisEnhet } from '@/lib/pris'
import { KNAPP_SEKUNDÆR, Merke, Seksjonstittel, TomTilstand } from '@/components/ui'
import { Søkefelt } from '@/components/sokefelt'
import { Filtervelger } from '@/components/filtervelger'
import { KopierLenke } from './kopier-lenke'
import { NyMaskin } from './ny-maskin'

export const metadata: Metadata = { title: 'Maskiner – HM Utleie' }
export const dynamic = 'force-dynamic'

const merkeType = {
  ledig: 'grønn',
  utleid: 'gul',
  service: 'nøytral',
  utrangert: 'nøytral',
} as const

const UTEN = 'Uten kategori'

const STATUSFILTRE = [
  { verdi: 'alle', tekst: 'Alle' },
  { verdi: 'ledig', tekst: 'Ledige' },
  { verdi: 'utleid', tekst: 'Utleid' },
  { verdi: 'service', tekst: 'På service' },
  { verdi: 'utrangert', tekst: 'Utrangert' },
] as const

/** Feltene et fritekstsøk skal treffe på. */
function treffer(m: Maskin, søk: string): boolean {
  const n = søk.toLowerCase().replace(/\s/g, '')
  return [
    m.navn,
    m.qr_kode,
    m.internnummer,
    m.kategori,
    m.underkategori,
    m.notat,
  ]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().replace(/\s/g, '').includes(n))
}

export default async function MaskinerSide(props: PageProps<'/admin/maskiner'>) {
  await krevAdmin()
  const sp = await props.searchParams

  const søk = typeof sp.q === 'string' ? sp.q.trim() : ''
  const status = typeof sp.status === 'string' ? sp.status : 'alle'
  const kategoriFilter = typeof sp.kategori === 'string' ? sp.kategori : ''

  const supabase = await lagServerKlient()
  const [{ data, error }, { data: kategoriRader }, { data: utAvBruk }] =
    await Promise.all([
      supabase.from('maskiner').select('*').eq('aktiv', true).order('navn'),
      supabase.from('kategorier').select('navn').order('rekkefolge').order('navn'),
      supabase.from('maskiner').select('*').eq('aktiv', false).order('navn'),
    ])

  const alle = (data ?? []) as Maskin[]
  const kategoriListe = (kategoriRader ?? []).map((k) => k.navn as string)

  /*
   * Filtreres i minnet. Antallet maskiner er lite nok til at det ikke
   * betyr noe, og søket spenner over seks felter – å bygge det som en
   * databasespørring ville gitt mye mer kode uten merkbar gevinst.
   */
  let maskiner = alle
  if (status !== 'alle') maskiner = maskiner.filter((m) => m.status === status)
  if (kategoriFilter) {
    maskiner = maskiner.filter((m) => (m.kategori?.trim() || UTEN) === kategoriFilter)
  }
  if (søk) maskiner = maskiner.filter((m) => treffer(m, søk))

  // Søk treffer også maskiner ute av bruk – ellers ville en du leter
  // etter være usynlig nettopp fordi den er tatt ut.
  const inaktive = ((utAvBruk ?? []) as Maskin[]).filter(
    (m) => !søk || treffer(m, søk),
  )

  // Underkategoriene som er i bruk, som forslag i «Ny maskin».
  const typerIBruk = [
    ...new Set(
      alle.map((m) => m.underkategori?.trim()).filter((t): t is string => Boolean(t)),
    ),
  ].sort((a, b) => a.localeCompare(b, 'nb'))

  // Kategoriene som faktisk finnes, til filtervelgeren.
  const kategorierIBruk = [
    ...new Set(alle.map((m) => m.kategori?.trim() || UTEN)),
  ].sort((a, b) => (a === UTEN ? 1 : b === UTEN ? -1 : a.localeCompare(b, 'nb')))

  const filtrerer = søk !== '' || status !== 'alle' || kategoriFilter !== ''

  /** Bygger URL som beholder de andre valgene. */
  const lenke = (endring: Record<string, string>) => {
    const p = new URLSearchParams()
    if (søk) p.set('q', søk)
    if (status !== 'alle') p.set('status', status)
    if (kategoriFilter) p.set('kategori', kategoriFilter)
    for (const [k, v] of Object.entries(endring)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    const s = p.toString()
    return s ? `/admin/maskiner?${s}` : '/admin/maskiner'
  }

  // Grupper maskinene under kategorien sin. Rekkefølgen følger den admin
  // har satt under Innstillinger; maskiner uten kategori havner sist.
  const grupper = new Map<string, Maskin[]>()
  for (const navn of kategoriListe) grupper.set(navn, [])
  for (const m of maskiner) {
    const nøkkel = m.kategori?.trim() || UTEN
    if (!grupper.has(nøkkel)) grupper.set(nøkkel, [])
    grupper.get(nøkkel)!.push(m)
  }

  // Bare grupper som faktisk har maskiner. Uten-kategori alltid nederst.
  const seksjoner = [...grupper.entries()]
    .filter(([, liste]) => liste.length > 0)
    .sort((a, b) => {
      if (a[0] === UTEN) return 1
      if (b[0] === UTEN) return -1
      return 0
    })

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Seksjonstittel
          under={
            filtrerer
              ? `${maskiner.length} av ${alle.length} maskiner`
              : `${alle.length} registrert · kopier lenken til QR-generatoren`
          }
        >
          Maskiner
        </Seksjonstittel>

        {alle.length > 0 && (
          <a href="/api/maskiner/csv" className={KNAPP_SEKUNDÆR}>
            Last ned alle som CSV
          </a>
        )}
      </div>

      <NyMaskin kategorier={kategoriListe} typer={typerIBruk} />

      <Søkefelt
        verdi={søk}
        plassholder="Søk på navn, kode, internnummer, kategori eller notat"
      />

      <div className="flex flex-wrap items-center gap-2">
        {STATUSFILTRE.map((f) => {
          const aktiv = status === f.verdi
          return (
            <Link
              key={f.verdi}
              href={lenke({ status: f.verdi === 'alle' ? '' : f.verdi })}
              aria-current={aktiv ? 'true' : undefined}
              className={`inline-flex min-h-[2.75rem] items-center border-2 px-4 text-xs font-bold tracking-wider uppercase transition-colors ${
                aktiv
                  ? 'border-[var(--kant-sterk)] bg-hm-black text-white'
                  : 'border-[var(--kant)] bg-[var(--flate-opp)] hover:border-[var(--kant-sterk)]'
              }`}
            >
              {f.tekst}
            </Link>
          )
        })}

        {/* Nedtrekk framfor chips: elleve kategorier tok mer plass enn
            tabellen de filtrerte, og brøt over flere rader. */}
        {kategorierIBruk.length > 1 && (
          <div className="ml-auto">
            <Filtervelger
              navn="kategori"
              etikett="Kategori"
              alleTekst="Alle kategorier"
              valg={kategorierIBruk}
              valgt={kategoriFilter}
            />
          </div>
        )}

        {filtrerer && (
          <Link
            href="/admin/maskiner"
            className="text-sm font-semibold text-[var(--blekk-svak)] underline underline-offset-4"
          >
            Nullstill
          </Link>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          Kunne ikke hente maskiner: {error.message}
        </p>
      )}

      {!error && maskiner.length === 0 ? (
        filtrerer ? (
          <TomTilstand
            tittel="Ingen treff"
            handling={{ href: '/admin/maskiner', tekst: 'Nullstill' }}
          >
            {søk
              ? `Fant ingen maskin som matcher «${søk}».`
              : 'Ingen maskiner med dette filteret.'}
          </TomTilstand>
        ) : (
          <TomTilstand tittel="Ingen maskiner ennå">
            Legg inn den første, så får den en permanent URL du kan lage QR-kode
            av.
          </TomTilstand>
        )
      ) : (
        /*
         * Én tabell for alle kategoriene, med overskriftsrader mellom.
         * Med én tabell per kategori regnes kolonnebreddene ut på nytt
         * for hver, og «Kode» havner på ulikt sted nedover siden.
         */
        <div className="overflow-x-auto border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)]">
          <table className="w-full text-sm">
            <colgroup>
              <col />
              <col className="w-32" />
              <col className="w-40" />
              <col className="w-32" />
              <col className="w-40" />
            </colgroup>

            <thead className="bg-hm-black text-white">
              <tr>
                <Th>Maskin</Th>
                <Th>Kode</Th>
                <Th>Pris</Th>
                <Th>Status</Th>
                <Th>Lenke for QR</Th>
              </tr>
            </thead>

            {seksjoner.map(([kategori, liste]) => (
              <tbody key={kategori}>
                <tr className="border-y-2 border-[var(--kant-sterk)] bg-[var(--flate-2)]">
                  <th colSpan={5} scope="colgroup" className="px-4 py-2.5 text-left">
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="hm-skrastrek !h-1 !w-5" aria-hidden="true" />
                      <span className="hm-display text-lg">{kategori}</span>
                      <span className="hm-tall text-xs font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
                        {liste.length} {liste.length === 1 ? 'maskin' : 'maskiner'}
                      </span>
                      {/* Felles QR for hele kategorien – for utstyr som
                          ikke har kode per enhet, som skuffer. */}
                      {kategori !== UTEN && (
                        <KopierLenke
                          url={`${env.NEXT_PUBLIC_SITE_URL}/kategori/${encodeURIComponent(kategori)}`}
                          etikett="Felles QR for kategorien"
                        />
                      )}
                    </span>
                  </th>
                </tr>

                {liste.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--kant)]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/maskiner/${m.id}`}
                        className="hm-display inline-flex min-h-[2.75rem] items-center text-base underline underline-offset-4"
                      >
                        {m.navn}
                      </Link>
                      {m.internnummer && (
                        <div className="text-xs text-[var(--blekk-svak)]">
                          {m.internnummer}
                        </div>
                      )}
                    </td>
                    <td className="hm-tall px-4 py-3 font-mono text-xs">
                      {m.qr_kode}
                    </td>
                    <td className="hm-tall px-4 py-3 font-semibold">
                      {m.dogn_pris === null ? (
                        <span className="text-[var(--blekk-svak)]">–</span>
                      ) : (
                        <>
                          {m.dogn_pris.toLocaleString('nb-NO')} kr
                          <span className="font-normal text-[var(--blekk-svak)]">
                            {prisEnhet(m.pris_enhet) === 'time' ? ' / time' : ' / døgn'}
                          </span>
                          {!m.vis_pris && (
                            <span
                              className="ml-1.5 text-[10px] font-bold tracking-wider text-[var(--blekk-svak)] uppercase"
                              title="Prisen vises ikke for kunden"
                            >
                              skjult
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Merke type={merkeType[m.status]}>
                        {MASKIN_STATUS_TEKST[m.status]}
                      </Merke>
                    </td>
                    <td className="px-4 py-3">
                      <KopierLenke url={`${env.NEXT_PUBLIC_SITE_URL}/m/${m.qr_kode}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}

      {/* Uten dette blir en maskin som tas ut av bruk umulig å finne igjen. */}
      {inaktive.length > 0 && (
        <details className="border-2 border-[var(--kant)] bg-[var(--flate-opp)]">
          <summary className="cursor-pointer px-4 py-3 text-sm font-bold tracking-wider uppercase">
            Ute av bruk ({inaktive.length})
          </summary>
          <ul className="divide-y-2 divide-[var(--kant)] border-t-2 border-[var(--kant)]">
            {inaktive.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link
                  href={`/admin/maskiner/${m.id}`}
                  className="font-semibold underline underline-offset-4"
                >
                  {m.navn}
                </Link>
                <span className="hm-tall font-mono text-xs text-[var(--blekk-svak)]">
                  {m.qr_kode}
                </span>
                <span className="ml-auto text-xs text-[var(--blekk-svak)]">
                  Åpne for å ta i bruk igjen
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-[11px] font-bold tracking-widest uppercase">
      {children}
    </th>
  )
}
