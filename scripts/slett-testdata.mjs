/**
 * Sletter alle leier, kunder, bilder og hendelser, og setter maskinene
 * tilbake til ledig. Maskinene og admin-brukerne beholdes.
 *
 *   node --env-file=.env.local scripts/slett-testdata.mjs --ja
 *
 * Krever --ja for å kjøre. Dette kan ikke angres.
 */
import { createClient } from '@supabase/supabase-js'

if (!process.argv.includes('--ja')) {
  console.error(
    'Dette sletter ALLE leier, kunder og bilder – permanent.\n' +
      'Kjør på nytt med --ja hvis det er det du vil.',
  )
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// Filene i Storage må ryddes for seg – databasen vet ikke om dem.
const { data: bilder } = await supabase.from('bilder').select('fil_sti')
if (bilder?.length) {
  const { error } = await supabase.storage
    .from('bilder')
    .remove(bilder.map((b) => b.fil_sti))
  console.log(
    error
      ? `✗ Storage: ${error.message}`
      : `✓ Slettet ${bilder.length} bildefiler fra Storage`,
  )
}

// hendelser og bilder har cascade fra leier, men vi rydder eksplisitt
// slik at eventuelle foreldreløse rader også forsvinner.
for (const tabell of ['hendelser', 'bilder', 'leier', 'kunder']) {
  const { error, count } = await supabase
    .from(tabell)
    .delete({ count: 'exact' })
    .not('id', 'is', null)
  console.log(error ? `✗ ${tabell}: ${error.message}` : `✓ ${tabell}: ${count} slettet`)
}

const { count } = await supabase
  .from('maskiner')
  .update({ status: 'ledig' }, { count: 'exact' })
  .neq('status', 'ledig')
console.log(`✓ ${count ?? 0} maskiner satt til ledig`)

console.log('\nFerdig. Maskiner og admin-brukere er beholdt.')
