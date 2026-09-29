# Ansatt-rollen — design

Dato: 2026-09-28
Status: Godkjent i samtale, venter på gjennomlesing

Egne folk skal kunne ta ut utstyr til firmaets prosjekter uten å fylle ut
kundeskjemaet. De er innlogget, så hvem de er ligger allerede lagret. De
velger utstyr og prosjekt, og internleia føres på prosjektet.

## Formål

I dag kan bare kunder leie, og de fyller ut navn, mobil, adresse, e-post,
dato, bilde og vilkår hver gang. Når en ansatt tar en hoppetusse til et
anlegg, er alt det støy – og det finnes ingen måte å si hvilket prosjekt
utstyret står på, eller hva et prosjekt har brukt på utstyr.

Siden skal svare på to spørsmål: *hva har jeg ute?* for den ansatte, og
*hva har dette prosjektet kostet i internleie?* for admin.

## Beslutninger fra samtalen

| Spørsmål | Svar |
|---|---|
| Hvem er «ansatte»? | Egne folk i Hauge Maskin, på egne prosjekter. Ingen kunde faktureres. |
| Pris? | Internpris: døgn × maskinens pris føres på prosjektet. Ingen faktura. |
| Hvem lager prosjektene? | Admin. Ansatte velger fra lista. |
| Hvordan velges utstyr? | Liste med avkrysning (flere om gangen), og QR på maskinen gir samme korte skjema med maskinen forhåndsvalgt. |
| Levering? | Rett tilbake i drift. Ingen godkjenning. Admin kan rette beløpet etterpå. |
| Returdato? | Valgfri. Tom betyr «til videre», og da blir leien aldri forfalt. |
| Brukere? | Admin oppretter med midlertidig passord som må byttes ved første innlogging – flyten finnes, rollen «ansatt» legges til. |
| Lagring? | Samme `leier`-tabell (alternativ A). En leie har enten kunde eller ansatt. |

## Avgrensning

Ikke i denne runden:

- Flytte utstyr direkte mellom prosjekter. «Lever» og «Ta ut» gjør samme nytten.
- Eksport av prosjektsummer til Excel/CSV.
- Egen flis i Hauge Maskin-appen (ligger i repoet `hauge-maskin-mobil`).
- E-post til den ansatte. Ingen kvitteringer, ingen purringer.
- Bilde og vilkårsavkrysning for ansatte.

---

## 1. Datamodell

Migrasjon `supabase/migrations/0011_ansatt.sql`. Idempotent, som de andre:
`if not exists`, `drop … if exists` før `create policy`.

### 1.1 Ny tabell `prosjekter`

| Kolonne | Type | Merknad |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `navn` | `text not null unique` | «Kvamsøy bru» |
| `nummer` | `text` | valgfritt, «P-2317» |
| `aktiv` | `boolean not null default true` | avsluttet = `false` |
| `opprettet` | `timestamptz not null default now()` | |

RLS på, policy `admin_alt` med `er_admin()`, som resten.

Et prosjekt kan avsluttes og gjenåpnes. Det kan slettes bare når ingen leie
peker på det – fremmednøkkelen fra `leier` stopper sletting ellers, og
handlingen sier fra med en forståelig melding.

### 1.2 `admin_brukere`

- Rollesjekken utvides til `('admin', 'service', 'ansatt')`. Sjekken fra
  0005 ble laget inline på kolonnen, så navnet er generert. Migrasjonen
  finner og dropper derfor enhver check-constraint på tabellen som nevner
  `rolle`, i en `do`-blokk, før den nye legges til med fast navn
  `admin_brukere_rolle_check`.
- Ny kolonne `telefon text` (valgfri). Normaliseres med `normaliserTelefon`
  når den lagres.

### 1.3 `leier`

- `kunde_id` blir valgfri (`drop not null`).
- `planlagt_slutt` blir valgfri (`drop not null`).
- Ny `ansatt_id uuid references admin_brukere(id)`.
- Ny `prosjekt_id uuid references prosjekter(id)`.
- Ny check `leier_leietaker_check`, som låser de to formene en leie kan ha:
  - **kundeleie:** `kunde_id` satt, `ansatt_id` og `prosjekt_id` tomme,
    `planlagt_slutt` satt – nøyaktig som før
  - **internleie:** `kunde_id` tom, `ansatt_id` og `prosjekt_id` satt,
    `planlagt_slutt` valgfri
