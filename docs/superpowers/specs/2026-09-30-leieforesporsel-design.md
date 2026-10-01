# Reservasjoner – del 3: leieforespørsel fra haugemaskin.no

Dato: 2026-09-30

## Mål

Kunden velger datoer i kalenderen på maskinsida på haugemaskin.no og sender
en forespørsel. Den havner som reservasjon med status `forespurt` i
utleie-appen, der admin godkjenner (blir `aktiv`) eller avslår (blir
`avlyst`). En forespørsel sperrer ingenting før den er godkjent.

## Veien inn (tilnærming C)

Skjemaet sender `POST` rett fra nettleseren til
`https://utleie-hauge-maskin.vercel.app/api/foresporsel`, samme mønster som
`/api/bilder/ny`: tak per IP (`innenforGrense`), zod, JSON-svar. CORS åpner
bare for `https://haugemaskin.no`, `https://www.haugemaskin.no`,
`https://haugemaskin.vercel.app`, og `http://localhost:*` utenfor produksjon.
Ingen nøkler å sette opp.

Endepunktet avviser, med norsk feilmelding:

| Sjekk | Svar |
|---|---|
| mer enn 5 forsøk i timen fra samme IP | 429 |
| skjult felt `nettside` er fylt ut, eller skjemaet var åpent under 3 s (`brukt_ms`, målt i nettleseren) | 400, generisk |
| ugyldig maskin, dato, navn (2–100), mobil (åtte siffer), e-post, melding (≤ 500) | 400 |
| `fra` før i dag, `til` før `fra`, mer enn 60 dager, eller `til` over ett år fram | 400 |
| maskinen finnes ikke eller er ikke aktiv | 404 |
| dagene overlapper en aktiv reservasjon eller en pågående leie | 409 |
| mobilnummeret har allerede 3 åpne forespørsler | 429 |

Pågående leie regnes som opptatt fra start til og med planlagt slutt, eller
til og med i dag når slutten er ukjent – likt kalenderen på nettsida.

Lagres som `forespurt` med `opprettet_av` null (slik skilles de fra admins
egne). Etter svaret: e-post til admin med `varsleNyForesporsel`, som hopper
stille over når e-postvarsling ikke er satt opp – som de andre varslene.

## Migrasjon 0013

`alter table reservasjoner add column if not exists kunde_epost text` –
valgfri, fra skjemaet.

`hm_offentleg_opptatt` får kolonnen `levert` bakerst: sann for en leie som
venter på godkjenning. Nettsida viser datoen en maskin skulle vært levert
når den er på overtid, og uten flagget ville en levert maskin som ikke er
godkjent ennå sett ut som den var på overtid. Nettsida leser visningen med
`select=*`, så rekkefølgen på utrulling og migrasjon spiller ingen rolle.

## Admin

- **Oversikten** får flisen «Nye forespørsler» med antall åpne (`forespurt`,
  `til_dato >= i dag`), lenket til kalenderen.
- **Kalenderen** får «Nye forespørsler» øverst: datoer, maskin, navn, mobil
  (`tel:`-lenke), e-post, melding, og «Godkjenn» / «Avslå» (avslå med
  bekreftelse). Godkjenn setter `aktiv`; overlapper den en annen aktiv
  reservasjon (`23P01`), står det «Dagene er tatt i mellomtiden.» og den
  forblir forespurt. I rutenettet tegnes forespørsler med grå, stiplet kant.

## Kunden (hm-web-craft)

- `Ledigkalender` får valg av periode (`mode="range"`): dager som har vært
  og opptatte dager kan ikke velges, og et valg kan ikke spenne over en
  opptatt dag (`excludeDisabled`). Høyst 60 dager.
- Når en periode er valgt, vises skjemaet under kalenderen: navn og mobil
  (påkrevd), e-post og melding (valgfritt), skjult felt, og «Send
  forespørsel». Teksten over knappen: «Forespørselen er ikke bindende. Vi
  ringer deg for å bekrefte.»
- Kvittering: «Takk! Vi ringer deg på 412 34 567 for å bekrefte.» Feil vises
  ved knappen.
- Adressen til endepunktet er `UTLEIE_APP_URL`, overstyrbar med
  `VITE_UTLEIE_APP_URL` så utvikling aldri skriver til produksjon.
- Telefon og e-post står fortsatt som alternativ.
- Er maskinen ute uten kjent slutt, står en tydelig melding over
  kalenderen: «Ute nå – skulle vært levert 12. september» når den er på
  overtid, ellers «Ute nå», og telefonnummeret. Levert, men ikke godkjent,
  gir ingen melding.

## Personvern og sletting

- Personvernsida på haugemaskin.no får skjemaet: navn, mobil, valgfri
  e-post og melding, maskin og datoer; formål å svare på forespørselen og
  eventuelt inngå leieavtale (grunnlag: avtale, art. 6 (1) b); lagres i
  utleiesystemet hos Supabase (Irland – AWS eu-west-1, ikke Frankfurt som
  først antatt; serveren kjører i Frankfurt, fra1); varselet til admin går
  gjennom Resend, som behandler e-post i USA (standardklausuler og EU–US
  Data Privacy Framework); slettes 30 dager etter at perioden er over hvis
  det ikke blir leie.
- Daglig jobb `GET /api/rydd` (Vercel cron kl. 07:30, `CRON_SECRET` som
  `/api/varsler/forfalt`) sletter reservasjoner som ikke ble leie – status
  `forespurt`, `avlyst`, eller `aktiv` men aldri hentet – der `til_dato` er
  mer enn 30 dager tilbake. `hentet` blir stående; de hører til en leie.

## Utenfor

SMS eller e-post til kunden (admin ringer). Endring av en forespørsel.
Captcha og tredjepartsskript.

## Verifisering

- Enhetstester: valideringen og overlappsjekken (`src/lib/foresporsel.ts`).
- Migrasjon 0013 mot PGlite sammen med 0001–0012.
- eslint, tsc, bygg og tester i begge repoene.
- Nettleseren: skjemaet på maskinsida mot en lokal utleie-app (CORS,
  valideringsfeil, kvittering med avskåret `fetch`), admin-visningen på en
  prøveside. Ingen skriving til produksjon.
- Etter publisering sender Thomas én forespørsel og avslår den i admin.
