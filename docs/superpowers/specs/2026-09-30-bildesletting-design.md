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
- `slett_utlopte_bilder(tidspunkt timestamptz default now(), maks integer default 500)`
  `returns table (sti text, foreldrelos boolean)`, i plpgsql (ASCII-navn som
  resten av skjemaet):
  1. Returnerer inntil `maks` foreldreløse filer. Bare stier av formen
     `/api/bilder/ny` lager (som `BILDE_STI`), så noe annet som senere legges
     i bøtta blir stående. Finnes ikke `storage.objects`, hoppes steget over.
  2. Sletter inntil `maks` utløpte rader, eldste først, der leien ikke er
     `aktiv` eller `venter_godkjenning`.
  3. Legger én hendelse på hver berørt leie: type `bilder_slettet`, aktor
     `system`, beskrivelse «Bilder slettet etter 24 måneder: henting og
     levering» (typene som faktisk ble slettet).
  4. Returnerer stiene til de slettede radene – men ikke en sti som fortsatt
     står på en annen rad. `fil_sti` er ikke unik, og fila skal stå til den
     siste raden som bruker den, er utløpt.
- `tidspunkt` er for tester og kappes til `now()`. Et kall i SQL-editoren med
  en dato fram i tid sletter aldri mer enn det som er utløpt i dag.
- `maks` gjelder hver del. 500 + 500 holder svaret under PostgREST sitt tak på
  1000 rader. Det som ikke rekkes, tas neste dag.
- `security definer set search_path = ''`, med fullt kvalifiserte navn.
  `revoke all … from public, anon, authenticated` og `grant execute … to
  service_role`. Ellers kunne hvem som helst kalt den via `/rest/v1/rpc`. To
  kontrollblokker stopper migrasjonen: hvis anon eller authenticated kan kjøre
  funksjonen, og hvis rollen som lager den (postgres i SQL-editoren) ikke
  kommer forbi radsikkerheten på `storage.objects`. Da ville søket etter
  foreldreløse filer bare gitt tomt svar, uten feil.
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

- Leser `innstillinger.slett_gamle_bilder`. Mangler kolonnen (`42703`,
  `PGRST204`), er migrasjonen ikke kjørt, og steget hoppes over (`bilder:
  'ikke satt opp'`).
- Av: `bilder: 'av'` i svaret.
- På: `slettGamleBilder()` i `src/lib/bildesletting.ts` kaller funksjonen,
  sletter filene med `storage.from('bilder').remove()` i biter på 100, og
  returnerer `{ rader, foreldrelose, filer }`. Bare `PGRST202` (funksjonen
  finnes ikke) hoppes over. `42703` eller `42883` fra kallet kommer fra inni
  funksjonen og er en ekte feil.
- Andre feil gir status 500 med begge resultatene, så kjøringen står som
  feilet i Vercel. Neste dag prøves det på nytt.
- Svaret skrives til loggen med `console.log` (bare antall og datoer). Vercel
  logger ikke svarkroppen.
- `maxDuration = 60`, som `/api/varsler/forfalt`.

Reservasjonsslettingen går uansett bryteren.

## Innstillinger

Ny fane «Personvern» (`?fane=personvern`) med kortet «Sletting av bilder»:

- Avkrysning «Slett bilder og posisjon etter 24 måneder», med Lagre-knapp som
  i varslingsskjemaet. Forklaring under: sjekkes hver morgen, og bilder fra
  leier som ikke er avsluttet, venter til leien er ferdig.
- «Eldste bilde på en avsluttet leie er fra 03.08.2026, og det slettes ved
  første kjøring etter 03.08.2028.» Står bryteren av, står bare datoen for
  bildet. Uten bilder på avsluttede leier: «Ingen bilder på avsluttede leier
  ennå.» Bilder på leier som pågår, telles ikke, siden de venter.
- Står den av: «Bildene blir liggende til noen sletter dem, og personvernsida
  sier ikke lenger at de slettes automatisk.»
- Er migrasjonen ikke kjørt, sier kortet det og Lagre er låst, så ingen tror
  bryteren virker.
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
kjørt.

Resten av avsnittet «Hvor lenge vi lagrer» er skrevet om etter avklaring med
Thomas 30.09.2026. Personvernforordningen art. 13 nr. 2 bokstav a krever en
periode eller et kriterium for alt som lagres. Avsnittet sier nå:

