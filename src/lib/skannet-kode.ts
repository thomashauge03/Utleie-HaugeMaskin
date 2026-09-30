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
