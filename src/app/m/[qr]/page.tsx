import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hentEnhetsId } from '@/lib/enhet'
import type { Leie, Maskin } from '@/lib/types'
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

  return { title: data?.navn ? `${data.navn} – Utleie` : 'Utleie' }
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

  // Finnes det en pågående leie på denne maskinen?
  const { data: aktivRad } = await supabaseAdmin
    .from('leier')
    .select('*')
    .eq('maskin_id', maskin.id)
    .in('status', ['aktiv', 'venter_godkjenning'])
    .maybeSingle()

  const aktiv = aktivRad as Leie | null
  const enhetsId = await hentEnhetsId()
  const erMin = Boolean(aktiv && enhetsId && aktiv.enhets_id === enhetsId)

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{maskin.navn}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {[maskin.kategori, maskin.internnummer].filter(Boolean).join(' · ') ||
            maskin.qr_kode}
        </p>
        {maskin.vis_pris && maskin.dogn_pris !== null && (
          <p className="mt-3 text-lg font-medium">
            {maskin.dogn_pris.toLocaleString('nb-NO')} kr
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              {' '}
              per døgn
            </span>
          </p>
        )}
      </header>

      {maskin.status === 'service' || maskin.status === 'utrangert' ? (
        <Melding tittel="Ikke tilgjengelig">
          Denne maskinen er ute av drift for øyeblikket. Ta kontakt med utleier.
        </Melding>
      ) : erMin && aktiv ? (
        <div className="space-y-4">
          <Melding tittel="Du leier denne nå" grønn>
            Startet {formatterDato(aktiv.start_tid)}. Forventet levering{' '}
            {formatterDato(aktiv.planlagt_slutt)}.
          </Melding>
          <Link
            href={`/leie/${aktiv.referanse}`}
            className="block rounded-xl bg-slate-900 px-4 py-3 text-center font-medium text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Se leien og lever tilbake
          </Link>
        </div>
      ) : aktiv ? (
        <Melding tittel="Utleid">
          Maskinen er utleid til {formatterDato(aktiv.planlagt_slutt)}. Ta kontakt
          med utleier hvis du trenger den.
        </Melding>
      ) : (
        <LeieSkjema maskinId={maskin.id} maskinNavn={maskin.navn} />
      )}
    </main>
  )
}

function Melding({
  tittel,
  children,
  grønn,
}: {
  tittel: string
  children: React.ReactNode
  grønn?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        grønn
          ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40'
          : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      <p className="font-medium">{tittel}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{children}</p>
    </div>
  )
}

function formatterDato(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
