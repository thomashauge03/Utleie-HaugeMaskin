# Teknisk plan – QR-basert utleiesystem

**Kunde:** Anleggsfirma
**Formål:** Oversikt over hvilke maskiner som er utleid, hvem som har dem, og når de kommer tilbake – styrt via kalender.
**Dato:** 27.07.2026

---

## 1. Mål og avgrensning

### Skal løses
- Kunde skanner QR-kode på maskinen og starter leie **uten innlogging**
- Systemet registrerer hvem som leier (navn, mobil, firma) og hvilken telefon som ble brukt
- Ved retur må kunden **ta bilde** – leien stopper og går til admin for godkjenning
- Admin får full oversikt i liste og **kalender**
- To roller: **Admin** (innlogging) og **Kunde** (kun QR-skann)

### Skal IKKE løses i denne versjonen
- Betaling og depositum – faktura sendes separat utenfor systemet
- Bokføring / regnskapsintegrasjon
- Automatisk SMS-verifisering (se punkt 3 – bygges slik at det kan skrus på senere)

---

## 2. Roller

| | Admin | Kunde |
|---|---|---|
| Innlogging | Ja (e-post + passord) | Nei |
| Tilgang | Hele systemet | Kun egen leie |
| Gjenkjennes via | Sesjon/cookie etter login | Enhets-ID i cookie + mobilnummer |

---

## 3. Identifisering av kunde – gratis løsning

Ingen nettleser gir ut mobilnummeret automatisk. Uten å betale for SMS-verifisering eller Vipps bygger vi i stedet **fem gratis lag** som til sammen gir god sporbarhet:

### 3.1 Skjema (påkrevd)
Ved leiestart må kunden fylle ut:

| Felt | Påkrevd | Merknad |
|---|---|---|
| Navn | Ja | |
| Mobilnummer | Ja | Valideres på norsk 8-sifret format |
| Adresse | Ja | Fakturaadresse – admin har da alt som trengs for å sende faktura |
| E-post | Ja | Kvittering sendes hit, og admin får en kanal utenom SMS |
| Forventet leveringsdato | Ja | Datovelger. Driver kalenderen og forfallsvarselet |
| Kommentar | Nei | Fritekst |

Alle feltene forhåndsutfylles automatisk ved neste leie fra samme telefon (se 3.2), så gjenganger-kunder trenger bare å bekrefte og velge dato.

> **Merk:** kommentaren lagres på *leien*, ikke på kunden. Den handler som regel om denne ene jobben («skal til Storgata 14, trenger den til fredag»), ikke om kunden som sådan. Admin har et eget notatfelt på kundekortet for varige merknader.

### 3.2 Enhets-ID (automatisk, gratis)
Ved første besøk genereres en `crypto.randomUUID()` som lagres i en varig cookie + `localStorage`.

Dette gir:
- Gjenkjennelse av samme telefon ved neste leie → skjemaet forhåndsutfylles
- Kunden kommer rett inn på «Min leie» uten å taste noe
- Admin ser om to ulike navn har brukt **samme telefon**, eller om ett nummer brukes fra **mange telefoner** – begge deler er varselflagg

### 3.3 Bilde ved henting (det sterkeste beviset)
Vi krever bilde **også ved henting**, ikke bare retur. Det gir før/etter-dokumentasjon og gjør skadesaker til fakta i stedet for ord mot ord.

### 3.4 GPS ved henting og retur
`navigator.geolocation` er gratis. Lagres sammen med bildet. Dokumenterer hvor maskinen ble hentet og levert.

### 3.5 Kundeliste hos admin
Admin kan legge inn kjente kunder på forhånd. Da skjer dette automatisk:

| Nummer i kundelista | Ikke i kundelista |
|---|---|
| Grønn status, leie starter direkte | Gult flagg «Ny kunde», admin varsles |

For et anleggsfirma er de fleste leietakere kjente underentreprenører. Da er dette i praksis like sterkt som SMS-verifisering, og koster ingenting.