- Fakturagrunnlaget: fem år etter utløpet av regnskapsåret (bokføringsloven).
- Andre opplysninger om kunden og leiene – kommentarer, merknader,
  reservasjoner, e-postloggen: fem år etter siste leie eller forespørsel.
- En reservasjon som ikke blir til leie: 30 dager etter perioden, slik
  `/api/rydd` fra `foresporsel` gjør.
- Når fristene er ute, «slettes eller anonymiseres» opplysningene. Metoden
  velges når femårsdelen bygges; før stod det bare «anonymiseres».

Teksten bygger på 746f300 (PR #1, merget til `origin/main` 30.09.2026), der
«automatisk» ble fjernet fordi ingenting slettet. Denne greina har den inne.

## Sjekkskript og samlefil

- `scripts/sjekk-migrasjoner.mjs` får 0012 (`reservasjoner.id`), 0013
  (`reservasjoner.kunde_epost`) og 0014 (`innstillinger.slett_gamle_bilder`).
  0012 og 0013 manglet.
- `supabase/KJOR-DENNE.sql` lages på nytt med `scripts/lag-samlemigrasjon.mjs`.
- 0012 lager `hm_offentleg_opptatt` bare når den ikke finnes. Etter 0013
  (kolonnen `levert`) stoppet en ny kjøring av samlefila på 0012 med «cannot
  drop columns from view», før 0014 var kjørt – og sjekkskriptet ber nettopp
  om å kjøre samlefila, «trygg å kjøre flere ganger». Endres visningen igjen
  senere, må 0013 få samme vern.

## Utrulling

`foresporsel` merges først, så denne. Thomas kjører 0014 (eller samlefila) i
Supabase SQL Editor. Rekkefølgen mellom migrasjon og kode spiller ingen
rolle. Neste morgen står `rydd {… "bilder":{"rader":0,"foreldrelose":0,
"filer":0} …}` i loggen for cron-kjøringen i Vercel.

## Utenfor – tas senere

- Femårsdelen, som personvernsida nå lover. Den må være bygd før første
  frist: rundt august 2031 for «andre opplysninger» (fem år etter den første
  leien, 2026-08) og 1.1.2032 for fakturagrunnlaget. `leier.fakturert` er
  bare ja/nei, så fristen trenger et tidspunkt (`fakturert_tid`;
  hendelsesloggen har det for gamle leier). Den må også ta kundens navn i
  `hendelser.beskrivelse` og `epost_logg.emne`, `kunde:<enhets-id>` i
  `hendelser.aktor`, hentede reservasjoner, kunder uten leie, og e-postlogg
  for forespørsler (uten `leie_id`). Sletting eller anonymisering velges da.
- Kunder kan ikke slettes fra adminpanelet.
- `bilder.ip` skrives aldri og kunne vært fjernet.

## Verifisering

- PGlite i scratchpad, aldri produksjon: 0001–0014 med stubbene fra
  migrasjonstestene, pluss `storage.objects`. Tilfeller:
  - Gammelt bilde på avsluttet leie slettes, og leien får én hendelse.
  - Gammelt bilde på aktiv leie og på leie som venter godkjenning blir stående.
  - Nytt bilde blir stående. Grensa: akkurat 24 måneder blir stående, ett
    sekund over slettes.
  - Foreldreløs fil over 24 måneder kommer med. Under 24 måneder, fil med
    rad, fil i en annen bøtte og fil med annet navnemønster gjør det ikke.
  - Andre kjøring uten filsletting returnerer de samme filene som
    foreldreløse (retter seg selv), og skriver ingen nye hendelser.
  - En sti som fortsatt står på en annen rad, returneres ikke før den siste
    raden er utløpt – og da én gang.
  - Et `tidspunkt` fram i tid sletter ikke mer enn det som er utløpt i dag.
  - `maks` begrenser antallet.
  - anon og authenticated kan ikke kjøre funksjonen, service_role kan.
  - Storage-kontrollen stopper migrasjonen for en rolle uten bypassrls.
  - Migrasjonen kan kjøres to ganger, og samlefila også.
  - `leggTilManeder` gir samme tidspunkt som Postgres.
- eslint og tsc med binærene fra hovedsjekkouten, `npm test`,
  `npm run build` med plassholdere for miljøet.
- Nettleseren: ikke mot produksjon. Fanen og personvernsida ses over etter
  utrulling, eller mot lokal Supabase hvis Thomas vil.
