import { hentAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import type { Maskin } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Pakker inn felt som inneholder skilletegn, hermetegn eller linjeskift. */
function csvFelt(verdi: string | null): string {
  let s = verdi ?? ''
  // Nøytraliser formel-injeksjon: Excel og Sheets tolker en celle som
  // starter med = + - @ (eller tab/CR) som en formel. Alle felt her er
  // admin-styrte, men en apostrof foran koster ingenting og lukker det.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export async function GET() {
  // Route handlers er offentlige endepunkter og må sikres som sådan.
  if (!(await hentAdmin())) {
    return new Response(null, { status: 401 })
  }

  const supabase = await lagServerKlient()
  const { data } = await supabase
    .from('maskiner')
    .select('*')
    .eq('aktiv', true)
    .order('navn')

  const maskiner = (data ?? []) as Maskin[]

  const rader = [
    ['internnummer', 'kode', 'navn', 'url'].join(';'),
    ...maskiner.map((m) =>
      [
        csvFelt(m.internnummer),
        csvFelt(m.qr_kode),
        csvFelt(m.navn),
        csvFelt(`${env.NEXT_PUBLIC_SITE_URL}/m/${m.qr_kode}`),
      ].join(';'),
    ),
  ].join('\r\n')

  // Semikolon og BOM fordi norsk Excel ellers dytter hele raden inn i
  // én kolonne og gjør æøå om til rusk.
  return new Response('﻿' + rader, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="maskiner-qr.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
