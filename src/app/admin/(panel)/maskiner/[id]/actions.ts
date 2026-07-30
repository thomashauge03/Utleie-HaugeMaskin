'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'

export type MaskinTilstand = { feil?: string; ok?: string }

const skjema = z.object({
  id: z.uuid(),
  navn: z.string().trim().min(1, 'Navn må fylles ut'),
  kategori: z.string().trim().optional(),
  internnummer: z.string().trim().optional(),
  dogn_pris: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number(v.replace(',', '.'))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), {
      message: 'Døgnpris må være et positivt tall',
    }),
  vis_pris: z.union([z.literal('on'), z.null()]).transform((v) => v === 'on'),
  status: z.enum(['ledig', 'utleid', 'service', 'utrangert']),
  notat: z.string().trim().optional(),
})

/** Er maskinen ute hos en kunde akkurat nå? */
async function harAktivLeie(
  supabase: Awaited<ReturnType<typeof lagServerKlient>>,
  maskinId: string,
) {
  const { data } = await supabase
    .from('leier')
    .select('id')
    .eq('maskin_id', maskinId)
    .in('status', ['aktiv', 'venter_godkjenning'])
    .maybeSingle()
  return Boolean(data)
}

export async function lagreMaskin(
  _forrige: MaskinTilstand,
  formData: FormData,
): Promise<MaskinTilstand> {
  await krevAdmin()

  const felter = skjema.safeParse(Object.fromEntries(formData))
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const supabase = await lagServerKlient()
  const utleid = await harAktivLeie(supabase, felter.data.id)

  /*
   * Statusen til en utleid maskin styres av leien, ikke av dette
   * skjemaet. Kunne admin sette den til «ledig» mens maskinen står hos
   * en kunde, ville neste person kunne leie den samme maskinen.
   */
  if (utleid && felter.data.status !== 'utleid') {
    return {
      feil: 'Maskinen er ute på leie nå. Statusen kan ikke endres før innleveringen er godkjent.',
    }
  }

  const { error } = await supabase
    .from('maskiner')
    .update({
      navn: felter.data.navn,
      kategori: felter.data.kategori || null,
      internnummer: felter.data.internnummer || null,
      dogn_pris: felter.data.dogn_pris,
      vis_pris: felter.data.vis_pris,
      status: felter.data.status,
      notat: felter.data.notat || null,
    })
    .eq('id', felter.data.id)

  if (error) return { feil: `Kunne ikke lagre: ${error.message}` }

  revalidatePath('/admin/maskiner')
  revalidatePath(`/admin/maskiner/${felter.data.id}`)
  return { ok: 'Endringene er lagret.' }
}

/**
 * Tar maskinen ut av bruk. Den slettes ikke – historikken på tidligere
 * leier skal fortsatt kunne vise hvilken maskin det gjaldt, og QR-koden
 * skal svare med en forklaring i stedet for å bli en død lenke.
 */
export async function deaktiverMaskin(maskinId: string) {
  await krevAdmin()
  const supabase = await lagServerKlient()

  if (await harAktivLeie(supabase, maskinId)) return

  await supabase.from('maskiner').update({ aktiv: false }).eq('id', maskinId)
  revalidatePath('/admin/maskiner')
  redirect('/admin/maskiner')
}

/**
 * Sletter maskinen for godt.
 *
 * Kun mulig når maskinen aldri har vært utleid. Har den historikk, ville
 * sletting gjort fakturagrunnlaget på gamle leier verdiløst – databasen
 * nekter det uansett via fremmednøkkelen, men vi sjekker her for å kunne
 * gi en forklaring i stedet for en teknisk feilmelding.
 */
export async function slettMaskin(maskinId: string) {
  await krevAdmin()
  const supabase = await lagServerKlient()

  const { count } = await supabase
    .from('leier')
    .select('id', { count: 'exact', head: true })
    .eq('maskin_id', maskinId)

  if ((count ?? 0) > 0) return

  await supabase.from('maskiner').delete().eq('id', maskinId)
  revalidatePath('/admin/maskiner')
  redirect('/admin/maskiner')
}

export async function aktiverMaskin(maskinId: string) {
  await krevAdmin()
  const supabase = await lagServerKlient()
  await supabase
    .from('maskiner')
    .update({ aktiv: true, status: 'ledig' })
    .eq('id', maskinId)
  revalidatePath('/admin/maskiner')
  revalidatePath(`/admin/maskiner/${maskinId}`)
}
