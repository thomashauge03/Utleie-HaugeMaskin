# Sletting av leier og maskiner med reservasjoner

Dato: 2026-10-01

## Problem

- `reservasjoner.leie_id` og `reservasjoner.maskin_id` (0012) har ingen
  `on delete`. En leie med en hentet reservasjon kan ikke slettes
  (`23503 … reservasjoner_leie_id_fkey`), og en maskin med reservasjoner
  kan ikke slettes i det hele tatt. Bekreftet i PGlite 30.09.2026.
- `slettLeierMedFiler` fjerner bildefilene først og ser bort fra feilen
  fra `delete`. Leien blir stående, og bildene den peker på er borte for
  godt.
- `slettLeie` og `slettMaskin` logger «slettet permanent» og sender admin
  videre uansett. `slettLeie` setter maskinen til ledig før slettingen.
- Samme nøkkel stopper `scripts/slett-testdata.mjs` (steget `leier`).

## Beslutninger

- **En hentet reservasjon slettes med leien** (`on delete cascade`).
  Avklart med Thomas 01.10.2026. «Slett leien» lover «for godt, med bilder
  og historikk», og reservasjonen hører til leiens historikk. Hentede
  reservasjoner vises ingen steder, og rydde-jobben (`/api/rydd`) lar dem
  stå fordi de hører til en leie. Uten leie ville navn og mobil blitt
  liggende til femårsrutinen.
- **Reservasjonene slettes med maskinen** (`on delete cascade`).
  `maskin_id` er påkrevd, så `set null` er ikke mulig. Bekreftelsen på
  maskinsida nevner kommende reservasjoner, slik den allerede nevner
  leiene.
- **Radene først, filene etterpå.** Slår filslettingen feil, ligger en
  foreldreløs fil og tar litt lagringsplass. Med motsatt rekkefølge mister
  en leie som ikke ble slettet bildene for godt. De bildene dokumenterer
  maskinens stand. Bildeslettingen (0014, ikke merget) tar foreldreløse
  filer når de er eldre enn 24 måneder.
- `leier.maskin_id` beholder sperren. En maskin med historikk kan fortsatt
  ikke slettes uten at appen sletter leiene først.

## Migrasjon 0015_reservasjoner_slettes_med.sql

- Bytter begge nøklene, med samme navn, til `on delete cascade`. Det skjer
  bare der nøkkelen ikke allerede har cascade, så en ny kjøring gjør
  ingenting.
- En kontroll til slutt krever én nøkkel per kolonne, begge med cascade.
  Ellers stopper den med `raise exception`.
- Den er trygg å kjøre før koden. Ingen kolonner endres, og den gamle
  koden sletter i samme rekkefølge som før. Det som feilet før, går nå.
- 0012 røres ikke, for galileo endrer den. 0013 og 0014 er tatt.
- `KJOR-DENNE.sql` lages ikke på nytt her. Main sin versjon slutter på
  0011, og main sin 0012 tåler ikke å kjøres etter 0013 (visningen). Kjør
  0015 direkte i SQL Editor. Samlefila lages på nytt når galileo er
  merget.
- `sjekk-migrasjoner.mjs` ser ikke fremmednøkler gjennom PostgREST, så
  0015 får ingen linje der. Appen sier fra i stedet (se under).

## Koden

- `slettLeierMedFiler` returnerer `{ feil }` eller
  `{ slettet, filerIgjen }`. Rekkefølgen er bildestier, `delete … select
  id`, filer.
  - En feil fra `delete` betyr at ingenting er slettet og ingen filer er
    rørt.
  - Filer Storage ikke fjernet, logges med stiene (`console.error`) og
    telles i hendelsen.
  - Logikken flyttes til `src/lib/slett-leier.ts`, som tar klienten som
    parameter, så den kan testes med `node --test`. `slett.ts` binder den
    til `supabaseAdmin`.
- `slettLeie` (useActionState) viser feilen over knappen. Maskinen
  frigjøres og hendelsen logges først når leien faktisk er slettet. Ble 0
  rader slettet, får admin «Fant ikke leien», og ingenting logges.
- `slettMaskin` (useActionState):
  - Den nekter når maskinen er utleid. Knappen er skjult da, men siden kan
    være gammel.
  - Feiler leiesteget, er ingenting slettet.
  - Feiler maskinsteget etter at leiene er slettet, logges leiene, og
    admin får vite at maskinen ble stående.
  - Hendelsen nevner leier og kommende reservasjoner.
- Hvis 23503 kommer fra `reservasjoner_*_fkey`, mangler 0015. Da står det
  «Databasen mangler migrasjon 0015, så reservasjoner stopper slettingen.
  Kjør supabase/migrations/0015_reservasjoner_slettes_med.sql i Supabase
  og prøv igjen.» Andre feil vises med databasens melding.

## Test

- **PGlite i scratchpad**, med 0001–0012 (main) og med 0001–0014
  (galileo):
  - Feilen finnes før 0015.
  - Etter 0015 går slettingen: den hentede reservasjonen forsvinner med
    leien, og reservasjonene forsvinner med maskinen.
  - Andre maskiners reservasjoner er urørt.
  - `leier.maskin_id` stopper fortsatt en maskin med leier.
  - To kjøringer av 0015 gir samme sluttilstand.
  - De nye testene feiler når 0015 mangler.
- **`node --test` med en falsk klient:**
  - Radene slettes før filene.
  - Feil gir ingen filsletting.
  - Filer som ble liggende, telles.
  - Meldingen for manglende 0015 vises.
- eslint og `tsc --noEmit` med binærene fra hovedsjekkouten.

## Utenfor

- Ende-til-ende-test mot Supabase. Docker-oppsettet finnes ikke lenger.
- Bildefiler som deles av flere leier. `fil_sti` er ikke unik, men bare
  kunden selv kan sende samme sti to ganger. Slik er det også i dag.
