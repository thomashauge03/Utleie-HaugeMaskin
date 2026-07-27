/**
 * Oppretter en admin-bruker.
 *
 *   node --env-file=.env.local scripts/opprett-admin.mjs "din@epost.no" "passord" "Ditt Navn"
 *
 * Passordet sendes som argument slik at det ikke må lagres i noen fil.
 * Videre brukere opprettes fra /admin/brukere inne i appen.
 */
import { createClient } from '@supabase/supabase-js'

const [epost, passord, ...navnDeler] = process.argv.slice(2)
const navn = navnDeler.join(' ')

if (!epost || !passord || !navn) {
  console.error('Bruk: node --env-file=.env.local scripts/opprett-admin.mjs "epost" "passord" "Navn"')
  process.exit(1)
}

if (passord.length < 8) {
  console.error('✗ Passordet må være minst 8 tegn.')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// Finn eksisterende auth-bruker, ellers opprett.
const { data: liste } = await supabase.auth.admin.listUsers()
let bruker = liste?.users.find((u) => u.email?.toLowerCase() === epost.toLowerCase())

if (bruker) {
  console.log(`Auth-bruker for ${epost} finnes fra før – setter nytt passord.`)
  await supabase.auth.admin.updateUserById(bruker.id, { password: passord })
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email: epost,
    password: passord,
    email_confirm: true, // ingen e-postbekreftelse nødvendig for admin
  })
  if (error) {
    console.error(`✗ Kunne ikke opprette bruker: ${error.message}`)
    process.exit(1)
  }
  bruker = data.user
}

const { error: radFeil } = await supabase
  .from('admin_brukere')
  .upsert({ id: bruker.id, navn, epost, aktiv: true }, { onConflict: 'id' })

if (radFeil) {
  console.error(`✗ Kunne ikke gi admintilgang: ${radFeil.message}`)
  process.exit(1)
}

console.log(`✓ ${navn} <${epost}> kan nå logge inn på /admin/logg-inn`)
