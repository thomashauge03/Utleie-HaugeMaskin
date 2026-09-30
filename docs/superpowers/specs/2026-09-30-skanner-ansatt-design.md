# Kameraskanner på /ansatt

Dato: 2026-09-30

## Mål

En ansatt skal kunne skanne QR-kodene på utstyret inne i appen, krysse av
flere på rad, og ta ut alt til ett prosjekt med skjemaet som finnes i dag.
Mobilkameraet klarer bare én maskin om gangen, og åpner lenken i Safari –
der gjelder ikke innloggingen fra appen på hjemskjermen.

## Oppførsel

«Skann QR-kode» står øverst i «Ta ut utstyr», over søkefeltet, og åpner
kameraet i en dialog i fullskjerm. For hver kode som leses:

| Kode | Svar i skanneren | Lista |
|---|---|---|
| Maskin som kan tas ut | «✓ Navn», og telefonen vibrerer | krysses av (aldri av igjen) |
| Maskin som er valgt fra før | «Navn er allerede valgt» | uendret |
| Maskin som er opptatt | «Navn: grunn», samme tekst som i lista | uendret |
| Maskin som ikke står i lista | «Fant ikke maskinen» | uendret |
| Kategorikode (`/kategori/<navn>`) | «Viser <kategori> – kryss av i lista» | søket settes til kategorien |
| Kategorikode uten treff i lista | «Fant ingen <kategori> i lista» | uendret |
| Returkoden (`/retur`) | «Dette er returkoden. Lever under «Hos deg nå».» | uendret |
| Alt annet | «Ukjent kode» | uendret |

- Samme kode leses ikke på nytt før det har gått 2,5 s, så kameraet ikke
  gjentar seg mens det holdes mot koden.
- «Ferdig (N valgt)» lukker. Esc og tilbakeknappen lukker også.
- Kameraet stoppes når dialogen lukkes, og når siden forlates.
- Uten kamera eller uten tillatelse sier dialogen fra; lista virker som før.

## Teknikk

- **`src/lib/skannet-kode.ts`**: `tolkKode(tekst)` gir
  `{ type: 'maskin', qr } | { type: 'kategori', navn } | { type: 'retur' } | { type: 'ukjent' }`.
  Leser stien, ikke verten, så koder printet med en eldre adresse virker.
  Teksten brukes bare til oppslag i lista – aldri til å navigere.
- **`src/app/ansatt/skanner.tsx`**: klientkomponent med `<dialog>`.
  `getUserMedia({ video: { facingMode: 'environment' } })`. Leser med
  `BarcodeDetector` der nettleseren har den (Android/Chrome); ellers
  lastes `jsqr` først når skanneren åpnes (iPhone, PC). Et bilde omtrent
  hvert 200. ms via `setTimeout`, nedskalert til høyst 640 px.
- **`UttakMaskin`** får `qr` (`qr_kode`) fra `hentUttaksside`. Siden krever
  innlogging, og koden står uansett på maskinen.
- **Ny avhengighet:** `jsqr` 1.4.0 (Apache-2.0). Ingen egne avhengigheter
  og ingen nettverkskall.

## Utenfor

Reservasjoner og varsel om framtidige utleier (neste runde). Skanning for
levering. Skanner på verkstedet.

## Verifisering

- Enhetstester for `tolkKode`.
- eslint, tsc, `next build`, `npm test`.
- I nettleseren, på en midlertidig prøveside med den ekte `UttakListe` og
  oppdiktede maskiner: `getUserMedia` byttes ut med en strøm fra et lerret
  som viser ekte QR-koder (laget med `qrcode` fra promo-prosjektet). Sjekk
  hver rad i tabellen over, at kameraet stoppes ved lukking, og utseendet
  på 375 px i lyst og mørkt tema.
- Publisering først etter ja fra Thomas.