- Delvise indekser på `prosjekt_id` og `ansatt_id` (`where … is not null`).

Eksisterende rader oppfyller kundeformen, så sjekken kan legges på uten
å røre data.

`leier_en_aktiv_per_maskin` gjelder uendret for begge formene. Det er
hele poenget med å bruke samme tabell: en kunde og en ansatt kan ikke ta
samme maskin samtidig.

Internleier bruker de samme kolonnene for pris som kundeleier:
`antall_dogn`, `belop` og `manuelt_justert`. `enhets_id`, `godkjent_tid`
og `godkjent_av` står tomme – ingen har godkjent noe.

**Obs for spørringer:** `leier` får med dette *to* fremmednøkler til
`admin_brukere` (`godkjent_av` og `ansatt_id`). PostgREST nekter da
`admin_brukere(*)` uten hint. Innbygging skrives som
`ansatt:admin_brukere!leier_ansatt_id_fkey(navn, telefon, epost)`.

### 1.4 Sikkerhet

`er_admin()` sjekker i dag bare at brukeren er aktiv, ikke rollen. Alle
policyene bygger på den, så en servicebruker kan i dag gå rett mot
databasen med sin egen sesjon og lese og endre alt – også kundenes
persondata. Med alle ansatte som brukere blir det et reelt hull.

- `er_admin()` krever `rolle = 'admin'`.
- Ny policy `egen_rad` på `admin_brukere`: `for select using (id = auth.uid())`.
  Det er alt innloggingen (`hentAdmin`, `loggInn`) leser med brukerens
  egen sesjon.

Kontrollert: verkstedet skriver med service role (`supabaseAdmin`), og
passordbyttet skriver flagget med service role. Ingen andre steder bruker
en ikke-admin sin sesjon mot tabellene.

Alt de ansatte gjør, går gjennom server actions med `supabaseAdmin`, som
selv sjekker at leien tilhører den innloggede.

Fem steder i koden sjekker i dag bare «innlogget», ikke rolle. Det var
greit så lenge alle innloggede var admin eller service, men ikke med
ansatte:

- `/api/faktura/[id]` (kundens navn, adresse og bilder), `/api/maskiner/csv`
  og den manuelle utløseren i `/api/varsler/forfalt` (sender e-post til
  kunder) krever admin – ny `hentFullAdmin()` i `auth.ts`.
- Verkstedets endringer i `src/app/verksted/actions.ts` (status, deler,
  mål, notater) og redigeringen på verkstedsidene krever admin eller
  service – ny `kanEndreVerksted()`. En innlogget ansatt kan melde
  «må sveises» som alle andre, men logges med navn i stedet for enhets-ID.

### 1.5 Rekkefølge

Migrasjonen kjøres i Supabase **før** koden deployes. Den er trygg å kjøre
mot koden som ligger ute i dag: nye kolonner er valgfrie, eksisterende
rader oppfyller sjekken, og tilgangsendringen treffer ingen kodevei
(se 1.4).

- Ny rad i `scripts/sjekk-migrasjoner.mjs`: `prosjekter.id`.
- `supabase/KJOR-DENNE.sql` lages på nytt med `scripts/lag-samlemigrasjon.mjs`.
- Ansattsiden viser «ikke satt opp ennå» hvis `prosjekter` mangler, i
  stedet for å krasje.

### 1.6 Typer

`src/lib/types.ts`:

- `Leie.kunde_id`, `Leie.planlagt_slutt`: `string | null`
- `Leie.ansatt_id`, `Leie.prosjekt_id`: `string | null`
- ny `Prosjekt`
- `erForfalt`: `planlagt_slutt === null` gir `false`

`Rolle` i `src/lib/auth.ts` får `'ansatt'`.

At `planlagt_slutt` blir nullbar, gjør at TypeScript peker ut alle ~40
stedene som leser den. Hvert sted skal vise «til videre» eller hoppe over
datoen – ikke gjette.

---

## 2. Roller og tilgang

| Rolle | Kommer inn på | Havner på etter innlogging |
|---|---|---|
| admin | alt | `/admin` |
| service | `/verksted` og `/ansatt` | `/verksted` |
| ansatt | `/ansatt` | `/ansatt` |