### 3.6 Oppgraderingsvei (bygges inn, skrus av)
Koden lages med et flagg `KREV_SMS_VERIFISERING=false`. Hvis misbruk blir et problem, skrus det på uten ombygging. Kostnad i Norge er typisk **0,20–0,40 kr per SMS** – ved 200 utleier i måneden under 100 kr/mnd. *(Priser må bekreftes hos leverandør.)*

> **Ærlig forbehold:** uten verifisering kan noen taste et falskt nummer. Sikringen ligger i bilde + GPS + registreringsnummer + at admin kjenner kundene sine. Det er godt nok for de fleste anleggsfirma, men det er en bevisst avveining – ikke et hull vi har oversett.

---

## 4. Flyt

```
QR-klistremerke på maskin
        │
        ▼
  /m/M-0042  ──►  Maskinen er utleid?  ──► «Utleid til 29.07 – ring 900 00 000»
        │
        ▼ ledig
  Skjema: navn, mobil, adresse, e-post, forventet levering, kommentar
        │
        ▼
  Bilde av maskin ved henting + GPS + godta vilkår
        │
        ▼
  ★ LEIE STARTER (servertid – ikke telefonens klokke)
        │
        │   Cookie holder «Min leie» åpen. Ingen innlogging.
        │
        ▼
  Skann RETUR-QR på arbeidsstedet  ──►  velg maskin  ──►  «Avslutt leie»
        │
        ▼
  Bilde PÅKREVD + GPS + kommentarfelt
        │
        ▼
  ★ KLOKKA STOPPER HER  →  status = venter_godkjenning
        │
        ▼
  Admin ser bildene side ved side  ──►  Godkjenn  eller  Avvis med avviksnotat
        │
        ▼
  status = avsluttet, antall døgn beregnet, klar for fakturering
```

### Designvalg 1 – hvilket tidspunkt som gjelder

Leien avsluttes på **tidspunktet returbildet ble mottatt**, ikke når admin godkjenner. Godkjenningen bekrefter bare at bildet er i orden – den flytter ikke klokka. Kunden skal ikke betale for admins responstid.

Én teknisk presisering: vi bruker **serverens mottakstidspunkt**, ikke EXIF-tidsstempelet i bildefilen. Telefonens klokke kan stilles, og et gammelt bilde kan lastes opp på nytt. Forskjellen er noen sekunder i praksis, men den ene varianten kan jukses og den andre kan ikke.

Er noe galt med returen – uskarpt bilde, feil maskin, synlig skade – **justerer admin døgn og beløp manuelt** på godkjenningsskjermen og skriver et avviksnotat. Det er ingen egen avvisningsprosess å gå gjennom. Slike tilfeller er sjeldne, og et fritekstfelt pluss to redigerbare tall løser dem bedre enn regler vi må vedlikeholde.

Det finnes likevel en «Send tilbake»-knapp for det ene tilfellet den trengs: maskinen er ikke faktisk levert. Da går leien tilbake til `aktiv` og klokka går videre.

### Designvalg 2 – pris

Døgnpris settes per maskin. Systemet **foreslår** et beløp ved godkjenning:

```
antall døgn × døgnpris     (påbegynt døgn foreslås som helt døgn)
```

Dette er et forslag, ikke en fasit. Både antall døgn og beløp er redigerbare felt på godkjenningsskjermen, og **admin avgjør etter skjønn**. Den justerte verdien er det som lagres og går videre til fakturagrunnlaget – ikke systemets forslag.

Vi bygger med vilje ingen regelmotor for helger, halve døgn, helligdager eller kulanse. Erfaringen er at slike regler alltid får unntak, og et redigerbart tall med en kommentar ved siden av er både enklere å bygge og lettere å forsvare overfor kunden.

**Skjul pris:** hver maskin har et `vis_pris`-flagg. Er det av, ser kunden maskinen og kan leie som normalt, men uten prisinformasjon. Standardverdien settes i innstillinger, og kan overstyres per maskin – nyttig hvis noen kunder har egen avtalepris som ikke skal stå på skjermen.

---

## 5. Datamodell (PostgreSQL)

