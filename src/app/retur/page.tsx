import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hentEnhetsId } from '@/lib/enhet'
import { FinnSkjema } from './finn-skjema'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Lever tilbake – Utleie' }

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
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Lever tilbake</h1>

      {leier && leier.length > 1 ? (
        <>
          <p className="mt-2 mb-6 text-sm text-slate-600 dark:text-slate-400">
            Du har {leier.length} maskiner ute. Velg hvilken du leverer:
          </p>
          <div className="space-y-3">
            {leier.map((l) => (
              <Link
                key={l.referanse}
                href={`/leie/${l.referanse}/retur`}
                className="block rounded-xl border border-slate-200 p-4 transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
              >
                <span className="block font-medium">
                  {(l.maskiner as unknown as { navn: string }).navn}
                </span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">
                  Leid siden{' '}
                  {new Date(l.start_tid).toLocaleDateString('nb-NO', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 mb-6 text-sm text-slate-600 dark:text-slate-400">
            Vi fant ingen aktiv leie på denne telefonen. Har du byttet telefon
            eller slettet nettleserdata, kan du finne leien med mobilnummeret
            ditt.
          </p>
          <FinnSkjema />
        </>
      )}
    </main>
  )
}
