import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { visTelefon } from '@/lib/telefon'
import { datoKort, osloDag } from '@/lib/dato'
import { LEIE_STATUS_TEKST, erForfalt, påUbestemtTid, type Leie, type LeieRad } from '@/lib/types'
import { LEIETAKER_FELT, leietaker, leietakerLinje, leietakerTekst } from '@/lib/leietaker'
import { Merke, Seksjonstittel, TomTilstand } from '@/components/ui'
import { kortDag } from '@/lib/reservasjon'
import { baner, plasser } from '@/lib/tidslinje'
import { NyReservasjon, type ReservasjonMaskin } from './ny-reservasjon'
import { ReservasjonRad, type ReservasjonVisning } from './reservasjon-rad'
import { Tidslinje, type Stolpe, type TidslinjeRad } from './tidslinje'

export const metadata: Metadata = { title: 'Kalender – HM Utleie' }
export const dynamic = 'force-dynamic'

type Rad = LeieRad

/** «Tabellen finnes ikke» – migrasjon 0012 er ikke kjørt. */
const FINNES_IKKE = ['PGRST205', '42P01']

const MND = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]

/** Date.getDay() har søndag som 0. Vi vil ha mandag som 0. */
const ukedagIndeks = (d: Date) => (d.getDay() + 6) % 7

/**
 * Civil dato yyyy-mm-dd for en dag i måneden. Dagene bygges på
 * server-lokal midnatt, så samme lokale getter gir tallene tilbake
 * uansett tidssone. Leiene plasseres på Oslo-dato (osloDag), så de havner
 * på riktig dag også når serveren er UTC.
 */
const celleDag = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Farge per status. Brukes både i tidslinja og i lista under. */
function farge(l: Leie) {
  if (erForfalt(l)) return 'bg-hm-red text-white'
  if (l.status === 'venter_godkjenning') return 'bg-hm-amber text-white'
  if (l.status === 'aktiv') return 'bg-hm-green text-white'
  return 'bg-hm-500 text-white'
}

/**
 * Siste dag leien skal tegnes på, eller null når den ikke har noen.
 *
 * En aktiv leie står ute til den faktisk leveres. Stoppet vi på avtalt
 * dato, ville nettopp de dagene maskinen er på overtid mangle i
 * kalenderen – som er de dagene man trenger å se. En internleie uten
 * dato står ute på ubestemt tid og tegnes på hver dag framover, også i
 * månedene som kommer. Stoppet den på i dag, så maskinen ledig ut i
 * morgen.
 */
function sluttFor(l: Leie, nå: Date): Date | null {
  if (påUbestemtTid(l)) return null
  if (l.status === 'aktiv' && l.planlagt_slutt) {
    return new Date(Math.max(new Date(l.planlagt_slutt).getTime(), nå.getTime()))
  }
  return new Date(l.slutt_tid ?? l.planlagt_slutt ?? nå)
}

/** Sluttdatoen slik den skrives ut: levert, avtalt, eller «på ubestemt tid». */
function tilTekst(l: Leie): string {
  if (l.slutt_tid) return datoKort(l.slutt_tid)
  return l.planlagt_slutt ? datoKort(l.planlagt_slutt) : 'på ubestemt tid'
}

