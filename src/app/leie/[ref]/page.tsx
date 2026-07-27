import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hentEnhetsId } from '@/lib/enhet'
import type { Leie, Maskin } from '@/lib/types'
import { HMLogo } from '@/components/hm-logo'
import { KNAPP_PRIMÆR, Merke } from '@/components/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Din leie – HM Utleie' }

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

  const merke = {
    aktiv: { type: 'grønn' as const, tekst: 'Pågår' },
    venter_godkjenning: { type: 'gul' as const, tekst: 'Venter godkjenning' },
    avsluttet: { type: 'nøytral' as const, tekst: 'Avsluttet' },
    avvist: { type: 'rød' as const, tekst: 'Avvist' },
  }[leie.status]

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
          <h1 className="hm-display mt-6 text-3xl">{maskin.navn}</h1>
          <div className="mt-3">
            <Merke type={merke.type}>{merke.tekst}</Merke>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-7">
        <dl className="border-2 border-[var(--kant)]">
          <Rad navn="Startet" verdi={tid(leie.start_tid)} />
          <Rad navn="Forventet levering" verdi={dato(leie.planlagt_slutt)} />
          {leie.slutt_tid && <Rad navn="Levert" verdi={tid(leie.slutt_tid)} />}
          {maskin.vis_pris && maskin.dogn_pris !== null && (
            <Rad
              navn="Døgnpris"
              verdi={`${maskin.dogn_pris.toLocaleString('nb-NO')} kr`}
            />
          )}
          {leie.status === 'avsluttet' && leie.belop !== null && (
            <Rad
              navn="Beløp"
              verdi={`${leie.belop.toLocaleString('nb-NO')} kr`}
              fremhevet
            />
          )}
        </dl>

        {leie.status === 'aktiv' && (
          <div className="mt-7">
            <Link href={`/leie/${leie.referanse}/retur`} className={KNAPP_PRIMÆR}>
              Lever tilbake
            </Link>
            <p className="mt-3 text-center text-sm text-[var(--blekk-svak)]">
              Du må ta bilde av maskinen når du leverer.
            </p>
          </div>
        )}

        {leie.status === 'venter_godkjenning' && (
          <Beskjed tittel="Levert – venter på godkjenning">
            Leien ble avsluttet {tid(leie.slutt_tid ?? leie.start_tid)}. Utleier
            ser over bildet og bekrefter. Du betaler ikke for ventetiden.
          </Beskjed>
        )}

        {leie.status === 'avsluttet' && (
          <Beskjed tittel="Leien er avsluttet" grønn>
            {leie.antall_dogn ? `${leie.antall_dogn} døgn. ` : ''}
            Faktura sendes til e-postadressen din.
          </Beskjed>
        )}
      </main>
    </>
  )
}

function Rad({
  navn,
  verdi,
  fremhevet,
}: {
  navn: string
  verdi: React.ReactNode
  fremhevet?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b-2 border-[var(--kant)] px-4 py-3 last:border-0">
      <dt className="text-xs font-bold tracking-widest text-[var(--blekk-svak)] uppercase">
        {navn}
      </dt>
      <dd
        className={`hm-tall text-right ${fremhevet ? 'hm-display text-2xl' : 'font-semibold'}`}
      >
        {verdi}
      </dd>
    </div>
  )
}

function Beskjed({
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
      className={`mt-7 border-l-4 bg-[var(--flate-2)] p-4 ${grønn ? 'border-hm-green' : 'border-hm-amber'}`}
    >
      <p className="hm-display text-lg">{tittel}</p>
      <p className="mt-1 text-sm text-[var(--blekk-svak)]">{children}</p>
    </div>
  )
}

const dato = (iso: string) => new Date(iso).toLocaleDateString('nb-NO')
const tid = (iso: string) =>
  new Date(iso).toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
