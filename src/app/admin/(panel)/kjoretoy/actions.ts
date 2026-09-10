'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { hentKjøretøy, normaliserRegNr } from '@/lib/vegvesen'

/*
 * 2–7 tegn er Vegvesens egen grense på kjennemerke-parameteren. Vi
 * validerer ikke mot norsk skiltformat: utenlandske skilt og
 * prøveskilt skal kunne føres inn, og et register man ikke får lagt
 * bilen sin inn i er verdiløst.
 */
const REG_NR = /^[A-Z0-9]{2,7}$/

const valgfriDato = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: 'Ugyldig dato',
  })

const kjøretøySkjema = z.object({
  reg_nr: z
    .string()
    .trim()
    .transform(normaliserRegNr)
    .refine((v) => REG_NR.test(v), {
      message: 'Registreringsnummeret må være 2–7 bokstaver og tall',
    }),
  internt_navn: z.string().trim().optional(),
  ansvarlig_navn: z.string().trim().optional(),
  ansvarlig_epost: z.string().trim().optional(),
  eu_frist: valgfriDato,
})

export type KjøretøyTilstand = { feil?: string; ok?: string }

export async function opprettKjøretøy(
  _forrige: KjøretøyTilstand,
  formData: FormData,
): Promise<KjøretøyTilstand> {
  // Server actions er POST-ruter som kan treffes direkte. Tilgangen må
  // sjekkes her, ikke bare i layouten.
  await krevAdmin()

  const felter = kjøretøySkjema.safeParse({
    reg_nr: formData.get('reg_nr') ?? '',
    internt_navn: formData.get('internt_navn'),
    ansvarlig_navn: formData.get('ansvarlig_navn'),
    ansvarlig_epost: formData.get('ansvarlig_epost'),
    eu_frist: formData.get('eu_frist') ?? '',
  })
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const epost = felter.data.ansvarlig_epost
  if (epost && !z.email().safeParse(epost).success) {
    return { feil: `«${epost}» er ikke en gyldig e-postadresse` }
  }

  /*
   * Oppslaget skjer før innsettingen, ikke etter, slik at bilen er
   * ferdig utfylt første gang den vises. Feiler det, lagrer vi likevel
   * med det brukeren skrev inn – et halvt register er bedre enn ingen,
   * og cron-jobben prøver igjen.
   */
  const oppslag = await hentKjøretøy(felter.data.reg_nr)
  const fraSvv =
    oppslag.status === 'ok'
      ? { ...oppslag.data, svv_hentet: new Date().toISOString() }
      : {}

  const supabase = await lagServerKlient()
  const { error } = await supabase.from('kjoretoy').insert({
    reg_nr: felter.data.reg_nr,
    internt_navn: felter.data.internt_navn || null,
    ansvarlig_navn: felter.data.ansvarlig_navn || null,
    ansvarlig_epost: felter.data.ansvarlig_epost || null,
    eu_frist: felter.data.eu_frist,
    ...fraSvv,
  })

  if (error) {
    // 23505 er unik-brudd. Postgres sin egen tekst nevner indeksnavnet,
    // som ikke sier brukeren noe.
    if (error.code === '23505') {
      return { feil: `${felter.data.reg_nr} er allerede registrert.` }
    }
    return { feil: `Kunne ikke lagre kjøretøyet: ${error.message}` }
  }

  revalidatePath('/admin/kjoretoy')

  const hale =
    oppslag.status === 'ok'
      ? ' Data er hentet fra Vegvesen.'
      : oppslag.status === 'nøkkelfeil'
        ? ''
        : ' Vegvesen svarte ikke – fyll inn fristen selv, eller prøv igjen fra kjøretøysiden.'

  return { ok: `${felter.data.reg_nr} er lagt til.${hale}` }
}
