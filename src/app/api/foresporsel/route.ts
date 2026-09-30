import { NextResponse, after, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { innenforGrense } from '@/lib/rategrense'
import { normaliserTelefon } from '@/lib/telefon'
import { osloDag } from '@/lib/dato'
import { opptattePerioder, overlapper, validerForesporsel } from '@/lib/foresporsel'
import { varsleNyForesporsel } from '@/lib/epost/varsler'

export const dynamic = 'force-dynamic'

/** Hovedsida, med og uten www, og Vercel-adressen til domenet er koblet på. */
const TILLATT = [
  'https://haugemaskin.no',
  'https://www.haugemaskin.no',
  'https://haugemaskin.vercel.app',
]
/** «Tabellen eller kolonnen finnes ikke» – migrasjon 0012/0013 ikke kjørt. */
const IKKE_SLÅTT_PÅ = ['PGRST205', 'PGRST204', '42P01', '42703']
const MAKS_ÅPNE = 3

/**
 * Nettleseren på haugemaskin.no poster hit fra et annet domene. Bare
 * hovedsida får svar den kan lese; lokalt også localhost, så utvikling av
 * hovedsida kan peke hit i stedet for mot produksjon.
 */
function cors(origin: string | null): Record<string, string> {
  const tillatt =
    origin &&
    (TILLATT.includes(origin) ||
      (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)))
  return tillatt
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      }
    : { Vary: 'Origin' }
}

function svar(origin: string | null, kropp: object, status: number) {
  return NextResponse.json(kropp, { status, headers: cors(origin) })
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(request.headers.get('origin')) })
}

/**
 * Leieforespørsel fra maskinsida på haugemaskin.no.
 *
 * Uautentisert, som kundeflyten: tak per IP, full validering, og sjekk mot
 * databasen av at dagene fortsatt er ledige. Lagres som «forespurt», som
 * ikke sperrer noe før admin godkjenner i kalenderen. Se
 * docs/superpowers/specs/2026-09-30-leieforesporsel-design.md.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')

  if (!(await innenforGrense('foresporsel', 5, 60 * 60 * 1000))) {
    return svar(origin, { feil: 'For mange forsøk. Vent litt og prøv igjen.' }, 429)
  }

  let kropp: unknown
  try {
    kropp = await request.json()
  } catch {
    return svar(origin, { feil: 'Ugyldig forespørsel' }, 400)
  }

  const iDag = osloDag(new Date())
  const utfall = validerForesporsel(kropp, iDag, Date.now())
  if (!utfall.ok) return svar(origin, { feil: utfall.feil }, utfall.status)
  const f = utfall.data

  const telefon = normaliserTelefon(f.telefon)
  if (!telefon) return svar(origin, { feil: 'Mobilnummeret må være åtte siffer' }, 400)

  const { data: maskin } = await supabaseAdmin
    .from('maskiner')
    .select('id')
    .eq('id', f.maskin_id)
    .eq('aktiv', true)
    .neq('status', 'utrangert')
    .maybeSingle()
  if (!maskin) return svar(origin, { feil: 'Fant ikke maskinen' }, 404)

  const [res, leier, åpne] = await Promise.all([
    supabaseAdmin
      .from('reservasjoner')
      .select('fra_dato, til_dato, status')
      .eq('maskin_id', maskin.id)
      .eq('status', 'aktiv')
      .gte('til_dato', iDag),
    supabaseAdmin
      .from('leier')
      .select('start_tid, planlagt_slutt')
      .eq('maskin_id', maskin.id)
      .in('status', ['aktiv', 'venter_godkjenning']),
    supabaseAdmin
      .from('reservasjoner')
      .select('id', { count: 'exact', head: true })
      .eq('kunde_telefon', telefon)
      .eq('status', 'forespurt')
      .gte('til_dato', iDag),
  ])
  if (res.error && IKKE_SLÅTT_PÅ.includes(res.error.code)) {
    return svar(origin, { feil: 'Forespørsler er ikke slått på ennå. Ring oss.' }, 503)
  }
  if (res.error || leier.error || åpne.error) {
    return svar(origin, { feil: 'Kunne ikke sende forespørselen. Prøv igjen.' }, 500)
  }

  const opptatt = opptattePerioder(
    res.data ?? [],
    (leier.data ?? []).map((l) => ({
      startDag: osloDag(l.start_tid),
      sluttDag: l.planlagt_slutt ? osloDag(l.planlagt_slutt) : null,
    })),
    iDag,
  )
  if (overlapper(f.fra, f.til, opptatt)) {
    return svar(origin, { feil: 'Noen av dagene er ikke ledige lenger. Velg andre datoer.' }, 409)
  }
  if ((åpne.count ?? 0) >= MAKS_ÅPNE) {
    return svar(
      origin,
      { feil: 'Du har allerede tre forespørsler vi ikke har svart på. Ring oss, så ordner vi det.' },
      429,
    )
  }

  const { data: ny, error } = await supabaseAdmin
    .from('reservasjoner')
    .insert({
      maskin_id: maskin.id,
      fra_dato: f.fra,
      til_dato: f.til,
      kunde_navn: f.navn,
      kunde_telefon: telefon,
      kunde_epost: f.epost,
      notat: f.melding,
      status: 'forespurt',
    })
    .select('id')
    .single()

  if (error || !ny) {
    if (error && IKKE_SLÅTT_PÅ.includes(error.code)) {
      return svar(origin, { feil: 'Forespørsler er ikke slått på ennå. Ring oss.' }, 503)
    }
    return svar(origin, { feil: 'Kunne ikke sende forespørselen. Prøv igjen.' }, 500)
  }

  // Etter svaret, som de andre varslene: kunden skal ikke vente på e-posten.
  after(() => varsleNyForesporsel(ny.id))

  return svar(origin, { ok: true, telefon }, 200)
}
