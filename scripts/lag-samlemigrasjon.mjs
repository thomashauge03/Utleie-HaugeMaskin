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

const deler = [
  '-- ============================================================',
  '-- Migrasjoner etter 0002, samlet.',
  '-- Lim inn hele fila i Supabase SQL Editor og trykk Run.',
  '-- Trygg a kjore flere ganger - alt er idempotent.',
  '-- ============================================================',
  '',
]

for (const f of filer) {
  deler.push(`-- >>>>>>>>>>  ${f}  <<<<<<<<<<`)
  deler.push(readFileSync(path.join(mappe, f), 'utf8').trimEnd())
  deler.push('')
}

const ut = path.join(process.cwd(), 'supabase', 'KJOR-DENNE.sql')
writeFileSync(ut, deler.join('\n'), 'utf8')

console.log(`Skrev ${filer.length} migrasjoner til supabase/KJOR-DENNE.sql`)
for (const f of filer) console.log(`   ${f}`)
