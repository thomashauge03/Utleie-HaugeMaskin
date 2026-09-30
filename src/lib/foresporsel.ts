import { z } from 'zod'

/**
 * Reglene for leieforespørsler fra haugemaskin.no, som rene funksjoner.
 *
 * Datoene er norske kalenderdager som yyyy-mm-dd og kan sammenlignes som
 * tekst. Mobilnummeret kommer rått ut herfra – ruta normaliserer det med
 * normaliserTelefon, samme som kundeskjemaet. Se
 * docs/superpowers/specs/2026-09-30-leieforesporsel-design.md.
 */

export const MAKS_DAGER = 60
/** Kortere tid fra skjemaet vises til det sendes, er en robot. */
export const MIN_MS = 3000

const DAG = /^\d{4}-\d{2}-\d{2}$/
const GENERISK = 'Kunne ikke sende forespørselen. Prøv igjen.'

export type Forespørsel = {
  maskin_id: string
  fra: string
  til: string
  navn: string
  telefon: string
  epost: string | null
  melding: string | null
}

export type Utfall = { ok: true; data: Forespørsel } | { ok: false; feil: string; status: number }

const skjema = z.object({
  maskin_id: z.uuid('Ukjent maskin'),
  fra: z.string().regex(DAG, 'Velg datoer i kalenderen'),
  til: z.string().regex(DAG, 'Velg datoer i kalenderen'),
  navn: z.string().trim().min(2, 'Skriv navnet ditt').max(100, 'Navnet er for langt'),
  telefon: z.string().trim().min(1, 'Skriv mobilnummeret ditt').max(20, 'Ugyldig mobilnummer'),
  epost: z
    .union([z.literal(''), z.email('Ugyldig e-postadresse').max(200)])
    .optional(),
  melding: z.string().trim().max(500, 'Meldingen kan være høyst 500 tegn').optional(),
  // Honningfelt: skjult for mennesker, fylt ut av roboter.
  nettside: z.string().optional(),
  startet: z.number().optional(),
})

/** Finnes datoen? «2026-02-31» passer mønsteret, men ikke kalenderen. */
function finnes(dag: string): boolean {
  const d = new Date(`${dag}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dag
}

/** Dager fra `fra` til `til`, i UTC så sommertid ikke spiller inn. */
function dagerMellom(fra: string, til: string): number {
  return Math.round((Date.parse(`${til}T00:00:00Z`) - Date.parse(`${fra}T00:00:00Z`)) / 86_400_000)
}

export function validerForesporsel(kropp: unknown, iDag: string, nå: number): Utfall {
  const f = skjema.safeParse(kropp)
  if (!f.success) return { ok: false, feil: f.error.issues[0].message, status: 400 }
  const d = f.data

  // Samme svar som andre feil, så en robot ikke lærer hva som avslørte den.
  if (d.nettside || d.startet === undefined || nå - d.startet < MIN_MS) {
    return { ok: false, feil: GENERISK, status: 400 }
  }

  if (!finnes(d.fra) || !finnes(d.til)) {
    return { ok: false, feil: 'Velg datoer i kalenderen', status: 400 }
  }
  if (d.fra < iDag) return { ok: false, feil: 'Startdatoen har vært', status: 400 }
  if (d.til < d.fra) return { ok: false, feil: 'Sluttdatoen er før startdatoen', status: 400 }
  if (dagerMellom(d.fra, d.til) + 1 > MAKS_DAGER) {
    return {
      ok: false,
      feil: `Høyst ${MAKS_DAGER} dager om gangen – ring oss for lengre leie`,
      status: 400,
    }
  }
  if (dagerMellom(iDag, d.til) > 366) {
    return { ok: false, feil: 'Vi tar imot forespørsler inntil ett år fram', status: 400 }
  }

  return {
    ok: true,
    data: {
      maskin_id: d.maskin_id,
      fra: d.fra,
      til: d.til,
      navn: d.navn,
      telefon: d.telefon,
      epost: d.epost || null,
      melding: d.melding || null,
    },
  }
}

/** Overlapper perioden noen av de opptatte? Begge endedager er med. */
export function overlapper(
  fra: string,
  til: string,
  perioder: { fra: string; til: string }[],
): boolean {
  return perioder.some((p) => fra <= p.til && til >= p.fra)
}

/**
 * Dagene maskinen er opptatt: aktive reservasjoner, og leier som pågår.
 * En leie uten kjent slutt (til videre, eller på overtid) er opptatt til og
 * med i dag – likt kalenderen på haugemaskin.no. Forespørsler og avlyste
 * reservasjoner sperrer ingenting.
 */
export function opptattePerioder(
  reservasjoner: { fra_dato: string; til_dato: string; status: string }[],
  leier: { startDag: string; sluttDag: string | null }[],
  iDag: string,
): { fra: string; til: string }[] {
  return [
    ...reservasjoner
      .filter((r) => r.status === 'aktiv')
      .map((r) => ({ fra: r.fra_dato, til: r.til_dato })),
    ...leier.map((l) => ({
      fra: l.startDag,
      til: l.sluttDag && l.sluttDag > iDag ? l.sluttDag : iDag,
    })),
  ]
}
