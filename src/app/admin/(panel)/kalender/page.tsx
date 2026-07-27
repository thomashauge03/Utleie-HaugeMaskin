import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import type { Kunde, Leie, Maskin } from '@/lib/types'
import { KopierLenke } from '../maskiner/kopier-lenke'

export const metadata: Metadata = { title: 'Kalender – HM Utleie' }
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
        <div>
          <span className="hm-skrastrek mb-3" aria-hidden="true" />
          <h1 className="hm-display text-3xl">
            {MND[måned]} {år}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/admin/kalender?ar=${forrige.getFullYear()}&mnd=${forrige.getMonth()}`}
            className="inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant)] bg-[var(--flate-opp)] px-3 text-xs font-bold tracking-wider uppercase transition-colors hover:border-[var(--kant-sterk)]"
          >
            ← Forrige
          </Link>
          <Link
            href="/admin/kalender"
            className="inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant)] bg-[var(--flate-opp)] px-3 text-xs font-bold tracking-wider uppercase transition-colors hover:border-[var(--kant-sterk)]"
          >
            I dag
          </Link>
          <Link
            href={`/admin/kalender?ar=${neste.getFullYear()}&mnd=${neste.getMonth()}`}
            className="inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant)] bg-[var(--flate-opp)] px-3 text-xs font-bold tracking-wider uppercase transition-colors hover:border-[var(--kant-sterk)]"
          >
            Neste →
          </Link>
        </div>
      </div>

      {rader.length === 0 ? (
        <div className="border-2 border-dashed border-[var(--kant)] p-12 text-center text-sm text-[var(--blekk-svak)]">
          Ingen utleie denne måneden.
        </div>
      ) : (
        <div className="overflow-x-auto border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-4">
          <div className="min-w-[720px]">
            {/* Datolinje */}
            <div className="mb-2 flex gap-2">
              <div className="w-44 shrink-0" />
              <div
                className="hm-tall grid flex-1 gap-px text-center text-[10px] text-[var(--blekk-svak)]"
                style={{ gridTemplateColumns: `repeat(${antallDager}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: antallDager }, (_, i) => (
                  <div
                    key={i}
                    className={
                      erInneværende && i + 1 === iDag.getDate()
                        ? 'font-bold text-hm-red'
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
                <div className="w-44 shrink-0 truncate text-sm font-semibold" title={maskin.navn}>
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
                      className="h-8 bg-[var(--flate-2)]"
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
                      ? 'bg-hm-red hover:bg-hm-red-hover'
                      : l.status === 'venter_godkjenning'
                        ? 'bg-hm-amber hover:brightness-90'
                        : l.status === 'aktiv'
                          ? 'bg-hm-green hover:brightness-90'
                          : 'bg-hm-500 hover:bg-hm-700'

                    return (
                      <Link
                        key={l.id}
                        href={`/admin/leier/${l.id}`}
                        title={`${l.kunder?.navn ?? ''} · ${l.referanse}`}
                        className={`absolute top-0 flex h-8 items-center overflow-hidden border-2 border-[var(--flate-opp)] px-2 text-[11px] font-bold text-white transition ${farge}`}
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

      <div className="flex flex-wrap items-center gap-4 text-xs font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
        <Prikk farge="bg-hm-green" tekst="Aktiv" />
        <Prikk farge="bg-hm-red" tekst="Forfalt" />
        <Prikk farge="bg-hm-amber" tekst="Venter godkjenning" />
        <Prikk farge="bg-hm-500" tekst="Avsluttet" />
      </div>

      {icalUrl && (
        <div className="border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-5">
          <h2 className="hm-display text-xl">Abonner i din egen kalender</h2>
          <p className="mt-1 mb-3 text-sm text-[var(--blekk-svak)]">
            Legg denne lenken til som kalenderabonnement i Google Kalender,
            Outlook eller Apple Kalender, så dukker alle utleier opp der du
            allerede holder til – også på mobil.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="border-2 border-[var(--kant)] bg-[var(--flate-2)] px-2 py-1 font-mono text-xs break-all">
              {icalUrl}
            </code>
            <KopierLenke url={icalUrl} etikett="Kopier" />
          </div>
          <p className="mt-3 text-xs text-[var(--blekk-svak)]">
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
