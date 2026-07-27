import type { Metadata } from 'next'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { KNAPP_LITEN, Merke, Seksjonstittel } from '@/components/ui'
import { NyBruker } from './ny-bruker'
import { settAktiv } from './actions'

export const metadata: Metadata = { title: 'Brukere – HM Utleie' }
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
    <div className="space-y-7">
      <Seksjonstittel under="Alle har lik tilgang. Historikken viser hvem som godkjente hva.">
        Brukere
      </Seksjonstittel>

      <NyBruker />

      <div className="overflow-x-auto border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)]">
        <table className="w-full text-sm">
          <thead className="bg-hm-black text-white">
            <tr>
              <Th>Navn</Th>
              <Th>E-post</Th>
              <Th>Status</Th>
              <Th>{''}</Th>
            </tr>
          </thead>
          <tbody>
            {brukere.map((b) => (
              <tr
                key={b.id}
                className="border-b-2 border-[var(--kant)] last:border-0"
              >
                <td className="px-4 py-3 font-semibold">
                  {b.navn}
                  {b.id === meg.id && (
                    <span className="ml-2 text-xs font-normal text-[var(--blekk-svak)]">
                      (deg)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--blekk-svak)]">{b.epost}</td>
                <td className="px-4 py-3">
                  <Merke type={b.aktiv ? 'grønn' : 'nøytral'}>
                    {b.aktiv ? 'Aktiv' : 'Deaktivert'}
                  </Merke>
                </td>
                <td className="px-4 py-3 text-right">
                  {b.id !== meg.id && (
                    <form action={settAktiv.bind(null, b.id, !b.aktiv)}>
                      <button className={KNAPP_LITEN}>
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

      <p className="text-xs text-[var(--blekk-svak)]">
        Brukere deaktiveres, ikke slettes — da beholder historikken navnet på
        den som godkjente en leie.
      </p>
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
