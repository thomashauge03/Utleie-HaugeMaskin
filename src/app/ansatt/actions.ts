'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { krevAnsatt } from '@/lib/auth'
import { norskSluttAvDag } from '@/lib/dato'
import { MAKS_KOMMENTAR } from '@/lib/validering'
import { avsluttInternLeie, taUtUtstyr } from '@/lib/intern-leie'

/** `varsel`: noe som ble tatt ut, er reservert før det er tilbake. */
export type UttakTilstand = { feil?: string; ok?: string; varsel?: string }
export type LeverTilstand = { feil?: string; ok?: string }

const uttakSkjema = z.object({
  maskinIder: z.array(z.uuid()).min(1, 'Velg minst én ting').max(50, 'Maks 50 om gangen'),
  prosjekt_id: z.uuid('Velg prosjekt'),
  planlagt_slutt: z.string().optional(),
})

/**
 * Tar ut det som er huket av, til valgt prosjekt.
 *
 * Både ok og feil kan være satt: gikk tre av fire, skal det stå hvilke
 * tre som ble tatt ut og hvorfor den fjerde ikke ble det.
 */
export async function taUt(
  _forrige: UttakTilstand,
  formData: FormData,
): Promise<UttakTilstand> {
  const bruker = await krevAnsatt()

  const felter = uttakSkjema.safeParse({
    maskinIder: formData.getAll('maskin_id'),
    prosjekt_id: formData.get('prosjekt_id'),
    planlagt_slutt: formData.get('planlagt_slutt') || undefined,
  })
  if (!felter.success) return { feil: felter.error.issues[0].message }

  // Tom dato betyr «til videre». Satt dato gjelder slutten av dagen i
  // norsk tid – se norskSluttAvDag.
  let slutt: Date | null = null
  if (felter.data.planlagt_slutt) {
    slutt = norskSluttAvDag(felter.data.planlagt_slutt)
    if (!slutt) return { feil: 'Ugyldig dato' }
    if (slutt.getTime() < Date.now()) return { feil: 'Datoen kan ikke være tilbake i tid' }
  }

  const svar = await taUtUtstyr(
    bruker,
    [...new Set(felter.data.maskinIder)],
    felter.data.prosjekt_id,
    slutt,
  )
  if ('feil' in svar) return { feil: svar.feil }

  revalidatePath('/ansatt')
  revalidatePath('/m/[qr]', 'page')

  return {
    ok: svar.tattUt.length > 0 ? `Tatt ut: ${svar.tattUt.join(', ')}.` : undefined,
    feil: svar.ikkeTatt.length > 0 ? `${svar.ikkeTatt.join('. ')}.` : undefined,
    varsel: svar.varsler.length > 0 ? svar.varsler.join(' ') : undefined,
  }
}

/** Leverer én internleie. Leien må være den innloggedes egen. */
export async function lever(
  leieId: string,
  _forrige: LeverTilstand,
  formData: FormData,
): Promise<LeverTilstand> {
  const bruker = await krevAnsatt()
  if (!z.uuid().safeParse(leieId).success) return { feil: 'Fant ikke leien.' }

  const kommentar = String(formData.get('kommentar') ?? '')
    .trim()
    .slice(0, MAKS_KOMMENTAR)

  const svar = await avsluttInternLeie({
    leieId,
    ansattId: bruker.id,
    aktor: `${bruker.rolle}:${bruker.epost}`,
    kommentar: kommentar || null,
  })
  if ('feil' in svar) return { feil: svar.feil }

  revalidatePath('/ansatt')
  revalidatePath('/m/[qr]', 'page')
  return { ok: `${svar.maskin} er levert.` }
}
