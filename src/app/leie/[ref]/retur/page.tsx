import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hentEnhetsId } from '@/lib/enhet'
import type { Leie, Maskin } from '@/lib/types'
import { ReturSkjema } from './retur-skjema'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Lever tilbake – Utleie' }

export default async function ReturSide(props: PageProps<'/leie/[ref]/retur'>) {
  const { ref } = await props.params

  const { data } = await supabaseAdmin
    .from('leier')
    .select('*, maskiner(*)')
    .eq('referanse', ref)
    .maybeSingle()

  const enhetsId = await hentEnhetsId()

  if (!data || !enhetsId || data.enhets_id !== enhetsId) {
    redirect('/retur')
  }

  const leie = data as Leie & { maskiner: Maskin }
  if (leie.status !== 'aktiv') {
    redirect(`/leie/${leie.referanse}`)
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">{leie.referanse}</p>
      <h1 className="mt-1 mb-6 text-2xl font-semibold tracking-tight">
        Lever tilbake {leie.maskiner.navn}
      </h1>

      <ReturSkjema referanse={leie.referanse} maskinNavn={leie.maskiner.navn} />
    </main>
  )
}
