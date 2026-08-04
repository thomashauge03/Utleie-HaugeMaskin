import { redirect } from 'next/navigation'
import { lagServerKlient } from '@/lib/supabase/server'
import 'server-only'

export type Rolle = 'admin' | 'service'

export type AdminBruker = {
  id: string
  navn: string
  epost: string
  rolle: Rolle
  maByttePassord: boolean
}

/** Siden brukeren sendes til når passordet må byttes. */
export const BYTT_PASSORD_STI = '/admin/bytt-passord'

/** Henter innlogget bruker, eller null om ingen er logget inn. */
export async function hentAdmin(): Promise<AdminBruker | null> {
  const supabase = await lagServerKlient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  /*
   * `select('*')` framfor navngitte kolonner med vilje.
   *
   * Ber vi om en kolonne som ennå ikke finnes, feiler hele spørringen,
   * og da returnerer denne null – altså «ikke innlogget» for alle.
   * Én ukjørt migrasjon ville låst hele systemet ute. Med * får vi det
   * som finnes, og feltene under faller tilbake til trygge verdier.
   */
  const { data } = await supabase
    .from('admin_brukere')
    .select('*')
    .eq('id', user.id)
    .eq('aktiv', true)
    .single()

  if (!data) return null

  // Faller tilbake til admin når rolle-kolonnen mangler, slik at
  // eksisterende brukere ikke låses ute før migrasjon 0005 er kjørt.
  return {
    id: data.id,
    navn: data.navn,
    epost: data.epost,
    rolle: (data.rolle as Rolle) ?? 'admin',
    maByttePassord: data.ma_bytte_passord ?? false,
  }
}

/**
 * Krever innlogget bruker, uten å tvinge passordbytte.
 *
 * Brukes av selve passordbyttesiden. Uten dette ville krevAdmin sendt
 * brukeren dit den allerede står, i en evig omdirigering.
 */
export async function krevInnlogget(): Promise<AdminBruker> {
  const bruker = await hentAdmin()
  if (!bruker) redirect('/admin/logg-inn')
  return bruker
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
  // Midlertidig passord må byttes før man slipper videre.
  if (bruker.maByttePassord) redirect(BYTT_PASSORD_STI)
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
  if (bruker.maByttePassord) redirect(BYTT_PASSORD_STI)
  return bruker
}
