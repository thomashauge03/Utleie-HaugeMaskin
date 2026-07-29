import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { visTelefon } from '@/lib/telefon'
import { dato } from '@/lib/dato'
import {
  LEIE_MERKE,
  LEIE_STATUS_TEKST,
  erForfalt,
  type Leie,
  type Kunde,
  type Maskin,
} from '@/lib/types'
import { Merke, Seksjonstittel, TomTilstand } from '@/components/ui'
import { Søkefelt } from '@/components/sokefelt'

export const metadata: Metadata = { title: 'Leier – HM Utleie' }
export const dynamic = 'force-dynamic'

type Rad = Leie & { maskiner: Maskin | null; kunder: Kunde | null }

const FILTRE = [
  { verdi: 'alle', tekst: 'Alle' },
  { verdi: 'aktiv', tekst: 'Aktive' },
  { verdi: 'forfalt', tekst: 'Forfalt' },
  { verdi: 'venter_godkjenning', tekst: 'Venter godkjenning' },
  { verdi: 'ufakturert', tekst: 'Ikke fakturert' },
  { verdi: 'fakturert', tekst: 'Fakturert' },
  { verdi: 'avsluttet', tekst: 'Avsluttet' },
] as const

export default async function LeierSide(props: PageProps<'/admin/leier'>) {
  await krevAdmin()
  const sp = await props.searchParams
  const valgt = typeof sp.status === 'string' ? sp.status : 'alle'
  const søk = typeof sp.q === 'string' ? sp.q.trim() : ''

  const supabase = await lagServerKlient()
  let spørring = supabase
    .from('leier')
    .select('*, maskiner(*), kunder(*)')
    .order('start_tid', { ascending: false })
    .limit(500)

  // «Forfalt» og «ikke fakturert» går på tvers av status, og filtreres
  // derfor etterpå sammen med søket.
  if (valgt === 'aktiv' || valgt === 'venter_godkjenning' || valgt === 'avsluttet') {
    spørring = spørring.eq('status', valgt)
  } else if (valgt === 'forfalt') {
    spørring = spørring.eq('status', 'aktiv').lt('planlagt_slutt', new Date().toISOString())
  } else if (valgt === 'ufakturert') {
    spørring = spørring.eq('status', 'avsluttet').eq('fakturert', false)
  } else if (valgt === 'fakturert') {
    spørring = spørring.eq('fakturert', true)
  }

  const { data } = await spørring
  let leier = (data ?? []) as Rad[]

  /*
   * Søket gjøres i minnet fordi det spenner over tre tabeller, og
   * PostgREST ikke støtter OR på tvers av innebygde ressurser. Med
   * grensen på 500 rader over er det uproblematisk i denne skalaen.
   * Vokser basen til titusener, må dette flyttes til en databasevisning
   * eller fulltekstindeks.
   */
  if (søk) {
    const n = søk.toLowerCase().replace(/\s/g, '')
    leier = leier.filter((l) =>
      [
        l.referanse,
        l.maskiner?.navn,
        l.maskiner?.qr_kode,
        l.maskiner?.internnummer,
        l.kunder?.navn,
        l.kunder?.telefon,
        l.kunder?.epost,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().replace(/\s/g, '').includes(n)),
    )
  }

  const lenke = (status: string) => {
    const p = new URLSearchParams()
    if (status !== 'alle') p.set('status', status)
    if (søk) p.set('q', søk)
    const s = p.toString()
    return s ? `/admin/leier?${s}` : '/admin/leier'
  }

  return (
    <div className="space-y-6">
      <Seksjonstittel
        under={
          søk
            ? `${leier.length} treff på «${søk}»`
            : `${leier.length} ${leier.length === 1 ? 'leie' : 'leier'}`
        }
      >
        Leier
      </Seksjonstittel>

      <Søkefelt
        verdi={søk}
        plassholder="Søk på navn, referanse, maskin eller telefon"
      />

      <div className="flex flex-wrap gap-2">
        {FILTRE.map((f) => {
          const aktiv = valgt === f.verdi
          return (
            <Link
              key={f.verdi}
              href={lenke(f.verdi)}
              aria-current={aktiv ? 'true' : undefined}
              className={`inline-flex min-h-[2.75rem] items-center border-2 px-4 text-xs font-bold tracking-wider uppercase transition-colors ${
                aktiv
                  ? 'border-[var(--kant-sterk)] bg-hm-black text-white'
                  : 'border-[var(--kant)] bg-[var(--flate-opp)] hover:border-[var(--kant-sterk)]'
              }`}
            >
              {f.tekst}
            </Link>
          )
        })}
      </div>

      {leier.length === 0 ? (
        <TomTilstand tittel={søk ? 'Ingen treff' : 'Ingen leier her'}>
          {søk
            ? `Fant ingenting som matcher «${søk}». Prøv et annet søkeord, eller nullstill filteret.`
            : 'Prøv et annet filter, eller vent til første maskin blir skannet.'}
        </TomTilstand>
      ) : (
        <div className="overflow-x-auto border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)]">
          <table className="w-full text-sm">
            <thead className="bg-hm-black text-white">
              <tr>
                <Th>Referanse</Th>
                <Th>Maskin</Th>
                <Th>Kunde</Th>
                <Th>Levering</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {leier.map((l) => (
                <tr
                  key={l.id}
                  className="border-b-2 border-[var(--kant)] transition-colors last:border-0 hover:bg-[var(--flate-2)]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/leier/${l.id}`}
                      className="hm-tall inline-flex min-h-[2.75rem] items-center font-mono text-xs font-bold underline underline-offset-4"
                    >
                      {l.referanse}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-semibold">{l.maskiner?.navn ?? '–'}</td>
                  <td className="px-4 py-3">
                    <div>{l.kunder?.navn ?? '–'}</div>
                    {l.kunder && (
                      <div className="hm-tall text-xs text-[var(--blekk-svak)]">
                        {visTelefon(l.kunder.telefon)}
                      </div>
                    )}
                  </td>
                  <td className="hm-tall px-4 py-3 whitespace-nowrap">
                    {dato(l.planlagt_slutt)}
                    {erForfalt(l) && (
                      <span className="ml-2 inline-block bg-hm-red px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                        Forfalt
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Merke type={LEIE_MERKE[l.status]}>
                        {LEIE_STATUS_TEKST[l.status]}
                      </Merke>
                      {l.status === 'avsluttet' &&
                        (l.fakturert ? (
                          <span className="text-[10px] font-bold tracking-wider text-hm-green uppercase">
                            ✓ Fakturert
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold tracking-wider text-hm-amber uppercase">
                            Ikke fakturert
                          </span>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-[11px] font-bold tracking-widest uppercase">
      {children}
    </th>
  )
}
