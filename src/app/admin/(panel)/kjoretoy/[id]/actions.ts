'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { bareUtfylte, hentKjøretøy } from '@/lib/vegvesen'

const valgfriDato = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: 'Ugyldig dato',
  })

const valgfriTall = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v.replace(/[\s.,]/g, ''))))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), {
    message: 'Må være et positivt tall',
  })

const redigerSkjema = z.object({
  internt_navn: z.string().trim().optional(),
  ansvarlig_navn: z.string().trim().optional(),
  ansvarlig_epost: z.string().trim().optional(),
  merke: z.string().trim().optional(),
  modell: z.string().trim().optional(),
  arsmodell: valgfriTall,
  km: valgfriTall,
  eu_frist: valgfriDato,
  forsikring_selskap: z.string().trim().optional(),
  forsikring_forfall: valgfriDato,
  neste_service: valgfriDato,
  neste_dekkskift: valgfriDato,
  status: z.enum(['i_drift', 'avskiltet', 'solgt']),
  notat: z.string().trim().optional(),
})

export type RedigerTilstand = { feil?: string; ok?: string }

export async function lagreKjøretøy(
  id: string,
  _forrige: RedigerTilstand,
  formData: FormData,
): Promise<RedigerTilstand> {
  await krevAdmin()

  if (!z.uuid().safeParse(id).success) return { feil: 'Ukjent kjøretøy.' }

  const felter = redigerSkjema.safeParse({
    internt_navn: formData.get('internt_navn'),
    ansvarlig_navn: formData.get('ansvarlig_navn'),
    ansvarlig_epost: formData.get('ansvarlig_epost'),
    merke: formData.get('merke'),
    modell: formData.get('modell'),
    arsmodell: formData.get('arsmodell') ?? '',
    km: formData.get('km') ?? '',
    eu_frist: formData.get('eu_frist') ?? '',
    forsikring_selskap: formData.get('forsikring_selskap'),
    forsikring_forfall: formData.get('forsikring_forfall') ?? '',
    neste_service: formData.get('neste_service') ?? '',
    neste_dekkskift: formData.get('neste_dekkskift') ?? '',
    status: formData.get('status') ?? 'i_drift',
    notat: formData.get('notat'),
  })
  if (!felter.success) {
    const f = felter.error.issues[0]
    return { feil: `${f.path.join('.') || 'Skjemaet'}: ${f.message}` }
  }

  const epost = felter.data.ansvarlig_epost
  if (epost && !z.email().safeParse(epost).success) {
    return { feil: `«${epost}» er ikke en gyldig e-postadresse` }
  }

  const supabase = await lagServerKlient()
  const { error } = await supabase
    .from('kjoretoy')
    .update({
      internt_navn: felter.data.internt_navn || null,
      ansvarlig_navn: felter.data.ansvarlig_navn || null,
      ansvarlig_epost: felter.data.ansvarlig_epost || null,
      merke: felter.data.merke || null,
      modell: felter.data.modell || null,
      arsmodell: felter.data.arsmodell,
      km: felter.data.km,
      eu_frist: felter.data.eu_frist,
      forsikring_selskap: felter.data.forsikring_selskap || null,
      forsikring_forfall: felter.data.forsikring_forfall,
      neste_service: felter.data.neste_service,
      neste_dekkskift: felter.data.neste_dekkskift,
      status: felter.data.status,
      notat: felter.data.notat || null,
      // Skjemaet har ingen trigger for dette. Settes fra applikasjonen,
      // som resten av tabellene.
      oppdatert: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { feil: `Kunne ikke lagre: ${error.message}` }

  revalidatePath('/admin/kjoretoy')
  revalidatePath(`/admin/kjoretoy/${id}`)
  return { ok: 'Lagret.' }
}

/**
 * Henter fristen på nytt fra Vegvesen.
 *
 * Bundet action uten returverdi: knappen skal bare oppdatere siden.
 * Feiler oppslaget, står de gamle verdiene igjen – det er riktigere enn
 * å tømme felter fordi et API var nede.
 */
export async function oppdaterFraVegvesen(id: string) {
  await krevAdmin()
  if (!z.uuid().safeParse(id).success) return

  const supabase = await lagServerKlient()
  const { data } = await supabase
    .from('kjoretoy')
    .select('reg_nr')
    .eq('id', id)
    .maybeSingle()

  if (!data?.reg_nr) return

  const oppslag = await hentKjøretøy(data.reg_nr as string)
  if (oppslag.status !== 'ok') return

  await supabase
    .from('kjoretoy')
    .update({
      ...bareUtfylte(oppslag.data),
      svv_hentet: new Date().toISOString(),
      oppdatert: new Date().toISOString(),
    })
    .eq('id', id)

  revalidatePath('/admin/kjoretoy')
  revalidatePath(`/admin/kjoretoy/${id}`)
}

export async function slettKjøretøy(id: string) {
  await krevAdmin()
  if (!z.uuid().safeParse(id).success) return

  const supabase = await lagServerKlient()
  await supabase.from('kjoretoy').delete().eq('id', id)

  revalidatePath('/admin/kjoretoy')
  // redirect kaster NEXT_REDIRECT og skal aldri stå i en try-blokk,
  // og alltid etter revalidatePath.
  redirect('/admin/kjoretoy')
}
