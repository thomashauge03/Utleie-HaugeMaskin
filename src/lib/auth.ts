import { redirect } from 'next/navigation'
import { lagServerKlient } from '@/lib/supabase/server'
import 'server-only'

export type Rolle = 'admin' | 'service'

export type AdminBruker = {
  id: string
  navn: string
  epost: string
  rolle: Rolle
}

/** Henter innlogget bruker, eller null om ingen er logget inn. */
export async function hentAdmin(): Promise<AdminBruker | null> {
  const supabase = await lagServerKlient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('admin_brukere')
    .select('id, navn, epost, rolle')
    .eq('id', user.id)
    .eq('aktiv', true)
    .single()

  if (!data) return null

  // Faller tilbake til admin når rolle-kolonnen mangler, slik at
  // eksisterende brukere ikke låses ute før migrasjon 0005 er kjørt.
  return { ...data, rolle: (data.rolle as Rolle) ?? 'admin' }
}

/**
 * Krever innlogget bruker med full tilgang.
 *
 * Må kalles øverst i hver adminside OG i hver server action. En server
 * action er en POST-rute som kan treffes direkte utenfra, så verken
 * proxy.ts eller adminlayouten er tilstrekkelig sikring alene.
 *
 * Servicebrukere sendes til verkstedet – de har ikke noe å gjøre i
 * kundelister og innstillinger.
 */
export async function krevAdmin(): Promise<AdminBruker> {
  const bruker = await hentAdmin()
  if (!bruker) redirect('/admin/logg-inn')
  if (bruker.rolle === 'service') redirect('/verksted')
  return bruker
}

/**
 * Krever bruker som kan endre verkstedet – admin eller servicearbeider.
 *
 * Returnerer null i stedet for å omdirigere, fordi verkstedsidene også
 * skal kunne leses uten innlogging. Kallstedet avgjør hva som skjer.
 */
export async function hentVerkstedBruker(): Promise<AdminBruker | null> {
  return hentAdmin()
}

export async function krevVerkstedBruker(): Promise<AdminBruker> {
  const bruker = await hentAdmin()
  if (!bruker) redirect('/admin/logg-inn')
  return bruker
}
