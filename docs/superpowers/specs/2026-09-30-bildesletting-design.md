# Sletting av bilder og posisjon etter 24 måneder

Dato: 2026-09-30

## Mål

Personvernsida lover at bilder og posisjonsdata slettes etter 24 måneder.
Ingenting i koden gjør det i dag – all sletting er manuell
(`slettLeierMedFiler`). En daglig jobb skal holde løftet, og den skal kunne
slås av og på i innstillingene. Står bryteren på, sier personvernsida
«slettes automatisk».

## Avklart med Thomas

- 24 måneder regnes fra `bilder.mottatt_tid`, altså når bildet kom inn, ikke
  fra leiens slutt.
- Bilder på en leie som er `aktiv` eller `venter_godkjenning`, røres ikke før
  leien er avsluttet. En internleie «til videre» kan stå ute i årevis.
- Én bryter, på fra start. Den styrer bare bildeslettingen.
- Femårsdelen (fakturagrunnlaget) tas ikke nå: ingen anonymisering eller
  sletting av leier, kunder, hendelser, e-postlogg eller reservasjoner.
- Ingen korte frister. E-postloggen og kunder uten leie skal bli liggende i
  systemet.
- Jobben bygger på `/api/rydd` fra greina `foresporsel`, og denne greina
  merges etter den.

## Hva som slettes

1. Rader i `bilder` der `mottatt_tid` er eldre enn 24 måneder og leien ikke
   pågår. Raden har posisjonen (`lat`, `lng`, `noyaktighet_m`), så den
   forsvinner med raden. `ip` skrives aldri.
2. Fila i bøtta «bilder» for hver slettet rad.
3. Foreldreløse filer: filer i bøtta som er eldre enn 24 måneder
   (`storage.objects.created_at`) og ikke har noen rad i `bilder`. De oppstår
   når kunden tar bildet på nytt – forrige fil blir liggende – eller gir opp
   skjemaet. Én slik fil ligger i produksjon i dag, fra 27.07.2026.

Første kjøring sletter ingenting. Fila fra 27.07.2026 går 27.07.2028, og det
eldste bildet med rad (03.08.2026) går 03.08.2028, sjekket mot produksjon
(bare lesing) 30.09.2026.

## Migrasjon 0014_bildesletting.sql

- `innstillinger.slett_gamle_bilder boolean not null default true` – bryteren.
- `slett_utlopte_bilder(tidspunkt timestamptz default now(), maks integer default 1000)`
  `returns table (sti text, foreldrelos boolean)`, i plpgsql (ASCII-navn som
  resten av skjemaet):
  1. Sletter inntil `maks` utløpte rader, eldste først, der leien ikke er
     `aktiv` eller `venter_godkjenning`.
  2. Legger én hendelse på hver berørt leie: type `bilder_slettet`, aktor
     `system`, beskrivelse «Bilder slettet etter 24 måneder: henting og
     levering» (typene som faktisk ble slettet).
  3. Returnerer stiene til de slettede radene, pluss inntil `maks`
     foreldreløse filer. Finnes ikke `storage.objects`, hoppes steg 3 over.
- `security definer set search_path = ''`, med fullt kvalifiserte navn.
  `revoke all … from public, anon, authenticated` og `grant execute … to
  service_role`. Ellers kunne hvem som helst kalt den via `/rest/v1/rpc` med
  et `tidspunkt` langt fram i tid og slettet alle bildene. En kontrollblokk stopper
  migrasjonen hvis anon eller authenticated kan kjøre den.
- plpgsql framfor sql: kroppen valideres ikke mot `storage.objects` når
  funksjonen lages, så migrasjonen går også der Storage ikke finnes (PGlite,
  lokal Supabase uten Storage).
- Trygg å kjøre før koden: ingen eksisterende kolonne endres. Trygg å kjøre
  etter: ruta hopper over steget når funksjonen mangler.

### Rader først, filer etterpå

`slettLeierMedFiler` sletter filene først, fordi en fil uten rad ellers ville
blitt liggende usynlig for alltid. Her er rekkefølgen motsatt, og det er
bevisst. Radene og hendelsene slettes og skrives i én transaksjon i
databasen, og filene slettes etterpå via Storage-API-et. Feiler
filslettingen, er fila nå foreldreløs og eldre enn 24 måneder, så neste
kjøring tar den. Jobben retter seg selv, og Storage-feil kan aldri gi en
rad som peker på en borte fil.

## `/api/rydd`

Etter reservasjonene, som før:

- Leser `innstillinger.slett_gamle_bilder`. Feil (kolonnen finnes ikke) betyr
  at migrasjonen ikke er kjørt, og steget hoppes over (`bilder: 'ikke satt
  opp'`).
