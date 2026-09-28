import type { ProsjektInnbygd } from '@/lib/types'

/*
 * Hvem en leie står på – kunden, eller den ansatte og prosjektet.
 *
 * Ett sted, så oversikten, leielista, kalenderen, verkstedet og
 * e-postene aldri viser det ulikt. Ingen formatering av telefon her:
 * fila testes med node:test, som ikke løser opp `@/`-stier, så den
 * importerer bare typer.
 */

/**
 * Innbygging av kunde, ansatt og prosjekt i leiespørringer.
 *
 * `leier` har to fremmednøkler til `admin_brukere` – `godkjent_av` og
 * `ansatt_id` – og da nekter PostgREST å gjette hvilken som menes.
 * Nøkkelen må navngis, ellers feiler hele spørringen.
 */
export const LEIETAKER_FELT =
  'kunder(*), ansatt:admin_brukere!leier_ansatt_id_fkey(navn, telefon, epost), prosjekter(navn, nummer)'

/** «Kvamsøy bru (P-2317)», eller bare navnet når nummeret mangler. */
export function prosjektNavn(p: ProsjektInnbygd): string {
  return p.nummer ? `${p.navn} (${p.nummer})` : p.navn
}

export type LeietakerKilde = {
  ansatt_id?: string | null
  kunder?: { navn: string; telefon: string } | null
  ansatt?: { navn: string; telefon: string | null } | null
  prosjekter?: ProsjektInnbygd | null
}

export type Leietaker = {
  intern: boolean
  navn: string
  /** Rått nummer. Formateres med visTelefon der det vises. */
  telefon: string | null
  /** Bare på internleier. */
  prosjekt: string | null
}

/** Avgjøres på `ansatt_id`, ikke på innbyggingen – den kan mangle. */
export function leietaker(l: LeietakerKilde): Leietaker {
  if (l.ansatt_id) {
    return {
      intern: true,
      navn: l.ansatt?.navn ?? 'Ukjent ansatt',
      telefon: l.ansatt?.telefon ?? null,
      prosjekt: l.prosjekter ? prosjektNavn(l.prosjekter) : null,
    }
  }
  return {
    intern: false,
    navn: l.kunder?.navn ?? '–',
    telefon: l.kunder?.telefon ?? null,
    prosjekt: null,
  }
}

/** «Ola Nordmann · Kvamsøy bru» eller «Kari Kunde» – der det er plass til én linje. */
export function leietakerTekst(l: LeietakerKilde): string {
  const t = leietaker(l)
  return t.prosjekt ? `${t.navn} · ${t.prosjekt}` : t.navn
}

/**
 * Hvorfor en maskin ikke kan tas ut – eller null når den er ledig.
 *
 * Ansatte ser hvilken kollega som har utstyret, så de vet hvem de skal
 * spørre. Kundens navn vises aldri – der står det bare «Utleid».
 */
export function opptattGrunn(m: {
  status: string
  påVerksted: boolean
  leie: { ansatt_id: string | null; ansattNavn: string | null; prosjekt: string | null } | null
  megId: string
}): string | null {
  if (m.leie) {
    if (!m.leie.ansatt_id) return 'Utleid'
    const hvem =
      m.leie.ansatt_id === m.megId ? 'Hos deg' : `Hos ${m.leie.ansattNavn ?? 'en kollega'}`
    return m.leie.prosjekt ? `${hvem} · ${m.leie.prosjekt}` : hvem
  }
  if (m.status === 'service') return 'Ute av drift'
  if (m.påVerksted) return 'Til reparasjon'
  if (m.status !== 'ledig') return 'Utleid'
  return null
}
