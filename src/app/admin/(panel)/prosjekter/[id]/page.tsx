import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { antallTekst, beregnPris, internleieRad, prisEnhet, summerInternleie } from '@/lib/pris'
import { dato } from '@/lib/dato'
import type { Prosjekt } from '@/lib/types'
import { Kort, KortTittel, Merke, TomTilstand } from '@/components/ui'
import { BekreftKnapp } from '@/components/bekreft-knapp'
import { settProsjektAktiv, slettProsjekt } from '../actions'
import { RedigerProsjekt } from './rediger-prosjekt'

export const metadata: Metadata = { title: 'Prosjekt – HM Utleie' }
export const dynamic = 'force-dynamic'

type Rad = {
  id: string
  referanse: string
  status: string
  start_tid: string
  slutt_tid: string | null
  antall_dogn: number | null
  belop: number | null
  manuelt_justert: boolean
  maskiner: { navn: string; dogn_pris: number | null; pris_enhet: string | null } | null
  ansatt: { navn: string } | null
}

const kr = (n: number) => `${n.toLocaleString('nb-NO')} kr`

export default async function ProsjektSide(props: PageProps<'/admin/prosjekter/[id]'>) {
  await krevAdmin()
  const { id } = await props.params
  const supabase = await lagServerKlient()

  const [{ data: prosjektRad }, { data: leieRader }] = await Promise.all([
    supabase.from('prosjekter').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('leier')
      .select(
        'id, referanse, status, start_tid, slutt_tid, antall_dogn, belop, manuelt_justert, maskiner(navn, dogn_pris, pris_enhet), ansatt:admin_brukere!leier_ansatt_id_fkey(navn)',
      )
      .eq('prosjekt_id', id)
      .order('start_tid', { ascending: false }),
  ])

  if (!prosjektRad) notFound()
  const prosjekt = prosjektRad as Prosjekt
  const leier = (leieRader ?? []) as unknown as Rad[]
  const nå = new Date().toISOString()

  const sum = summerInternleie(leier.map(internleieRad), nå)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/prosjekter"
          className="inline-flex min-h-[2.75rem] items-center text-sm font-semibold text-[var(--blekk-svak)] underline underline-offset-4"
        >
          ← Alle prosjekter
        </Link>
        <span className="hm-skrastrek mt-2 mb-3 block" aria-hidden="true" />
        <h1 className="hm-display text-3xl">{prosjekt.navn}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {prosjekt.nummer && (
            <span className="hm-tall font-mono text-sm text-[var(--blekk-svak)]">
              {prosjekt.nummer}
            </span>
          )}
          <Merke type={prosjekt.aktiv ? 'grønn' : 'nøytral'}>
            {prosjekt.aktiv ? 'Aktiv' : 'Avsluttet'}
          </Merke>
        </div>
      </div>

      <Kort>
        <KortTittel>Internleie hittil</KortTittel>
        <div className="p-5">
          <p className="hm-display hm-tall text-4xl">{kr(sum.levert + sum.løpende)}</p>
          <p className="mt-1 text-sm text-[var(--blekk-svak)]">
            {kr(sum.levert)} levert
            {sum.ute > 0 && ` · ${kr(sum.løpende)} løpende på ${sum.ute} ting som er ute`}
          </p>
          {sum.manglerPris && (
            <p className="mt-3 border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
              Noe utstyr på prosjektet mangler pris, så summen er for lav. Sett
              pris på maskinen, og rett beløpet på leien.
            </p>
          )}
        </div>
      </Kort>

      <Kort>
        <KortTittel>Leier</KortTittel>
        {leier.length === 0 ? (
          <div className="p-5">
            <TomTilstand tittel="Ingenting ført ennå">
              Når noen tar ut utstyr til prosjektet, dukker det opp her.
            </TomTilstand>
          </div>
        ) : (
          <ul className="divide-y-2 divide-[var(--kant)]">
            {leier.map((l) => {
              const enhet = prisEnhet(l.maskiner?.pris_enhet)
              const anslag =
                l.status === 'aktiv'
                  ? beregnPris(l.start_tid, nå, enhet, l.maskiner?.dogn_pris ?? null)
                  : null
              const antall = anslag?.antall ?? l.antall_dogn
              const belop = anslag ? anslag.belop : l.belop
              return (
                <li key={l.id}>
                  <Link
                    href={`/admin/leier/${l.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition-colors hover:bg-[var(--flate-2)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {l.maskiner?.navn ?? 'Ukjent maskin'}
                      </span>
                      <span className="block text-sm text-[var(--blekk-svak)]">
                        {l.ansatt?.navn ?? 'Ukjent ansatt'} · {dato(l.start_tid)} –{' '}
                        {l.slutt_tid ? dato(l.slutt_tid) : 'ute nå'}
                      </span>
                    </span>
                    <span className="hm-tall text-sm">
                      {antall !== null ? antallTekst(antall, enhet) : '–'}
                    </span>
                    <span className="hm-tall shrink-0 text-right font-semibold">
                      {belop !== null ? kr(belop) : 'mangler pris'}
                      {anslag && (
                        <span className="block text-[10px] font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
                          Løpende
                        </span>
                      )}
                      {l.manuelt_justert && (
                        <span className="block text-[10px] font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
                          Justert
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Kort>

      <Kort>
        <KortTittel>Navn og nummer</KortTittel>
        <RedigerProsjekt id={prosjekt.id} navn={prosjekt.navn} nummer={prosjekt.nummer} />
      </Kort>

      <div className="space-y-3">
        {prosjekt.aktiv && sum.ute > 0 && (
          <p className="border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
            {sum.ute} ting står fortsatt ute på prosjektet. Avslutter du det, blir
            de stående til de leveres – men ingen kan ta ut mer til det.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <form action={settProsjektAktiv.bind(null, prosjekt.id, !prosjekt.aktiv)}>
            <BekreftKnapp
              etikett={prosjekt.aktiv ? 'Avslutt prosjektet' : 'Åpne prosjektet igjen'}
              bekreft={prosjekt.aktiv ? 'Ja, avslutt' : 'Ja, åpne'}
            />
          </form>
          {leier.length === 0 && (
            <form action={slettProsjekt.bind(null, prosjekt.id)}>
              <BekreftKnapp etikett="Slett prosjektet" bekreft="Slett for godt" fare />
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
