import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hentEnhetsId } from '@/lib/enhet'
import type { Leie, Maskin } from '@/lib/types'
import { HMLogo } from '@/components/hm-logo'
import { KNAPP_PRIMÆR, Merke } from '@/components/ui'
import { dato } from '@/lib/dato'
import { krPer, prisEnhet } from '@/lib/pris'
import { LeieSkjema } from './leie-skjema'

export const dynamic = 'force-dynamic'

export async function generateMetadata(
  props: PageProps<'/m/[qr]'>,
): Promise<Metadata> {
  const { qr } = await props.params
  const { data } = await supabaseAdmin
    .from('maskiner')
    .select('navn')
    .eq('qr_kode', qr)
    .maybeSingle()

  return { title: data?.navn ? `${data.navn} – HM Utleie` : 'HM Utleie' }
}

export default async function MaskinSide(props: PageProps<'/m/[qr]'>) {
  const { qr } = await props.params

  const { data } = await supabaseAdmin
    .from('maskiner')
    .select('*')
    .eq('qr_kode', qr)
    .eq('aktiv', true)
    .maybeSingle()

  if (!data) notFound()
  const maskin = data as Maskin

  const { data: aktivRad } = await supabaseAdmin
    .from('leier')
    .select('*')
    .eq('maskin_id', maskin.id)
    .in('status', ['aktiv', 'venter_godkjenning'])
    .maybeSingle()

  const aktiv = aktivRad as Leie | null
  const enhetsId = await hentEnhetsId()
  const erMin = Boolean(aktiv && enhetsId && aktiv.enhets_id === enhetsId)
  const utilgjengelig = maskin.status === 'service' || maskin.status === 'utrangert'

  return (
    <>
      {/* ── Maskinkort ────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-hm-black px-5 pt-6 pb-8 text-white">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-16 h-[160%] w-40 skew-x-[-18deg] bg-hm-red/90"
        />
        <div className="relative mx-auto max-w-md">
          <div className="flex items-start justify-between gap-4">
            <HMLogo størrelse="sm" />
            <span className="hm-tall font-mono text-xs tracking-widest text-white/50">
              {maskin.qr_kode}
            </span>
          </div>

          <h1 className="hm-display mt-6 text-3xl">{maskin.navn}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {utilgjengelig ? (
              <Merke type="nøytral">Ute av drift</Merke>
            ) : aktiv ? (
              <Merke type="gul">{erMin ? 'Du leier denne' : 'Utleid'}</Merke>
            ) : (
              <Merke type="grønn">Ledig nå</Merke>
            )}
            {maskin.kategori && (
              <span className="text-sm text-white/60">{maskin.kategori}</span>
            )}
          </div>

          {maskin.vis_pris && maskin.dogn_pris !== null && (
            <p className="mt-6 flex items-baseline gap-2">
              <span className="hm-display hm-tall text-5xl">
                {maskin.dogn_pris.toLocaleString('nb-NO')}
              </span>
              <span className="text-sm font-semibold tracking-widest text-white/60 uppercase">
                {krPer(prisEnhet(maskin.pris_enhet))}
              </span>
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-7">
        {utilgjengelig ? (
          <Beskjed tittel="Ikke tilgjengelig">
            Denne maskinen er ute av drift. Ta kontakt med utleier.
          </Beskjed>
        ) : erMin && aktiv ? (
          <div className="space-y-5">
            <Beskjed tittel="Leien din er i gang">
              Startet {dato(aktiv.start_tid)}. Forventet levering{' '}
              {dato(aktiv.planlagt_slutt)}.
            </Beskjed>
            <Link href={`/leie/${aktiv.referanse}`} className={KNAPP_PRIMÆR}>
              Se leien og lever
            </Link>
          </div>
        ) : aktiv ? (
          <Beskjed tittel="Maskinen er utleid">
            Den er ventet tilbake {dato(aktiv.planlagt_slutt)}. Ta kontakt med
            utleier hvis du trenger den før det.
          </Beskjed>
        ) : (
          <LeieSkjema maskinId={maskin.id} maskinNavn={maskin.navn} />
        )}
      </main>
    </>
  )
}

function Beskjed({
  tittel,
  children,
}: {
  tittel: string
  children: React.ReactNode
}) {
  return (
    <div className="border-l-4 border-hm-red bg-[var(--flate-2)] p-4">
      <p className="hm-display text-lg">{tittel}</p>
      <p className="mt-1 text-sm text-[var(--blekk-svak)]">{children}</p>
    </div>
  )
}

