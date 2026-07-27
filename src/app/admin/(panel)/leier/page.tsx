import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { visTelefon } from '@/lib/telefon'
import { LEIE_STATUS_TEKST, type Leie, type Kunde, type Maskin } from '@/lib/types'
import { Merke, Seksjonstittel, TomTilstand } from '@/components/ui'

export const metadata: Metadata = { title: 'Leier – HM Utleie' }
export const dynamic = 'force-dynamic'

type Rad = Leie & { maskiner: Maskin | null; kunder: Kunde | null }

const merkeType = {
  aktiv: 'grønn',
  venter_godkjenning: 'gul',
  avsluttet: 'nøytral',
  avvist: 'rød',
} as const

const filtre = [
  { verdi: 'alle', tekst: 'Alle' },
  { verdi: 'aktiv', tekst: 'Aktive' },
  { verdi: 'venter_godkjenning', tekst: 'Venter godkjenning' },
  { verdi: 'avsluttet', tekst: 'Avsluttet' },
]

export default async function LeierSide(props: PageProps<'/admin/leier'>) {
  await krevAdmin()
  const { status } = await props.searchParams
  const valgt = typeof status === 'string' ? status : 'alle'

  const supabase = await lagServerKlient()
  let spørring = supabase
    .from('leier')
    .select('*, maskiner(*), kunder(*)')
    .order('start_tid', { ascending: false })

  if (valgt !== 'alle') spørring = spørring.eq('status', valgt)

  const { data } = await spørring
  const leier = (data ?? []) as Rad[]
  const nå = Date.now()

  return (
    <div className="space-y-7">
      <Seksjonstittel under={`${leier.length} treff`}>Leier</Seksjonstittel>

      <div className="flex flex-wrap gap-2">
        {filtre.map((f) => {
          const aktiv = valgt === f.verdi
          return (
            <Link
              key={f.verdi}
              href={f.verdi === 'alle' ? '/admin/leier' : `/admin/leier?status=${f.verdi}`}
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
      </div>

      {leier.length === 0 ? (
        <TomTilstand tittel="Ingen leier her">
          Prøv et annet filter, eller vent til første maskin blir skannet.
        </TomTilstand>
      ) : (
        <div className="overflow-x-auto border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)]">
          <table className="w-full text-sm">
            <thead className="bg-hm-black text-white">
              <tr>
                <Th>Referanse</Th>
                <Th>Maskin</Th>
                <Th>Kunde</Th>
                <Th>Levering</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {leier.map((l) => {
                const forfalt =
                  l.status === 'aktiv' && new Date(l.planlagt_slutt).getTime() < nå
                return (
                  <tr
                    key={l.id}
                    className="border-b-2 border-[var(--kant)] transition-colors last:border-0 hover:bg-[var(--flate-2)]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/leier/${l.id}`}
                        className="hm-tall inline-flex min-h-[2.75rem] items-center font-mono text-xs font-bold underline underline-offset-4"
                      >
                        {l.referanse}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {l.maskiner?.navn ?? '–'}
                    </td>
                    <td className="px-4 py-3">
                      <div>{l.kunder?.navn ?? '–'}</div>
                      {l.kunder && (
                        <div className="hm-tall text-xs text-[var(--blekk-svak)]">
                          {visTelefon(l.kunder.telefon)}
                        </div>
                      )}
                    </td>
                    <td className="hm-tall px-4 py-3">
                      {new Date(l.planlagt_slutt).toLocaleDateString('nb-NO')}
                      {forfalt && (
                        <span className="ml-2 inline-block bg-hm-red px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                          Forfalt
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Merke type={merkeType[l.status]}>
                        {LEIE_STATUS_TEKST[l.status]}
                      </Merke>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
