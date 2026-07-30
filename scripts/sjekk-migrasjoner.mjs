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

/** Én representativ tabell eller kolonne per migrasjon. */
const MIGRASJONER = [
  { fil: '0001_init.sql', tabell: 'maskiner', kolonne: 'id' },
  { fil: '0002_kategorier.sql', tabell: 'kategorier', kolonne: 'id' },
  { fil: '0003_varsling.sql', tabell: 'epost_logg', kolonne: 'id' },
  { fil: '0004_prisenhet.sql', tabell: 'maskiner', kolonne: 'pris_enhet' },
  { fil: '0005_verksted.sql', tabell: 'maskiner', kolonne: 'underkategori' },
  { fil: '0006_flere_verkstedkategorier.sql', tabell: 'kategorier', kolonne: 'er_verksted' },
]

const mangler = []

for (const m of MIGRASJONER) {
  const { error } = await supabase.from(m.tabell).select(m.kolonne).limit(1)
  if (error) {
    mangler.push(m.fil)
    console.log(`  ✗ ${m.fil}`)
  } else {
    console.log(`  ✓ ${m.fil}`)
  }
}

if (mangler.length === 0) {
  console.log('\nAlle migrasjoner er kjørt.\n')
  process.exit(0)
}

console.log(
  `\n${mangler.length} ${mangler.length === 1 ? 'migrasjon mangler' : 'migrasjoner mangler'}.\n` +
    'Åpne Supabase → SQL Editor og kjør:\n' +
    '  supabase/KJOR-DENNE.sql\n\n' +
    'Den inneholder alle ukjørte migrasjoner, og er trygg å kjøre flere ganger.\n',
)
process.exit(1)
