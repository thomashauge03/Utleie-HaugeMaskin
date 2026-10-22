/**
 * Hva en skannet QR-kode peker på.
 *
 * Kodene er lenker: maskinene har /m/<qr>, skuffer og annet uten egen kode
 * har /kategori/<navn>, og returkoden på anlegget har /retur. Bare stien
 * leses, ikke verten – koder printet med en eldre adresse skal virke.
 *
 * Teksten kommer fra hva som helst kameraet ser. Den brukes bare til
 * oppslag, aldri til å navigere.
 */
export type SkannetKode =
  | { type: 'maskin'; qr: string }
  | { type: 'kategori'; navn: string }
  | { type: 'retur' }
  | { type: 'ukjent' }

const UKJENT: SkannetKode = { type: 'ukjent' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Id-en i små bokstaver, eller null om den ikke er en rad-id fra QR-admin. */
export function kodeId(id: string): string | null {
  const t = id.trim()
  return UUID.test(t) ? t.toLowerCase() : null
}

/**
 * Etikettene fra QR-admin har ikke lenka selv, men en videresending:
 * https://qr-admin-fawn.vercel.app/q?k=<id>. Telefonens kamera åpner den,
 * og QR-admin sender videre. Skanneren må slå opp id-en selv (se
 * /api/qr/[id]) og tolke lenka den finner.
 *
 * Gir id-en, eller null når teksten ikke er en slik kode. Verten sjekkes
 * ikke, som i tolkKode – og utleie-appen har ingen /q selv.
 */
export function videresendingsId(tekst: string): string | null {
  let url: URL
  try {
    url = new URL(tekst.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.pathname.replace(/\/$/, '') !== '/q') return null
  return kodeId(url.searchParams.get('k') ?? '')
}

export function tolkKode(tekst: string): SkannetKode {
  let url: URL
  try {
    url = new URL(tekst.trim())
  } catch {
    return UKJENT
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return UKJENT

  const deler = url.pathname.split('/').filter(Boolean)
  if (deler.length === 1 && deler[0] === 'retur') return { type: 'retur' }
  if (deler.length !== 2) return UKJENT

  let verdi: string
  try {
    verdi = decodeURIComponent(deler[1])
  } catch {
    return UKJENT
  }
  if (deler[0] === 'm') return { type: 'maskin', qr: verdi }
  if (deler[0] === 'kategori') return { type: 'kategori', navn: verdi }
  return UKJENT
}
