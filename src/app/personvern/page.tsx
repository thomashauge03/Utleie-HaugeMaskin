import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Personvern – HM Utleie' }
export const dynamic = 'force-dynamic'

export default async function PersonvernSide() {
  const { data } = await supabaseAdmin
    .from('innstillinger')
    .select('firmanavn, varsel_epost')
    .maybeSingle()

  const firma = data?.firmanavn?.trim() || 'Hauge Maskin'
  const kontakt = data?.varsel_epost?.trim()

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="hm-display text-3xl">Personvernerklæring</h1>
      <p className="mt-2 text-sm text-[var(--blekk-svak)]">
        For utleietjenesten til {firma}.
      </p>

      <div className="mt-8 max-w-[68ch] space-y-6 text-sm leading-relaxed">
        <Avsnitt tittel="Hvem er behandlingsansvarlig">
          {firma} er ansvarlig for behandlingen av personopplysningene som
          samles inn gjennom denne tjenesten. Har du spørsmål om personvern,
          {kontakt ? (
            <>
              {' '}
              ta kontakt på{' '}
              <a
                href={`mailto:${kontakt}`}
                className="font-semibold text-hm-red-ink underline underline-offset-2"
              >
                {kontakt}
              </a>
              .
            </>
          ) : (
            ' ta kontakt med utleier.'
          )}
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
          Du kan be om innsyn i opplysningene vi har om deg, få rettet feil, og
          be om sletting av opplysninger vi ikke er lovpålagt å beholde.{' '}
          {kontakt ? (
            <>
              Ta kontakt på{' '}
              <a
                href={`mailto:${kontakt}`}
                className="font-semibold text-hm-red-ink underline underline-offset-2"
              >
                {kontakt}
              </a>
              .
            </>
          ) : (
            'Ta kontakt med utleier.'
          )}{' '}
          Du kan også klage til Datatilsynet.
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
      <h2 className="hm-display mb-1.5 text-lg">{tittel}</h2>
      <div>{children}</div>
    </section>
  )
}
