# Utleiesystem

QR-basert utleie av anleggsmaskiner. Kunden skanner, leier uten innlogging,
og leverer ved å ta bilde. Admin har oversikt i liste og kalender.

Begrunnelsen bak designvalgene ligger i [docs/TEKNISK-PLAN.md](docs/TEKNISK-PLAN.md).

## Kom i gang

### 1. Opprett et Supabase-prosjekt

Gå til [supabase.com](https://supabase.com), lag et gratis prosjekt, og velg
region **Frankfurt (eu-central-1)** – nærmest Norge, og holder persondata
innenfor EØS.

### 2. Kjør databaseskjemaet

Åpne **SQL Editor** i Supabase-dashbordet, lim inn hele innholdet i
`supabase/migrations/0001_init.sql` og kjør det.

### 3. Opprett lagringsbøtte for bilder

Under **Storage**, lag en bøtte med navn `bilder`. Sett den til **privat** –
bildene hentes gjennom signerte URL-er, ikke åpne lenker.

### 4. Sett miljøvariabler

```bash
cp .env.local.example .env.local
```

Fyll inn verdiene fra **Project Settings → API** i Supabase.

### 5. Start

```bash
npm run dev
```

### 6. Opprett første admin-bruker

Under **Authentication → Users** i Supabase, legg til en bruker med e-post og
passord. Kjør så i SQL Editor:

```sql
insert into admin_brukere (id, navn, epost)
select id, 'Ditt Navn', email from auth.users where email = 'din@epost.no';
```

Videre brukere opprettes fra `/admin/brukere` inne i appen.

## Struktur

```
src/app/m/[qr]/        Kundeside per maskin (QR-kode på maskinen)
src/app/retur/         Felles retur-side (QR-kode på arbeidsstedet)
src/app/leie/[ref]/    Kvittering og retur for én enkelt leie
src/app/admin/         Adminpanel, krever innlogging
src/lib/supabase/      Databaseklienter
src/proxy.ts           Sesjonsoppfriskning (het middleware.ts før Next 16)
supabase/migrations/   Databaseskjema
docs/                  Teknisk plan
```

## Slå på e-postvarsling (utsatt – gjøres når det passer)

Varslingskoden ligger klar, men er ikke konfigurert. Uten oppsettet
under laster alt som normalt; varsler hoppes stille over, og
varslingsskjemaet i innstillingene gir feilmelding ved lagring.

1. **Kjør migrasjonen** `supabase/migrations/0003_varsling.sql` i
   Supabase SQL Editor. (0002 må være kjørt først – den er kjørt.)
2. **Resend:** verifiser et subdomene under Domains, f.eks.
   `send.techauge.no` – subdomene, så SPF-en til vanlig e-post ikke
   berøres. Lag en API-nøkkel. Gratisplanen har 1 domene og
   3 000 e-poster/mnd, som holder lenge her.
3. **Tre variabler i Vercel** (Settings → Environment Variables):
   ```
   RESEND_API_KEY=re_...
   VARSEL_FRA=utleie@send.techauge.no
   CRON_SECRET=<tilfeldig streng, f.eks. openssl rand -hex 32>
   ```
4. **Redeploy**, og sett mottakere under `/admin/innstillinger`.
   Test med «Send forfallsvarsel nå» – utfallet vises i loggen på
   samme side.

Merk: uten verifisert domene (kun `onboarding@resend.dev`) kan Resend
bare sende til kontoens egen adresse. Kunder får ingenting, og
feilene vises kun i e-postloggen.

## Sikkerhet

`SUPABASE_SERVICE_ROLE_KEY` omgår all radsikkerhet og må aldri havne i
nettleseren. Den brukes kun i server-ruter for kundeflyten, siden kunden ikke
er innlogget og derfor ikke har en sesjon databasen kan vurdere. Hver slik rute
verifiserer selv at enhets-ID eller leiereferanse hører til raden som hentes.

`src/proxy.ts` frisker kun opp sesjonen. Selve tilgangskontrollen ligger i
adminlayouten og i hver enkelt server action – server actions kjører som POST
mot siden de brukes fra, og kan derfor ikke sikres av proxy alene.

## Merk om Next.js 16

Prosjektet kjører Next.js 16, som har flere brytende endringer mot 14/15:

- `middleware.ts` heter nå `proxy.ts`
- `cookies()`, `params` og `searchParams` er asynkrone og må ventes på
- Server actions har **1 MB grense** på forespørselskroppen. Bilder lastes
  derfor opp direkte fra nettleseren til Supabase Storage, ikke gjennom en
  server action
- `revalidateTag()` krever nå to argumenter
- Turbopack er standard, `--turbopack`-flagget skal ikke brukes

Se `AGENTS.md`. Dokumentasjonen ligger lokalt i `node_modules/next/dist/docs/`.
