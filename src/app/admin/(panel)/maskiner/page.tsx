import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { MASKIN_STATUS_TEKST, type Maskin } from '@/lib/types'
import { KNAPP_SEKUNDÆR, Merke, Seksjonstittel, TomTilstand } from '@/components/ui'
import { KopierLenke } from './kopier-lenke'
import { NyMaskin } from './ny-maskin'

export const metadata: Metadata = { title: 'Maskiner – HM Utleie' }
export const dynamic = 'force-dynamic'

const merkeType = {
  ledig: 'grønn',
  utleid: 'gul',
  service: 'nøytral',
  utrangert: 'nøytral',
} as const

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
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Seksjonstittel
          under={`${maskiner.length} registrert · kopier lenken til QR-generatoren`}
        >
          Maskiner
        </Seksjonstittel>

        {maskiner.length > 0 && (
          <a href="/api/maskiner/csv" className={KNAPP_SEKUNDÆR}>
            Last ned alle som CSV
          </a>
        )}
      </div>

      <NyMaskin />

      {error && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          Kunne ikke hente maskiner: {error.message}
        </p>
      )}

      {!error && maskiner.length === 0 ? (
        <TomTilstand tittel="Ingen maskiner ennå">
          Legg inn den første, så får den en permanent URL du kan lage QR-kode
          av.
        </TomTilstand>
      ) : (
        <div className="overflow-x-auto border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)]">
          <table className="w-full text-sm">
            <thead className="bg-hm-black text-white">
              <tr>
                <Th>Maskin</Th>
                <Th>Kode</Th>
                <Th>Døgnpris</Th>
                <Th>Status</Th>
                <Th>Lenke for QR</Th>
              </tr>
            </thead>
            <tbody>
              {maskiner.map((m) => (
                <tr
                  key={m.id}
                  className="border-b-2 border-[var(--kant)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/maskiner/${m.id}`}
                      className="hm-display inline-flex min-h-[2.75rem] items-center text-base underline underline-offset-4"
                    >
                      {m.navn}
                    </Link>
                    {(m.kategori || m.internnummer) && (
                      <div className="text-xs text-[var(--blekk-svak)]">
                        {[m.kategori, m.internnummer].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="hm-tall px-4 py-3 font-mono text-xs">
                    {m.qr_kode}
                  </td>
                  <td className="hm-tall px-4 py-3 font-semibold">
                    {m.dogn_pris === null ? (
                      <span className="text-[var(--blekk-svak)]">–</span>
                    ) : (
                      <>
                        {m.dogn_pris.toLocaleString('nb-NO')} kr
                        {!m.vis_pris && (
                          <span
                            className="ml-1.5 text-[10px] font-bold tracking-wider text-[var(--blekk-svak)] uppercase"
                            title="Prisen vises ikke for kunden"
                          >
                            skjult
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Merke type={merkeType[m.status]}>
                      {MASKIN_STATUS_TEKST[m.status]}
                    </Merke>
                  </td>
                  <td className="px-4 py-3">
                    <KopierLenke url={`${env.NEXT_PUBLIC_SITE_URL}/m/${m.qr_kode}`} />
                  </td>
                </tr>
              ))}
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
