import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { dato } from '@/lib/dato'
import { LEIE_STATUS_TEKST, MASKIN_STATUS_TEKST, type Leie, type Kunde, type Maskin } from '@/lib/types'
import { Kort, KortTittel, Merke } from '@/components/ui'
import { KopierLenke } from '../kopier-lenke'
import { RedigerSkjema } from './rediger-skjema'
import { aktiverMaskin } from './actions'

export const metadata: Metadata = { title: 'Rediger maskin – HM Utleie' }
export const dynamic = 'force-dynamic'

const merkeType = {
  ledig: 'grønn',
  utleid: 'gul',
  service: 'nøytral',
  utrangert: 'nøytral',
} as const

export default async function MaskinDetaljSide(props: PageProps<'/admin/maskiner/[id]'>) {
  await krevAdmin()
  const { id } = await props.params

  const supabase = await lagServerKlient()
  const { data } = await supabase.from('maskiner').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  const maskin = data as Maskin

  const [{ data: kategoriRader }, { data: leieRader }, { count: antallLeier }] =
    await Promise.all([
      supabase.from('kategorier').select('navn').order('navn'),
      supabase
        .from('leier')
        .select('*, kunder(*)')
        .eq('maskin_id', maskin.id)
        .order('start_tid', { ascending: false })
        .limit(10),
      // Egen telling, siden lista over er begrenset til ti.
      supabase
        .from('leier')
        .select('id', { count: 'exact', head: true })
        .eq('maskin_id', maskin.id),
    ])

  const leier = (leieRader ?? []) as (Leie & { kunder: Kunde | null })[]
  const utleid = leier.some(
    (l) => l.status === 'aktiv' || l.status === 'venter_godkjenning',
  )

  // Kategorier admin har lagt inn, pluss den maskinen faktisk bruker –
  // ellers forsvinner en fritekstkategori fra forslagslista.
  const kategorier = [
    ...new Set([...(kategoriRader ?? []).map((k) => k.navn), maskin.kategori].filter(Boolean)),
  ] as string[]

  const url = `${env.NEXT_PUBLIC_SITE_URL}/m/${maskin.qr_kode}`

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/maskiner"
          className="inline-flex min-h-[2.75rem] items-center text-sm font-semibold text-[var(--blekk-svak)] underline underline-offset-4"
        >
          ← Alle maskiner
        </Link>
        <span className="hm-skrastrek mt-2 mb-3 block" aria-hidden="true" />
        <h1 className="hm-display text-3xl">{maskin.navn}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="hm-tall font-mono text-sm text-[var(--blekk-svak)]">
            {maskin.qr_kode}
          </span>
          <Merke type={merkeType[maskin.status]}>
            {MASKIN_STATUS_TEKST[maskin.status]}
          </Merke>
          {!maskin.aktiv && <Merke type="rød">Tatt ut av bruk</Merke>}
        </div>
      </div>

      {!maskin.aktiv && (
        <div className="flex flex-wrap items-center gap-4 border-l-4 border-hm-red bg-[var(--flate-opp)] p-4">
          <p className="min-w-0 flex-1 text-sm">
            Maskinen er tatt ut av bruk og vises ikke i lista. QR-koden er
            fortsatt den samme om du tar den i bruk igjen.
          </p>
          <form action={aktiverMaskin.bind(null, maskin.id)}>
            <button className="hm-trykk inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] px-4 text-xs font-bold tracking-wider uppercase">
              Ta i bruk igjen
            </button>
          </form>
        </div>
      )}

      <Kort>
        <KortTittel>Rediger</KortTittel>
        <RedigerSkjema
          maskin={maskin}
          kategorier={kategorier}
          utleid={utleid}
          harHistorikk={(antallLeier ?? 0) > 0}
          antallLeier={antallLeier ?? 0}
        />
      </Kort>

      <Kort>
        <KortTittel>Lenke for QR-kode</KortTittel>
        <div className="p-5">
          <p className="mb-3 text-sm text-[var(--blekk-svak)]">
            Denne adressen endres aldri, heller ikke om maskinen får nytt navn
            eller ny pris. Klistremerket varer maskinens levetid.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="border-2 border-[var(--kant)] bg-[var(--flate-2)] px-2 py-1 font-mono text-xs break-all">
              {url}
            </code>
            <KopierLenke url={url} etikett="Kopier" />
          </div>
        </div>
      </Kort>

      <Kort>
        <KortTittel>Siste leier</KortTittel>
        {leier.length === 0 ? (
          <p className="p-5 text-sm text-[var(--blekk-svak)]">
            Denne maskinen har ikke vært utleid ennå.
          </p>
        ) : (
          <ul className="divide-y-2 divide-[var(--kant)]">
            {leier.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/admin/leier/${l.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition-colors hover:bg-[var(--flate-2)]"
                >
                  <span className="hm-tall shrink-0 font-mono text-xs">
                    {l.referanse}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {l.kunder?.navn ?? '–'}
                  </span>
                  <span className="hm-tall text-sm text-[var(--blekk-svak)]">
                    {dato(l.start_tid)}
                  </span>
                  <Merke
                    type={
                      l.status === 'aktiv'
                        ? 'grønn'
                        : l.status === 'venter_godkjenning'
                          ? 'gul'
                          : 'nøytral'
                    }
                  >
                    {LEIE_STATUS_TEKST[l.status]}
                  </Merke>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Kort>
    </div>
  )
}
