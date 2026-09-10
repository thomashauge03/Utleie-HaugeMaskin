# Kjøretøymodul — design

Dato: 2026-09-10
Status: godkjent av eier 2026-09-10

Internt kjøretøyregister i adminpanelet: registreringsnummer, EU-kontroll og
andre frister, med automatisk oppslag mot Statens vegvesen og e-postpåminnelse
via Resend.

## Formål

Firmaet har egne kjøretøy — servicebiler, varebiler, hengere — som ikke er en
del av utleieparken. I dag finnes ingen oversikt over når de skal på
EU-kontroll. Fristen oppdages når den er passert.

Modulen skal svare på ett spørsmål på under fem sekunder: *hva forfaller snart?*

Vegvesen varsler eieren selv omtrent to måneder før fristen. Verdien her er
lengre varsel, hele parken samlet på ett sted, og at EU-fristen står ved siden
av forsikring, service og dekkskift.

## Avgrensning

- Kjøretøy kan **ikke** leies ut. De har ingen relasjon til `maskiner` eller
  `leier`. Blir det aktuelt senere, er det en egen sak.
- Ingen kilometerlogg over tid — ett felt som overskrives.
- Ingen dokumentopplasting (vognkort, forsikringsbevis) i denne runden.
- Ingen egne mottakere per kjøretøy. Varsel går til firmaets varseladresse.

---

## 1. Datamodell

Egen tabell `kjoretoy`, migrasjon `supabase/migrations/0009_kjoretoy.sql`.

Begrunnelse for egen tabell framfor kolonner på `maskiner`: et kjøretøy har
skilt og en offentlig frist, ikke QR-kode og døgnpris. Å presse begge inn i
`maskiner` ville gitt en tabell der halvparten av kolonnene alltid er tomme,
og en utleiekatalog full av objekter som ikke kan leies.

| Kolonne | Type | Kilde |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `reg_nr` | `text not null unique` | manuelt, normalisert |
| `internt_navn` | `text` | manuelt |
| `ansvarlig_navn` | `text` | manuelt |
| `ansvarlig_epost` | `text` | manuelt |
| `merke` | `text` | Vegvesen, manuell fallback |
| `modell` | `text` | Vegvesen, manuell fallback |
| `arsmodell` | `integer` | Vegvesen, manuell fallback |
| `kjoretoy_klasse` | `text` | Vegvesen |
| `eu_frist` | `date` | Vegvesen, manuell fallback |
| `eu_sist_godkjent` | `date` | Vegvesen |
| `reg_status` | `text` | Vegvesen |
| `svv_hentet` | `timestamptz` | null = aldri hentet |
| `km` | `integer` | manuelt |
| `forsikring_selskap` | `text` | manuelt |
| `forsikring_forfall` | `date` | manuelt |
| `neste_service` | `date` | manuelt |
| `neste_dekkskift` | `date` | manuelt |
| `status` | `text not null default 'i_drift' check (status in ('i_drift','avskiltet','solgt'))` | manuelt |
| `notat` | `text` | manuelt |
| `opprettet` | `timestamptz not null default now()` | |
| `oppdatert` | `timestamptz not null default now()` | |

Husregler som må følges (verifisert mot `0001`–`0008`):

- Idempotent SQL: `create table if not exists`, `create index if not exists`,
  `drop policy if exists` før `create policy`.
- Ingen enum-typer. Lukkede mengder er `text ... check (x in (...))`.
- Ingen triggere. `oppdatert` settes fra applikasjonen.
- Kolonnenavn er ASCII-foldet norsk snake_case: `reg_nr`, `arsmodell`.
- `comment on column` der kolonnen ikke er selvforklarende.
- RLS: én policy `admin_alt`, `for all using (er_admin()) with check (er_admin())`.

Indeks:

```sql
create index if not exists kjoretoy_frist_idx
  on kjoretoy (eu_frist) where status = 'i_drift';
```

### «Forfalt» er ikke en status

Forfall er et **avledet predikat**, aldri en kolonneverdi — samme valg som
`erForfalt` for leier i `src/lib/types.ts`. `dagerTil()` i `src/lib/dato.ts`
gjør allerede nøyaktig det som trengs (negativt = forfalt, 0 = i dag, låst til
Europe/Oslo). Ingen ny datofunksjon skal skrives.