export default async function KalenderSide(props: PageProps<'/admin/kalender'>) {
  await krevAdmin()
  const sp = await props.searchParams

  /*
   * Ett felles «nå» for hele siden: hvilken måned som vises, hvilken rute
   * som er i dag, og hvor langt aktive leier strekkes. Da er de alltid
   * enige. Date.now() midt i renderingen avvises av react-hooks/purity.
   */
  const nå = new Date()
  const år = Number(sp.ar) || nå.getFullYear()
  const måned = sp.mnd !== undefined ? Number(sp.mnd) : nå.getMonth()

  const førsteIMnd = new Date(år, måned, 1)
  const antallDager = new Date(år, måned + 1, 0).getDate()

  const supabase = await lagServerKlient()
  const { data } = await supabase
    .from('leier')
    .select(`*, maskiner(*), ${LEIETAKER_FELT}`)
    .lte('start_tid', new Date(år, måned + 1, 0, 23, 59, 59).toISOString())
    .order('start_tid')

  // En leie på ubestemt tid hører med i hver måned fra den startet.
  const leier = ((data ?? []) as Rad[]).filter((l) => {
    const slutt = sluttFor(l, nå)
    return slutt === null || slutt >= førsteIMnd
  })

  // Reservasjoner som berører måneden, og maskinene skjemaet kan velge.
  // Mangler tabellen, står det en beskjed der skjemaet ellers hadde stått.
  const [{ data: resData, error: resFeil }, { data: maskinData }] = await Promise.all([
    supabase
      .from('reservasjoner')
      .select(
        'id, maskin_id, fra_dato, til_dato, kunde_navn, kunde_telefon, notat, status, maskiner(navn, kategori, internnummer)',
      )
      .eq('status', 'aktiv')
      .lte('fra_dato', celleDag(new Date(år, måned + 1, 0)))
      .gte('til_dato', celleDag(førsteIMnd))
      .order('fra_dato'),
    supabase
      .from('maskiner')
      .select('id, navn, internnummer')
      .eq('aktiv', true)
      .neq('status', 'utrangert')
      .order('navn'),
  ])
  const reservasjonerPå = !(resFeil && FINNES_IKKE.includes(resFeil.code))
  const reservasjoner = (resData ?? []) as unknown as ReservasjonVisning[]

  const iDag = osloDag(nå)

  /*
   * Tidslinja: én rad per maskin med leie eller reservasjon i måneden.
   * Leiene strekkes som før (sluttFor); en leie på ubestemt tid har ingen
   * slutt og går ut til høyre kant.
   */
  const førsteDag = celleDag(førsteIMnd)
  const sisteDag = celleDag(new Date(år, måned + 1, 0))
  type Maskininfo = { navn: string; kategori?: string | null; internnummer?: string | null }
  const perMaskin = new Map<string, { info: Omit<TidslinjeRad, 'baner'>; stolper: Stolpe[] }>()
  const leggTil = (maskinId: string, maskin: Maskininfo | null | undefined, stolpe: Stolpe) => {
    const m = perMaskin.get(maskinId) ?? {
      info: {
        id: maskinId,
        navn: maskin?.navn ?? 'Ukjent maskin',
        kategori: maskin?.kategori ?? null,
        internnummer: maskin?.internnummer ?? null,
      },
      stolper: [],
    }
    m.stolper.push(stolpe)
    perMaskin.set(maskinId, m)
  }

  for (const l of leier) {
    const slutt = sluttFor(l, nå)
    const plass = plasser(
      { fra: osloDag(l.start_tid), til: slutt && osloDag(slutt) },
      førsteDag,
      sisteDag,
    )
    if (!plass) continue
    leggTil(l.maskin_id, l.maskiner, {
      ...plass,
      id: l.id,
      tekst: `${erForfalt(l) ? '⚠ ' : ''}${leietakerTekst(l)}`,
      tittel: `${l.maskiner?.navn ?? l.referanse} · ${leietakerTekst(l)} · ${datoKort(l.start_tid)} → ${tilTekst(l)}`,
      href: `/admin/leier/${l.id}`,
      klasse: `border border-[var(--kant-sterk)] ${farge(l)}`,
      ubestemt: påUbestemtTid(l),
    })
  }
  for (const r of reservasjoner) {
    const plass = plasser({ fra: r.fra_dato, til: r.til_dato }, førsteDag, sisteDag)
    if (!plass) continue
    // Forespørsler fra nettsida (reservasjoner del 3) er grå og sperrer ingenting.
    const forespurt = r.status === 'forespurt'
    leggTil(r.maskin_id, r.maskiner, {
      ...plass,
      id: r.id,
      tekst: `${forespurt ? '? Forespurt' : 'Reservert'} · ${r.kunde_navn}`,
      tittel: `${r.maskiner?.navn ?? 'Maskin'} · ${forespurt ? 'forespurt av' : 'reservert for'} ${r.kunde_navn} · ${kortDag(r.fra_dato)}–${kortDag(r.til_dato)}`,
      klasse: forespurt
        ? 'border border-dashed border-[var(--blekk-svak)] bg-[var(--flate-opp)] text-[var(--blekk-svak)]'
        : 'border border-dashed border-hm-amber bg-[var(--flate-opp)]',
    })
  }
  // Kategoriene alfabetisk og uten kategori sist; maskinene på navn.
  const rader: TidslinjeRad[] = [...perMaskin.values()]
    .map(({ info, stolper }) => ({ ...info, baner: baner(stolper) }))
    .sort(
      (a, b) =>
        Number(a.kategori === null) - Number(b.kategori === null) ||
        (a.kategori ?? '').localeCompare(b.kategori ?? '', 'nb') ||
        a.navn.localeCompare(b.navn, 'nb'),
    )
  const dagIDag = iDag.slice(0, 7) === førsteDag.slice(0, 7) ? Number(iDag.slice(8, 10)) : null
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

      {reservasjonerPå ? (
        <NyReservasjon maskiner={(maskinData ?? []) as ReservasjonMaskin[]} iDag={iDag} />
      ) : (
        <p className="border-l-4 border-hm-amber bg-[var(--flate-opp)] p-4 text-sm">
          Reservasjoner er ikke slått på ennå. Kjør{' '}
          <code className="font-mono text-xs">supabase/migrations/0012_reservasjoner.sql</code> i
          Supabase SQL Editor.
        </p>
      )}

      {/* ── Tidslinje: én rad per maskin ──────────────────── */}
      <Tidslinje
        rader={rader}
        antallDager={antallDager}
        førsteUkedag={ukedagIndeks(førsteIMnd)}
        iDag={dagIDag}
        tomTekst={`Ingen leier eller reservasjoner i ${MND[måned]}.`}
      />

      <div className="flex flex-wrap items-center gap-4 text-xs font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
        <Prikk farge="bg-hm-green" tekst="Utleid" />
        <Prikk farge="bg-hm-red" tekst="Forfalt ⚠" />
        <Prikk farge="bg-hm-amber" tekst="Venter godkjenning" />
        <Prikk farge="bg-hm-500" tekst="Avsluttet" />
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 border border-dashed border-hm-amber bg-[var(--flate-opp)]" />
          Reservert
        </span>
        <span>◂ ▸ fortsetter fra forrige / til neste måned</span>
      </div>

      {reservasjoner.length > 0 && (
        <div>
          <h2 className="hm-display mb-1 text-2xl">Reservasjoner i {MND[måned]}</h2>
          <p className="mb-4 text-sm text-[var(--blekk-svak)]">
            Kunden kjennes igjen på mobilnummeret når den henter, og da blir
            reservasjonen en leie.
          </p>
          <ol className="space-y-3">
            {reservasjoner.map((r) => (
              <ReservasjonRad key={r.id} r={r} visMaskin />
            ))}
          </ol>
        </div>
      )}

      {/* ── Én og én, med datoene skrevet ut ──────────────── */}
      {leier.length === 0 ? (
        <TomTilstand tittel="Ingen utleie denne måneden">
          Bla til en annen måned, eller vent til neste maskin blir skannet.
        </TomTilstand>
      ) : (
        <div>
          <h2 className="hm-display mb-1 text-2xl">Leier i {MND[måned]}</h2>
          <p className="mb-4 text-sm text-[var(--blekk-svak)]">
            Samme utleie som i tidslinja, med datoene skrevet ut.
          </p>

          <ol className="space-y-3">
            {[...leier]
              .sort((a, b) => a.start_tid.localeCompare(b.start_tid))
              .map((l) => {
                const t = leietaker(l)
                return (
                  <li key={l.id}>
                    <Link
                      href={`/admin/leier/${l.id}`}
                      className="hm-trykk hm-kant-skygge-sm flex flex-wrap items-center gap-x-5 gap-y-3 border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-4"
                    >
                      <span
                        className={`hm-display hm-tall shrink-0 border-2 border-[var(--kant-sterk)] px-3 py-1.5 text-base whitespace-nowrap ${farge(l)}`}
                      >
                        {datoKort(l.start_tid)} →{' '}
                        {tilTekst(l)}
                        {erForfalt(l) && ' ⚠'}
                      </span>

                      {/* min-w-40: ved siden av «→ på ubestemt tid» er det for
                          trangt på mobil – da bryter navnet til egen linje
                          i stedet for å kappes. */}
                      <span className="min-w-40 flex-1">
                        <span className="hm-display block truncate text-lg">
                          {l.maskiner?.navn ?? 'Ukjent maskin'}
                        </span>
                        <span className="block text-sm text-[var(--blekk-svak)]">
                          <span className="inline-flex flex-wrap items-center gap-2">
                            {leietakerLinje(t)}
                            {t.intern && <Merke>Intern</Merke>}
                          </span>
                          {t.telefon && ` · ${visTelefon(t.telefon)}`}
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
                )
              })}
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
