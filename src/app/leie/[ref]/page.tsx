import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hentEnhetsId } from '@/lib/enhet'
import type { Leie, Maskin } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Din leie – Utleie' }

export default async function LeieSide(props: PageProps<'/leie/[ref]'>) {
  const { ref } = await props.params

  const { data } = await supabaseAdmin
    .from('leier')
    .select('*, maskiner(*)')
    .eq('referanse', ref)
    .maybeSingle()

  const enhetsId = await hentEnhetsId()

  /*
   * Referansen følger et forutsigbart mønster (L-ÅÅMM-NNNN), så den kan
   * ikke være eneste sikring – ellers kunne hvem som helst telle seg
   * gjennom andres leier og lese navn og telefonnummer. Vi krever at
   * enhets-ID stemmer. Har kunden byttet telefon, finner de leien via
   * /retur ved å taste mobilnummeret sitt i stedet.
   */
  if (!data || !enhetsId || data.enhets_id !== enhetsId) {
    redirect('/retur')
  }

  const leie = data as Leie & { maskiner: Maskin }
  const maskin = leie.maskiner

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">{leie.referanse}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{maskin.navn}</h1>

      <dl className="mt-6 space-y-3 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800">
        <Rad navn="Status" verdi={<StatusMerke status={leie.status} />} />
        <Rad navn="Startet" verdi={formatterTid(leie.start_tid)} />
        <Rad navn="Forventet levering" verdi={formatterDato(leie.planlagt_slutt)} />
        {leie.slutt_tid && (
          <Rad navn="Levert" verdi={formatterTid(leie.slutt_tid)} />
        )}
        {maskin.vis_pris && maskin.dogn_pris !== null && (
          <Rad
            navn="Døgnpris"
            verdi={`${maskin.dogn_pris.toLocaleString('nb-NO')} kr`}
          />
        )}
      </dl>

      {leie.status === 'aktiv' && (
        <div className="mt-6 space-y-3">
          <Link
            href={`/leie/${leie.referanse}/retur`}
            className="block rounded-xl bg-slate-900 px-4 py-3.5 text-center font-medium text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Lever tilbake
          </Link>
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Du må ta bilde av maskinen når du leverer.
          </p>
        </div>
      )}

      {leie.status === 'venter_godkjenning' && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <p className="font-medium">Levert – venter på godkjenning</p>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Leien ble avsluttet {formatterTid(leie.slutt_tid ?? leie.start_tid)}.
            Utleier ser over bildet og bekrefter. Du betaler ikke for ventetiden.
          </p>
        </div>
      )}

      {leie.status === 'avsluttet' && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm dark:border-green-900 dark:bg-green-950/40">
          <p className="font-medium">Leien er avsluttet</p>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            {leie.antall_dogn ? `${leie.antall_dogn} døgn. ` : ''}
            Faktura sendes til e-postadressen din.
          </p>
        </div>
      )}
    </main>
  )
}

function Rad({ navn, verdi }: { navn: string; verdi: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500 dark:text-slate-400">{navn}</dt>
      <dd className="text-right font-medium">{verdi}</dd>
    </div>
  )
}

function StatusMerke({ status }: { status: Leie['status'] }) {
  const stil: Record<string, string> = {
    aktiv: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    venter_godkjenning:
      'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    avsluttet: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    avvist: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  }
  const tekst: Record<string, string> = {
    aktiv: 'Pågår',
    venter_godkjenning: 'Venter godkjenning',
    avsluttet: 'Avsluttet',
    avvist: 'Avvist',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stil[status]}`}>
      {tekst[status]}
    </span>
  )
}

function formatterDato(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatterTid(iso: string) {
  return new Date(iso).toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
