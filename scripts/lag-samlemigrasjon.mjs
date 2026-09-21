/**
 * Slår sammen migrasjonene etter 0002 til én fil.
 *
 *   node scripts/lag-samlemigrasjon.mjs
 *
 * Skrives med Node framfor PowerShell fordi Get-Content i PS 5.1
 * leser med systemets tegnsett, ikke UTF-8 – og da blir «låser» til
 * «lÃ¥ser» i Supabase-editoren.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const mappe = path.join(process.cwd(), 'supabase', 'migrations')

// 0001 og 0002 er kjørt overalt, og ingen av dem er idempotente – tar
// vi dem med, feiler fila på «relation already exists». Nummeret må
// sammenlignes som tall; «0002_x.sql» > «0002» er sant som streng.
const filer = readdirSync(mappe)
  .filter((f) => f.endsWith('.sql') && Number(f.slice(0, 4)) > 2)
  .sort()

const innhold = new Map(
  filer.map((f) => [f, readFileSync(path.join(mappe, f), 'utf8').trimEnd()]),
)

/*
 * Idempotent er ikke det samme som ufarlig. En migrasjon som dropper en
 * tabell eller kolonne gir samme sluttilstand hver gang den kjores, men
 * den forste kjoringen kan ta data som ikke finnes noe annet sted. Den
 * som limer inn fila for a fikse en helt annen manglende migrasjon, skal
 * se det for han trykker Run - ikke tre hundre linjer lenger nede.
 *
 * Bare de fire verbene som tar DATA teller. «drop policy» og «drop
 * index» star i nesten hver migrasjon som del av idempotens-monsteret
 * drop-sa-create, og ville gjort advarselen til stoy alle ignorerer.
 */
const RIVER = /^\s*(drop\s+(table|column)|delete\s+from|truncate)\b/im
const river = filer.filter((f) => RIVER.test(innhold.get(f)))

const deler = [
  '-- ============================================================',
  '-- Migrasjoner etter 0002, samlet.',
  '-- Lim inn hele fila i Supabase SQL Editor og trykk Run.',
  '-- Trygg a kjore flere ganger - alt er idempotent.',
]

if (river.length) {
  deler.push(
    '--',
    '-- ADVARSEL: fila fjerner ogsa data. Disse migrasjonene river:',
    ...river.map((f) => `--   ${f}`),
    '-- Idempotent betyr lik sluttilstand, ikke at ingenting gar tapt.',
    '-- Sjekk at det som droppes er tatt vare pa for du kjorer.',
  )
}

deler.push('-- ============================================================', '')

for (const f of filer) {
  deler.push(`-- >>>>>>>>>>  ${f}  <<<<<<<<<<`)
  deler.push(innhold.get(f))
  deler.push('')
}

const ut = path.join(process.cwd(), 'supabase', 'KJOR-DENNE.sql')
writeFileSync(ut, deler.join('\n'), 'utf8')

console.log(`Skrev ${filer.length} migrasjoner til supabase/KJOR-DENNE.sql`)
for (const f of filer) console.log(`   ${f}`)
