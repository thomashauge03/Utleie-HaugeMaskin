import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Leievilkår – HM Utleie' }
export const dynamic = 'force-dynamic'

export default async function VilkarSide() {
  const { data } = await supabaseAdmin
    .from('innstillinger')
    .select('firmanavn, vilkar_tekst')
    .maybeSingle()

  const firma = data?.firmanavn?.trim() || 'Hauge Maskin'
  const egenTekst = data?.vilkar_tekst?.trim()

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="hm-display text-3xl">Leievilkår</h1>
      <p className="mt-2 text-sm text-[var(--blekk-svak)]">
        For utleie av maskiner fra {firma}.
      </p>

      <div className="mt-8 max-w-[68ch] space-y-6 text-sm leading-relaxed">
        <Avsnitt tittel="1. Leieforholdet">
          Leien starter når du bekrefter i appen, og løper til maskinen er
          levert tilbake og innleveringen er bekreftet av utleier. Du er
          ansvarlig for maskinen i hele denne perioden.
        </Avsnitt>

        <Avsnitt tittel="2. Bruk">
          Maskinen skal brukes til det den er beregnet for, av personer med
          nødvendig kompetanse, og i tråd med bruksanvisningen. Maskinen kan
          ikke framleies eller overlates til andre uten avtale.
        </Avsnitt>

        <Avsnitt tittel="3. Dokumentasjon med bilde">
          Du tar bilde av maskinen ved henting og ved innlevering. Bildene
          dokumenterer tilstanden for begge parter og brukes ved eventuell
          uenighet om skade.
        </Avsnitt>

        <Avsnitt tittel="4. Innlevering og åpningstid">
          Maskinen leveres tilbake mellom kl. 07.00 og 17.00. Levering utenom
          dette må avtales med utleier på forhånd, og kan medføre
          ekstrakostnader. Leien stopper på tidspunktet du sender inn
          innleveringen i appen, ikke når utleier bekrefter den.
        </Avsnitt>

        <Avsnitt tittel="5. Drivstoff">
          Maskiner som bruker drivstoff skal leveres med full tank. Leveres
          maskinen med manglende drivstoff, faktureres drivstoffet etter
          forbruk, i tillegg til et påfyllingsgebyr på kr 350.
        </Avsnitt>

        <Avsnitt tittel="6. Rengjøring">
          Maskinen skal leveres rengjort og i samme stand som ved henting,
          normal slitasje unntatt. Leveres den uvasket, påløper et
          rengjøringsgebyr fra kr 500, avhengig av maskinens størrelse og
          tilstand.
        </Avsnitt>

        <Avsnitt tittel="7. Skade og tap">
          Du er ansvarlig for skade utover normal slitasje, og for tap av
          maskinen, i hele leieperioden. Skader skal meldes utleier straks de
          oppstår, ikke først ved innlevering. Erstatningen fastsettes av
          utleier ut fra reparasjonskostnad eller gjenanskaffelsesverdi.
        </Avsnitt>

        <Avsnitt tittel="8. Pris og fakturering">
          Leien beregnes per påbegynte døgn, om ikke annet er avtalt. Endelig
          beløp fastsettes av utleier ved gjennomgang av innleveringen.
          Eventuelle gebyrer for drivstoff, rengjøring eller sen levering
          kommer i tillegg. Faktura sendes til oppgitt adresse.
        </Avsnitt>

        <Avsnitt tittel="9. Forsinket levering">
          Leveres maskinen senere enn oppgitt dato, løper leien videre til
          faktisk innlevering.
        </Avsnitt>

        {/* Fritekst admin selv legger inn under Innstillinger. */}
        {egenTekst && (
          <Avsnitt tittel="10. Tilleggsvilkår">
            <span className="whitespace-pre-line">{egenTekst}</span>
          </Avsnitt>
        )}
      </div>
    </main>
  )
}

function Avsnitt({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="hm-display mb-1.5 text-lg">{tittel}</h2>
      <p>{children}</p>
    </section>
  )
}
