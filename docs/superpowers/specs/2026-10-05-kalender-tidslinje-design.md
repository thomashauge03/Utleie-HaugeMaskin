# Kalenderen som tidslinje – én rad per maskin

Dato: 2026-10-05

## Mål

Månedsrutenettet i `/admin/kalender` får plass til fem leier per dag
(tre før 05.10.). Leier på ubestemt tid står nå på hver dag framover, så
rutene fylles, og resten blir «+N til» – akkurat det man ikke ser.
Thomas vil ha en kalender som tåler mange leier, og overlot valget av
løsning til oss.

## Løsning

Rutenettet erstattes av en tidslinje for måneden: én rad per maskin, én
kolonne per dag. Hver leie og reservasjon er én stolpe fra første til
siste dag. Stolper som overlapper på samme maskin legges i hver sin
bane under hverandre, så ingenting skjules, uansett hvor mange leier det
er. «Er gravemaskinen ledig den 20.?» leses rett av raden.

Valgt framfor:

- **Rutenett som kan utvides** («+N til» åpner dagen): enklest, men en
  leie over tre uker er fortsatt 21 lapper, og man ser ikke én maskin
  over tid.
- **Dagsliste** (hva som er ute, dag for dag): god på mobil, men gir
  ingen oversikt over måneden.

## Slik ser den ut

- Overskriften, navigasjonen (← Forrige / I dag / Neste →),
  reservasjonsskjemaet og de to listene under («Reservasjoner i …»,
  «Leier i …») er som før.
- Topprad: ukedag (ma, ti, on …) og dato. Helg er skyggelagt; i dag er
  rød og markert nedover hele tidslinja.
- Radene grupperes etter kategori, med overskrift som på `/ansatt`, og
  sorteres på navn. Kategoriene står alfabetisk; maskiner uten kategori
  kommer sist, under «Uten kategori». Maskinkolonnen (navn og internnummer) står fast til
  venstre når tidslinja rulles sidelengs.
- Bare maskiner med leie eller reservasjon i måneden får rad. Tom måned:
  «Ingen leier eller reservasjoner i oktober.»
- **Leie:** samme farger som før – utleid grønn, forfalt rød med ⚠,
  venter godkjenning gul, avsluttet grå. Teksten er leietakeren (kunden,
  eller ansatt · prosjekt). Stolpen lenker til leia, og tooltipen har
  maskin, leietaker og datoer.
- **På ubestemt tid:** stolpen går ut til høyre kant og har «på ubestemt
  tid ▸» ytterst til høyre – også i månedene som kommer.
- Stolpe som begynner før måneden, starter med «◂»; stolpe som fortsetter
  etter måneden, slutter med «▸».
- **Reservasjon:** stiplet gul kant, «Reservert · kunde». En forespørsel
  (reservasjoner del 3) tegnes grå og stiplet med «?», når den kommer.
- **Mobil:** tidslinja rulles sidelengs (dagkolonnene er minst 2rem), og
  den ruller selv fram til i dag når inneværende måned åpnes.

## Oppbygging

- `src/lib/tidslinje.ts` – rene funksjoner, med tester:
  - `plasser({ fra, til }, førsteDag, sisteDag)` gir
    `{ fraKol, tilKol, førMåneden, etterMåneden }`, eller `null` når
    perioden ikke berører måneden. Datoene er norske kalenderdager
    (`yyyy-mm-dd`), kolonnene er dagen i måneden (1–31). `til: null` er
    ingen slutt – på ubestemt tid – og går til siste dag med
    `etterMåneden: true`.
  - `baner(elementer)` fordeler elementene på baner uten overlapp,
    sortert etter start. Et element havner i første bane der det får
    plass.
- `kalender/tidslinje.tsx` – tegner tidslinja av ferdige rader. Den
  henter ingenting selv, så den kan vises med prøvedata.
- `kalender/rull-til-i-dag.tsx` – liten klientkomponent som ruller
  beholderen fram til dagens kolonne.
- `kalender/page.tsx` – henter som før og gjør leier og reservasjoner om
  til rader med `sluttFor`, `farge`, `tilTekst` og `leietakerTekst`.
  Rutenettet (`ruter`, `LEIER_PER_RUTE`) fjernes.

Ingen databaseendring. Reservasjonene henter maskinens kategori og
internnummer i tillegg til navnet.

## Utenfor

Ansattes tilgang til kalenderen, «vis alle maskiner» (også de ledige),
dra-og-slipp, uke- og kvartalsvisning, og hjemmesidas kalender.

## Verifisering

- Enhetstester for `plasser` og `baner`: periode inne i måneden, startet
  før, uten slutt, helt før og helt etter, slutt på siste dag,
  overlapp gir ny bane, etter hverandre deler bane.
- eslint, tsc, `next build`, `npm test`.
- Lokal Supabase med mange prøveleier (minst 15 maskiner, overlapp, på
  ubestemt tid, på overtid, venter godkjenning, avsluttet, på tvers av
  måneder): 1280 px og 375 px, lyst og mørkt, i september, oktober og
  november.
- `foresporsel`-greina endrer reservasjonslappene i rutenettet. Når den
  skal inn, flyttes spørringen etter forespurte reservasjoner over;
  tidslinja har allerede stilen for dem.
