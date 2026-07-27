import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { visTelefon } from '@/lib/telefon'
import { LEIE_STATUS_TEKST, type Leie, type Kunde, type Maskin } from '@/lib/types'

export const metadata: Metadata = { title: 'Leier – Utleie' }
export const dynamic = 'force-dynamic'

type Rad = Leie & { maskiner: Maskin | null; kunder: Kunde | null }

const statusFarge: Record<string, string> = {
  aktiv: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  venter_godkjenning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  avsluttet: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  avvist: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
}

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

  const filtre = [
    { verdi: 'alle', tekst: 'Alle' },
    { verdi: 'aktiv', tekst: 'Aktive' },
    { verdi: 'venter_godkjenning', tekst: 'Venter godkjenning' },
    { verdi: 'avsluttet', tekst: 'Avsluttet' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Leier</h1>

      <div className="flex flex-wrap gap-2">
        {filtre.map((f) => (
          <Link
            key={f.verdi}
            href={f.verdi === 'alle' ? '/admin/leier' : `/admin/leier?status=${f.verdi}`}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              valgt === f.verdi
                ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-300 hover:bg-white dark:border-slate-700 dark:hover:bg-slate-900'
            }`}
          >
            {f.tekst}
          </Link>
        ))}
      </div>

      {leier.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Ingen leier å vise her.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Referanse</th>
                <th className="px-4 py-3 font-medium">Maskin</th>
                <th className="px-4 py-3 font-medium">Kunde</th>
                <th className="px-4 py-3 font-medium">Levering</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {leier.map((l) => {
                const forfalt =
                  l.status === 'aktiv' && new Date(l.planlagt_slutt).getTime() < nå
                return (
                  <tr
                    key={l.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/leier/${l.id}`}
                        className="font-mono text-xs underline underline-offset-4"
                      >
                        {l.referanse}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{l.maskiner?.navn ?? '–'}</td>
                    <td className="px-4 py-3">
                      <div>{l.kunder?.navn ?? '–'}</div>
                      {l.kunder && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {visTelefon(l.kunder.telefon)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={forfalt ? 'font-medium text-red-600 dark:text-red-400' : ''}>
                        {new Date(l.planlagt_slutt).toLocaleDateString('nb-NO')}
                      </span>
                      {forfalt && (
                        <span className="ml-1 text-xs text-red-600 dark:text-red-400">
                          forfalt
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusFarge[l.status]}`}
                      >
                        {LEIE_STATUS_TEKST[l.status]}
                      </span>
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
