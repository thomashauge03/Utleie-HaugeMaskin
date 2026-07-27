import { createBrowserClient } from '@supabase/ssr'

/**
 * Nettleserklient. Brukes kun til å laste bilder opp til Storage via
 * signerte URL-er – all lesing og skriving av data går gjennom server.
 */
export function lagNettleserKlient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
