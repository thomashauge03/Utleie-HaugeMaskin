import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { Kort, KortTittel, Seksjonstittel } from '@/components/ui'
import { BekreftKnapp } from '@/components/bekreft-knapp'
import { KopierLenke } from '../maskiner/kopier-lenke'
import { FirmaSkjema, type Innstillinger } from './firma-skjema'
import { Kategorier, type Kategori } from './kategorier'
import { VarselSkjema, type Varsling } from './varsel-skjema'
import { VerkstedSkjema } from './verksted-skjema'
import { Deler, type Del } from './deler'
import { EpostStatus } from './epost-status'
import { nyttIcalToken } from './actions'

export const metadata: Metadata = { title: 'Innstillinger – HM Utleie' }
export const dynamic = 'force-dynamic'

const FANER = [
  { verdi: 'firma', tekst: 'Firma' },
  { verdi: 'varetyper', tekst: 'Varetyper' },
  { verdi: 'verksted', tekst: 'Verksted' },
  { verdi: 'varsling', tekst: 'Varsling' },
  { verdi: 'kalender', tekst: 'Kalender' },
] as const

type Fane = (typeof FANER)[number]['verdi']

function Faner({ valgt }: { valgt: Fane }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Innstillinger">
      {FANER.map((f) => {
        const aktiv = valgt === f.verdi
        return (
          <Link
            key={f.verdi}
            href={f.verdi === 'firma' ? '/admin/innstillinger' : `/admin/innstillinger?fane=${f.verdi}`}
            aria-current={aktiv ? 'page' : undefined}
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
    </nav>
  )
}

export default async function InnstillingerSide(
  props: PageProps<'/admin/innstillinger'>,
) {
  await krevAdmin()
  const sp = await props.searchParams

  const ønsket = typeof sp.fane === 'string' ? sp.fane : 'firma'
  const fane: Fane = FANER.some((f) => f.verdi === ønsket)
    ? (ønsket as Fane)
    : 'firma'

  const supabase = await lagServerKlient()

  const [
    { data: innst },
    { data: kategoriRader },
    { data: maskiner },
    { data: delRader },
    { data: delBruk },
  ] = await Promise.all([
    supabase.from('innstillinger').select('*').maybeSingle(),
    supabase.from('kategorier').select('id, navn, er_verksted').order('navn'),
    supabase.from('maskiner').select('kategori').eq('aktiv', true),
    supabase
      .from('verksted_deler')
      .select('id, navn')
      .order('rekkefolge')
      .order('navn'),
    supabase.from('maskin_delstatus').select('del_id'),
  ])

  // Hvor mange registreringer henger på hver del – så admin ser hva
  // som forsvinner ved sletting.
  const perDel = new Map<string, number>()
  for (const r of delBruk ?? []) {
    perDel.set(r.del_id, (perDel.get(r.del_id) ?? 0) + 1)
  }

  const deler: Del[] = (delRader ?? []).map((d) => ({
    id: d.id,
    navn: d.navn,
    antallRegistrert: perDel.get(d.id) ?? 0,
  }))

  // Tell maskiner per kategori, så admin ser konsekvensen av å slette.
  const antall = new Map<string, number>()
  for (const m of maskiner ?? []) {
    if (m.kategori) antall.set(m.kategori, (antall.get(m.kategori) ?? 0) + 1)
  }

  const kategorier: Kategori[] = (kategoriRader ?? []).map((k) => ({
    id: k.id,
    navn: k.navn,
    antallMaskiner: antall.get(k.navn) ?? 0,
  }))

  /*
   * Verkstedvelgeren må vise kategoriene som faktisk er i bruk på
   * maskinene, ikke bare de som ligger i plukklista. Kategori er
   * fritekst, så en kategori kan være i bruk uten å stå i tabellen –
   * og da ville den vært umulig å velge her.
   */
  const alleKategorier = [
    ...new Set([...kategorier.map((k) => k.navn), ...antall.keys()]),
  ].sort((a, b) => a.localeCompare(b, 'nb'))

  const icalUrl = innst?.ical_token
    ? `${env.NEXT_PUBLIC_SITE_URL}/api/ical/${innst.ical_token}.ics`
    : null

  return (
    <div className="space-y-8">
      <Seksjonstittel under="Det du endrer her slår ut i hele systemet">
        Innstillinger
      </Seksjonstittel>

      <Faner valgt={fane} />

      {fane === 'varetyper' && (
        <Kort>
          <KortTittel>Varetyper</KortTittel>
          <Kategorier kategorier={kategorier} />
        </Kort>
      )}

      {fane === 'verksted' && (
        <>
          <Kort>
            <KortTittel>Kategorier i verkstedet</KortTittel>
            <VerkstedSkjema
              kategorier={alleKategorier}
              valgte={(kategoriRader ?? [])
                .filter((k) => k.er_verksted)
                .map((k) => k.navn as string)}
            />
          </Kort>

          <Kort>
            <KortTittel>Deler</KortTittel>
            <Deler deler={deler} />
          </Kort>
        </>
      )}

      {fane === 'firma' && (
      <Kort>
        <KortTittel>Firma</KortTittel>
        <FirmaSkjema
          innstillinger={{
            firmanavn: innst?.firmanavn ?? '',
            varsel_epost: innst?.varsel_epost ?? null,
            vis_pris_standard: innst?.vis_pris_standard ?? true,
            vilkar_tekst: innst?.vilkar_tekst ?? '',
          }}
        />
      </Kort>
      )}

      {fane === 'varsling' && (
        <>
      <Kort>
        <KortTittel>Varsling på e-post</KortTittel>
        <EpostStatus />
        <VarselSkjema
          varsling={{
            varsel_epost: innst?.varsel_epost ?? null,
            varsel_kopi: innst?.varsel_kopi ?? null,
            avsender_navn: innst?.avsender_navn ?? 'HM Utleie',
            varsle_ny_leie: innst?.varsle_ny_leie ?? true,
            varsle_retur: innst?.varsle_retur ?? true,
            varsle_forfalt: innst?.varsle_forfalt ?? true,
            kvittering_start: innst?.kvittering_start ?? true,
            kvittering_retur: innst?.kvittering_retur ?? true,
            purring_forfalt: innst?.purring_forfalt ?? false,
          } satisfies Varsling}
        />
      </Kort>

      <Kort>
        <KortTittel>Kjør forfallsvarsel manuelt</KortTittel>
        <div className="p-5">
          <p className="mb-4 text-sm text-[var(--blekk-svak)]">
            Oversikten over maskiner på overtid sendes automatisk hver morgen
            kl. 07. Vil du utløse den nå — for å teste, eller fordi noe haster —
            kan du kjøre den herfra. Kunder får maks én påminnelse per døgn
            uansett hvor mange ganger du trykker.
          </p>
          <a
            href="/api/varsler/forfalt"
            target="_blank"
            rel="noopener noreferrer"
            className="hm-trykk inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] px-4 text-xs font-bold tracking-wider uppercase"
          >
            Send forfallsvarsel nå
          </a>
        </div>
      </Kort>
        </>
      )}

      {fane === 'kalender' && (
      <Kort>
        <KortTittel>Kalenderabonnement</KortTittel>
        <div className="p-5">
          <p className="mb-4 text-sm text-[var(--blekk-svak)]">
            Lenken lar Google Kalender, Outlook eller Apple Kalender hente inn
            alle utleier. Den inneholder kundenavn og telefonnummer — del den
            kun internt.
          </p>

          {icalUrl && (
            <div className="flex flex-wrap items-center gap-3">
              <code className="border-2 border-[var(--kant)] bg-[var(--flate-2)] px-2 py-1 font-mono text-xs break-all">
                {icalUrl}
              </code>
              <KopierLenke url={icalUrl} etikett="Kopier" />
            </div>
          )}

          <form action={nyttIcalToken} className="mt-5 border-t-2 border-[var(--kant)] pt-5">
            <p className="mb-3 text-sm text-[var(--blekk-svak)]">
              Har lenken kommet på avveie? Lag en ny — da slutter den gamle å
              virke, og alle som abonnerer må legge inn den nye.
            </p>
            <BekreftKnapp etikett="Lag ny lenke" bekreft="Bekreft – gammel slutter å virke" fare />
          </form>
        </div>
      </Kort>
      )}
    </div>
  )
}
