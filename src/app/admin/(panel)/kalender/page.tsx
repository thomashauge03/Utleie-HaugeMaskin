import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { visTelefon } from '@/lib/telefon'
import { datoKort, osloDag } from '@/lib/dato'
import { LEIE_STATUS_TEKST, erForfalt, type Kunde, type Leie, type Maskin } from '@/lib/types'
import { Merke, Seksjonstittel, TomTilstand } from '@/components/ui'

export const metadata: Metadata = { title: 'Kalender – HM Utleie' }
export const dynamic = 'force-dynamic'

type Rad = Leie & { maskiner: Maskin | null; kunder: Kunde | null }

const MND = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]
// Uka starter på mandag i Norge.
const UKEDAGER = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']

/** Date.getDay() har søndag som 0. Vi vil ha mandag som 0. */
const ukedagIndeks = (d: Date) => (d.getDay() + 6) % 7

/**
 * Civil dato yyyy-mm-dd for en rutenettcelle. Cellene bygges på
 * server-lokal midnatt, så samme lokale getter gir tallene tilbake
 * uansett tidssone. Leiene bøttes på Oslo-dato (osloDag), så de havner
 * på riktig dag også når serveren er UTC.
 */
const celleDag = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Farge per status. Brukes både i rutenettet og i lista under. */
function farge(l: Leie) {
  if (erForfalt(l)) return 'bg-hm-red text-white'
  if (l.status === 'venter_godkjenning') return 'bg-hm-amber text-white'
  if (l.status === 'aktiv') return 'bg-hm-green text-white'
  return 'bg-hm-500 text-white'
}