### Migrasjonen kjøres for hånd

Repoet har ingen migrasjonsrunner. Tre ting må gjøres samlet:

1. Ny `supabase/migrations/0009_kjoretoy.sql`
2. Ny rad i `MIGRASJONER` i `scripts/sjekk-migrasjoner.mjs`
3. `node scripts/lag-samlemigrasjon.mjs` for å regenerere `supabase/KJOR-DENNE.sql`

Deretter limer eier inn `KJOR-DENNE.sql` i Supabase SQL Editor og verifiserer
med `node --env-file=.env.local scripts/sjekk-migrasjoner.mjs`.

---

## 2. Vegvesen-oppslag

Ny fil `src/lib/vegvesen.ts`, `server-only`.

```
GET https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata
    ?kjennemerke=AB12345
Header: SVV-Authorization: Apikey <SVV_API_KEY>
```

Felt vi leser, alle relativt til `kjoretoydataListe[0]`:

| Verdi | Sti |
|---|---|
| Neste EU-kontroll | `periodiskKjoretoyKontroll.kontrollfrist` (`YYYY-MM-DD`) |
| Sist godkjent | `periodiskKjoretoyKontroll.sistGodkjent` |
| Registreringsstatus | `registrering.registreringsstatus.kodeVerdi` |
| Merke | `godkjenning.tekniskGodkjenning.tekniskeData.generelt.merke[0].merke` |
| Modell | `godkjenning.tekniskGodkjenning.tekniskeData.generelt.handelsbetegnelse[0]` |
| Kjøretøyklasse | `godkjenning.tekniskGodkjenning.kjoretoyklassifisering.tekniskKode.kodeVerdi` |
| Førstegangsreg. | `forstegangsregistrering.registrertForstegangNorgeDato` |

### Fem ting som styrer utformingen

1. **Nøkkelen krever BankID og Altinn-tjenesten «Kjøretøyoppslag»** for å
   bestille på vegne av virksomheten. Søknaden behandles automatisk og gir
   nøkkelen umiddelbart, men porten må passeres av et menneske. Derfor leses
   `SVV_API_KEY` rått fra `process.env` og legges **ikke** i `env.ts`-skjemaet
   — samme grep som `RESEND_API_KEY` allerede bruker. Mangler nøkkelen, virker
   hele modulen manuelt.
2. **Ukjent skilt gir HTTP 200**, ikke 404, med
   `{"feilmelding":"OPPLYSNINGER_IKKE_TILGJENGELIGE"}` og tom/manglende
   `kjoretoydataListe`. Samme kode dekker skjermede skilt, så meldingen til
   brukeren er «kunne ikke verifiseres», aldri «finnes ikke».
3. `merke` og `handelsbetegnelse` er **arrays**. Begge må indekseres og
   null-sjekkes.
4. `periodiskKjoretoyKontroll` **mangler helt** for kjøretøy uten
   kontrollplikt. Hele stien må guardes.
5. **Ingen CORS.** Oppslaget må skje på server. Det er uansett riktig, siden
   nøkkelen er en hemmelighet.

### Returtype

En diskriminert union, så kallstedet kan si noe presist:

```ts
export type Oppslag =
  | { status: 'ok'; data: Kjøretøydata }
  | { status: 'ukjent' }
  | { status: 'kvote' }
  | { status: 'nøkkelfeil' }
  | { status: 'feil'; kode: number | 'timeout' }
```

`fetch` med `cache: 'no-store'` (Next 16 sin standard er «auto no cache», som
kan bli bakt inn ved prerender) og `AbortSignal.timeout(10_000)`.

### Ikke verifisert mot levende API

Ingen nøkkel finnes i prosjektet ennå, så ingen vellykket 200 er observert.
Følgende må bekreftes den dagen nøkkelen kommer, og koden må tåle at de er
feil:

- At `SVV-Authorization: Apikey <key>` faktisk virker (bekreftet kun som
  dokumentasjon, to steder hos Vegvesen).