Alle roller er egne folk, og **alle kan gjøre alt en ansatt kan**: ta ut
utstyr, levere, bruke det korte skjemaet på maskinens QR-kode og bli sendt
videre fra `/retur`. Service har i tillegg verkstedet, admin har alt.
Rollen `ansatt` skiller seg ut ved å *bare* komme inn på sin egen side.

### 2.1 `src/lib/auth.ts`

- `krevAdmin()`: `ansatt` sendes til `/ansatt`, som `service` sendes til
  `/verksted` i dag.
- Ny `krevAnsatt()`: krever innlogget, aktiv bruker med byttet passord.
  Alle roller slipper gjennom. Brukes av `/ansatt` og handlingene der.
- Én hjelper `hjemFor(rolle)` → `/admin` | `/verksted` | `/ansatt`, brukt
  etter passordbytte og der det ellers ville stått en ternær.

### 2.2 Innlogging

- Samme side som i dag, `/admin/logg-inn`.
- Ny valgfri `?neste=`. Siden sender den videre i et skjult felt, og
  handlingen følger den **bare** hvis den er en lokal sti: starter med `/`,
  ikke `//` eller `/\`. Ellers `/admin` som før. Valideringen er en ren
  funksjon `trygtNeste()` med tester – dette er en klassisk åpen omdirigering
  hvis den gjøres feil.
- Maskinsiden og `/retur` får en liten lenke «Ansatt? Logg inn» med `neste`
  satt tilbake til siden. Uten den ville en ansatt som ikke har logget inn
  på telefonen ennå, fått kundeskjemaet og kanskje fylt det ut.
- `src/proxy.ts` frisker i dag bare opp sesjonen under `/admin`. Server
  components kan ikke skrive informasjonskapsler, så på `/verksted` – og
  nå `/ansatt`, `/m/…` og `/retur` – ble en utløpt sesjon aldri fornyet, og
  brukeren ble logget ut etter omtrent en time. Matcheren utvides til de
  fire, og proxyen hopper rett videre når forespørselen ikke har noen
  Supabase-informasjonskapsel – kunder betaler ingenting for dette.

### 2.3 Brukere (`/admin/brukere`)

- «Ny bruker» får valget *Ansatt – kan ta ut utstyr til prosjekter* og et
  valgfritt felt *Mobilnummer*. Midlertidig passord og tvunget bytte som i dag.
- Teksten for servicearbeider endres fra «kun verkstedet» til «verkstedet,
  og kan ta ut utstyr til prosjekter».
- Redigering får samme rollevalg og mobilnummer.
- Lista viser rollen, og for brukere med utstyr ute: «2 ting ute». Det er
  det admin trenger å se før noen deaktiveres.

### 2.4 Meny mellom sidene

`BrukerMeny` fra verkstedhodet (`src/app/verksted/bruker-meny.tsx`) blir
felles meny øverst på både `/verksted` og `/ansatt`:

| Lenke | Vises for |
|---|---|
| Adminpanel | admin |
| Verksted | admin, service |
| Ta ut utstyr | alle |
| Bytt passord | alle |
| Logg ut | alle |

Lenken til siden man står på vises ikke. Rolleetiketten får «Ansatt» i
tillegg til «Admin» og «Servicearbeider».

---

## 3. Den ansattes flyt

### 3.1 Siden `/ansatt`

Laget for mobil, i samme stil som `/verksted`. Topp med logo og den felles
menyen (se 2.4). Ikke inni adminpanelets layout.

**«Hos deg nå»** – den innloggedes aktive internleier:

- maskin (navn, internnummer), prosjekt, «ute siden 12.09.2026», og
  «ventet tilbake 30.09.2026» bare hvis dato er satt
- knapp **Lever** per rad. Et trykk åpner et valgfritt felt
  *Noe som bør fikses?* og en bekreft-knapp
- tom tilstand: «Du har ikke noe ute»

**«Ta ut utstyr»** – alle aktive maskiner, gruppert på kategori og
underkategori:

- Søkefelt som filtrerer i nettleseren, så avkrysningene ikke nullstilles.
- Ledige (`status = 'ledig'` og `kanLeiesUt`) har avkrysning, med store
  trykkflater.
- Ikke-ledige vises gråtonet med grunn og uten avkrysning:
  - hos deg selv: «Hos deg · Kvamsøy bru»
  - hos en kollega: «Hos Ola Nordmann · Kvamsøy bru»
  - hos en kunde: «Utleid» – **aldri** kundens navn
  - verkstedstatus som stopper utleie: «Til reparasjon»
  - maskinstatus `service`: «Ute av drift»
- Maskinstatus `utrangert` vises ikke.
- Ingen priser.

**Bunnlinja** dukker opp når minst én ting er huket av:

- «3 valgt»
- **Prosjekt**: nedtrekk med aktive prosjekter. Forhåndsvalgt er prosjektet
  den ansatte brukte sist, hvis det fortsatt er aktivt.
- **Tilbake**: dato, valgfri, tidligst i dag. Tom = «til videre».
- Knapp **Ta ut**.

Uten aktive prosjekter vises «Ingen aktive prosjekter ennå – admin må
legge inn prosjekter først», og knappen er av.

### 3.2 Ta ut (server action)

1. `krevAnsatt()`.
2. Valider: 1–50 maskin-ID-er, én prosjekt-ID, valgfri dato `yyyy-mm-dd`.
   Datoen gjøres om med `norskSluttAvDag`, som flyttes fra
   `src/app/m/[qr]/actions.ts` til `src/lib/dato.ts` så begge bruker samme.
3. Prosjektet må finnes og være aktivt.
4. Per maskin: må være aktiv, ledig og `kanLeiesUt`. Sett inn leie
   (`ansatt_id`, `prosjekt_id`, `planlagt_slutt` eller null), sett maskinen
   til `utleid`, logg hendelse `startet` med aktør `<rolle>:<epost>` –
   samme form som verkstedet, så en servicearbeider står som `service:`.
5. Svar med hvilke som gikk og hvilke som ikke gikk. Treffer innsettingen
   den unike indeksen (23505), rakk noen andre å ta maskinen – de andre
   registreres likevel, og siden sier «Kompaktor 2 rakk noen andre å ta».
6. Ingen e-post.

### 3.3 Lever (server action)

1. `krevAnsatt()`.
2. Leien må ha `ansatt_id` = den innloggede og `status = 'aktiv'`.
3. Klokka stopper nå (servertid). `beregnPris()` gir antall og beløp.
4. Oppdater leien til `avsluttet` med `slutt_tid`, `antall_dogn`, `belop`
   og ev. `kommentar_retur` – med `.eq('status', 'aktiv')` som lås mot
   dobbeltsending, som i kundereturen.
5. Maskinen settes til `ledig` hvis den fortsatt står som `utleid`.
6. Hendelse `levert`, aktør `<rolle>:<epost>`.
7. Står det noe i *Noe som bør fikses?*, sendes e-post til admin (se 4.4).

Avslutningen ligger i én server-only funksjon,
`avsluttInternLeie(leieId, aktør, kommentar?)`, som også brukes når admin
registrerer levering på vegne av en ansatt.

### 3.4 QR på maskinen (`/m/[qr]`) når du er innlogget

| Situasjon | Viser |
|---|---|
| Ledig | Samme korte skjema som bunnlinja, med denne maskinen valgt |
| Du har den | «Du har denne på Kvamsøy bru» + Lever |
| Hos en kollega | «Hos Ola Nordmann · Kvamsøy bru» |
| Hos en kunde | «Maskinen er utleid», som i dag |
| Verksted / ute av drift | som i dag |
| Må bytte passord | lenke til passordbytte |

Ikke innlogget: nøyaktig som i dag, pluss «Ansatt? Logg inn».

For kunder som skanner en maskin som står på et prosjekt: «Maskinen er
utleid». Er det satt dato, vises «ventet tilbake»; ellers ingen dato.
Kunder ser aldri navn på ansatte eller prosjekter.

### 3.5 Felles returkode (`/retur`)

Innlogget → sendes til `/ansatt`. Ikke innlogget: som i dag, pluss
«Ansatt? Logg inn».

Kvitteringssiden `/leie/[ref]` og kundereturen krever at enhets-ID-en
stemmer. Internleier har ingen, så de faller allerede ut der og havner på
`/retur` – som sender innloggede videre.

---

## 4. Admin

### 4.1 Prosjekter (`/admin/prosjekter`)

Nytt menypunkt etter «Leier». Menyen får også «Ta ut utstyr» → `/ansatt`,
ved siden av «Verksted».

**Lista:** navn, nummer, status, antall ute nå, og **internleie hittil**:

- sum av `belop` for leverte leier
- pluss et løpende anslag for det som er ute (`beregnPris` fram til nå),
  merket «løpende»
- «mangler pris» hvis noen maskin på prosjektet ikke har pris

Skjema for nytt prosjekt (navn, nummer). Avslutt og gjenåpne. Å avslutte
et prosjekt som har utstyr ute er lov, men siden sier «3 ting står
fortsatt ute på prosjektet».

**Detaljsiden** `/admin/prosjekter/[id]`: alle leiene – maskin, ansatt,
fra–til, antall, beløp – med sum nederst. Redigering av navn og nummer.
Slett-knapp bare når prosjektet ikke har leier.

### 4.2 Hvem som vises som leietaker

Ren funksjon `leietaker(leie)` i `src/lib/leietaker.ts`:

- kundeleie → `{ intern: false, navn: kunde.navn, detalj: telefon }`
- internleie → `{ intern: true, navn: ansatt.navn, detalj: prosjekt (nummer) }`

Brukes overalt der det i dag står `l.kunder?.navn ?? '–'`: oversikten,
leielista, kalenderen, maskinsiden, verkstedlista («Ute hos …»),
forfallsvarselet og iCal. Internleier får merket «Intern».

Søket i leielista treffer også ansattnavn og prosjektnavn.

### 4.3 Leiesiden for en internleie

- Boksen «Ansatt og prosjekt» (navn, mobil, prosjekt med lenke) i stedet
  for kundeboksen.
- Ingen godkjenningsskjema, fakturagrunnlag, PDF eller «fakturert»-bryter.
- Aktiv: «Registrer levering» – bruker `avsluttInternLeie` med aktør
  `admin:<epost>`. Går rett til avsluttet med utregnet pris.
- Avsluttet: lite skjema **Rett antall og beløp** → setter
  `manuelt_justert = true` og logger hendelse `justert`.

### 4.4 Fakturering, e-post, kalender

- **Faktura:** `/api/faktura/[id]` svarer 404 for internleier.
- **«Ikke fakturert»** på oversikten og i leielistas filter holder
  internleier utenfor (`ansatt_id is null`). Ellers ville hver
  prosjektleie ligget der som noe som skulle vært fakturert.
- **E-post ved uttak og levering:** ingen.
- **Merknad ved levering:** ny mal `merknadIntern` – «Ola Nordmann leverte
  Kompaktor 2 fra Kvamsøy bru: *venstre hjul slark*». Går til
  varseladressen, styrt av samme innstilling som returvarsler
  (`varsle_retur`).
- **Forfalt:** en internleie med passert dato kommer med i den daglige
  oversikten til admin, med `leietaker()` i stedet for kunde. Purring går
  bare til kunder – koden hopper allerede over leier uten kunde-e-post.
  Leier uten dato har `planlagt_slutt = null` og faller utenfor `lt()`.
- **Kalender:** en aktiv leie uten dato tegnes fram til i dag, med
  «til videre» i teksten.
- **iCal:** samme – slutt i dag for pågående leier uten dato.

---

## 5. Feilhåndtering

| Situasjon | Utfall |
|---|---|
| Prosjektet avsluttes mens noen står i skjemaet | «Prosjektet er avsluttet. Velg et annet.» |
| Noen tar en av maskinene først | resten registreres, siden sier hvilken |
| Maskinen er satt til verksted i mellomtiden | «Står til reparasjon» for den, resten går |
| Leveringen sendes to ganger | den andre treffer ingen rad og gjør ingenting |
| Prøver å levere en annens leie (direkte POST) | «Fant ikke leien» |
| Deaktivert ansatt | kommer ikke inn; utstyret står til admin registrerer levering |
| `prosjekter` finnes ikke (migrasjon ikke kjørt) | «Ikke satt opp ennå» på `/ansatt` |
| Maskinen har ingen pris | leien avsluttes, beløpet står tomt, prosjektet sier «mangler pris» |

---

## 6. Testing og verifisering

Prosjektet har ikke testrammeverk. Det legges ikke til noe.

**Enhetstester** med Nodes innebygde `node:test` (Node 24 kjører
TypeScript direkte). Filer `*.test.mjs` ved siden av modulen, kjørt med
`npm test` → `node --test "src/**/*.test.mjs"`. Modulene som testes må
bare ha `import type` fra relative stier – Node løser ikke opp
`'./pris'` uten filendelse.

- `beregnPris()` i `src/lib/pris.ts` – døgn og time, påbegynt enhet teller
  som hel, minst én, uten pris gir `belop: null`, hele kroner som forslaget
  på godkjenningssiden i dag (som også tar den i bruk, så regelen står ett sted)
- `leietaker()` – begge former, manglende innbygde rader
- `norskSluttAvDag()` – vinter- og sommertid, ugyldig input
- `trygtNeste()` – lokale stier godtas; `//evil.no`, `/\evil.no`,
  `https://…`, tom og manglende avvises

