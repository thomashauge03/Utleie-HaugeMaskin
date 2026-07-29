import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { innenforGrense } from '@/lib/rategrense'

export const dynamic = 'force-dynamic'

const skjema = z.object({
  type: z.enum(['henting', 'levering']),
})

/**
 * Utsteder en signert opplastingslenke til Storage.
 *
 * Bildet lastes opp direkte fra nettleseren fordi server actions i
 * Next.js 16 har 1 MB grense på forespørselskroppen, og et mobilbilde
 * er gjerne 3–5 MB. Se docs/TEKNISK-PLAN.md pkt. 9.
 *
 * Lenken gjelder kun én bestemt filsti, og stien bestemmes her – ikke
 * av klienten. Ellers kunne hvem som helst overskrevet andres bilder.
 */
export async function POST(request: NextRequest) {
  // Uautentisert endepunkt. Uten tak kunne noen bedt om tusenvis av
  // opplastingslenker og fylt lageret. 40 i timen holder til en kunde
  // som tar noen forsøk på hvert bilde.
  if (!(await innenforGrense('bilde', 40, 60 * 60 * 1000))) {
    return NextResponse.json(
      { feil: 'For mange forsøk. Vent litt og prøv igjen.' },
      { status: 429 },
    )
  }

  let kropp: unknown
  try {
    kropp = await request.json()
  } catch {
    return NextResponse.json({ feil: 'Ugyldig forespørsel' }, { status: 400 })
  }

  const felter = skjema.safeParse(kropp)
  if (!felter.success) {
    return NextResponse.json({ feil: 'Ugyldig bildetype' }, { status: 400 })
  }

  const nå = new Date()
  const mappe = `${nå.getUTCFullYear()}-${String(nå.getUTCMonth() + 1).padStart(2, '0')}`
  const sti = `${mappe}/${felter.data.type}-${crypto.randomUUID()}.jpg`

  const { data, error } = await supabaseAdmin.storage
    .from('bilder')
    .createSignedUploadUrl(sti)

  if (error || !data) {
    return NextResponse.json(
      { feil: 'Kunne ikke klargjøre opplasting' },
      { status: 500 },
    )
  }

  return NextResponse.json({ sti: data.path, token: data.token })
}
