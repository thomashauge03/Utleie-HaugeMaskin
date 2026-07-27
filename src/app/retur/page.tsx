import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hentEnhetsId } from '@/lib/enhet'
import { HMLogo } from '@/components/hm-logo'
import { FinnSkjema } from './finn-skjema'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Lever tilbake – HM Utleie' }

/**
 * Felles retursiden. Én QR-kode for hele anlegget, hengt opp der
 * maskinene leveres inn. Se docs/TEKNISK-PLAN.md pkt. 8.2.
 */
export default async function FellesReturSide() {
  const enhetsId = await hentEnhetsId()

  const { data: leier } = enhetsId
    ? await supabaseAdmin
        .from('leier')
        .select('referanse, start_tid, maskiner(navn)')
        .eq('enhets_id', enhetsId)
        .eq('status', 'aktiv')
        .order('start_tid')
    : { data: null }

  // Én aktiv leie på denne telefonen – hopp rett til kameraet.
  if (leier?.length === 1) {
    redirect(`/leie/${leier[0].referanse}/retur`)
  }

  return (
    <>
      <header className="relative overflow-hidden bg-hm-black px-5 pt-6 pb-8 text-white">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-16 h-[160%] w-40 skew-x-[-18deg] bg-hm-red/90"
        />
        <div className="relative mx-auto max-w-md">
          <HMLogo størrelse="sm" />
          <h1 className="hm-display mt-6 text-3xl">Lever tilbake</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-7">
        {leier && leier.length > 1 ? (
          <>
            <p className="mb-5 text-sm text-[var(--blekk-svak)]">
              Du har {leier.length} maskiner ute. Velg hvilken du leverer:
            </p>
            <div className="space-y-3">
              {leier.map((l) => (
                <Link
                  key={l.referanse}
                  href={`/leie/${l.referanse}/retur`}
                  className="hm-trykk hm-kant-skygge-sm block border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-4"
                >
                  <span className="hm-display block text-lg">
                    {(l.maskiner as unknown as { navn: string }).navn}
                  </span>
                  <span className="mt-0.5 block text-sm text-[var(--blekk-svak)]">
                    Leid siden{' '}
                    {new Date(l.start_tid).toLocaleDateString('nb-NO')}
                  </span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mb-6 border-l-4 border-hm-amber bg-[var(--flate-2)] p-4">
              <p className="hm-display text-lg">Fant ingen leie på denne telefonen</p>
              <p className="mt-1 text-sm text-[var(--blekk-svak)]">
                Har du byttet telefon eller slettet nettleserdata, finner du
                leien med mobilnummeret ditt.
              </p>
            </div>
            <FinnSkjema />
          </>
        )}
      </main>
    </>
  )
}
