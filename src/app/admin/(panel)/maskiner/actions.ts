'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'

const maskinSkjema = z.object({
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
  vis_pris: z.union([z.literal('on'), z.null()]).transform((v) => v === 'on'),
  notat: z.string().trim().optional(),
})

export type MaskinTilstand = { feil?: string; ok?: string }

function les(formData: FormData) {
  return maskinSkjema.safeParse({
    navn: formData.get('navn'),
    kategori: formData.get('kategori'),
    underkategori: formData.get('underkategori'),
    internnummer: formData.get('internnummer'),
    dogn_pris: formData.get('dogn_pris'),
    pris_enhet: formData.get('pris_enhet') ?? 'dogn',
    vis_pris: formData.get('vis_pris'),
    notat: formData.get('notat'),
  })
}

export async function opprettMaskin(
  _forrige: MaskinTilstand,
  formData: FormData,
): Promise<MaskinTilstand> {
  // Server actions er POST-ruter som kan treffes direkte. Tilgangen må
  // sjekkes her, ikke bare i layouten.
  await krevAdmin()

  const felter = les(formData)
  if (!felter.success) return { feil: felter.error.issues[0].message }

  const supabase = await lagServerKlient()
  const { error } = await supabase.from('maskiner').insert({
    navn: felter.data.navn,
    kategori: felter.data.kategori || null,
    underkategori: felter.data.underkategori || null,
    internnummer: felter.data.internnummer || null,
    dogn_pris: felter.data.dogn_pris,
    pris_enhet: felter.data.pris_enhet,
    vis_pris: felter.data.vis_pris,
    notat: felter.data.notat || null,
  })

  if (error) return { feil: `Kunne ikke lagre maskinen: ${error.message}` }

  revalidatePath('/admin/maskiner')
  return { ok: `${felter.data.navn} er lagt til.` }
}

const statusSkjema = z.enum(['ledig', 'utleid', 'service', 'utrangert'])

export async function settMaskinStatus(id: string, status: string) {
  await krevAdmin()

  const gyldig = statusSkjema.safeParse(status)
  if (!gyldig.success) return

  const supabase = await lagServerKlient()

  // En utleid maskin kan ikke settes til service eller ledig manuelt –
  // det ville løsrevet maskinstatus fra den aktive leien.
  const { data: aktivLeie } = await supabase
    .from('leier')
    .select('id')
    .eq('maskin_id', id)
    .in('status', ['aktiv', 'venter_godkjenning'])
    .maybeSingle()

  if (aktivLeie) return

  await supabase.from('maskiner').update({ status: gyldig.data }).eq('id', id)
  revalidatePath('/admin/maskiner')
}
