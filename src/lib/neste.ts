/**
 * Godtar bare en lokal sti som mål etter innlogging.
 *
 * «neste» kommer fra adresselinja og kan settes av hvem som helst. Uten
 * denne sjekken blir innloggingssiden en åpen omdirigering: en lenke til
 * vår egen innlogging som sender offeret videre til en falsk side etterpå.
 * «//evil.no» og «/\evil.no» ser lokale ut, men nettleseren tolker dem
 * som en annen vert. Tabulator og linjeskift fjernes av nettleseren før
 * tolkning, så «/⇥/evil.no» blir til «//evil.no» – derfor avvises
 * kontrolltegn også.
 */
export function trygtNeste(neste: unknown): string | null {
  if (typeof neste !== 'string') return null
  if (!neste.startsWith('/')) return null
  if (neste.startsWith('//') || neste.startsWith('/\\')) return null
  for (const tegn of neste) {
    if (tegn.charCodeAt(0) < 0x20) return null
  }
  return neste
}
