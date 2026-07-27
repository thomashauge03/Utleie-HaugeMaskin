/**
 * Sjekker at Supabase-prosjektet er satt opp riktig.
 *
 *   node --env-file=.env.local scripts/sjekk-oppsett.mjs
 *
 * Skriver aldri ut nøkler – kun om de finnes og virker.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const nøkkel = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !nøkkel) {
  console.error('✗ Mangler miljøvariabler. Er .env.local fylt ut?')
  process.exit(1)
}

const supabase = createClient(url, nøkkel, { auth: { persistSession: false } })

const TABELLER = [
  'admin_brukere',
  'innstillinger',
  'kunder',
  'maskiner',
  'leier',
  'bilder',
  'hendelser',
]

let feil = 0

console.log(`\nProsjekt: ${new URL(url).hostname}\n`)
console.log('Tabeller')

for (const tabell of TABELLER) {
  // Ekte select, ikke `head: true`-telling. Sistnevnte returnerer ikke
  // feil for manglende tabeller, og ga falskt grønt lys under oppsettet.
  const { error, data } = await supabase.from(tabell).select('*').limit(1)

  if (error) {
    feil++
    console.log(`  ✗ ${tabell.padEnd(15)} ${error.message}`)
  } else {
    const { count } = await supabase
      .from(tabell)
      .select('*', { count: 'exact', head: true })
    console.log(`  ✓ ${tabell.padEnd(15)} ${count ?? data.length} rader`)
  }
}

console.log('\nLagring')
const { data: bøtter, error: bøtteFeil } = await supabase.storage.listBuckets()

if (bøtteFeil) {
  feil++
  console.log(`  ✗ ${bøtteFeil.message}`)
} else if (!bøtter.length) {
  feil++
  console.log('  ✗ Ingen bøtter. Opprett en privat bøtte som heter "bilder".')
} else {
  for (const b of bøtter) {
    const privat = !b.public
    if (b.name === 'bilder' && !privat) feil++
    console.log(`  ${b.name === 'bilder' && !privat ? '✗' : '✓'} ${b.name.padEnd(15)} ${privat ? 'privat' : 'OFFENTLIG – bør være privat!'}`)
  }
  if (!bøtter.some((b) => b.name === 'bilder')) {
    feil++
    console.log('  ✗ Mangler bøtte som heter "bilder"')
  }
}

console.log(
  feil === 0
    ? '\n✓ Alt på plass.\n'
    : `\n✗ ${feil} problem(er) å rette opp. Se README steg 2 og 3.\n`,
)
process.exit(feil === 0 ? 0 : 1)
