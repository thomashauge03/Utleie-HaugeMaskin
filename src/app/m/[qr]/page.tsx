import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hentEnhetsId } from '@/lib/enhet'
import { BYTT_PASSORD_STI, hentAdmin } from '@/lib/auth'
import { hentProsjektvalg } from '@/lib/intern-leie'
import { prosjektNavn } from '@/lib/leietaker'
import type { Leie, Maskin, ProsjektInnbygd } from '@/lib/types'
import { HMLogo } from '@/components/hm-logo'
import { KNAPP_PRIMÆR, Merke } from '@/components/ui'
import { dato, osloDag, returDato } from '@/lib/dato'
import { krPer, prisEnhet } from '@/lib/pris'
import { kanLeiesUt, verkstedStatusAv } from '@/lib/verksted'
import { kortDag, kundeGrense, nesteReservasjon, reservasjonTekst } from '@/lib/reservasjon'
import { hentReservasjoner } from '@/lib/reservasjon-data'
import { LeverKnapp } from '@/app/ansatt/lever-knapp'
import { LevertRamme } from '@/app/ansatt/levert-melding'
import { UttakEnkel } from '@/app/ansatt/uttak-skjema'
import { LeieSkjema } from './leie-skjema'

export const dynamic = 'force-dynamic'

type AktivLeie = Leie & {
  ansatt: { navn: string } | null
  prosjekter: ProsjektInnbygd | null
}

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

  const [{ data: aktivRad, error: aktivFeil }, enhetsId, bruker, reservasjoner] = await Promise.all([
    supabaseAdmin
      .from('leier')
      .select('*, ansatt:admin_brukere!leier_ansatt_id_fkey(navn), prosjekter(navn, nummer)')
      .eq('maskin_id', maskin.id)
      .in('status', ['aktiv', 'venter_godkjenning'])
      .maybeSingle(),
    hentEnhetsId(),
    hentAdmin(),
    hentReservasjoner([maskin.id]),
  ])

  // En feil her skal aldri se ut som «ingen leier» – ellers viser sida
  // en utleid maskin som «Ledig nå».
  if (aktivFeil) throw new Error(`Kunne ikke hente leien: ${aktivFeil.message}`)

  const aktiv = aktivRad as unknown as AktivLeie | null
  const erMin = Boolean(aktiv && enhetsId && aktiv.enhets_id === enhetsId)
  const utilgjengelig = maskin.status === 'service' || maskin.status === 'utrangert'
  const påVerksted = !kanLeiesUt(maskin.verksted_status)

  // Kunden er ikke kjent før skjemaet sendes, så her vises grensen for
  // alle. Den reserverte kunden slipper forbi i startLeie, på mobilnummeret.
  const iDag = osloDag(new Date())
  const grense = kundeGrense(reservasjoner, iDag)
  const neste = nesteReservasjon(reservasjoner, iDag)

  // Innlogget betyr en av våre egne. De får det korte uttaksskjemaet i
  // stedet for kundeskjemaet, og ser hvilken kollega som har maskinen.
  const ansatt = bruker && !bruker.maByttePassord ? bruker : null
  const minIntern = Boolean(ansatt && aktiv?.ansatt_id === ansatt.id)
  const prosjekt = aktiv?.prosjekter ? prosjektNavn(aktiv.prosjekter) : null
  const valg =
    ansatt && !aktiv && !utilgjengelig && !påVerksted
      ? await hentProsjektvalg(ansatt.id)
      : null

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
              <Merke type="gul">
                {erMin ? 'Du leier denne' : minIntern ? 'Du har denne' : 'Utleid'}
              </Merke>
            ) : grense.type === 'sperret' ? (
              <Merke type="gul">Reservert</Merke>
            ) : (
              <Merke type="grønn">Ledig nå</Merke>
            )}
            {maskin.kategori && (
              <span className="text-sm text-white/60">{maskin.kategori}</span>
            )}
          </div>

          {/* Internleie har ingen kundepris – prisen er for kunder. */}
          {!ansatt && maskin.vis_pris && maskin.dogn_pris !== null && (
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
        {/* Etter en levering bytter siden til uttaksskjemaet – rammen
            står fast rundt og viser at leveringen gikk. */}
        <LevertRamme>
          {utilgjengelig ? (
            <Beskjed tittel="Ikke tilgjengelig">
              Denne maskinen er ute av drift. Ta kontakt med utleier.
            </Beskjed>
          ) : påVerksted && !aktiv ? (
            <Beskjed tittel="Står til reparasjon">
              {verkstedStatusAv(maskin.verksted_status) === 'deler_bestilt'
                ? 'Deler er bestilt, og den er klar når de er på plass.'
                : 'Den må sveises før den kan brukes igjen.'}{' '}
              Ta kontakt med utleier hvis du trenger den.
            </Beskjed>
          ) : erMin && aktiv ? (
            <div className="space-y-5">
              <Beskjed tittel="Leien din er i gang">
                Startet {dato(aktiv.start_tid)}. Forventet levering{' '}
                {returDato(aktiv.planlagt_slutt)}.
              </Beskjed>
              <Link href={`/leie/${aktiv.referanse}`} className={KNAPP_PRIMÆR}>
                Se leien og lever
              </Link>
            </div>
          ) : minIntern && aktiv ? (
            <div className="space-y-5">
              <Beskjed tittel={prosjekt ? `Du har denne på ${prosjekt}` : 'Du har denne'}>
                Tatt ut {dato(aktiv.start_tid)}.
                {aktiv.planlagt_slutt
                  ? ` Ventet tilbake ${dato(aktiv.planlagt_slutt)}.`
                  : ' På ubestemt tid.'}
              </Beskjed>
              <LeverKnapp leieId={aktiv.id} />
            </div>
          ) : ansatt && aktiv?.ansatt_id ? (
            <Beskjed tittel={`Hos ${aktiv.ansatt?.navn ?? 'en kollega'}`}>
              {prosjekt ? `Står på ${prosjekt}. ` : ''}
              {aktiv.planlagt_slutt
                ? `Ventet tilbake ${dato(aktiv.planlagt_slutt)}.`
                : 'Ute på ubestemt tid.'}
            </Beskjed>
          ) : aktiv ? (
            <Beskjed tittel="Maskinen er utleid">
              {aktiv.planlagt_slutt
                ? `Den er ventet tilbake ${dato(aktiv.planlagt_slutt)}. Ta kontakt med utleier hvis du trenger den før det.`
                : 'Den er utleid på ubestemt tid. Ta kontakt med utleier hvis du trenger den.'}
            </Beskjed>
          ) : bruker?.maByttePassord ? (
            <Beskjed tittel="Bytt passord først">
              Du må velge ditt eget passord før du kan ta ut utstyr.{' '}
              <Link href={BYTT_PASSORD_STI} className="font-semibold underline underline-offset-4">
                Bytt passord
              </Link>
            </Beskjed>
          ) : ansatt && valg ? (
            <div className="space-y-4">
              <p className="hm-display text-lg">Ta ut til prosjekt</p>
              {/* Varsel, ikke sperre: den ansatte avgjør selv. */}
              {neste && (
                <p className="border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm font-semibold">
                  {reservasjonTekst(neste, iDag)}
                </p>
              )}
              <UttakEnkel
                maskinId={maskin.id}
                prosjekter={valg.prosjekter}
                sistProsjektId={valg.sistProsjektId}
                iDag={iDag}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {grense.type === 'frist' && (
                <Beskjed tittel={`Reservert fra ${kortDag(grense.fra)}`}>
                  En annen kunde har reservert maskinen. Du kan leie den nå, men må
                  levere senest {kortDag(grense.sisteDag)}
                </Beskjed>
              )}
              {grense.type === 'sperret' && (
                <Beskjed tittel="Reservert nå">
                  Maskinen er reservert for en kunde til {kortDag(grense.til)} Er det
                  deg, fyll ut skjemaet med mobilnummeret du oppga da du reserverte.
                </Beskjed>
              )}
              <LeieSkjema
                maskinId={maskin.id}
                maskinNavn={maskin.navn}
                sisteDag={grense.type === 'frist' ? grense.sisteDag : undefined}
              />
            </div>
          )}
        </LevertRamme>

        {/* Vises for alle som ikke er innlogget, uansett hva maskinen
            viser over – står den utleid til en kunde, havnet lenka ellers
            aldri på skjermen, og en ansatt uten økt på telefonen fikk bare
            kundeskjemaet (spec §3.4). */}
        {!bruker && (
          <p className="mt-8 text-center">
            <Link
              href={`/admin/logg-inn?neste=${encodeURIComponent(`/m/${maskin.qr_kode}`)}`}
              className="inline-flex min-h-[2.75rem] items-center text-sm font-semibold text-[var(--blekk-svak)] underline underline-offset-4"
            >
              Ansatt? Logg inn
            </Link>
          </p>
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
