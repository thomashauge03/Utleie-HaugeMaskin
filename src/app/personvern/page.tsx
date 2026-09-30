import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Personvern – HM Utleie' }
export const dynamic = 'force-dynamic'

export default async function PersonvernSide() {
  const [{ data }, { data: sletting }] = await Promise.all([
    supabaseAdmin.from('innstillinger').select('firmanavn, varsel_epost').maybeSingle(),
    // Egen spørring: før migrasjon 0014 finnes ikke kolonnen, og da skal
    // bare «automatisk» falle bort – ikke firmanavnet og kontaktadressen.
    supabaseAdmin.from('innstillinger').select('slett_gamle_bilder').maybeSingle(),
  ])

  const firma = data?.firmanavn?.trim() || 'Hauge Maskin'
  const kontakt = data?.varsel_epost?.trim()
  // Står bryteren av, sletter ingenting av seg selv, og da skal sida ikke si det.
  const automatisk = sletting?.slett_gamle_bilder === true

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
            <li>Kommentarer du skriver ved henting og innlevering</li>
            <li>Bilder du tar av maskinen ved henting og innlevering</li>
            <li>Posisjon når bildet tas, dersom du tillater det</li>
            <li>
              Navn, mobilnummer og datoer når du reserverer en maskin på forhånd
            </li>
            <li>
              Merknader utleier skriver om leien eller kundeforholdet, for
              eksempel om skade på maskinen
            </li>
            <li>
              IP-adressen din, som brukes til å stoppe for mange forsøk på kort
              tid og ikke lagres i databasen
            </li>
          </ul>
        </Avsnitt>

        <Avsnitt tittel="Hvorfor">
          Opplysningene er nødvendige for å gjennomføre leieforholdet: for å
          vite hvem som har, eller skal ha, hvilken maskin, for å kunne kontakte
          deg, for å fakturere, og for å dokumentere maskinens tilstand ved
          henting og innlevering. Behandlingsgrunnlaget er avtalen mellom deg og
          oss. IP-adressen bruker vi bare til å hindre misbruk, og grunnlaget
          for det er vår berettigede interesse i å holde tjenesten trygg.
        </Avsnitt>

        <Avsnitt tittel="Posisjon er frivillig">
          Du kan avslå å dele posisjon. Leien og innleveringen fungerer likevel.
        </Avsnitt>

        <Avsnitt tittel="Informasjonskapsler og lagring i nettleseren">
          Tjenesten lagrer en tilfeldig identifikator i en informasjonskapsel
          (cookie) i nettleseren din, slik at du kan se og levere leien uten å
          logge inn. Den varer i to år. Mens du fyller ut leieskjemaet, husker
          nettleseren det du skriver, så du ikke mister det om du bytter app.
          Det fylles bare inn igjen de første tre timene, og sendes ikke til oss
          før du sender inn skjemaet. Vi bruker ingen informasjonskapsler til
          statistikk eller reklame.
        </Avsnitt>

        <Avsnitt tittel="Hvor lenge vi lagrer">
          Bilder og posisjonsdata slettes{automatisk && ' automatisk'} etter 24
          måneder. Opplysninger som inngår i fakturagrunnlaget, oppbevares i fem
          år etter utløpet av regnskapsåret, slik bokføringsloven krever, og
          anonymiseres deretter.
        </Avsnitt>

        <Avsnitt tittel="Hvem har tilgang">
          Kun ansatte hos utleier med behov for det, og leverandørene nedenfor,
          som behandler opplysningene på våre vegne. Vi selger ikke
          opplysninger videre.
        </Avsnitt>

        <Avsnitt tittel="Leverandører som behandler opplysningene">
          Vi har databehandleravtale med alle tre:
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Supabase</strong> lagrer databasen og bildene i et
              datasenter i Irland.
            </li>
            <li>
              <strong>Vercel</strong> kjører tjenesten på servere i Frankfurt.
            </li>
            <li>
              <strong>Resend</strong> sender e-post fra tjenesten, som
              kvitteringer til deg og varsler til utleier. Varslene inneholder
              navn, mobilnummer, e-postadresse, adresse og eventuelle
              kommentarer.
            </li>
          </ul>
        </Avsnitt>

        <Avsnitt tittel="Overføring ut av EØS">
          Resend behandler e-posten i USA. Vercel er et amerikansk selskap, og
          etter avtalen kan opplysninger også behandles i USA og andre land der
          Vercel eller underleverandørene deres har drift. Supabase-selskapet vi
          har avtale med, holder til i Singapore. Overføringene bygger på
          EU-kommisjonens standardklausuler, og Resend er i tillegg sertifisert
          under EU–US Data Privacy Framework. Ta kontakt om du vil ha en kopi av
          klausulene.
        </Avsnitt>

        <Avsnitt tittel="Dine rettigheter">
          Du kan be om innsyn i opplysningene vi har om deg, få rettet feil, be
          om sletting av opplysninger vi ikke er lovpålagt å beholde, og be om
          at behandlingen begrenses. Opplysningene du selv har gitt oss, kan du
          få utlevert i et maskinlesbart format, og du kan protestere mot
          behandling som bygger på berettiget interesse.{' '}
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
