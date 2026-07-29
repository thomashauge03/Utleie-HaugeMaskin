import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { visTelefon } from '@/lib/telefon'
import { LEIE_STATUS_TEKST, type Kunde, type Leie, type Maskin } from '@/lib/types'
import { Merke, Seksjonstittel, TomTilstand } from '@/components/ui'

export const metadata: Metadata = { title: 'Kalender – HM Utleie' }
export const dynamic = 'force-dynamic'

type Rad = Leie & { maskiner: Maskin | null; kunder: Kunde | null }

const MND = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]
const UKEDAG = ['S', 'M', 'T', 'O', 'T', 'F', 'L']

/** Dagnummer i måneden, klemt inn i [1, antallDager]. */
function klem(d: Date, år: number, måned: number, antallDager: number) {
  if (d.getFullYear() < år || (d.getFullYear() === år && d.getMonth() < måned)) return 1
  if (d.getFullYear() > år || (d.getFullYear() === år && d.getMonth() > måned)) return antallDager
  return d.getDate()
}

function erForfalt(l: Leie) {
  return l.status === 'aktiv' && new Date(l.planlagt_slutt).getTime() < Date.now()
}

/** Fargen brukes både i tidslinja og i lista, så de leses som det samme. */
function farge(l: Leie) {
  if (erForfalt(l)) return 'bg-hm-red'
  if (l.status === 'venter_godkjenning') return 'bg-hm-amber'
  if (l.status === 'aktiv') return 'bg-hm-green'
  return 'bg-hm-500'
}

const kortDato = (iso: string) =>
  new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })

