/**
 * Oppretter den private lagringsbøtta for bilder.
 *
 *   node --env-file=.env.local scripts/opprett-botte.mjs
 *
 * Trygg å kjøre flere ganger – gjør ingenting hvis bøtta finnes.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: finnes } = await supabase.storage.getBucket('bilder')

if (finnes) {
  console.log(`Bøtta "bilder" finnes allerede (${finnes.public ? 'OFFENTLIG' : 'privat'}).`)
  process.exit(0)
}

const { error } = await supabase.storage.createBucket('bilder', {
  public: false, // hentes gjennom signerte URL-er, ikke åpne lenker
  fileSizeLimit: 5 * 1024 * 1024, // komprimerte bilder ligger på ~200 kB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
})

if (error) {
  console.error(`✗ Kunne ikke opprette bøtta: ${error.message}`)
  process.exit(1)
}

console.log('✓ Opprettet privat bøtte "bilder" (maks 5 MB, kun bildeformater).')
