import { redirect } from 'next/navigation'
import { lagServerKlient } from '@/lib/supabase/server'
import 'server-only'

export type AdminBruker = {
  id: string
  navn: string
  epost: string
}

/** Henter innlogget admin, eller null om ingen er logget inn. */
export async function hentAdmin(): Promise<AdminBruker | null> {
  const supabase = await lagServerKlient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('admin_brukere')
    .select('id, navn, epost')
    .eq('id', user.id)
    .eq('aktiv', true)
    .single()

  return data ?? null
}

/**
 * Krever innlogget, aktiv admin – ellers omdirigering til innlogging.
 *
 * Må kalles øverst i hver adminside OG i hver server action. En server
 * action er en POST-rute som kan treffes direkte utenfra, så verken
 * proxy.ts eller adminlayouten er tilstrekkelig sikring alene.
 */
export async function krevAdmin(): Promise<AdminBruker> {
  const admin = await hentAdmin()
  if (!admin) redirect('/admin/logg-inn')
  return admin
}
