import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { internleieRad, kroner, summerInternleie, type InternleieRad } from '@/lib/pris'
import { sammenlignProsjekter } from '@/lib/leietaker'
import type { Prosjekt } from '@/lib/types'
import { Merke, Seksjonstittel, TomTilstand } from '@/components/ui'
import { Søkefelt } from '@/components/sokefelt'
import { SmartDokBeskjed } from './smartdok-beskjed'

export const metadata: Metadata = { title: 'Prosjekter – HM Utleie' }
export const dynamic = 'force-dynamic'

const FILTRE = [
  { verdi: 'aktive', tekst: 'Aktive' },
  { verdi: 'alle', tekst: 'Vis avsluttede' },
] as const

type Rad = {
  prosjekt_id: string
  status: string
  start_tid: string
  belop: number | null
  maskiner: { dogn_pris: number | null; pris_enhet: string | null } | null
}

export default async function ProsjekterSide(props: PageProps<'/admin/prosjekter'>) {
  await krevAdmin()
  const sp = await props.searchParams
  const visAlle = sp.vis === 'alle'
  const søk = typeof sp.q === 'string' ? sp.q.trim() : ''

  const supabase = await lagServerKlient()
  const nå = new Date().toISOString()

  const [{ data: prosjektRader }, { data: leieRader }] = await Promise.all([
    supabase.from('prosjekter').select('*'),
    supabase
      .from('leier')
      .select('prosjekt_id, status, start_tid, belop, maskiner(dogn_pris, pris_enhet)')
      .not('prosjekt_id', 'is', null)
      .in('status', ['aktiv', 'avsluttet']),
  ])

  const alle = (prosjektRader ?? []) as Prosjekt[]

  const perProsjekt = new Map<string, InternleieRad[]>()
  for (const l of (leieRader ?? []) as unknown as Rad[]) {
    const liste = perProsjekt.get(l.prosjekt_id) ?? []
    liste.push(internleieRad(l))
    perProsjekt.set(l.prosjekt_id, liste)
  }
  const sum = (p: Prosjekt) => summerInternleie(perProsjekt.get(p.id) ?? [], nå)

  // Et prosjekt kan avsluttes i SmartDok mens utstyr fortsatt står ute
  // på det. Det skal ikke forsvinne fra lista før utstyret er levert.
  let prosjekter = visAlle ? alle : alle.filter((p) => p.aktiv || sum(p).ute > 0)

  if (søk) {
    const n = søk.toLowerCase().replace(/\s/g, '')
    prosjekter = prosjekter.filter((p) =>
      [p.nummer, p.navn]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().replace(/\s/g, '').includes(n)),
    )
  }

  prosjekter.sort((a, b) => Number(b.aktiv) - Number(a.aktiv) || sammenlignProsjekter(a, b))

  const lenke = (vis: string) => {
    const p = new URLSearchParams()
    if (vis === 'alle') p.set('vis', 'alle')
    if (søk) p.set('q', søk)
    const s = p.toString()
    return s ? `/admin/prosjekter?${s}` : '/admin/prosjekter'
  }

  const antallAktive = alle.filter((p) => p.aktiv).length

  return (
    <div className="space-y-6">
      <Seksjonstittel
        under={
          søk
            ? `${prosjekter.length} treff på «${søk}»`
            : `${antallAktive} aktive av ${alle.length} · internleie føres på prosjektet når noen tar ut utstyr til det`
        }
      >
        Prosjekter
      </Seksjonstittel>

      <SmartDokBeskjed />

      <Søkefelt verdi={søk} plassholder="Søk på nummer eller navn" />

      <div className="flex flex-wrap gap-2">
        {FILTRE.map((f) => {
          const aktiv = (f.verdi === 'alle') === visAlle
          return (
            <Link
              key={f.verdi}
              href={lenke(f.verdi)}
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

      {prosjekter.length === 0 ? (
        <TomTilstand tittel={søk ? 'Ingen treff' : 'Ingen prosjekter her'}>
          {søk
            ? `Fant ingen prosjekt som matcher «${søk}».${visAlle ? '' : ' Søk blant de avsluttede også med «Vis avsluttede».'}`
            : 'Prosjektene dukker opp her når adminbordet har hentet dem fra SmartDok.'}
        </TomTilstand>
      ) : (
        <div className="overflow-x-auto border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)]">
          <table className="w-full text-sm">
            <thead className="bg-hm-black text-white">
              <tr>
                <Th>Nummer</Th>
                <Th>Prosjekt</Th>
                <Th>Ute nå</Th>
                <Th>Internleie hittil</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {prosjekter.map((p) => {
                const s = sum(p)
                return (
                  <tr
                    key={p.id}
                    className="border-b-2 border-[var(--kant)] transition-colors last:border-0 hover:bg-[var(--flate-2)]"
                  >
                    <td className="hm-tall px-4 py-3 whitespace-nowrap">{p.nummer ?? '–'}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/prosjekter/${p.id}`}
                        className="inline-flex min-h-[2.75rem] items-center font-semibold underline underline-offset-4"
                      >
                        {p.navn}
                      </Link>
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
