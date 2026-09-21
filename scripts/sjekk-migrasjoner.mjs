/**
 * Sier hvilke migrasjoner som mangler i databasen.
 *
 *   node --env-file=.env.local scripts/sjekk-migrasjoner.mjs
 *
 * Finnes fordi en manglende migrasjon ellers oppdages først når et
 * skjema feiler midt i bruk – og da med en teknisk feilmelding om
 * «schema cache» som ikke sier noe om hva man skal gjøre.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

/**
 * Én representativ tabell eller kolonne per migrasjon.
 *
 * `borte: true` snur sonderingen: migrasjonen river ned framfor å bygge
 * opp, og er kjørt først når oppslaget IKKE finner noe. 0009 har ingen
 * rad – den opprettet nettopp det 0010 fjerner, så en sondering på den
 * ville meldt «mangler» i det øyeblikket ryddingen var gjort.
 */
const MIGRASJONER = [
  { fil: '0001_init.sql', tabell: 'maskiner', kolonne: 'id' },
  { fil: '0002_kategorier.sql', tabell: 'kategorier', kolonne: 'id' },
  { fil: '0003_varsling.sql', tabell: 'epost_logg', kolonne: 'id' },
  { fil: '0004_prisenhet.sql', tabell: 'maskiner', kolonne: 'pris_enhet' },
  { fil: '0005_verksted.sql', tabell: 'maskiner', kolonne: 'underkategori' },
  { fil: '0006_flere_verkstedkategorier.sql', tabell: 'kategorier', kolonne: 'er_verksted' },
  { fil: '0007_delmal.sql', tabell: 'maskin_delstatus', kolonne: 'mal' },
  { fil: '0008_bytt_passord.sql', tabell: 'admin_brukere', kolonne: 'ma_bytte_passord' },
  { fil: '0010_fjern_kjoretoy.sql', tabell: 'kjoretoy', kolonne: 'eu_frist', borte: true },
]

/*
 * «Finnes ikke» må skilles fra «kom ikke fram». For de vanlige radene er
 * enhver feil et nei, og det er den trygge veien å bomme. For en
 * borte-rad er det motsatt: der ville en nettverks- eller nøkkelfeil
 * blitt lest som «tabellen er vekk, alt i orden». Derfor godtas bare
 * kodene som faktisk betyr at relasjonen eller kolonnen ikke finnes.
 */
const FINNES_IKKE = ['PGRST205', 'PGRST204', '42P01', '42703']
const betyrBorte = (error) => FINNES_IKKE.includes(error?.code)

const mangler = []

for (const m of MIGRASJONER) {
  const { error } = await supabase.from(m.tabell).select(m.kolonne).limit(1)
  const kjørt = m.borte ? betyrBorte(error) : !error

  if (kjørt) {
    console.log(`  ✓ ${m.fil}`)
  } else {
    mangler.push(m)
    console.log(`  ✗ ${m.fil}${m.borte && error ? `  (${error.code ?? 'ukjent feil'})` : ''}`)
  }
}

if (mangler.length === 0) {
  console.log('\nAlle migrasjoner er kjørt.\n')
  process.exit(0)
}

const river = mangler.some((m) => m.borte)

console.log(
  `\n${mangler.length} ${mangler.length === 1 ? 'migrasjon mangler' : 'migrasjoner mangler'}.\n` +
    'Åpne Supabase → SQL Editor og kjør:\n' +
    '  supabase/KJOR-DENNE.sql\n\n' +
    'Den inneholder alle ukjørte migrasjoner, og er trygg å kjøre flere ganger.\n' +
    (river
      ? '\nMERK: fila fjerner også kjøretøyregisteret – tabellen kjoretoy\n' +
        'droppes og gamle fristvarsler slettes fra epost_logg. Har denne\n' +
        'databasen kjøretøydata du ikke har tatt vare på, hent dem ut først.\n'
      : ''),
)
process.exit(1)