```sql
-- ── Admin-brukere ─────────────────────────────────────────
-- Kobles mot Supabase Auth (auth.users). Alle har lik, full tilgang.
create table admin_brukere (
  id         uuid primary key references auth.users(id) on delete cascade,
  navn       text not null,
  epost      text not null unique,
  aktiv      boolean not null default true,
  opprettet  timestamptz not null default now()
);

-- ── Kunder ────────────────────────────────────────────────
create table kunder (
  id          uuid primary key default gen_random_uuid(),
  navn        text not null,
  telefon     text not null unique,
  adresse     text not null,                -- fakturaadresse
  epost       text not null,
  status      text not null default 'ny',   -- ny | godkjent | sperret
  admin_notat text,                         -- varig merknad, kun synlig for admin
  opprettet   timestamptz not null default now()
);

-- ── Maskiner ──────────────────────────────────────────────
create table maskiner (
  id               uuid primary key default gen_random_uuid(),
  qr_kode          text not null unique,     -- kort kode i URL, f.eks. 'M-0042'
  navn             text not null,            -- 'Wacker hoppetusse BS60-4'
  kategori         text,                     -- 'Komprimering', 'Skog', 'Sag'
  internnummer     text,
  dogn_pris        numeric(10,2),
  vis_pris         boolean not null default true, -- av = kunden ser ikke prisen
  status           text not null default 'ledig', -- ledig|utleid|service|utrangert
  bilde_url        text,
  bruksanvisning_url text,
  notat            text,
  aktiv            boolean not null default true,
  opprettet        timestamptz not null default now()
);

-- ── Leier ─────────────────────────────────────────────────
create table leier (
  id              uuid primary key default gen_random_uuid(),
  referanse       text not null unique,      -- 'L-2607-0031', menneskelesbar
  maskin_id       uuid not null references maskiner(id),
  kunde_id        uuid not null references kunder(id),
  enhets_id       text,                      -- UUID fra kundens telefon
  status          text not null default 'aktiv',
                  -- aktiv | venter_godkjenning | avsluttet | avvist
  planlagt_slutt  timestamptz not null,      -- kundens forventede leveringsdato
  start_tid       timestamptz not null default now(),
  slutt_tid       timestamptz,               -- = servertid da returbildet ble mottatt
  godkjent_tid    timestamptz,
  godkjent_av     uuid references admin_brukere(id),
  antall_dogn     numeric(6,2),              -- forslag fra systemet, redigerbart
  belop           numeric(10,2),             -- forslag fra systemet, redigerbart
  manuelt_justert boolean not null default false, -- true hvis admin endret tallene
  fakturert       boolean not null default false,
  kommentar_start text,                      -- kundens kommentar ved henting
  kommentar_retur text,                      -- kundens kommentar ved levering
  admin_notat     text,
  avvik           text,                      -- skade registrert av admin
  opprettet       timestamptz not null default now()
);

create index on leier (status);
create index on leier (planlagt_slutt) where status = 'aktiv';

-- ── Bilder ────────────────────────────────────────────────
create table bilder (
  id           uuid primary key default gen_random_uuid(),
  leie_id      uuid not null references leier(id) on delete cascade,
  type         text not null,                -- henting | levering
  fil_sti      text not null,
  lat          double precision,
  lng          double precision,
  noyaktighet_m double precision,
  tatt_tid     timestamptz not null default now(),
  ip           inet
);

-- ── Hendelseslogg (revisjonsspor) ─────────────────────────
create table hendelser (
  id          bigserial primary key,
  leie_id     uuid references leier(id) on delete cascade,
  type        text not null,                 -- opprettet|startet|retur_sendt|godkjent|avvist
  beskrivelse text,
  aktor       text,                          -- 'kunde:<enhets_id>' | 'admin:<epost>'
  tid         timestamptz not null default now()
);
```

### Om admin-brukere

Flere brukere, **én tilgangsnivå** – alle kommer inn på samme adminpanel med lik tilgang. Ingen rollehierarki å vedlikeholde.

Gevinsten ved egne brukere fremfor én delt konto er sporbarhet: `leier.godkjent_av` og hendelsesloggen viser hvem som faktisk godkjente hver retur. Blir det uenighet om en skade måneder senere, står det svart på hvitt hvem som så på bildet.