**Statisk:** `tsc --noEmit`, `npm run lint`, `npm run build`.

**Spørringene** – hver ny `select` med innbygging kjøres mot databasen med
service role i et engangsskript, så en feil i fremmednøkkel-hintet
oppdages før adminpanelet i produksjon gjør det.

**Uinnlogget i nettleseren:** maskinsiden viser kundeskjemaet og «Ansatt?
Logg inn», `/retur` likeså, og `/ansatt` sender til innlogging med `neste`.

**Hele flyten innlogget** gjør Thomas. Innlogging går mot Supabase Auth,
en tjeneste utenfor maskinen, og Claude logger ikke inn med passord der på
noens vegne. Sjekklista, etter at migrasjonen er kjørt:

1. Admin oppretter et testprosjekt og en testbruker med rollen ansatt.
2. Logg inn som testbrukeren → tvunget passordbytte → havner på `/ansatt`.
3. Ta ut to ting til testprosjektet, én med dato og én uten.
4. Skann (åpne) maskinsiden til den ene → «Du har denne …».
5. Lever én med merknad → ledig igjen, pris på prosjektet.
6. Admin: prosjektsiden viser sum og løpende anslag, leielista viser
   «Intern», «Ikke fakturert» viser dem ikke.
7. Som testbrukeren: `/admin` sender til `/ansatt`. Direkte oppslag mot
   `kunder` med brukerens egen sesjon gir ingen rader.