- At `kontrollfrist` kommer som `YYYY-MM-DD` (utledet fra OpenAPI
  `format: date`, ikke fra en observert respons). Parses defensivt.
- Om kvoteoverskridelse gir 429 eller 422 — dokumentasjonen og speccen er
  uenige. Begge håndteres.
- Om ugyldig nøkkel gir 401 eller 403. Begge håndteres.

Kvote ifølge dokumentasjonen: 50 000 kall per nøkkel per døgn. Lisens CC BY
4.0 — Statens vegvesen krediteres der dataene vises.

---

## 3. Oppfriskingsstrategi

EU-fristen endres **én gang hvert 1.–2. år per kjøretøy**. Den kan ikke regnes
ut lokalt: kontrolleres kjøretøyet mer enn to måneder før fristen, beregnes
neste frist fra kontrolldatoen; kontrolleres det innenfor to måneder, beregnes
den fra den opprinnelige fristen. Den avhenger altså av når eieren faktisk
møtte opp, og må leses fra Vegvesen.

Et fullt nattlig oppslag på hele parken er derfor sløsing. Én cron,
`0 6 * * *`, ny rute `/api/kjoretoy/oppdater`. Hver kjøring plukker inntil
**50** kjøretøy i denne prioriteten:

1. aldri hentet (`svv_hentet is null`)
2. frist innen 90 dager og ikke hentet i dag
3. eldste `svv_hentet` over 7 dager gammel

Resultatet er at alt friskes opp minst ukentlig, og det som nærmer seg frist
daglig. Grensen på 50 holder ruten godt innenfor `maxDuration`.

I tillegg en **«Oppdater fra Vegvesen»**-knapp per kjøretøy på detaljsiden.

Et vellykket oppslag overskriver de Vegvesen-eide feltene og setter
`svv_hentet`. Manuelt innskrevne verdier er en fallback fram til første
vellykkede oppslag. Detaljsiden viser kilden eksplisitt: «Hentet fra Vegvesen
10.09.2026» eller «Lagt inn manuelt».

Ruten autentiseres som den eksisterende cron-ruten: `Bearer CRON_SECRET`
**eller** innlogget bruker. `vercel.json` må endres, og `npm run sjekk:vercel`
kjøres etterpå — en ugyldig `vercel.json` har allerede kostet et helt bygg.

---

## 4. E-postvarsel

Rørene finnes fra før og trenger ingen ny oppsettkode. Inntil `RESEND_API_KEY`
og `VARSEL_FRA` finnes i Vercel, logges hver utsending som `feilet` i
`epost_logg` og vises i Innstillinger. Ingenting krasjer.

Endringer:

- Ny `Varseltype: 'eu_kontroll_admin'` i `src/lib/epost/send.ts`.
  `epost_logg.type` er `text` uten check-constraint, så ingen migrasjon trengs
  for typen.
- Ny mal `euKontrollAdmin` i `src/lib/epost/maler.ts`, bygget med de
  eksisterende `ramme`/`h1`/`fakta`/`knapp`-hjelperne. HTML **og** ren tekst,
  `esc()` på all interpolert verdi. Malbyggerne er ikke eksportert, så malen
  må ligge i samme fil.
- Ny `varsleEuKontroll()` i `src/lib/epost/varsler.ts`, hele kroppen i
  `try/catch` etter mønster av `varsleForfalte()`.
- Ny kolonne `varsle_eu_kontroll boolean not null default true` på
  `innstillinger`, med avkrysning i fanen «Varsling».

### Utløser

E-post sendes **bare** på dager der minst ett objekt treffer nøyaktig
**30, 14 eller 3 dager** igjen, eller nettopp har blitt forfalt
(`dagerTil() === -1`).

Alternativet — «send når noe er under 30 dager» — ville gitt samme e-post 30
dager på rad, og da slutter folk å lese den.

Når e-posten først går, inneholder den hele bildet: alt som forfaller innen 30
dager, og alt som allerede er forfalt.

Samme digest dekker `eu_frist`, `forsikring_forfall`, `neste_service` og
`neste_dekkskift`, med EU-kontroll øverst. Bare kjøretøy med
`status = 'i_drift'` regnes med.

### Dedup