export default async function KalenderSide(props: PageProps<'/admin/kalender'>) {
  await krevAdmin()
  const sp = await props.searchParams

  const nå = new Date()
  const år = Number(sp.ar) || nå.getFullYear()
  const måned = sp.mnd !== undefined ? Number(sp.mnd) : nå.getMonth()

  const førsteDag = new Date(år, måned, 1)
  const antallDager = new Date(år, måned + 1, 0).getDate()

  const supabase = await lagServerKlient()
  const { data } = await supabase
    .from('leier')
    .select('*, maskiner(*), kunder(*)')
    .lte('start_tid', new Date(år, måned + 1, 0, 23, 59, 59).toISOString())
    .order('start_tid')

  const leier = ((data ?? []) as Rad[]).filter(
    (l) => new Date(l.slutt_tid ?? l.planlagt_slutt) >= førsteDag,
  )

  const perMaskin = new Map<string, { maskin: Maskin; leier: Rad[] }>()
  for (const l of leier) {
    if (!l.maskiner) continue
    const e = perMaskin.get(l.maskiner.id)
    if (e) e.leier.push(l)
    else perMaskin.set(l.maskiner.id, { maskin: l.maskiner, leier: [l] })
  }
  const rader = [...perMaskin.values()].sort((a, b) =>
    a.maskin.navn.localeCompare(b.maskin.navn, 'nb'),
  )

  const forrige = new Date(år, måned - 1, 1)
  const neste = new Date(år, måned + 1, 1)
  const iDag = new Date()
  const dagIDag =
    iDag.getFullYear() === år && iDag.getMonth() === måned ? iDag.getDate() : null

  const kolonner = `repeat(${antallDager}, minmax(0, 1fr))`
  const navLenke =
    'inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant)] bg-[var(--flate-opp)] px-3 text-xs font-bold tracking-wider uppercase transition-colors hover:border-[var(--kant-sterk)]'

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Seksjonstittel
          under={`${leier.length} ${leier.length === 1 ? 'leie' : 'leier'} i denne måneden`}
        >
          {`${MND[måned]} ${år}`}
        </Seksjonstittel>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/kalender?ar=${forrige.getFullYear()}&mnd=${forrige.getMonth()}`}
            className={navLenke}
          >
            ← Forrige
          </Link>
          <Link href="/admin/kalender" className={navLenke}>
            I dag
          </Link>
          <Link
            href={`/admin/kalender?ar=${neste.getFullYear()}&mnd=${neste.getMonth()}`}
            className={navLenke}
          >
            Neste →
          </Link>
        </div>
      </div>

      {rader.length === 0 ? (
        <TomTilstand tittel="Ingen utleie denne måneden">
          Bla til en annen måned, eller vent til neste maskin blir skannet.
        </TomTilstand>
      ) : (
        <>
          {/* ── Tidslinje ─────────────────────────────────── */}
          <div className="overflow-x-auto border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-4">
            <div className="min-w-[780px]">
              {/* Ukedag over dagnummer – uten den er det umulig å se
                  hvilken dato en stolpe faktisk gjelder. */}
              <div className="mb-1.5 flex gap-3">
                <div className="w-48 shrink-0" />
                <div
                  className="hm-tall grid flex-1 gap-px text-center"
                  style={{ gridTemplateColumns: kolonner }}
                >
                  {Array.from({ length: antallDager }, (_, i) => {
                    const d = new Date(år, måned, i + 1)
                    const helg = d.getDay() === 0 || d.getDay() === 6
                    const idag = dagIDag === i + 1
                    return (
                      <div
                        key={i}
                        className={
                          idag
                            ? 'text-hm-red'
                            : helg
                              ? 'text-[var(--blekk-svak)]'
                              : ''
                        }
                      >
                        <div className="text-[9px] leading-tight font-bold uppercase opacity-70">
                          {UKEDAG[d.getDay()]}
                        </div>
                        <div className={`text-[11px] leading-tight ${idag ? 'font-bold' : ''}`}>
                          {i + 1}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {rader.map(({ maskin, leier: maskinLeier }) => (
                <div key={maskin.id} className="mb-1.5 flex items-center gap-3">
                  <div
                    className="w-48 shrink-0 truncate text-sm font-semibold"
                    title={maskin.navn}
                  >
                    {maskin.navn}
                  </div>

                  <div className="relative flex-1">
                    {/* Bakgrunn: én rute per dag. Helg og i dag markert. */}
                    <div className="grid gap-px" style={{ gridTemplateColumns: kolonner }}>
                      {Array.from({ length: antallDager }, (_, i) => {
                        const d = new Date(år, måned, i + 1)
                        const helg = d.getDay() === 0 || d.getDay() === 6
                        return (
                          <div
                            key={i}
                            className={`h-9 ${
                              dagIDag === i + 1
                                ? 'bg-hm-red/25'
                                : helg
                                  ? 'bg-[var(--kant)]'
                                  : 'bg-[var(--flate-2)]'
                            }`}
                          />
                        )
                      })}
                    </div>

                    {/* Leiene i samme rutenett, lagt oppå bakgrunnen. */}
                    <div
                      className="pointer-events-none absolute inset-0 grid gap-px"
                      style={{ gridTemplateColumns: kolonner }}
                    >
                      {maskinLeier.map((l) => {
                        const fra = klem(new Date(l.start_tid), år, måned, antallDager)
                        const til = klem(
                          new Date(l.slutt_tid ?? l.planlagt_slutt),
                          år,
                          måned,
                          antallDager,
                        )
                        return (
                          <Link
                            key={l.id}
                            href={`/admin/leier/${l.id}`}
                            title={`${maskin.navn} · ${l.kunder?.navn ?? ''} · ${kortDato(l.start_tid)}–${kortDato(l.slutt_tid ?? l.planlagt_slutt)}`}
                            style={{ gridColumn: `${fra} / ${til + 1}` }}
                            className={`pointer-events-auto flex h-9 items-center overflow-hidden border border-[var(--kant-sterk)] px-1.5 text-[11px] font-bold text-white ${farge(l)}`}
                          >
                            <span className="truncate">
                              {l.kunder?.navn ?? l.referanse}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
            <Prikk farge="bg-hm-green" tekst="Aktiv" />
            <Prikk farge="bg-hm-red" tekst="Forfalt" />
            <Prikk farge="bg-hm-amber" tekst="Venter godkjenning" />
            <Prikk farge="bg-hm-500" tekst="Avsluttet" />
            <Prikk farge="bg-[var(--kant)]" tekst="Helg" />
          </div>

          {/* ── Én og én, med datoene skrevet ut ──────────── */}
          <div>
            <h2 className="hm-display mb-1 text-2xl">Leier i {MND[måned]}</h2>
            <p className="mb-4 text-sm text-[var(--blekk-svak)]">
              Samme utleie som i tidslinja, men med datoene skrevet ut.
            </p>

            <ol className="space-y-3">
              {[...leier]
                .sort((a, b) => a.start_tid.localeCompare(b.start_tid))
                .map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/admin/leier/${l.id}`}
                      className="hm-trykk hm-kant-skygge-sm flex flex-wrap items-center gap-x-5 gap-y-3 border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-4"
                    >
                      <span
                        className={`hm-display hm-tall shrink-0 border-2 border-[var(--kant-sterk)] px-3 py-1.5 text-base whitespace-nowrap text-white ${farge(l)}`}
                      >
                        {kortDato(l.start_tid)} → {kortDato(l.slutt_tid ?? l.planlagt_slutt)}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="hm-display block truncate text-lg">
                          {l.maskiner?.navn ?? 'Ukjent maskin'}
                        </span>
                        <span className="block text-sm text-[var(--blekk-svak)]">
                          {l.kunder?.navn ?? '–'}
                          {l.kunder && ` · ${visTelefon(l.kunder.telefon)}`}
                        </span>
                      </span>

                      <span className="flex flex-wrap items-center gap-3">
                        {erForfalt(l) && <Merke type="rød">Forfalt</Merke>}
                        <Merke
                          type={
                            l.status === 'aktiv'
                              ? 'grønn'
                              : l.status === 'venter_godkjenning'
                                ? 'gul'
                                : 'nøytral'
                          }
                        >
                          {LEIE_STATUS_TEKST[l.status]}
                        </Merke>
                        <span className="hm-tall font-mono text-xs text-[var(--blekk-svak)]">
                          {l.referanse}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
            </ol>
          </div>
        </>
      )}
    </div>
  )
}

function Prikk({ farge: f, tekst }: { farge: string; tekst: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block size-3 border border-[var(--kant-sterk)] ${f}`} />
      {tekst}
    </span>
  )
}
