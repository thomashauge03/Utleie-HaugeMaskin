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

/* ═══ Verksted ═════════════════════════════════════════════ */

/**
 * Velger hvilken kategori som bruker verkstedflyten i stedet for
 * utleie. Tom verdi slår modulen av.
 */
export async function lagreVerkstedKategori(
  _forrige: Tilstand,
  formData: FormData,
): Promise<Tilstand> {
  await krevAdmin()

  // Avhukede bokser sendes ikke med i FormData, så vi nullstiller alle
  // først og setter dem som faktisk står i innsendingen. Ellers ville
  // en kategori aldri kunne tas ut av verkstedet igjen.
  const valgte = formData.getAll('verksted').map((v) => String(v))

  const supabase = await lagServerKlient()

  const { error: nullstill } = await supabase
    .from('kategorier')
    .update({ er_verksted: false })
    .eq('er_verksted', true)

  if (nullstill) return { feil: `Kunne ikke lagre: ${nullstill.message}` }

  if (valgte.length > 0) {
    const { error } = await supabase
      .from('kategorier')
      .update({ er_verksted: true })
      .in('navn', valgte)

    if (error) return { feil: `Kunne ikke lagre: ${error.message}` }
  }

  revalidatePath('/admin/innstillinger')
  revalidatePath('/verksted')
  return {
    ok:
      valgte.length > 0
        ? `${valgte.join(', ')} bruker nå verkstedflyten.`
        : 'Verkstedmodulen er slått av.',
  }
}

/* ═══ Varsling ═════════════════════════════════════════════ */

const av = z.union([z.literal('on'), z.null()]).transform((v) => v === 'on')

const varselSkjema = z.object({
  varsel_epost: z.string().trim(),
  varsel_kopi: z.string().trim(),
  avsender_navn: z.string().trim().max(60),
  varsle_ny_leie: av,
  varsle_retur: av,
  varsle_forfalt: av,
  kvittering_start: av,
  kvittering_retur: av,
  purring_forfalt: av,
})

/** Godtar «a@b.no, c@d.no» og validerer hver enkelt. */
function sjekkAdresser(rå: string): { ok: true; verdi: string | null } | { ok: false; feil: string } {
  const liste = rå.split(/[,;\s]+/).map((a) => a.trim()).filter(Boolean)
  const ugyldig = liste.find((a) => !z.email().safeParse(a).success)
  if (ugyldig) return { ok: false, feil: `«${ugyldig}» er ikke en gyldig e-postadresse` }
  return { ok: true, verdi: liste.length ? liste.join(', ') : null }
}

export async function lagreVarsling(
  _forrige: Tilstand,
  formData: FormData,
): Promise<Tilstand> {
  await krevAdmin()

  const felter = varselSkjema.safeParse({
    varsel_epost: formData.get('varsel_epost') ?? '',
    varsel_kopi: formData.get('varsel_kopi') ?? '',
    avsender_navn: formData.get('avsender_navn') ?? '',
    varsle_ny_leie: formData.get('varsle_ny_leie'),
    varsle_retur: formData.get('varsle_retur'),
    varsle_forfalt: formData.get('varsle_forfalt'),
    kvittering_start: formData.get('kvittering_start'),
    kvittering_retur: formData.get('kvittering_retur'),
    purring_forfalt: formData.get('purring_forfalt'),
  })
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const til = sjekkAdresser(felter.data.varsel_epost)
  if (!til.ok) return { feil: til.feil }
  const kopi = sjekkAdresser(felter.data.varsel_kopi)
  if (!kopi.ok) return { feil: kopi.feil }

  const varslerAdmin =
    felter.data.varsle_ny_leie || felter.data.varsle_retur || felter.data.varsle_forfalt
  if (varslerAdmin && !til.verdi) {
    return { feil: 'Du må oppgi minst én mottaker for å slå på varsler til admin.' }
  }

  const supabase = await lagServerKlient()
  const { error } = await supabase
    .from('innstillinger')
    .update({
      varsel_epost: til.verdi,
      varsel_kopi: kopi.verdi,
      avsender_navn: felter.data.avsender_navn || 'HM Utleie',
      varsle_ny_leie: felter.data.varsle_ny_leie,
      varsle_retur: felter.data.varsle_retur,
      varsle_forfalt: felter.data.varsle_forfalt,
      kvittering_start: felter.data.kvittering_start,
      kvittering_retur: felter.data.kvittering_retur,
      purring_forfalt: felter.data.purring_forfalt,
      oppdatert: new Date().toISOString(),
    })
    .eq('id', true)

  if (error) return { feil: `Kunne ikke lagre: ${error.message}` }

  revalidatePath('/admin/innstillinger')
  return { ok: 'Varslingsinnstillingene er lagret.' }
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
