import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hentEnhetsId } from '@/lib/enhet'
import type { Leie, Maskin } from '@/lib/types'
import { HMLogo } from '@/components/hm-logo'
import { ReturSkjema } from './retur-skjema'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Lever tilbake – HM Utleie' }

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
    <>
      <header className="relative overflow-hidden bg-hm-black px-5 pt-6 pb-8 text-white">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-16 h-[160%] w-40 skew-x-[-18deg] bg-hm-red/90"
        />
        <div className="relative mx-auto max-w-md">
          <div className="flex items-start justify-between gap-4">
            <HMLogo størrelse="sm" />
            <span className="hm-tall font-mono text-xs tracking-widest text-white/50">
              {leie.referanse}
            </span>
          </div>
          <p className="mt-6 text-sm font-bold tracking-widest text-hm-red uppercase">
            Innlevering
          </p>
          <h1 className="hm-display mt-1 text-3xl">{leie.maskiner.navn}</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-7">
        <ReturSkjema referanse={leie.referanse} maskinNavn={leie.maskiner.navn} />
      </main>
    </>
  )
}
