import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import 'server-only'

/**
 * Klient med service role-nøkkel. Omgår all radsikkerhet.
 *
 * Brukes utelukkende i server-ruter for kundeflyten, der kunden ikke er
 * innlogget og derfor ikke har noen sesjon databasen kan vurdere. Hver
 * slik rute må selv verifisere tilgang – typisk ved å sjekke at enhets-ID
 * eller leiereferanse i forespørselen faktisk hører til raden som hentes.
 *
 * `server-only` gjør at bygget feiler hvis fila importeres fra en
 * klientkomponent, i stedet for at nøkkelen stille havner i nettleseren.
 */
export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
