import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { internleieRad, kroner, summerInternleie, type InternleieRad } from '@/lib/pris'
import type { Prosjekt } from '@/lib/types'
import { Merke, Seksjonstittel, TomTilstand } from '@/components/ui'
import { NyttProsjekt } from './nytt-prosjekt'

export const metadata: Metadata = { title: 'Prosjekter – HM Utleie' }
export const dynamic = 'force-dynamic'

type Rad = {
  prosjekt_id: string
  status: string
  start_tid: string
  belop: number | null
  maskiner: { dogn_pris: number | null; pris_enhet: string | null } | null
}

export default async function ProsjekterSide() {
  await krevAdmin()
  const supabase = await lagServerKlient()
  const nå = new Date().toISOString()

  const [{ data: prosjektRader }, { data: leieRader }] = await Promise.all([
    supabase
      .from('prosjekter')
      .select('*')
      .order('aktiv', { ascending: false })
      .order('navn'),
    supabase
      .from('leier')
      .select('prosjekt_id, status, start_tid, belop, maskiner(dogn_pris, pris_enhet)')
      .not('prosjekt_id', 'is', null)
      .in('status', ['aktiv', 'avsluttet']),
  ])

  const prosjekter = (prosjektRader ?? []) as Prosjekt[]

  const perProsjekt = new Map<string, InternleieRad[]>()
  for (const l of (leieRader ?? []) as unknown as Rad[]) {
    const liste = perProsjekt.get(l.prosjekt_id) ?? []
    liste.push(internleieRad(l))
    perProsjekt.set(l.prosjekt_id, liste)
  }

  return (
    <div className="space-y-7">
      <Seksjonstittel under="Internleie føres på prosjektet når noen tar ut utstyr til det.">
        Prosjekter
      </Seksjonstittel>

      <NyttProsjekt />

      {prosjekter.length === 0 ? (
        <TomTilstand tittel="Ingen prosjekter ennå">
          Legg inn det første, så kan de ansatte ta ut utstyr til det.
        </TomTilstand>
      ) : (
        <div className="overflow-x-auto border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)]">
          <table className="w-full text-sm">
            <thead className="bg-hm-black text-white">
              <tr>
                <Th>Prosjekt</Th>
                <Th>Ute nå</Th>
                <Th>Internleie hittil</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {prosjekter.map((p) => {
                const s = summerInternleie(perProsjekt.get(p.id) ?? [], nå)
                return (
                  <tr
                    key={p.id}
                    className="border-b-2 border-[var(--kant)] transition-colors last:border-0 hover:bg-[var(--flate-2)]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/prosjekter/${p.id}`}
                        className="inline-flex min-h-[2.75rem] items-center font-semibold underline underline-offset-4"
                      >
                        {p.navn}
                      </Link>
                      {p.nummer && (
                        <div className="hm-tall text-xs text-[var(--blekk-svak)]">{p.nummer}</div>
                      )}
                    </td>
                    <td className="hm-tall px-4 py-3">{s.ute}</td>
                    <td className="hm-tall px-4 py-3 whitespace-nowrap">
                      {kroner(s.levert + s.løpende)}
                      {s.løpende > 0 && (
                        <span className="block text-xs text-[var(--blekk-svak)]">
                          herav {kroner(s.løpende)} løpende
                        </span>
                      )}
                      {s.manglerPris && (
                        <span className="block text-[10px] font-bold tracking-wider text-hm-amber uppercase">
                          Mangler pris
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Merke type={p.aktiv ? 'grønn' : 'nøytral'}>
                        {p.aktiv ? 'Aktiv' : 'Avsluttet'}
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
