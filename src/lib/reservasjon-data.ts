import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { osloDag } from '@/lib/dato'
import type { Reservasjon } from '@/lib/reservasjon'

/** «Tabellen finnes ikke» – migrasjon 0012 er ikke kjørt. */
const FINNES_IKKE = ['PGRST205', '42P01']

/**
 * Aktive reservasjoner som ikke er over. Service role, som resten av
 * kunde- og ansattflyten. Mangler tabellen, er svaret tomt, så appen
 * virker som før til migrasjonen er kjørt. Andre feil kastes – en feil
 * skal aldri se ut som «ingen reservasjoner».
 */
export async function hentReservasjoner(maskinIder?: string[]): Promise<Reservasjon[]> {
  let spørring = supabaseAdmin
    .from('reservasjoner')
    .select('id, maskin_id, fra_dato, til_dato, kunde_navn, kunde_telefon, status')
    .eq('status', 'aktiv')
    .gte('til_dato', osloDag(new Date()))
    .order('fra_dato')
  if (maskinIder) spørring = spørring.in('maskin_id', maskinIder)

  const { data, error } = await spørring
  if (error) {
    if (FINNES_IKKE.includes(error.code)) return []
    throw new Error(`Kunne ikke hente reservasjoner: ${error.message}`)
  }
  return (data ?? []) as Reservasjon[]
}

/** Kundens egne reservasjoner er hentet – knyttes til leien som startet. */
export async function merkHentet(ider: string[], leieId: string): Promise<void> {
  if (ider.length === 0) return
  await supabaseAdmin
    .from('reservasjoner')
    .update({ status: 'hentet', leie_id: leieId })
    .in('id', ider)
    .eq('status', 'aktiv')
}
