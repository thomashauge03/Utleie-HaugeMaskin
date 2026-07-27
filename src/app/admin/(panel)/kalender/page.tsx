import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import type { Kunde, Leie, Maskin } from '@/lib/types'
import { KopierLenke } from '../maskiner/kopier-lenke'

export const metadata: Metadata = { title: 'Kalender – Utleie' }
export const dynamic = 'force-dynamic'

type Rad = Leie & { maskiner: Maskin | null; kunder: Kunde | null }

const MND = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]

/** Dagnummer i måneden, klemt inn i [1, antallDager]. */
function klem(dato: Date, år: number, måned: number, antallDager: number) {
  if (dato.getFullYear() < år || (dato.getFullYear() === år && dato.getMonth() < måned)) {
    return 1
  }
  if (dato.getFullYear() > år || (dato.getFullYear() === år && dato.getMonth() > måned)) {
    return antallDager
  }
  return dato.getDate()
}

export default async function KalenderSide(props: PageProps<'/admin/kalender'>) {
  await krevAdmin()
  const sp = await props.searchParams

  const nå = new Date()
  const år = Number(sp.ar) || nå.getFullYear()
  const måned = sp.mnd !== undefined ? Number(sp.mnd) : nå.getMonth()

  const førsteDag = new Date(år, måned, 1)
  const sisteDag = new Date(år, måned + 1, 0)
  const antallDager = sisteDag.getDate()

  const supabase = await lagServerKlient()

  // Alle leier som overlapper måneden.
  const { data } = await supabase
    .from('leier')
    .select('*, maskiner(*), kunder(*)')
    .lte('start_tid', new Date(år, måned + 1, 0, 23, 59, 59).toISOString())
    .order('start_tid')

  const alle = (data ?? []) as Rad[]
  const leier = alle.filter((l) => {
    const slutt = new Date(l.slutt_tid ?? l.planlagt_slutt)
    return slutt >= førsteDag
  })

  const { data: innstillinger } = await supabase
    .from('innstillinger')
    .select('ical_token')
    .maybeSingle()

  // Grupper per maskin
  const perMaskin = new Map<string, { maskin: Maskin; leier: Rad[] }>()
  for (const l of leier) {
    if (!l.maskiner) continue
    const eksisterende = perMaskin.get(l.maskiner.id)
    if (eksisterende) eksisterende.leier.push(l)
    else perMaskin.set(l.maskiner.id, { maskin: l.maskiner, leier: [l] })
  }
  const rader = [...perMaskin.values()].sort((a, b) =>
    a.maskin.navn.localeCompare(b.maskin.navn, 'nb'),
  )

  const forrige = new Date(år, måned - 1, 1)
  const neste = new Date(år, måned + 1, 1)
  const iDag = new Date()
  const erInneværende = iDag.getFullYear() === år && iDag.getMonth() === måned

  const icalUrl = innstillinger?.ical_token
    ? `${env.NEXT_PUBLIC_SITE_URL}/api/ical/${innstillinger.ical_token}.ics`
    : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {MND[måned]} {år}
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/admin/kalender?ar=${forrige.getFullYear()}&mnd=${forrige.getMonth()}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 transition hover:bg-white dark:border-slate-700 dark:hover:bg-slate-900"
          >
            ← Forrige
          </Link>
          <Link
            href="/admin/kalender"
            className="rounded-lg border border-slate-300 px-3 py-1.5 transition hover:bg-white dark:border-slate-700 dark:hover:bg-slate-900"
          >
            I dag
          </Link>
          <Link
            href={`/admin/kalender?ar=${neste.getFullYear()}&mnd=${neste.getMonth()}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 transition hover:bg-white dark:border-slate-700 dark:hover:bg-slate-900"
          >
            Neste →
          </Link>
        </div>
      </div>

      {rader.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Ingen utleie denne måneden.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-[720px]">
            {/* Datolinje */}
            <div className="mb-2 flex gap-2">
              <div className="w-44 shrink-0" />
              <div
                className="grid flex-1 gap-px text-center text-[10px] text-slate-400"
                style={{ gridTemplateColumns: `repeat(${antallDager}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: antallDager }, (_, i) => (
                  <div
                    key={i}
                    className={
                      erInneværende && i + 1 === iDag.getDate()
                        ? 'font-bold text-slate-900 dark:text-slate-100'
                        : ''
                    }
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>

            {rader.map(({ maskin, leier: maskinLeier }) => (
              <div key={maskin.id} className="mb-1.5 flex items-center gap-2">
                <div className="w-44 shrink-0 truncate text-sm" title={maskin.navn}>
                  {maskin.navn}
                </div>
                <div
                  className="relative grid flex-1 gap-px"
                  style={{
                    gridTemplateColumns: `repeat(${antallDager}, minmax(0, 1fr))`,
                  }}
                >
                  {/* Bakgrunnsruter */}
                  {Array.from({ length: antallDager }, (_, i) => (
                    <div
                      key={i}
                      className="h-8 rounded-sm bg-slate-100 dark:bg-slate-800"
                    />
                  ))}

                  {maskinLeier.map((l) => {
                    const start = klem(new Date(l.start_tid), år, måned, antallDager)
                    const slutt = klem(
                      new Date(l.slutt_tid ?? l.planlagt_slutt),
                      år,
                      måned,
                      antallDager,
                    )
                    const forfalt =
                      l.status === 'aktiv' &&
                      new Date(l.planlagt_slutt).getTime() < Date.now()

                    const farge = forfalt
                      ? 'bg-red-500 hover:bg-red-600'
                      : l.status === 'venter_godkjenning'
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : l.status === 'aktiv'
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-slate-400 hover:bg-slate-500'

                    return (
                      <Link
                        key={l.id}
                        href={`/admin/leier/${l.id}`}
                        title={`${l.kunder?.navn ?? ''} · ${l.referanse}`}
                        className={`absolute top-0 flex h-8 items-center overflow-hidden rounded-sm px-2 text-[11px] font-medium text-white transition ${farge}`}
                        style={{
                          gridColumn: `${start} / ${slutt + 1}`,
                          left: `${((start - 1) / antallDager) * 100}%`,
                          width: `${((slutt - start + 1) / antallDager) * 100}%`,
                        }}
                      >
                        <span className="truncate">{l.kunder?.navn ?? l.referanse}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <Prikk farge="bg-green-600" tekst="Aktiv" />
        <Prikk farge="bg-red-500" tekst="Forfalt" />
        <Prikk farge="bg-amber-500" tekst="Venter godkjenning" />
        <Prikk farge="bg-slate-400" tekst="Avsluttet" />
      </div>

      {icalUrl && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-medium">Abonner i din egen kalender</h2>
          <p className="mt-1 mb-3 text-sm text-slate-600 dark:text-slate-400">
            Legg denne lenken til som kalenderabonnement i Google Kalender,
            Outlook eller Apple Kalender, så dukker alle utleier opp der du
            allerede holder til – også på mobil.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded bg-slate-100 px-2 py-1 text-xs break-all dark:bg-slate-800">
              {icalUrl}
            </code>
            <KopierLenke url={icalUrl} etikett="Kopier" />
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Lenken inneholder kundenavn og telefonnummer. Del den kun internt.
          </p>
        </div>
      )}
    </div>
  )
}

function Prikk({ farge, tekst }: { farge: string; tekst: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block size-3 rounded-sm ${farge}`} />
      {tekst}
    </span>
  )
}