8. Som en servicebruker: havner på `/verksted`, «Ta ut utstyr» i menyen,
   ta ut og lever én ting. Menyen på `/ansatt` fører tilbake til verkstedet.

Testdataene ryddes målrettet etterpå – testbrukeren, testprosjektet og
leiene deres. **Aldri** med `scripts/slett-testdata.mjs`, som tømmer alle
leier og kunder.

---

## 7. Filer

**Nye**

- `supabase/migrations/0011_ansatt.sql`
- `src/lib/leietaker.ts` (+ test)
- `src/lib/intern-leie.ts` – `avsluttInternLeie`, server-only
- `src/app/ansatt/page.tsx`, `actions.ts`, `uttak-skjema.tsx`, `lever-knapp.tsx`, `loading.tsx`
- `src/app/admin/(panel)/prosjekter/page.tsx`, `actions.ts`, `[id]/page.tsx`, `loading.tsx`

**Endres**

- `src/lib/auth.ts`, `types.ts`, `pris.ts` (+ test), `dato.ts` (+ test)
- `src/lib/verksted-data.ts`, `src/lib/epost/varsler.ts`, `maler.ts`
- `src/app/admin/logg-inn/*`, `src/app/admin/bytt-passord/actions.ts`, `src/proxy.ts`
- `src/app/admin/(panel)/brukere/*`, `meny.tsx`, `page.tsx`, `kalender/page.tsx`
- `src/app/admin/(panel)/leier/page.tsx`, `leier/[id]/*`, `maskiner/[id]/page.tsx`
- `src/app/m/[qr]/page.tsx`, `actions.ts`
- `src/app/retur/page.tsx`
- `src/app/verksted/bruker-meny.tsx`, `actions.ts`, `page.tsx`, `[id]/page.tsx`
- `src/app/api/faktura/[id]/route.ts`, `api/ical/[fil]/route.ts`,
  `api/maskiner/csv/route.ts`, `api/varsler/forfalt/route.ts`
- `scripts/sjekk-migrasjoner.mjs`, `supabase/KJOR-DENNE.sql`, `package.json`
- `README.md` (roller, migrasjon)

`src/app/personvern/page.tsx` endres ikke: «Kun ansatte hos utleier med
behov for det» stemmer fortsatt – strammere enn før, siden ansatte aldri
ser kundenavn og sikkerhetsendringen i 1.4 stenger direkte databasetilgang
for alle andre enn admin.
