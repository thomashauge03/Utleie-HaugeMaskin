# Reservasjoner – del 1: admin, kunder og ansatte

Dato: 2026-09-30

## Mål

En kunde ringer og vil ha vibroplata 14.–16. oktober. I dag finnes det
ingen måte å si det til appen på: en leie starter først når noen skanner.
Reservasjoner gjør framtidige utleier kjent, så

- en annen kunde kan leie maskinen fram til dagen før, men ikke lenger,
- en ansatt som tar den til et prosjekt, får varsel,
- den reserverte kunden får leie når dagen kommer.

Del 2 (senere): kalender på haugemaskin.no som viser opptatte dager.
Del 3 (senere): kunden ber om datoer på nettsida; forespørselen blir en
reservasjon med status «forespurt» som admin godkjenner.

## Data – migrasjon 0012

**`reservasjoner`**

| Kolonne | |
|---|---|
| `id` | uuid |
| `maskin_id` | → maskiner |
| `fra_dato`, `til_dato` | `date`, begge dager med. `til_dato >= fra_dato` |
| `kunde_navn` | påkrevd |
| `kunde_telefon` | påkrevd, åtte siffer som `kunder.telefon` – slik kjennes kunden igjen ved henting |
| `notat` | valgfritt |
| `status` | `forespurt` · `aktiv` · `hentet` · `avlyst` (standard `aktiv`; `forespurt` brukes først i del 3) |
| `leie_id` | → leier, settes når reservasjonen hentes |
| `opprettet_av`, `opprettet` | |

- To **aktive** reservasjoner på samme maskin kan ikke overlappe
  (`exclude using gist`, `btree_gist`). Forespørsler sperrer ingenting.
- RLS: bare admin (`er_admin()`), som alle andre tabeller. Kunde- og
  ansattflyten leser med service role, slik de gjør i dag.

**`hm_offentleg_opptatt`** – read-only visning for hovedsida (del 2):
`maskin_id, fra_dato, til_dato` for aktive reservasjoner og pågående
leier, bare for aktive maskiner. Ingen navn, ingen telefon. Samme
tilgangsmønster som `hm_offentleg_maskiner`: `revoke all` før
`grant select` til anon, og en kontroll som stanser migrasjonen hvis
grunntabellene mangler RLS.

Migrasjonen kjøres av Thomas i Supabase SQL Editor. Til den er kjørt,
virker appen som i dag: manglende tabell (`PGRST205`/`42P01`) betyr
«ingen reservasjoner», og admin får beskjed om å kjøre migrasjonen.

## Regler

Datoer er norske kalenderdager (`yyyy-mm-dd`). «Neste reservasjon» er
den aktive med tidligst `fra_dato` blant dem som ikke er over
(`til_dato >= i dag`).

| Hvem | Neste reservasjon (for en annen kunde) | Svar |
|---|---|---|
| Kunde | starter senere | kan leie, levering senest **dagen før** `fra_dato` – i datofeltet (`max`) og på serveren |
| Kunde | har startet | kan ikke leie. «Maskinen er reservert for en annen kunde nå. Ta kontakt med utleier.» |
| Kunde med samme mobil som reservasjonen | – | egen reservasjon teller ikke som sperre; den merkes `hentet` med `leie_id` når leien starter |
| Ansatt | finnes | varsel, aldri sperre |

Tekster (ingen kundenavn utenfor admin):

- Senere: «Reservert fra 14.10. – lever innen 13.10.»
- Nå: «Reservert for en kunde til 16.10.»

## Hvor det vises

- **Kunde, `/m/[qr]`:** en beskjed over skjemaet, og `max` på datofeltet.
  Er reservasjonen i gang: beskjed om at bare kunden med reservasjonen kan
  leie, og at den skal bruke mobilnummeret den oppga.
- **Ansatt:** under maskinnavnet i lista på `/ansatt`, i skannersvaret
  («✓ Navn – Reservert fra …», gul), over skjemaet på `/m/[qr]`, og i
  svaret etter uttak når valgt returdato (eller «til videre») går inn i
  reservasjonen.
- **Admin, kalenderen:** «+ Ny reservasjon» (maskin, fra, til, kunde,
  mobil, notat). Reservasjonene tegnes i rutenettet med stiplet gul kant,
  og listes under med «Avlys». Overlapp gir «Maskinen er allerede
  reservert i den perioden.» Er maskinen utleid med retur etter
  `fra_dato`, lagres den likevel, med varsel.
- **Admin, maskinsida:** kommende reservasjoner med «Avlys».

## Utenfor

Kalender og forespørsler på haugemaskin.no (del 2 og 3). E-post til
kunden. Endring av en reservasjon – avlys og legg inn på nytt.

## Verifisering

- Enhetstester for reglene (`src/lib/reservasjon.ts`): neste reservasjon,
  dagen før over måneds- og årsskifte, kundegrensen med og uten egen
  mobil, varseltekstene.
- Migrasjonen kjøres mot en ekte Postgres før Thomas får den: tabellen,
  overlappssperren, visningen og at anon bare kan lese visningen.
- eslint, tsc, `next build`, `npm test`.
- I nettleseren, på en midlertidig prøveside: uttakslista og skanneren med
  reserverte maskiner, kundeskjemaet med `max`, og reservasjonsskjemaet i
  admin – 375 px, lyst og mørkt.
- Publisering først etter ja fra Thomas; migrasjonen kjøres før koden
  trengs, men koden tåler at den mangler.