`epost_logg.leie_id` er fremmednøkkel mot `leier` og kan ikke peke på et
kjøretøy. Den unike indeksen `epost_logg_daglig_unik` dekker kun
forfallstypene. Dedup gjøres derfor på kodenivå: spørring mot `epost_logg` på
`type = 'eu_kontroll_admin'` og `sendt >= i dag` før utsending — samme mønster
som `varsleForfalte()` allerede bruker.

---

## 5. Tilgang

`krevAdmin()` sender `service`-brukere til `/verksted`, så en side inne i
`(panel)` kan de aldri se. Lesetilgang blir derfor to ruter:

| Rute | Tilgang | Innhold |
|---|---|---|
| `/admin/kjoretoy` | `krevAdmin()` | liste, søk, filter, opprett |
| `/admin/kjoretoy/[id]` | `krevAdmin()` | detalj, rediger, oppdater fra Vegvesen, slett |
| `/verksted/kjoretoy` | `krevVerkstedBruker()` | skrivebeskyttet liste |

`krevVerkstedBruker()` brukes bevisst framfor `hentVerkstedBruker()`: deler av
`/verksted` er lesbart uten innlogging, og kjøretøylista skal ikke være det.

RLS skiller ikke `admin` fra `service` — `er_admin()` returnerer true for
begge. Skillet finnes utelukkende i TypeScript. Hver side **og hver server
action** kaller derfor tilgangssjekken som første setning; en server action er
en POST-rute som kan treffes direkte utenfra.

---

## 6. Grensesnitt

Følger husstilen uten unntak:

- Ingen modaler. «Nytt kjøretøy» er en inline utvidelse styrt av lokal
  `useState`.
- Ukontrollerte felt (`name` + `defaultValue`), lest fra `FormData`.
- `useActionState`, aldri `useFormStatus`. Ventetilstand er tekstbytte
  («Lagrer …»), aldri spinner.
- Returform fra alle actions: `{ feil?: string; ok?: string }`.
- Ingen avrunding. `border-2`, `divide-y-2`, `border-l-4 border-hm-red` for
  feil, `border-l-4 border-hm-amber` for advarsel.
- `Merke` for status, alltid med tekst — farge er aldri eneste signal.
- Semantiske tokens (`var(--flate)`, `var(--kant)`). Ingen `dark:`-varianter;
  mørk modus skjer via `prefers-color-scheme` på variablene.
- Omsluttende `<label>`, ikke `htmlFor`. `aria-label` der etiketten er skjult.
- Søk på nøkkelen `q` via `<Søkefelt>`, filtrering i minnet. Reg.nr passer inn
  i den eksisterende normaliseringen, som stripper mellomrom.
- Filtre er en chip-rad av `<Link>` med `aria-current`.

Listesortering er `eu_frist` stigende, med nulls sist. Det som haster mest
står øverst uten at brukeren gjør noe.

Dashbordet (`/admin`) får en rad i «Krever handling» for kjøretøy med frist
innen 30 dager eller forfalt.

### Registreringsnummer

Normaliseres til store bokstaver uten mellomrom eller bindestrek før lagring
(`AB 12345` → `AB12345`). Valideres løst: 2–7 tegn `A–Z0–9`, som matcher
Vegvesens egen parameterbegrensning. Utenlandske skilt aksepteres innenfor
samme ramme. Ingen hard sperre på norsk format.

---

## 7. Persondata

`ansvarlig_navn` og `ansvarlig_epost` er persondata om ansatte. To felt, det
minimum funksjonen krever, bak innlogging, uten historikk. Nevnes med én linje
i `/personvern`.

Vegvesen-oppslaget returnerer verken eier eller kilometerstand — det er bevisst
utelatt fra det åpne datasettet — så ingen persondata hentes utenfra.

---

## 8. Forutsetninger

Valg tatt uten eksplisitt svar fra eier, lette å endre:

- Tersklene 30/14/3 dager er hardkodet i en konstant, ikke redigerbare i UI.
- Dashbordet får en rad i «Krever handling», ikke en egen flis.
- Statusmengden er `i_drift` / `avskiltet` / `solgt`. Ingen `verksted`-status;
  verkstedmodulen dekker maskiner, ikke kjøretøy.