Ny bruker opprettes av en eksisterende admin under `/admin/brukere` – invitasjon på e-post, brukeren setter selv passord. Deaktivering skjer ved å sette `aktiv = false`, ikke ved sletting, slik at historikken beholder navnet.

---

## 6. Sider

### Kundeside (ingen innlogging, mobiloptimalisert)

| Rute | Innhold |
|---|---|
| `/m/[qr]` | Maskinkort: bilde, navn, døgnpris, status. Knapp avhengig av status |
| `/m/[qr]/lei` | Skjema + kamera for hentingsbilde + vilkår |
| `/retur` | **Felles retur-QR på arbeidsstedet.** Gjenkjenner telefonen, viser aktive leier, sender videre til kamera |
| `/leie/[ref]` | Kvittering: hva du har leid, siden når, forventet levering, «Avslutt leie» |
| `/leie/[ref]/retur` | Kamera (påkrevd) + GPS + kommentar |
| `/mine` | Alle aktive leier på denne telefonen |
| `/vilkar` | Leievilkår |
| `/personvern` | Personvernerklæring |

### Adminpanel (innlogging)

| Rute | Innhold |
|---|---|
| `/admin` | Dashbord: utleid nå, **forfalt**, venter godkjenning, ledig |
| `/admin/kalender` | Måned/uke. Rader = maskiner, blokker = leier |
| `/admin/leier` | Filtrerbar liste med søk på kunde/maskin/regnr |
| `/admin/leier/[id]` | Detalj. **Hentingsbilde og returbilde side ved side.** Godkjenn / Avvis |
| `/admin/maskiner` | Legg til, rediger, sett i service. **Kopier URL** per maskin + CSV-eksport av alle |
| `/admin/kunder` | Kundeliste, sperr kunde, notater, leiehistorikk. **Kopier fakturagrunnlag** |
| `/admin/brukere` | Inviter og deaktiver admin-brukere. Alle får lik tilgang |
| `/admin/innstillinger` | Vilkårstekst, iCal-lenke, varslingsadresser, standard prisvisning |

---

## 7. Kalender

To ting, begge gratis:

### 7.1 Innebygd kalendervisning
Måneds- og ukevisning i adminpanelet. Maskiner som rader, leieperioder som blokker. Fargekoder:

- 🟩 Aktiv leie innenfor forventet leveringsdato
- 🟥 **Forfalt** – forventet leveringsdato er passert uten retur
- 🟨 Venter godkjenning
- ⬜ Ledig

Forventet leveringsdato er det kunden selv oppga ved henting. Den er ikke bindende, men den er det admin styrer etter – og den utløser et automatisk e-postvarsel når datoen passeres uten at maskinen er levert.

### 7.2 iCal-feed (abonnement)
Endepunkt `/api/ical/<hemmelig-token>.ics` som admin abonnerer på i **Google Kalender, Outlook eller Apple Kalender**. Da dukker alle utleier opp i kalenderen admin allerede bruker, på mobil og PC, uten å logge inn i systemet.

Hver leie blir en hendelse:
```
Hoppetusse BS60 – Ola Nordmann
27.07 08:00 → 29.07 (forventet levering)
Mobil: 900 00 000 · ola@eksempel.no
Storgata 14, 5003 Bergen
«Trenger den til fredag»
```

Read-only og krever ingen OAuth-oppsett. Toveis Google-synk kan legges til senere hvis ønskelig, men er unødvendig komplekst nå.

---

## 8. QR-koder og URL-er

Systemet genererer **ikke** QR-bilder selv – dere har egen generator. Systemet leverer i stedet stabile URL-er som kan kopieres rett inn i den.

### 8.1 Én URL per maskin (henting)

Hver maskin får en fast, kort adresse:

```
https://utleie.<firma>.no/m/M-0042
```

I `/admin/maskiner` står URL-en synlig ved hver maskin med en **«Kopier lenke»**-knapp. Det finnes også en **«Kopier alle»**-knapp som gir hele listen som CSV (`internnummer, navn, url`), slik at dere kan masse-generere QR-koder i ett jafs i stedet for én om gangen.

