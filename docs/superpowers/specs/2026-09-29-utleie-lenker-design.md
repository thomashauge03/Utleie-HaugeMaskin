# Lenker mellom utleie-appen og hovedsida

Dato: 2026-09-29

## Mål

Utleiesida på hovedsida (hm-web-craft, `/utleie`) er den offentlige
utleienettsida. Den leser allerede maskinparken fra utleie-appen gjennom
visningen `hm_offentleg_maskiner`, så data er koblet. Det som mangler, er
veien mellom dem: appens forside viser ikke til maskinlista, og hovedsida
viser ikke til appen.

Maskinlista skal finnes ett sted. Appen får ingen egen katalog.

## Utleie-appen (utleie-hauge-maskin.vercel.app)

1. **Forsida, den svarte toppen.** Under ingressen «… QR-koden sitter på
   maskinen.» kommer knappen «Se alle maskiner og hva som er ledig» til
   `${HOVEDSIDE_URL}/utleie`. Samme form som `KNAPP_SEKUNDÆR` («Til
   retursiden»), men med faste farger – hvit flate, svart tekst – fordi
   toppen er svart i begge tema, og temafargene ville gitt hvit tekst på hvit
   flate der. Rødt er forbeholdt leieflyten.
2. **Bunnteksten.** «Hauge Maskin» til `HOVEDSIDE_URL`, først i lista foran
   Leievilkår, Personvern og Admin.
3. **Adressen.** `HOVEDSIDE_URL` er én konstant øverst i `src/app/page.tsx`.

## Hovedsida (hm-web-craft)

1. **Adressen.** `UTLEIE_APP_URL = "https://utleie-hauge-maskin.vercel.app"`
   i `src/lib/site.ts`, samme adresse som står i QR-kodene.
2. **Filmband** får valgfri `lenkje?: ReactNode`, vist under teksten på
   samme måte som i `Seksjonstopp` (`<Avslor i={2} className="mt-6">`).
3. **Utleiefilm** sender lenken «Slik leier du med QR-kode» til
   `UTLEIE_APP_URL`, tegnet som «Se alle maskiner» (strek og tekst), med
   farger for både lys og mørk flate. Filmen står på forsida og øverst på
   `/utleie`, så lenken kommer begge steder.
4. **Leveringsseddelfilm** er uendret og får ingen lenke.

## Domenet

haugemaskin.no er ikke koblet til Vercel-prosjektet `haugemaskin` ennå. Per
29.09.2026 sender `http://haugemaskin.no` videre til Facebook-sida, og https
svarer ikke. `HOVEDSIDE_URL` er derfor `https://haugemaskin.vercel.app`, og
byttes til `https://haugemaskin.no` når domenet er koblet på.

## Utenfor

Ingen maskinliste i appen, ingen bestilling på nett, ingen domeneendring.

## Verifisering

- utleie-app: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.
- hm-web-craft: `npm run lint`, `npm run typecheck`, `npm run build`.
- I nettleseren: appens forside, og forsida og `/utleie` på hovedsida, i
  375 px og PC-bredde. Lenkene går dit de skal. Thomas får skjermbilder.
- Publisering er push til `main` i begge repoene og skjer først etter ja
  fra Thomas.
