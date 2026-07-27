import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Leievilkår – Utleie' }

export default function VilkarSide() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="hm-display text-3xl">Leievilkår</h1>

      <div className="mt-6 border-l-4 border-hm-amber bg-[var(--flate-2)] p-4 text-sm">
        <p className="hm-display text-lg">Utkast – må gjennomgås før bruk</p>
        <p className="mt-1 text-[var(--blekk-svak)]">
          Teksten under er et utgangspunkt, ikke juridisk kvalitetssikrede
          vilkår. Den bør gjennomgås av noen med ansvar for firmaets avtaler
          før systemet tas i bruk mot kunder.
        </p>
      </div>

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

        <Avsnitt tittel="4. Innlevering">
          Maskinen skal leveres rengjort og i samme stand som ved henting,
          normal slitasje unntatt. Leien stopper på tidspunktet du sender inn
          innleveringen i appen, ikke når utleier bekrefter den.
        </Avsnitt>

        <Avsnitt tittel="5. Pris og fakturering">
          Leien beregnes per påbegynte døgn, om ikke annet er avtalt. Endelig
          beløp fastsettes av utleier ved gjennomgang av innleveringen.
          Faktura sendes til oppgitt adresse.
        </Avsnitt>

        <Avsnitt tittel="6. Skade og tap">
          Ved skade utover normal slitasje, eller ved tap av maskinen, er du
          erstatningsansvarlig. Skader skal meldes utleier straks de oppstår,
          ikke først ved innlevering.
        </Avsnitt>

        <Avsnitt tittel="7. Forsinket levering">
          Leveres maskinen senere enn oppgitt dato, løper leien videre til
          faktisk innlevering.
        </Avsnitt>
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