URL-en er permanent. Den endres aldri, heller ikke om maskinen får nytt navn eller ny pris – da overlever klistremerket hele maskinens levetid.

### 8.2 Én felles URL for levering (arbeidsstedet)

```
https://utleie.<firma>.no/retur
```

Dette er **én QR-kode for hele anlegget**, ikke én per maskin. Den henges opp der maskinene leveres inn.

Kunden skanner, og siden gjenkjenner telefonen via cookien:

| Situasjon | Hva kunden ser |
|---|---|
| Én aktiv leie | Går rett til kamera for den maskinen |
| Flere aktive leier | Velger fra liste hvilken som leveres |
| Ingen cookie (ny telefon, slettet nettleserdata) | Taster mobilnummer og får opp sine aktive leier |

Dette er bedre enn å skanne maskinens egen QR ved retur, av to grunner: klistremerket på maskinen er ofte skittent eller skadet etter bruk, og leveringen skjer uansett alltid på samme sted.

> **Liten personvernvurdering på nummer-oppslaget:** hvem som helst kan i prinsippet taste et tilfeldig nummer og se om det har en aktiv leie. Vi begrenser skaden ved å vise kun maskinnavn og startdato – ingen navn, adresse eller kontaktinfo – og ved å rate-limite oppslaget. Risikoen er lav, men den er verdt å være klar over.

### 8.3 Praktiske råd for klistremerkene

- Laminerte eller UV-bestandige vinyletiketter, minimum **4×4 cm**
- Plasser dem der de ikke slites mot bakken eller lasteplanet
- **Lag alltid to per maskin** – ett faller av
- Skriv maskinnavn og internnummer under QR-en, så kan koden identifiseres manuelt hvis skanningen svikter
- Retur-koden på arbeidsstedet bør være **stor** (A5 eller større) og henge i lamineringslomme under tak

QR-ene peker på offentlige URL-er. Alt en fremmed kan se er at maskinen finnes og om den er utleid. Ingen personopplysninger eksponeres.

---

## 9. Teknisk stack

| Lag | Valg | Hvorfor |
|---|---|---|
| Frontend + backend | **Next.js (App Router)** | Én kodebase, server-rendret, rask på mobil |
| Database | **PostgreSQL via Supabase** | Ferdig admin-innlogging, radnivå-sikkerhet |
| Bildelagring | **Supabase Storage** | Innebygd, signerte URL-er |
| Kamera | `<input type="file" capture="environment">` | Åpner kamera direkte, ingen app. Krever HTTPS |
| Bildekomprimering | `browser-image-compression` | Klientside ned til ~1200 px / ~200 kB før opplasting |
| QR | *Ingen* – ekstern generator | Systemet leverer kopierbare URL-er, dere lager kodene selv |
| Kalender-UI | Egen komponent | Enklere enn tunge biblioteker for dette behovet |
| iCal | `ics` (npm) | Genererer feed |
| E-postvarsel | Resend (gratis inntil ~3 000/mnd) | Varsler admin ved ny leie og retur |

### Bildeopplasting – hvorfor den går utenom serveren

Next.js 16 setter en grense på **1 MB** for hvor mye data en server action kan ta imot. Et ukomprimert mobilbilde er ofte 3–5 MB, så bildene kan ikke sendes den veien.

Flyten blir derfor:

```
Kamera  →  komprimering i nettleseren (~1200 px, ~200 kB)
        →  server utsteder en signert opplastingslenke
        →  nettleseren laster opp direkte til Supabase Storage
        →  filstien sendes tilbake og lagres på leien
```

Dette er også raskere for kunden, siden bildet ikke må innom vår server, og det er mønsteret Next-dokumentasjonen selv anbefaler for brukergenererte filer.

### Kostnadsbilde (ærlig)
- **Domene:** ~150 kr/år
- **Supabase gratis:** 500 MB database + 1 GB fillagring. Med komprimerte bilder holder 1 GB til ca. **5 000 bilder** – flere år med drift. *Merk: gratisplanen pauser prosjektet etter 7 dagers inaktivitet. Ikke et problem i daglig drift, men verdt å vite.*
- **Vercel:** gratisplanen er formelt for ikke-kommersiell bruk. For et firma betyr det Pro til ca. **$20/mnd**, eller selvhosting på en VPS til ca. **60–100 kr/mnd**
- **Realistisk:** enten ~450 kr/mnd på ferdige tjenester, eller ~100 kr/mnd på egen VPS med litt mer oppsettarbeid

