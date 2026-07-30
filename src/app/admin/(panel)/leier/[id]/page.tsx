import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { signertBildeUrl } from '@/lib/bilder'
import { antallEtikett, antallTekst, beregnAntall, prisEnhet } from '@/lib/pris'
import { visTelefon } from '@/lib/telefon'
import { dato, tid } from '@/lib/dato'
import { LEIE_STATUS_TEKST, type Bilde, type Kunde, type Leie, type Maskin } from '@/lib/types'
import { KNAPP_SEKUNDÆR, Kort, KortTittel, Merke } from '@/components/ui'
import { GodkjennSkjema } from './godkjenn-skjema'
import { ManuellLevering } from './manuell-levering'
import { SlettLeie } from './slett-leie'
import { settFakturert } from './actions'

export const metadata: Metadata = { title: 'Leie – HM Utleie' }
export const dynamic = 'force-dynamic'

const merkeType = {
  aktiv: 'grønn',
  venter_godkjenning: 'gul',
  avsluttet: 'nøytral',
  avvist: 'rød',
} as const

export default async function LeieDetaljSide(props: PageProps<'/admin/leier/[id]'>) {
  await krevAdmin()
  const { id } = await props.params

  const supabase = await lagServerKlient()
  const { data } = await supabase
    .from('leier')
    .select('*, maskiner(*), kunder(*)')
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()
  const leie = data as Leie & { maskiner: Maskin | null; kunder: Kunde | null }

  const { data: bilderData } = await supabase
    .from('bilder')
    .select('*')
    .eq('leie_id', leie.id)
    .order('mottatt_tid')

  const bilder = (bilderData ?? []) as Bilde[]
  const medUrl = await Promise.all(
    bilder.map(async (b) => ({ ...b, url: await signertBildeUrl(b.fil_sti) })),
  )

  const { data: hendelser } = await supabase
    .from('hendelser')
    .select('*')
    .eq('leie_id', leie.id)
    .order('tid', { ascending: false })

  const sluttForBeregning = leie.slutt_tid ?? new Date().toISOString()
  const enhet = prisEnhet(leie.maskiner?.pris_enhet)
  const foreslattDogn = beregnAntall(leie.start_tid, sluttForBeregning, enhet)
  const foreslattBelop = leie.maskiner?.dogn_pris
    ? Math.round(foreslattDogn * leie.maskiner.dogn_pris)
    : null

  const fakturagrunnlag = [
    leie.kunder?.navn,
    leie.kunder?.adresse,
    leie.kunder?.epost,
    leie.kunder ? visTelefon(leie.kunder.telefon) : null,
    '',
    `${leie.referanse} – ${leie.maskiner?.navn ?? ''}`,
    antallTekst(leie.antall_dogn ?? foreslattDogn, enhet),
    leie.belop ? `${leie.belop.toLocaleString('nb-NO')} kr` : '',
  ]
    .filter((l) => l !== null && l !== undefined)
    .join('\n')

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/leier"
          className="inline-flex min-h-[2.75rem] items-center text-sm font-semibold text-[var(--blekk-svak)] underline underline-offset-4"
        >
          ← Alle leier
        </Link>
        <span className="hm-skrastrek mt-2 mb-3 block" aria-hidden="true" />
        <h1 className="hm-display text-3xl">
          {leie.maskiner?.navn ?? 'Ukjent maskin'}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="hm-tall font-mono text-sm text-[var(--blekk-svak)]">
            {leie.referanse}
          </span>
          <Merke type={merkeType[leie.status]}>
            {LEIE_STATUS_TEKST[leie.status]}
          </Merke>
        </div>
      </div>

      {leie.status === 'venter_godkjenning' && (
        <GodkjennSkjema
          leieId={leie.id}
          foreslattDogn={foreslattDogn}
          foreslattBelop={foreslattBelop}
          antallEtikett={antallEtikett(enhet)}
        />
      )}

      {leie.status === 'aktiv' && <ManuellLevering leieId={leie.id} />}

      <Kort>
        <KortTittel>Bilder</KortTittel>
        <div className="p-5">
          {medUrl.length === 0 ? (
            <p className="text-sm text-[var(--blekk-svak)]">Ingen bilder ennå.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {medUrl.map((b) => (
                <figure key={b.id}>
                  <div className="relative border-2 border-[var(--kant-sterk)]">
                    {b.url ? (
                      /* Signert URL som utløper – next/image ville cachet den feil. */
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={b.url}
                        alt={b.type === 'henting' ? 'Maskinen ved henting' : 'Maskinen ved levering'}
                        className="block w-full"
                      />
                    ) : (
                      <div className="p-8 text-center text-sm text-[var(--blekk-svak)]">
                        Kunne ikke hente bildet
                      </div>
                    )}
                    <figcaption className="absolute top-0 left-0 bg-hm-black px-2 py-1 text-[11px] font-bold tracking-wider text-white uppercase">
                      {b.type === 'henting' ? 'Henting' : 'Levering'}
                    </figcaption>
                  </div>
                  <p className="mt-2 text-xs text-[var(--blekk-svak)]">
                    {tid(b.mottatt_tid)}
                    {b.lat !== null && b.lng !== null && (
                      <>
                        {' · '}
                        <a
                          href={`https://www.google.com/maps?q=${b.lat},${b.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold underline underline-offset-2"
                        >
                          Se posisjon
                        </a>
                      </>
                    )}
                  </p>
                </figure>
              ))}
            </div>
          )}
        </div>
      </Kort>

      <div className="grid gap-6 lg:grid-cols-2">
        <Kort>
          <KortTittel>Kunde</KortTittel>
          <div className="p-5">
            {leie.kunder ? (
              <dl className="space-y-2.5 text-sm">
                <Rad navn="Navn" verdi={leie.kunder.navn} />
                <Rad navn="Mobil" verdi={visTelefon(leie.kunder.telefon)} />
                <Rad navn="E-post" verdi={leie.kunder.epost} />
                <Rad navn="Adresse" verdi={leie.kunder.adresse} />
                {leie.kunder.status === 'ny' && (
                  <p className="mt-3 border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-xs">
                    Ny kunde — ikke registrert hos dere fra før
                  </p>
                )}
              </dl>
            ) : (
              <p className="text-sm text-[var(--blekk-svak)]">Ingen kunde knyttet.</p>
            )}
          </div>
        </Kort>

        <Kort>
          <KortTittel>Leieperiode</KortTittel>
          <div className="p-5">
            <dl className="space-y-2.5 text-sm">
              <Rad navn="Startet" verdi={tid(leie.start_tid)} />
              <Rad navn="Forventet levering" verdi={dato(leie.planlagt_slutt)} />
              <Rad navn="Levert" verdi={leie.slutt_tid ? tid(leie.slutt_tid) : '–'} />
              <Rad
                navn={enhet === 'time' ? 'Timer' : 'Døgn'}
                verdi={leie.antall_dogn ?? `${foreslattDogn} (forslag)`}
              />
              <Rad
                navn="Beløp"
                verdi={
                  leie.belop
                    ? `${leie.belop.toLocaleString('nb-NO')} kr${leie.manuelt_justert ? ' (justert)' : ''}`
                    : foreslattBelop
                      ? `${foreslattBelop.toLocaleString('nb-NO')} kr (forslag)`
                      : '–'
                }
              />
            </dl>
          </div>
        </Kort>
      </div>

      {(leie.kommentar_start || leie.kommentar_retur || leie.avvik) && (
        <Kort>
          <KortTittel>Kommentarer</KortTittel>
          <dl className="space-y-3 p-5 text-sm">
            {leie.kommentar_start && (
              <Rad navn="Ved henting" verdi={leie.kommentar_start} />
            )}
            {leie.kommentar_retur && (
              <Rad navn="Ved levering" verdi={leie.kommentar_retur} />
            )}
            {leie.avvik && (
              <Rad
                navn="Avvik"
                verdi={<span className="text-hm-red-ink">{leie.avvik}</span>}
              />
            )}
          </dl>
        </Kort>
      )}

      {leie.status === 'avsluttet' && (
        <Kort>
          <KortTittel>Fakturagrunnlag</KortTittel>
          <div className="p-5">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <a
                href={`/api/faktura/${leie.id}`}
                className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[3rem] items-center gap-2 border-2 border-[var(--kant-sterk)] bg-hm-red px-5 text-sm font-bold tracking-wide text-white uppercase hover:bg-hm-red-hover"
              >
                <LastNed />
                Last ned PDF
              </a>
              <span className="text-xs text-[var(--blekk-svak)]">
                Med logo, kundeopplysninger og begge bildene — klar som vedlegg
              </span>
            </div>

            <pre className="overflow-x-auto border-2 border-[var(--kant)] bg-[var(--flate-2)] p-4 font-mono text-xs whitespace-pre-wrap">
              {fakturagrunnlag}
            </pre>

            <form
              action={settFakturert.bind(null, leie.id, !leie.fakturert)}
              className="mt-4"
            >
              <button
                type="submit"
                className={`${KNAPP_SEKUNDÆR} ${leie.fakturert ? 'border-hm-green text-hm-green' : ''}`}
              >
                {leie.fakturert ? '✓ Fakturert – angre' : 'Marker som fakturert'}
              </button>
            </form>
          </div>
        </Kort>
      )}

      {hendelser && hendelser.length > 0 && (
        <Kort>
          <KortTittel>Historikk</KortTittel>
          <ol className="p-5 text-sm">
            {hendelser.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap gap-x-4 gap-y-0.5 border-l-2 border-[var(--kant)] py-2 pl-4"
              >
                <span className="hm-tall text-[var(--blekk-svak)]">{tid(h.tid)}</span>
                <span className="font-semibold">{h.beskrivelse || h.type}</span>
                <span className="w-full text-xs text-[var(--blekk-svak)]">
                  {h.aktor}
                </span>
              </li>
            ))}
          </ol>
        </Kort>
      )}

      <SlettLeie
        leieId={leie.id}
        referanse={leie.referanse}
        fakturert={leie.fakturert}
      />
    </div>
  )
}

function LastNed() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  )
}

function Rad({ navn, verdi }: { navn: string; verdi: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-xs font-bold tracking-widest text-[var(--blekk-svak)] uppercase">
        {navn}
      </dt>
      <dd className="hm-tall text-right font-semibold">{verdi}</dd>
    </div>
  )
}

