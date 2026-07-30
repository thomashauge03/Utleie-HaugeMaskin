import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Maskin } from '@/lib/types'
import 'server-only'

export type Del = { id: string; navn: string; rekkefolge: number }

export type VerkstedMaskin = Maskin & {
  kjeft_dimensjon: string | null
  underkategori: string | null
  verksted_status: string | null
  deler: Record<string, string>
  delMal: Record<string, string>
}

export const UTEN_TYPE = 'Uten type'

/** Grupperer på underkategori, med de utypede sist. */
export function grupperPaaType(
  maskiner: VerkstedMaskin[],
): [string, VerkstedMaskin[]][] {
  const grupper = new Map<string, VerkstedMaskin[]>()
  for (const m of maskiner) {
    const n = m.underkategori?.trim() || UTEN_TYPE
    if (!grupper.has(n)) grupper.set(n, [])
    grupper.get(n)!.push(m)
  }
  return [...grupper.entries()].sort((a, b) => {
    if (a[0] === UTEN_TYPE) return 1
    if (b[0] === UTEN_TYPE) return -1
    return a[0].localeCompare(b[0], 'nb')
  })
}

/**
 * Henter verkstedkategorien og maskinene i den.
 *
 * Bruker service role, fordi lista skal kunne leses uten innlogging –
 * skuffene er interne, og QR-en henger på veggen i verkstedet.
 */
export async function hentVerksted(): Promise<{
  kategorier: string[]
  deler: Del[]
  maskiner: VerkstedMaskin[]
}> {
  const { data: valgte } = await supabaseAdmin
    .from('kategorier')
    .select('navn')
    .eq('er_verksted', true)
    .order('rekkefolge')
    .order('navn')

  const kategorier = (valgte ?? []).map((k) => k.navn as string)
  if (kategorier.length === 0) return { kategorier: [], deler: [], maskiner: [] }

  const [{ data: delRader }, { data: maskinRader }] = await Promise.all([
    supabaseAdmin.from('verksted_deler').select('*').order('rekkefolge').order('navn'),
    supabaseAdmin
      .from('maskiner')
      .select('*')
      .in('kategori', kategorier)
      .eq('aktiv', true)
      .order('underkategori', { nullsFirst: false })
      .order('internnummer')
      .order('navn'),
  ])

  const deler = (delRader ?? []) as Del[]
  const maskiner = (maskinRader ?? []) as Maskin[]

  // Én spørring for alle delstatusene framfor én per maskin.
  const { data: statuser } = await supabaseAdmin
    .from('maskin_delstatus')
    .select('maskin_id, del_id, status, mal')
    .in(
      'maskin_id',
      maskiner.map((m) => m.id),
    )

  const perMaskin = new Map<string, Record<string, string>>()
  const malPerMaskin = new Map<string, Record<string, string>>()
  for (const s of statuser ?? []) {
    const eksisterende = perMaskin.get(s.maskin_id) ?? {}
    eksisterende[s.del_id] = s.status
    perMaskin.set(s.maskin_id, eksisterende)

    if (s.mal) {
      const mal = malPerMaskin.get(s.maskin_id) ?? {}
      mal[s.del_id] = s.mal
      malPerMaskin.set(s.maskin_id, mal)
    }
  }

  return {
    kategorier,
    deler,
    maskiner: maskiner.map((m) => ({
      ...(m as VerkstedMaskin),
      // Deler uten rad regnes som OK – ingen har meldt noe galt.
      deler: perMaskin.get(m.id) ?? {},
      delMal: malPerMaskin.get(m.id) ?? {},
    })),
  }
}

export async function hentVerkstedMaskin(maskinId: string) {
  const { data } = await supabaseAdmin
    .from('maskiner')
    .select('*')
    .eq('id', maskinId)
    .maybeSingle()

  if (!data) return null

  const [{ data: delRader }, { data: statuser }, { data: logg }] = await Promise.all([
    supabaseAdmin.from('verksted_deler').select('*').order('rekkefolge').order('navn'),
    supabaseAdmin
      .from('maskin_delstatus')
      .select('del_id, status, mal')
      .eq('maskin_id', maskinId),
    supabaseAdmin
      .from('verksted_logg')
      .select('*')
      .eq('maskin_id', maskinId)
      .order('tid', { ascending: false })
      .limit(30),
  ])

  const deler = (delRader ?? []) as Del[]
  const status: Record<string, string> = {}
  const mal: Record<string, string> = {}
  for (const s of statuser ?? []) {
    status[s.del_id] = s.status
    if (s.mal) mal[s.del_id] = s.mal
  }

  return {
    maskin: data as VerkstedMaskin,
    deler,
    delStatus: status,
    delMal: mal,
    logg: (logg ?? []) as {
      id: string
      del_navn: string | null
      beskrivelse: string
      aktor: string
      tid: string
    }[],
  }
}