---

## 10. Personvern (GDPR)

Systemet behandler personopplysninger: navn, mobilnummer, GPS-posisjon og bilder.

**Må på plass før lansering:**
- **Personvernerklæring** på `/personvern`, lenket fra leieskjemaet
- **Behandlingsgrunnlag:** avtale (leieforholdet) – ikke samtykke, siden opplysningene er nødvendige for å gjennomføre leien
- **GPS må være valgfritt.** Kunden kan avslå, og leien må fungere likevel. Å tvinge fram posisjon er ikke lov når det ikke er strengt nødvendig
- **Sletterutine:**
  - Bilder og GPS: slettes automatisk etter **24 måneder**
  - Leiedata som er fakturagrunnlag: beholdes **5 år** (bokføringsloven), deretter anonymiseres kundedata
- **Innsyn og sletting:** admin må kunne eksportere og slette all data om én kunde fra `/admin/kunder`

---

## 11. Faseplan

| Fase | Innhold | Estimat |
|---|---|---|
| **0** | Repo, domene, Supabase-prosjekt, deploy-pipeline | 0,5 dag |
| **1** | Datamodell, admin-innlogging, maskin-CRUD, kopierbare URL-er + CSV | 2 dager |
| **2** | Kundeflyt: QR → maskinside → skjema → hentingsbilde → leie starter | 2 dager |
| **3** | Retur: `/retur`-siden, kamera, GPS, klokka stopper, admin godkjenning med redigerbare tall | 2,5 dager |
| **4** | Kalendervisning + iCal-feed + forfallsvarsel på e-post | 1,5 dager |
| **5** | Personvernside, vilkår, sletterutine, mobiltesting på iOS og Android | 1,5 dager |
| | **Sum** | **~10 dagsverk** |

Etter fase 3 har dere et system som faktisk kan brukes i drift. Fase 4 og 5 gjør det behagelig og lovlig.

---

## 12. Avklarte valg

| Spørsmål | Valg |
|---|---|
| Booking fram i tid | **Nei.** Leie starter her og nå. Kunden oppgir kun forventet leveringsdato |
| Pris | **Ja, med pris.** Per maskin kan admin skjule den for kunden |
| Sluttidspunkt | **Tidspunktet returbildet ble mottatt.** Admins godkjenning flytter ikke klokka |
| Admin-brukere | **Flere brukere, lik tilgang.** Gir sporbarhet på hvem som godkjente |
| Registreringsnummer | **Utgår** |
| Kundefelt | Navn, mobil, adresse, e-post, forventet levering, kommentar |
| Prisregel | **Ingen regelmotor.** Systemet foreslår, admin justerer etter skjønn |
| Avvik og skade | Håndteres med manuell justering + avviksnotat, ikke egen prosess |
| QR-generering | **Ekstern.** Systemet gir kopierbare URL-er per maskin + CSV-eksport |
| Retur-QR | **Én felles kode** på arbeidsstedet, ikke per maskin |

## 13. Fortsatt uavklart

1. **Varsling** – hvilken e-postadresse skal ha beskjed ved ny utleie, ved innlevert retur, og ved forfalt maskin? Samme adresse for alt, eller ulike?
2. **Antall maskiner** – ca. hvor mange enheter skal inn til å begynne med? Påvirker hvordan maskinlisten og QR-utskriften bør organiseres.
3. **Kunde bytter telefon** – da mister de cookien. Foreslått løsning: de skanner QR-en på maskinen de har, taster mobilnummeret sitt, og gjenkjennes slik. Greit?
4. **Dårlig dekning** – trengs offline-støtte hvis kunden står uten nett når maskinen skal leveres? Kan løses med lokal mellomlagring som sender når nettet er tilbake, men det er ekstraarbeid og bør bare bygges hvis det er et reelt problem.
