import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { visTelefon } from '@/lib/telefon'
import type { Kunde } from '@/lib/types'
import { settKundeStatus } from './actions'

export const metadata: Metadata = { title: 'Kunder – Utleie' }
export const dynamic = 'force-dynamic'

const statusStil: Record<string, string> = {
  ny: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  godkjent: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  sperret: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
}

const statusTekst: Record<string, string> = {
  ny: 'Ny',
  godkjent: 'Godkjent',
  sperret: 'Sperret',
}

export default async function KunderSide() {
  await krevAdmin()
  const supabase = await lagServerKlient()

  const { data } = await supabase
    .from('kunder')
    .select('*, leier(id, status)')
    .order('opprettet', { ascending: false })

  const kunder = (data ?? []) as (Kunde & { leier: { id: string; status: string }[] })[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kunder</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {kunder.length} registrert. Kunder opprettes automatisk ved første leie.
        </p>
      </div>

      {kunder.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Ingen kunder ennå.
        </div>
      ) : (
        <div className="space-y-3">
          {kunder.map((k) => {
            const aktive = k.leier.filter((l) => l.status === 'aktiv').length
            return (
              <div
                key={k.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{k.navn}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStil[k.status]}`}
                      >
                        {statusTekst[k.status]}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {visTelefon(k.telefon)} · {k.epost}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-500">
                      {k.adresse}
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {k.leier.length} leier totalt
                      {aktive > 0 && ` · ${aktive} aktiv${aktive > 1 ? 'e' : ''} nå`}
                    </div>
                    {k.admin_notat && (
                      <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">
                        {k.admin_notat}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {k.status !== 'godkjent' && (
                      <form action={settKundeStatus.bind(null, k.id, 'godkjent')}>
                        <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                          Merk som godkjent
                        </button>
                      </form>
                    )}
                    {k.status !== 'sperret' ? (
                      <form action={settKundeStatus.bind(null, k.id, 'sperret')}>
                        <button className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40">
                          Sperr
                        </button>
                      </form>
                    ) : (
                      <form action={settKundeStatus.bind(null, k.id, 'godkjent')}>
                        <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                          Opphev sperring
                        </button>
                      </form>
                    )}
                    <Link
                      href={`/admin/leier?kunde=${k.id}`}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Se leier
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
