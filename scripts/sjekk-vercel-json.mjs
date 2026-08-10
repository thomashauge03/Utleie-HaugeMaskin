/**
 * Validerer vercel.json mot Vercels eget skjema før push.
 *
 * Bakgrunn: skjemaet avviser ukjente felt. En kommentarnøkkel av typen
 * "//regions" ga «Build Failed – should NOT have additional property»,
 * og fordi det skjer i valideringen kjørte bygget aldri. Feilen er
 * usynlig lokalt: npm run build bryr seg ikke om vercel.json.
 */
import { readFileSync } from 'node:fs'

const fil = new URL('../vercel.json', import.meta.url)
const config = JSON.parse(readFileSync(fil, 'utf8'))

const skjema = await fetch('https://openapi.vercel.sh/vercel.json').then((r) =>
  r.json(),
)

const tillatte = new Set(Object.keys(skjema.properties ?? {}))
tillatte.add('$schema')

const ukjente = Object.keys(config).filter((k) => !tillatte.has(k))

// process.exitCode framfor process.exit(): sistnevnte river ned Node
// midt i ventende async-arbeid, og gir en libuv-assertion på Windows.
if (ukjente.length) {
  console.log('\n  FEIL: vercel.json har felt skjemaet ikke kjenner:\n')
  for (const k of ukjente) console.log(`    "${k}"`)
  console.log('\n  Vercel avviser dette med «Build Failed» for bygget starter.')
  console.log('  JSON har ingen kommentarer - legg forklaringen i docs/ i stedet.\n')
  process.exitCode = 1
} else {
  // Regionen må være en kjent Vercel-region, ellers feiler utrullingen.
  const regioner = skjema.properties?.regions?.items?.enum
  const ugyldige = Array.isArray(config.regions)
    ? config.regions.filter((r) => regioner && !regioner.includes(r))
    : []

  if (ugyldige.length) {
    console.log(`\n  FEIL: ukjent region: ${ugyldige.join(', ')}\n`)
    process.exitCode = 1
  } else {
    console.log(
      `\n  vercel.json er gyldig. Felt: ${Object.keys(config).join(', ')}` +
        `${config.regions ? ` | region: ${config.regions.join(', ')}` : ''}\n`,
    )
  }
}