export default async function KalenderSide(props: PageProps<'/admin/kalender'>) {
  await krevAdmin()
  const sp = await props.searchParams

  const nå = new Date()
  const år = Number(sp.ar) || nå.getFullYear()
  const måned = sp.mnd !== undefined ? Number(sp.mnd) : nå.getMonth()

  const førsteIMnd = new Date(år, måned, 1)
  const antallDager = new Date(år, måned + 1, 0).getDate()

  const supabase = await lagServerKlient()
  const { data } = await supabase
    .from('leier')
    .select('*, maskiner(*), kunder(*)')
    .lte('start_tid', new Date(år, måned + 1, 0, 23, 59, 59).toISOString())
    .order('start_tid')

  // Aktive leier regnes som pågående til i dag, ikke bare til avtalt dato.
  const leier = ((data ?? []) as Rad[]).filter((l) => {
    const slutt =
      l.status === 'aktiv'
        ? new Date(Math.max(new Date(l.planlagt_slutt).getTime(), Date.now()))
        : new Date(l.slutt_tid ?? l.planlagt_slutt)
    return slutt >= førsteIMnd
  })

  /*
   * Rutenettet starter på mandagen i uka der den 1. faller, og fylles
   * ut til hele uker. Da får hver kolonne alltid samme ukedag.
   */
  const førFørste = ukedagIndeks(førsteIMnd)
  const totaltRuter = Math.ceil((førFørste + antallDager) / 7) * 7

  const iDag = osloDag(new Date())

  const ruter = Array.from({ length: totaltRuter }, (_, i) => {
    const d = new Date(år, måned, i - førFørste + 1)
    const iMåneden = d.getMonth() === måned && d.getFullYear() === år
    const dag = celleDag(d)

    const påDagen = leier.filter((l) => {
      const fra = osloDag(l.start_tid)
      /*
       * En aktiv leie står ute til den faktisk leveres. Stoppet vi på
       * avtalt dato, ville nettopp de dagene maskinen er på overtid
       * mangle i kalenderen – som er de dagene man trenger å se.
       */
      const til =
        l.status === 'aktiv'
          ? osloDag(new Date(Math.max(new Date(l.planlagt_slutt).getTime(), Date.now())))
          : osloDag(l.slutt_tid ?? l.planlagt_slutt)
      // ISO-datoer kan sammenlignes som tekst.
      return dag >= fra && dag <= til
    })

    return { dato: d, dag, iMåneden, leier: påDagen }
  })
  const forrige = new Date(år, måned - 1, 1)
  const neste = new Date(år, måned + 1, 1)

  const navLenke =
    'inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant)] bg-[var(--flate-opp)] px-3 text-xs font-bold tracking-wider uppercase transition-colors hover:border-[var(--kant-sterk)]'

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Seksjonstittel
          under={`${leier.length} ${leier.length === 1 ? 'leie' : 'leier'} berører denne måneden`}
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

      {/* ── Månedsrutenett ────────────────────────────────── */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-7 gap-px border-2 border-[var(--kant-sterk)] bg-[var(--kant-sterk)]">
            {UKEDAGER.map((d) => (
              <div
                key={d}
                className="bg-hm-black px-2 py-2 text-center text-[11px] font-bold tracking-widest text-white uppercase"
              >
                {d}
              </div>
            ))}

            {ruter.map(({ dato, dag, iMåneden, leier: påDagen }, i) => {
              const erIDag = dag === iDag
              const helg = ukedagIndeks(dato) >= 5

              return (
                <div
                  key={i}
                  className={`min-h-[7.5rem] p-1.5 ${
                    !iMåneden
                      ? 'bg-[var(--flate-2)] opacity-45'
                      : erIDag
                        ? 'bg-hm-red/10'
                        : helg
                          ? 'bg-[var(--flate-2)]'
                          : 'bg-[var(--flate-opp)]'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className={`hm-tall inline-flex size-6 items-center justify-center text-sm font-bold ${
                        erIDag ? 'bg-hm-red text-white' : ''
                      }`}
                    >
                      {dato.getDate()}
                    </span>
                    {påDagen.length > 0 && (
                      <span className="hm-tall text-[10px] font-bold text-[var(--blekk-svak)]">
                        {påDagen.length}
                      </span>
                    )}
                  </div>

                  <ul className="space-y-1">
                    {påDagen.slice(0, 3).map((l) => {
                      // Er dagen etter avtalt levering, står maskinen på overtid.
                      const påOvertid =
                        l.status === 'aktiv' && dag > osloDag(l.planlagt_slutt)

                      return (
                        <li key={l.id}>
                          <Link
                            href={`/admin/leier/${l.id}`}
                            title={`${l.maskiner?.navn} · ${l.kunder?.navn ?? ''} · ${datoKort(l.start_tid)}–${datoKort(l.slutt_tid ?? l.planlagt_slutt)}`}
                            className={`block truncate border border-[var(--kant-sterk)] px-1.5 py-1 text-[11px] leading-tight font-bold ${farge(l)}`}
                          >
                            {påOvertid && '⚠ '}
                            {l.maskiner?.navn ?? l.referanse}
                          </Link>
                        </li>
                      )
                    })}

                    {påDagen.length > 3 && (
                      <li className="px-1 text-[10px] font-bold text-[var(--blekk-svak)]">
                        +{påDagen.length - 3} til
                      </li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
        <Prikk farge="bg-hm-green" tekst="Utleid" />
        <Prikk farge="bg-hm-red" tekst="Forfalt · ⚠ = dag på overtid" />
        <Prikk farge="bg-hm-amber" tekst="Venter godkjenning" />
        <Prikk farge="bg-hm-500" tekst="Avsluttet" />
      </div>

      {/* ── Én og én, med datoene skrevet ut ──────────────── */}
      {leier.length === 0 ? (
        <TomTilstand tittel="Ingen utleie denne måneden">
          Bla til en annen måned, eller vent til neste maskin blir skannet.
        </TomTilstand>
      ) : (
        <div>
          <h2 className="hm-display mb-1 text-2xl">Leier i {MND[måned]}</h2>
          <p className="mb-4 text-sm text-[var(--blekk-svak)]">
            Samme utleie som i rutenettet, med datoene skrevet ut.
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
                      className={`hm-display hm-tall shrink-0 border-2 border-[var(--kant-sterk)] px-3 py-1.5 text-base whitespace-nowrap ${farge(l)}`}
                    >
                      {datoKort(l.start_tid)} →{' '}
                      {l.slutt_tid ? datoKort(l.slutt_tid) : datoKort(l.planlagt_slutt)}
                      {erForfalt(l) && ' ⚠'}
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
