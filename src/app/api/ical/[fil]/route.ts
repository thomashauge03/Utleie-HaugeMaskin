import { createEvents, type EventAttributes } from 'ics'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { visTelefon } from '@/lib/telefon'
import type { Kunde, Leie, Maskin } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Rad = Leie & { maskiner: Maskin | null; kunder: Kunde | null }

/** ics-pakka vil ha [år, måned (1-indeksert), dag, time, minutt]. */
function tilDatoArray(iso: string): [number, number, number, number, number] {
  const d = new Date(iso)
  return [
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  ]
}

/**
 * Kalenderfeed for abonnement i Google Kalender, Outlook eller Apple.
 *
 * Autentiseres med et hemmelig token i URL-en – kalenderklienter kan
 * ikke logge inn. Tokenet ligger i innstillinger-tabellen og kan byttes
 * der hvis lenken kommer på avveie.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/ical/[fil]'>) {
  const { fil } = await ctx.params
  const token = fil.replace(/\.ics$/i, '')

  const { data: innstillinger } = await supabaseAdmin
    .from('innstillinger')
    .select('ical_token')
    .maybeSingle()

  // Feil token skal ikke avsløre om feeden finnes.
  if (!innstillinger?.ical_token || token !== innstillinger.ical_token) {
    return new Response(null, { status: 404 })
  }

  const { data } = await supabaseAdmin
    .from('leier')
    .select('*, maskiner(*), kunder(*)')
    .in('status', ['aktiv', 'venter_godkjenning', 'avsluttet'])
    .order('start_tid', { ascending: false })
    .limit(500)

  const leier = (data ?? []) as Rad[]

  const hendelser: EventAttributes[] = leier.map((l) => {
    const slutt = l.slutt_tid ?? l.planlagt_slutt
    const forfalt =
      l.status === 'aktiv' && new Date(l.planlagt_slutt).getTime() < Date.now()

    const beskrivelse = [
      l.kunder ? `Kunde: ${l.kunder.navn}` : null,
      l.kunder ? `Mobil: ${visTelefon(l.kunder.telefon)}` : null,
      l.kunder ? `E-post: ${l.kunder.epost}` : null,
      `Referanse: ${l.referanse}`,
      l.status === 'venter_godkjenning' ? 'Venter på godkjenning' : null,
      forfalt ? 'FORFALT – ikke levert til avtalt tid' : null,
      l.kommentar_start ? `Kommentar: ${l.kommentar_start}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    return {
      uid: `${l.id}@utleie`,
      title: `${forfalt ? '⚠ ' : ''}${l.maskiner?.navn ?? 'Maskin'} – ${l.kunder?.navn ?? 'ukjent'}`,
      start: tilDatoArray(l.start_tid),
      end: tilDatoArray(slutt),
      description: beskrivelse,
      location: l.kunder?.adresse ?? undefined,
      status: l.status === 'avsluttet' ? 'CONFIRMED' : 'TENTATIVE',
      productId: 'utleie',
    } as EventAttributes
  })

  const { error, value } = createEvents(hendelser)

  if (error || !value) {
    return new Response('Kunne ikke bygge kalenderen', { status: 500 })
  }

  return new Response(value, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="utleie.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