- Av: `bilder: 'av'` i svaret.
- På: `slettGamleBilder()` i `src/lib/bildesletting.ts` kaller funksjonen,
  sletter filene med `storage.from('bilder').remove()` i biter på 100, og
  returnerer `{ rader, foreldrelose, filer }`. Mangler funksjonen
  (`PGRST202`), hoppes steget over.
- Andre feil gir status 500 med begge resultatene, så kjøringen står som
  feilet i Vercel. Neste dag prøves det på nytt.
- `maxDuration = 60`, som `/api/varsler/forfalt`.

Reservasjonsslettingen går uansett bryteren.

## Innstillinger

Ny fane «Personvern» (`?fane=personvern`) med kortet «Sletting av bilder»:

- Avkrysning «Slett bilder og posisjon etter 24 måneder», med Lagre-knapp som
  i varslingsskjemaet. Forklaring under: sjekkes hver morgen, og bilder fra
  leier som ikke er avsluttet, venter til leien er ferdig.
- «Eldste bilde er fra 03.08.2026 og slettes tidligst 03.08.2028.» Eller
  «Ingen bilder lagret.»
- Står den av: «Bildene blir liggende til noen sletter dem, og personvernsida
  sier ikke lenger at de slettes automatisk.»
- Er migrasjonen ikke kjørt, sier kortet det, så ingen tror bryteren virker.
- `lagreBildesletting` i `innstillinger/actions.ts`: `krevAdmin`, lagrer
  bryteren, `revalidatePath` for innstillingene og `/personvern`.

## Leiesida i admin

Bilder-kortet viser «Bildene er slettet etter 24 måneder.» når leien ikke har
bilder igjen og har en `bilder_slettet`-hendelse. Ellers «Ingen bilder ennå.»
som før. Hendelsen står også i leiens logg.

## Personvernsida

«Bilder og posisjonsdata slettes automatisk etter 24 måneder» når bryteren er
på, ellers uten «automatisk». Bryteren leses i en egen spørring som tåler at
kolonnen mangler, så resten av sida ikke faller bort før migrasjonen er
kjørt. Setningen om fem år røres ikke.

Teksten bygger på 746f300 (PR #1, merget til `origin/main` 30.09.2026), der
«automatisk» ble fjernet fordi ingenting slettet. Denne greina har den inne.

## Sjekkskript og samlefil

- `scripts/sjekk-migrasjoner.mjs` får 0012 (`reservasjoner.id`), 0013
  (`reservasjoner.kunde_epost`) og 0014 (`innstillinger.slett_gamle_bilder`).
  0012 og 0013 manglet.
- `supabase/KJOR-DENNE.sql` lages på nytt med `scripts/lag-samlemigrasjon.mjs`.

## Utrulling

`foresporsel` merges først, så denne. Thomas kjører 0014 i Supabase SQL
Editor. Rekkefølgen mellom migrasjon og kode spiller ingen rolle. Neste
morgen står `bilder: { rader: 0, foreldrelose: 0, filer: 0 }` i loggen for
cron-kjøringen i Vercel.

## Utenfor – tas senere

- Femårsdelen. `leier.fakturert` er bare ja/nei, så fristen trenger et
  tidspunkt (`fakturert_tid`; hendelsesloggen har det for gamle leier). Det
  gjelder også kundens navn i `hendelser.beskrivelse` og `epost_logg.emne`,
  `kunde:<enhets-id>` i `hendelser.aktor`, hentede reservasjoner, og kunder
  uten leie. Personvernsida sier «anonymiseres deretter», og det må stemme
  med det som velges da.
- Kunder kan ikke slettes fra adminpanelet.
- `bilder.ip` skrives aldri og kunne vært fjernet.

## Verifisering

- PGlite i scratchpad, aldri produksjon: 0001–0014 med stubbene fra
  migrasjonstestene, pluss `storage.objects`. Tilfeller:
  - Gammelt bilde på avsluttet leie slettes, og leien får én hendelse.
  - Gammelt bilde på aktiv leie og på leie som venter godkjenning blir stående.
  - Nytt bilde blir stående. Grensa: akkurat 24 måneder blir stående, ett
    sekund over slettes.
  - Foreldreløs fil over 24 måneder kommer med, under 24 måneder og fil med
    rad gjør det ikke.
  - Andre kjøring uten filsletting returnerer de samme filene som
    foreldreløse (retter seg selv), og skriver ingen nye hendelser.
  - `maks` begrenser antallet.
  - anon og authenticated kan ikke kjøre funksjonen, service_role kan.
  - Migrasjonen kan kjøres to ganger.
- eslint og tsc med binærene fra hovedsjekkouten, `npm test`,
  `npm run build` med plassholdere for miljøet.
- Nettleseren: ikke mot produksjon. Fanen og personvernsida ses over etter
  utrulling, eller mot lokal Supabase hvis Thomas vil.
