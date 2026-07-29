import { z } from 'zod'
import 'server-only'

/**
 * Miljøvariabler valideres ved oppstart i stedet for å feile med
 * "undefined is not a string" et tilfeldig sted midt i en forespørsel.
 */
const skjema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
})

const resultat = skjema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
})

if (!resultat.success) {
  const mangler = resultat.error.issues.map((i) => i.path.join('.')).join(', ')
  throw new Error(
    `Manglende eller ugyldige miljøvariabler: ${mangler}\n` +
      `Kopier .env.local.example til .env.local og fyll inn verdiene.`,
  )
}

export const env = resultat.data
