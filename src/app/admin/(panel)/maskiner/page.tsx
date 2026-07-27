import type { Metadata } from 'next'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { MASKIN_STATUS_TEKST, type Maskin } from '@/lib/types'
import { KopierLenke } from './kopier-lenke'
import { NyMaskin } from './ny-maskin'

export const metadata: Metadata = { title: 'Maskiner – Utleie' }
export const dynamic = 'force-dynamic'

const statusFarge: Record<string, string> = {
  ledig: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  utleid: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  service: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  utrangert: 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
}

export default async function MaskinerSide() {
  await krevAdmin()

  const supabase = await lagServerKlient()
  const { data, error } = await supabase
    .from('maskiner')
    .select('*')
    .eq('aktiv', true)
    .order('navn')

  const maskiner = (data ?? []) as Maskin[]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Maskiner</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {maskiner.length} registrert. Kopier lenken til QR-generatoren din.
          </p>
        </div>

        {maskiner.length > 0 && (
          <a
            href="/api/maskiner/csv"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition hover:bg-white dark:border-slate-700 dark:hover:bg-slate-900"
          >
            Last ned alle som CSV
          </a>
        )}
      </div>

      <NyMaskin />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Kunne ikke hente maskiner: {error.message}
        </p>
      )}

      {!error && maskiner.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ingen maskiner ennå. Legg inn den første, så får den en URL du kan lage QR-kode av.
          </p>
        </div>
      )}

      {maskiner.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Maskin</th>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Døgnpris</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Lenke for QR</th>
              </tr>
            </thead>
            <tbody>
              {maskiner.map((m) => {
                const url = `${env.NEXT_PUBLIC_SITE_URL}/m/${m.qr_kode}`
                return (
                  <tr
                    key={m.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.navn}</div>
                      {(m.kategori || m.internnummer) && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {[m.kategori, m.internnummer].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{m.qr_kode}</td>
                    <td className="px-4 py-3">
                      {m.dogn_pris === null ? (
                        <span className="text-slate-400">–</span>
                      ) : (
                        <>
                          {m.dogn_pris.toLocaleString('nb-NO')} kr
                          {!m.vis_pris && (
                            <span
                              className="ml-1 text-xs text-slate-400"
                              title="Prisen vises ikke for kunden"
                            >
                              (skjult)
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusFarge[m.status]}`}
                      >
                        {MASKIN_STATUS_TEKST[m.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <KopierLenke url={url} />
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
