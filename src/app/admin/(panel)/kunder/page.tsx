import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { visTelefon } from '@/lib/telefon'
import type { Kunde } from '@/lib/types'
import { KNAPP_LITEN, Merke, Seksjonstittel, TomTilstand } from '@/components/ui'
import { settKundeStatus } from './actions'

export const metadata: Metadata = { title: 'Kunder – HM Utleie' }
export const dynamic = 'force-dynamic'

const merkeType = { ny: 'gul', godkjent: 'grønn', sperret: 'rød' } as const
const statusTekst = { ny: 'Ny', godkjent: 'Godkjent', sperret: 'Sperret' }

export default async function KunderSide() {
  await krevAdmin()
  const supabase = await lagServerKlient()

  const { data } = await supabase
    .from('kunder')
    .select('*, leier(id, status)')
    .order('opprettet', { ascending: false })

  const kunder = (data ?? []) as (Kunde & { leier: { id: string; status: string }[] })[]

  return (
    <div className="space-y-7">
      <Seksjonstittel
        under={`${kunder.length} registrert · opprettes automatisk ved første leie`}
      >
        Kunder
      </Seksjonstittel>

      {kunder.length === 0 ? (
        <TomTilstand tittel="Ingen kunder ennå">
          Første kunde dukker opp her så snart noen skanner en QR-kode og
          starter en leie.
        </TomTilstand>
      ) : (
        <div className="space-y-4">
          {kunder.map((k) => {
            const aktive = k.leier.filter((l) => l.status === 'aktiv').length
            return (
              <article
                key={k.id}
                className={`border-2 bg-[var(--flate-opp)] p-5 ${
                  k.status === 'sperret'
                    ? 'border-hm-red'
                    : 'border-[var(--kant-sterk)]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="hm-display text-xl">{k.navn}</h2>
                      <Merke type={merkeType[k.status]}>{statusTekst[k.status]}</Merke>
                    </div>

                    <p className="hm-tall mt-1.5 text-sm">
                      {visTelefon(k.telefon)}
                      <span className="text-[var(--blekk-svak)]"> · {k.epost}</span>
                    </p>
                    <p className="text-sm text-[var(--blekk-svak)]">{k.adresse}</p>

                    <p className="mt-2 text-xs font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
                      {k.leier.length} leier
                      {aktive > 0 && ` · ${aktive} aktiv${aktive > 1 ? 'e' : ''} nå`}
                    </p>

                    {k.admin_notat && (
                      <p className="mt-3 border-l-4 border-[var(--kant)] bg-[var(--flate-2)] p-3 text-xs">
                        {k.admin_notat}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {k.status !== 'godkjent' && (
                      <form action={settKundeStatus.bind(null, k.id, 'godkjent')}>
                        <button className={KNAPP_LITEN}>Godkjenn</button>
                      </form>
                    )}
                    {k.status !== 'sperret' ? (
                      <form action={settKundeStatus.bind(null, k.id, 'sperret')}>
                        <button className={`${KNAPP_LITEN} border-hm-red text-hm-red-ink`}>
                          Sperr
                        </button>
                      </form>
                    ) : (
                      <form action={settKundeStatus.bind(null, k.id, 'godkjent')}>
                        <button className={KNAPP_LITEN}>Opphev sperring</button>
                      </form>
                    )}
                    <Link href="/admin/leier" className={KNAPP_LITEN}>
                      Se leier
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
