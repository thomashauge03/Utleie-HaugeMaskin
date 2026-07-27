import type { Metadata } from 'next'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { NyBruker } from './ny-bruker'
import { settAktiv } from './actions'

export const metadata: Metadata = { title: 'Brukere – Utleie' }
export const dynamic = 'force-dynamic'

type AdminRad = {
  id: string
  navn: string
  epost: string
  aktiv: boolean
  opprettet: string
}

export default async function BrukereSide() {
  const meg = await krevAdmin()
  const supabase = await lagServerKlient()

  const { data } = await supabase.from('admin_brukere').select('*').order('navn')
  const brukere = (data ?? []) as AdminRad[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brukere</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Alle admin-brukere har lik tilgang. Historikken viser hvem som
          godkjente hva.
        </p>
      </div>

      <NyBruker />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Navn</th>
              <th className="px-4 py-3 font-medium">E-post</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {brukere.map((b) => (
              <tr
                key={b.id}
                className="border-b border-slate-100 last:border-0 dark:border-slate-800"
              >
                <td className="px-4 py-3 font-medium">
                  {b.navn}
                  {b.id === meg.id && (
                    <span className="ml-2 text-xs font-normal text-slate-500">(deg)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{b.epost}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      b.aktiv
                        ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {b.aktiv ? 'Aktiv' : 'Deaktivert'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {b.id !== meg.id && (
                    <form action={settAktiv.bind(null, b.id, !b.aktiv)}>
                      <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                        {b.aktiv ? 'Deaktiver' : 'Aktiver'}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Brukere deaktiveres, ikke slettes – da beholder historikken navnet på
        den som godkjente en leie.
      </p>
    </div>
  )
}
