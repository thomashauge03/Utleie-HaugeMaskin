import { createEvents, type EventAttributes } from 'ics'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { visTelefon } from '@/lib/telefon'
import type { Kunde, Leie, Maskin } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Rad = Leie & { maskiner: Maskin | null; kunder: Kunde | null }

/**
 * Sammenligner to hemmeligheter i konstant tid, så svartiden ikke
 * lekker hvor mange tegn som stemte. Praktisk talt ikke utnyttbart ved
 * 192-bit token, men det koster ingenting å gjøre riktig.
 */
function likeHemmelige(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let ulik = 0
  for (let i = 0; i < a.length; i++) ulik |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return ulik === 0
}

/**
 * ics-pakka vil ha [år, måned (1-indeksert), dag, time, minutt].
 *
 * Vi bygger UTC-tall og merker hendelsen med `startInputType: 'utc'`.
 * Uten det tolker kalenderklienten tallene som «flytende» lokaltid, og
 * hendelsen havner på feil klokkeslett hos abonnenten. Med UTC-merking
 * konverterer klienten selv til leserens tidssone.
 */
function tilDatoArray(iso: string): [number, number, number, number, number] {
  const d = new Date(iso)
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
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

  // Feil token skal ikke avsløre om feeden finnes. Konstant-tid
  // sammenligning så svartiden ikke lekker hvor mange tegn som stemte.
  if (!innstillinger?.ical_token || !likeHemmelige(token, innstillinger.ical_token)) {
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
      startInputType: 'utc',
      end: tilDatoArray(slutt),
      endInputType: 'utc',
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
