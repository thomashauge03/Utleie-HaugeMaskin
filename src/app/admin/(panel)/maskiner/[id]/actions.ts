'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { slettLeierMedFiler } from '@/lib/slett'

export type MaskinTilstand = { feil?: string; ok?: string }

const skjema = z.object({
  id: z.uuid(),
  navn: z.string().trim().min(1, 'Navn må fylles ut'),
  kategori: z.string().trim().optional(),
  underkategori: z.string().trim().optional(),
  internnummer: z.string().trim().optional(),
  dogn_pris: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number(v.replace(',', '.'))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), {
      message: 'Prisen må være et positivt tall',
    }),
  pris_enhet: z.enum(['dogn', 'time']).default('dogn'),
  /*
   * En avhuket boks sendes ikke med i FormData i det hele tatt. Med
   * Object.fromEntries blir feltet da undefined, ikke null – og uten
   * undefined her feilet all lagring der «Vis prisen» var slått av.
   */
  vis_pris: z
    .union([z.literal('on'), z.null()])
    .optional()
    .transform((v) => v === 'on'),
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
  if (!felter.success) {
    // Ta med feltnavnet. Zods standardmelding er «Invalid input», som
    // ikke sier noe om hvor i skjemaet det gikk galt.
    const sak = felter.error.issues[0]
    const felt = sak.path.join('.')
    return { feil: felt ? `${felt}: ${sak.message}` : sak.message }
  }

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
      underkategori: felter.data.underkategori || null,
      internnummer: felter.data.internnummer || null,
      dogn_pris: felter.data.dogn_pris,
      pris_enhet: felter.data.pris_enhet,
      vis_pris: felter.data.vis_pris,
      status: felter.data.status,
      notat: felter.data.notat || null,
    })
    .eq('id', felter.data.id)

  if (error) return { feil: `Kunne ikke lagre: ${error.message}` }

  revalidatePath('/admin/maskiner')
  revalidatePath(`/admin/maskiner/${felter.data.id}`)

  // Tilbake til lista. redirect() kaster en kontrollflyt-exception, så
  // ingenting under kjører – returtypen er kun for feiltilfellene over.
  redirect('/admin/maskiner')
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
  const admin = await krevAdmin()
  const supabase = await lagServerKlient()

  // Fremmednøkkelen fra leier hindrer sletting så lenge det finnes
  // historikk, så leiene må ryddes først. Bilder, hendelser og
  // e-postlogg følger med via cascade; filene tas av hjelperen.
  const { data: leier } = await supabase
    .from('leier')
    .select('id')
    .eq('maskin_id', maskinId)

  const leieIder = (leier ?? []).map((l) => l.id as string)
  const antall = await slettLeierMedFiler(leieIder)

  const { data: maskin } = await supabase
    .from('maskiner')
    .select('navn, qr_kode')
    .eq('id', maskinId)
    .maybeSingle()

  await supabase.from('maskiner').delete().eq('id', maskinId)

  await supabase.from('hendelser').insert({
    leie_id: null,
    type: 'maskin_slettet',
    beskrivelse: maskin
      ? `Maskin ${maskin.navn} (${maskin.qr_kode}) slettet permanent${antall ? `, med ${antall} leier` : ''}`
      : 'Maskin slettet permanent',
    aktor: `admin:${admin.epost}`,
  })

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
