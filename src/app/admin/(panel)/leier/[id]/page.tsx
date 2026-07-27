import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { signertBildeUrl, beregnDogn } from '@/lib/bilder'
import { visTelefon } from '@/lib/telefon'
import { LEIE_STATUS_TEKST, type Bilde, type Kunde, type Leie, type Maskin } from '@/lib/types'
import { GodkjennSkjema } from './godkjenn-skjema'
import { settFakturert } from './actions'

export const metadata: Metadata = { title: 'Leie – Utleie' }
export const dynamic = 'force-dynamic'

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
  const foreslattDogn = beregnDogn(leie.start_tid, sluttForBeregning)
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
    `${leie.antall_dogn ?? foreslattDogn} døgn`,
    leie.belop ? `${leie.belop.toLocaleString('nb-NO')} kr` : '',
  ]
    .filter((l) => l !== null && l !== undefined)
    .join('\n')

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/leier"
          className="text-sm text-slate-500 underline underline-offset-4 dark:text-slate-400"
        >
          ← Alle leier
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {leie.maskiner?.navn ?? 'Ukjent maskin'}
        </h1>
        <p className="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">
          {leie.referanse} · {LEIE_STATUS_TEKST[leie.status]}
        </p>
      </div>

      {leie.status === 'venter_godkjenning' && (
        <GodkjennSkjema
          leieId={leie.id}
          foreslattDogn={foreslattDogn}
          foreslattBelop={foreslattBelop}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Kort tittel="Kunde">
          {leie.kunder ? (
            <dl className="space-y-2 text-sm">
              <Rad navn="Navn" verdi={leie.kunder.navn} />
              <Rad navn="Mobil" verdi={visTelefon(leie.kunder.telefon)} />
              <Rad navn="E-post" verdi={leie.kunder.epost} />
              <Rad navn="Adresse" verdi={leie.kunder.adresse} />
              {leie.kunder.status === 'ny' && (
                <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  Ny kunde – ikke tidligere registrert
                </p>
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Ingen kunde knyttet.</p>
          )}
        </Kort>

        <Kort tittel="Leieperiode">
          <dl className="space-y-2 text-sm">
            <Rad navn="Startet" verdi={tid(leie.start_tid)} />
            <Rad navn="Forventet levering" verdi={dato(leie.planlagt_slutt)} />
            <Rad navn="Levert" verdi={leie.slutt_tid ? tid(leie.slutt_tid) : '–'} />
            <Rad
              navn="Døgn"
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
        </Kort>
      </div>

      {(leie.kommentar_start || leie.kommentar_retur || leie.avvik) && (
        <Kort tittel="Kommentarer">
          <dl className="space-y-3 text-sm">
            {leie.kommentar_start && (
              <Rad navn="Ved henting" verdi={leie.kommentar_start} />
            )}
            {leie.kommentar_retur && (
              <Rad navn="Ved levering" verdi={leie.kommentar_retur} />
            )}
            {leie.avvik && (
              <Rad
                navn="Avvik"
                verdi={<span className="text-red-600 dark:text-red-400">{leie.avvik}</span>}
              />
            )}
          </dl>
        </Kort>
      )}

      <Kort tittel="Bilder">
        {medUrl.length === 0 ? (
          <p className="text-sm text-slate-500">Ingen bilder ennå.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {medUrl.map((b) => (
              <figure key={b.id}>
                {b.url ? (
                  /* Signert URL som utløper – next/image ville cachet den feil. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={b.url}
                    alt={b.type === 'henting' ? 'Ved henting' : 'Ved levering'}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
                    Kunne ikke hente bildet
                  </div>
                )}
                <figcaption className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium">
                    {b.type === 'henting' ? 'Ved henting' : 'Ved levering'}
                  </span>
                  {' · '}
                  {tid(b.mottatt_tid)}
                  {b.lat !== null && b.lng !== null && (
                    <>
                      {' · '}
                      <a
                        href={`https://www.google.com/maps?q=${b.lat},${b.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        Se posisjon
                      </a>
                    </>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </Kort>

      {leie.status === 'avsluttet' && (
        <Kort tittel="Fakturering">
          <pre className="mb-4 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs whitespace-pre-wrap dark:bg-slate-800">
            {fakturagrunnlag}
          </pre>
          <form action={settFakturert.bind(null, leie.id, !leie.fakturert)}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {leie.fakturert ? '✓ Fakturert – angre' : 'Marker som fakturert'}
            </button>
          </form>
        </Kort>
      )}

      {hendelser && hendelser.length > 0 && (
        <Kort tittel="Historikk">
          <ol className="space-y-2 text-sm">
            {hendelser.map((h) => (
              <li key={h.id} className="flex flex-wrap gap-x-3 text-slate-600 dark:text-slate-400">
                <span className="tabular-nums">{tid(h.tid)}</span>
                <span className="text-slate-900 dark:text-slate-200">
                  {h.beskrivelse || h.type}
                </span>
                <span className="text-xs">{h.aktor}</span>
              </li>
            ))}
          </ol>
        </Kort>
      )}
    </div>
  )
}

function Kort({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 font-medium">{tittel}</h2>
      {children}
    </section>
  )
}

function Rad({ navn, verdi }: { navn: string; verdi: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-slate-500 dark:text-slate-400">{navn}</dt>
      <dd className="text-right font-medium">{verdi}</dd>
    </div>
  )
}

const dato = (iso: string) => new Date(iso).toLocaleDateString('nb-NO')
const tid = (iso: string) =>
  new Date(iso).toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
