'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'

export type Tilstand = { feil?: string; ok?: string }

/* ═══ Firmainnstillinger ═══════════════════════════════════ */

const innstillingerSkjema = z.object({
  firmanavn: z.string().trim().max(120),
  varsel_epost: z.string().trim(),
  vis_pris_standard: z.union([z.literal('on'), z.null()]).transform((v) => v === 'on'),
  vilkar_tekst: z.string().trim(),
})

export async function lagreInnstillinger(
  _forrige: Tilstand,
  formData: FormData,
): Promise<Tilstand> {
  await krevAdmin()

  const felter = innstillingerSkjema.safeParse({
    firmanavn: formData.get('firmanavn'),
    varsel_epost: formData.get('varsel_epost'),
    vis_pris_standard: formData.get('vis_pris_standard'),
    vilkar_tekst: formData.get('vilkar_tekst'),
  })
  if (!felter.success) return { feil: felter.error.issues[0].message }

  if (felter.data.varsel_epost && !z.email().safeParse(felter.data.varsel_epost).success) {
    return { feil: 'Varslingsadressen er ikke en gyldig e-postadresse' }
  }

  const supabase = await lagServerKlient()
  const { error } = await supabase
    .from('innstillinger')
    .update({
      firmanavn: felter.data.firmanavn,
      varsel_epost: felter.data.varsel_epost || null,
      vis_pris_standard: felter.data.vis_pris_standard,
      vilkar_tekst: felter.data.vilkar_tekst,
      oppdatert: new Date().toISOString(),
    })
    .eq('id', true)

  if (error) return { feil: `Kunne ikke lagre: ${error.message}` }

  revalidatePath('/admin/innstillinger')
  return { ok: 'Innstillingene er lagret.' }
}

/**
 * Lager nytt iCal-token. Den gamle abonnementslenka slutter da å virke –
 * som er hele poenget dersom den har kommet på avveie.
 */
export async function nyttIcalToken() {
  await krevAdmin()

  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

  const supabase = await lagServerKlient()
  await supabase.from('innstillinger').update({ ical_token: token }).eq('id', true)

  revalidatePath('/admin/innstillinger')
  revalidatePath('/admin/kalender')
}

/* ═══ Kategorier ═══════════════════════════════════════════ */

const navnSkjema = z.string().trim().min(2, 'Navnet må være minst to tegn').max(60)

export async function opprettKategori(
  _forrige: Tilstand,
  formData: FormData,
): Promise<Tilstand> {
  await krevAdmin()

  const navn = navnSkjema.safeParse(formData.get('navn'))
  if (!navn.success) return { feil: navn.error.issues[0].message }

  const supabase = await lagServerKlient()
  const { error } = await supabase.from('kategorier').insert({ navn: navn.data })

  if (error) {
    return {
      feil:
        error.code === '23505'
          ? 'Denne kategorien finnes allerede.'
          : `Kunne ikke lagre: ${error.message}`,
    }
  }

  revalidatePath('/admin/innstillinger')
  revalidatePath('/admin/maskiner')
  return { ok: `«${navn.data}» er lagt til.` }
}

/**
 * Endrer navn på en kategori og flytter maskinene som brukte det gamle
 * navnet over. Uten den flyttingen ville maskinene blitt stående med en
 * kategori som ikke lenger finnes i lista.
 */
export async function endreKategori(id: string, formData: FormData) {
  await krevAdmin()

  const navn = navnSkjema.safeParse(formData.get('navn'))
  if (!navn.success) return

  const supabase = await lagServerKlient()

  const { data: gammel } = await supabase
    .from('kategorier')
    .select('navn')
    .eq('id', id)
    .maybeSingle()

  if (!gammel || gammel.navn === navn.data) return

  const { error } = await supabase
    .from('kategorier')
    .update({ navn: navn.data })
    .eq('id', id)

  if (error) return

  await supabase
    .from('maskiner')
    .update({ kategori: navn.data })
    .eq('kategori', gammel.navn)

  revalidatePath('/admin/innstillinger')
  revalidatePath('/admin/maskiner')
}

/**
 * Sletter en kategori fra plukklista. Maskinene som bruker den beholder
 * teksten sin – de blir ikke stående uten kategori fordi noen ryddet i
 * lista.
 */
export async function slettKategori(id: string) {
  await krevAdmin()
  const supabase = await lagServerKlient()
  await supabase.from('kategorier').delete().eq('id', id)
  revalidatePath('/admin/innstillinger')
  revalidatePath('/admin/maskiner')
}
