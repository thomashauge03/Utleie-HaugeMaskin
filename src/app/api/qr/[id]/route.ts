import { kodeId } from '@/lib/skannet-kode'

/*
 * Slår opp hvor en etikett fra QR-admin peker, for skanneren i appen.
 * Det samme som QR-admins egen videresendingsside gjør (qr-admin,
 * components/Videresend.tsx), bare uten å sende telefonen dit.
 *
 * Katalogen i QR-admin er åpen for lesing, så den offentlige nøkkelen
 * holder. Den står i en miljøvariabel og ikke her, fordi repoet er åpent.
 * Mangler den, svarer ruta 503 og skanneren sier fra.
 */
const QR_ADMIN_SUPABASE = 'https://thypecauthhleewecgfu.supabase.co'

// Etiketter byttes sjelden. Et minutt gamle svar er godt nok, og
// skanneren slår opp samme kode mange ganger mens den står i bildet.
const HOLD_S = 60

export async function GET(_: Request, ctx: RouteContext<'/api/qr/[id]'>) {
  const id = kodeId((await ctx.params).id)
  if (!id) return Response.json({ feil: 'Ugyldig kode' }, { status: 400 })

  const nøkkel = process.env.QR_ADMIN_ANON_KEY
  if (!nøkkel) return Response.json({ feil: 'QR_ADMIN_ANON_KEY mangler' }, { status: 503 })

  const headers: Record<string, string> = { apikey: nøkkel }
  // Den gamle anon-nøkkelen er en JWT og skal også stå som Bearer.
  if (nøkkel.startsWith('eyJ')) headers.Authorization = `Bearer ${nøkkel}`

  const r = await fetch(
    `${QR_ADMIN_SUPABASE}/rest/v1/categories?id=eq.${id}&select=qr_type,qr_data`,
    { headers, next: { revalidate: HOLD_S } },
  )
  if (!r.ok) return Response.json({ feil: `QR-admin svarte ${r.status}` }, { status: 502 })

  const [rad] = (await r.json()) as { qr_type: string; qr_data: { url?: string } | null }[]
  const url = rad?.qr_type === 'url' ? (rad.qr_data?.url?.trim() ?? null) : null
  return Response.json({ url }, { headers: { 'Cache-Control': `private, max-age=${HOLD_S}` } })
}
