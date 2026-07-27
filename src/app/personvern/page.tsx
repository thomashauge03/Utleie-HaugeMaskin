import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Personvern – Utleie' }

export default function PersonvernSide() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Personvernerklæring</h1>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        <p className="font-medium">Utkast – firmanavn og kontaktinfo mangler</p>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Erklæringen må fylles ut med firmaets navn, organisasjonsnummer og
          kontaktadresse før systemet tas i bruk mot kunder.
        </p>
      </div>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        <Avsnitt tittel="Hvem er behandlingsansvarlig">
          [Firmanavn AS, org.nr. ..., adresse, kontakt-e-post] er ansvarlig for
          behandlingen av personopplysningene som samles inn gjennom denne
          tjenesten.
        </Avsnitt>

        <Avsnitt tittel="Hvilke opplysninger vi behandler">
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Navn, mobilnummer, adresse og e-postadresse</li>
            <li>Hvilken maskin du leier, og når</li>
            <li>Bilder du tar av maskinen ved henting og innlevering</li>
            <li>Posisjon når bildet tas, dersom du tillater det</li>
            <li>
              En tilfeldig identifikator lagret i nettleseren din, slik at du
              slipper å taste opplysningene på nytt neste gang
            </li>
          </ul>
        </Avsnitt>

        <Avsnitt tittel="Hvorfor">
          Opplysningene er nødvendige for å gjennomføre leieforholdet: for å
          vite hvem som har hvilken maskin, for å kunne kontakte deg, for å
          fakturere, og for å dokumentere maskinens tilstand ved henting og
          innlevering. Behandlingsgrunnlaget er avtalen mellom deg og oss.
        </Avsnitt>

        <Avsnitt tittel="Posisjon er frivillig">
          Du kan avslå å dele posisjon. Leien og innleveringen fungerer likevel.
        </Avsnitt>

        <Avsnitt tittel="Hvor lenge vi lagrer">
          Bilder og posisjonsdata slettes automatisk etter 24 måneder.
          Opplysninger som inngår i fakturagrunnlaget oppbevares i fem år slik
          bokføringsloven krever, og anonymiseres deretter.
        </Avsnitt>

        <Avsnitt tittel="Dine rettigheter">
          Du kan be om innsyn i opplysningene vi har om deg, få rettet feil,
          og be om sletting av opplysninger vi ikke er lovpålagt å beholde.
          Ta kontakt på [kontakt-e-post]. Du kan også klage til Datatilsynet.
        </Avsnitt>

        <Avsnitt tittel="Hvem har tilgang">
          Kun ansatte hos utleier med behov for det. Opplysningene lagres hos
          Supabase, med databaser i EU. Vi selger ikke opplysninger videre.
        </Avsnitt>
      </div>
    </main>
  )
}

function Avsnitt({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 font-medium text-slate-900 dark:text-slate-100">{tittel}</h2>
      <div>{children}</div>
    </section>
  )
}
