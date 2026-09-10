/**
 * Røyktest av Vegvesen-nøkkelen.
 *
 *   node --env-file=.env.local scripts/sjekk-vegvesen.mjs EK12345
 *
 * Finnes fordi ingenting i integrasjonen er bekreftet mot det levende
 * API-et: verken at «Apikey»-headeren virker, at kontrollfrist kommer
 * som yyyy-mm-dd, eller hva et ukjent skilt faktisk svarer. Kjør denne
 * første gang nøkkelen er på plass, og les utskriften.
 */
const BASE = 'https://akfell-datautlevering.atlas.vegvesen.no'

const nøkkel = process.env.SVV_API_KEY
if (!nøkkel) {
  console.log('\nSVV_API_KEY mangler.\n')
  console.log('Modulen virker manuelt uten den. Skal oppslaget virke:')
  console.log('  1. Skaff Altinn-tjenesten «Kjøretøyoppslag» for firmaet')
  console.log('  2. https://www.vegvesen.no/dinside/data-og-api-er/tilgang-til-api-for-kjoretoyopplysninger/')
  console.log('  3. Logg inn med BankID, bestill, kopier nøkkelen med én gang')
  console.log('  4. Legg den i .env.local og i Vercel som SVV_API_KEY\n')
  process.exit(1)
}

const kjennemerke = (process.argv[2] ?? '').replace(/[\s-]/g, '').toUpperCase()
if (!kjennemerke) {
  console.log('\nBruk: node --env-file=.env.local scripts/sjekk-vegvesen.mjs EK12345\n')
  process.exit(1)
}

const url = new URL('/enkeltoppslag/kjoretoydata', BASE)
url.searchParams.set('kjennemerke', kjennemerke)

const res = await fetch(url, {
  headers: { 'SVV-Authorization': `Apikey ${nøkkel}`, Accept: 'application/json' },
})

console.log(`\nHTTP ${res.status} ${res.statusText}`)

const tekst = await res.text()
let kropp
try {
  kropp = JSON.parse(tekst)
} catch {
  console.log('Svaret var ikke JSON:\n')
  console.log(tekst.slice(0, 800))
  process.exit(1)
}

if (kropp.feilmelding) console.log(`feilmelding: ${kropp.feilmelding}`)

const rad = kropp.kjoretoydataListe?.[0]
if (!rad) {
  console.log('\nIngen data for dette skiltet.')
  console.log('Merk at samme svar kommer for skilt som ikke finnes OG for')
  console.log('skjermede skilt – de kan ikke skilles.\n')
  process.exit(0)
}

const pkk = rad.periodiskKjoretoyKontroll
const generelt = rad.godkjenning?.tekniskGodkjenning?.tekniskeData?.generelt

console.log('\nTolket:')
console.log(`  merke            ${generelt?.merke?.[0]?.merke ?? '–'}`)
console.log(`  modell           ${generelt?.handelsbetegnelse?.[0] ?? '–'}`)
console.log(`  reg.status       ${rad.registrering?.registreringsstatus?.kodeVerdi ?? '–'}`)
console.log(`  EU-frist         ${pkk?.kontrollfrist ?? '– (ingen kontrollplikt?)'}`)
console.log(`  sist godkjent    ${pkk?.sistGodkjent ?? '–'}`)

if (pkk?.kontrollfrist && !/^\d{4}-\d{2}-\d{2}$/.test(pkk.kontrollfrist)) {
  console.log('\n  ⚠ kontrollfrist har et annet format enn yyyy-mm-dd.')
  console.log('    src/lib/vegvesen.ts må tilpasses.')
}

console.log('')
