import { cookies } from 'next/headers'
import 'server-only'

const NAVN = 'utleie_enhet'
const TO_AR = 60 * 60 * 24 * 730

/**
 * Enhets-ID: en tilfeldig UUID i en varig cookie.
 *
 * Dette er ikke identitet – det identifiserer telefonen, ikke personen.
 * Nytten er at kunden slipper å taste alt på nytt ved neste leie, og at
 * retursiden vet hvilke leier som hører til denne telefonen uten
 * innlogging. Se docs/TEKNISK-PLAN.md pkt. 3.2.
 */
export async function hentEnhetsId(): Promise<string | null> {
  const kakebeholder = await cookies()
  return kakebeholder.get(NAVN)?.value ?? null
}

/**
 * Henter enhets-ID, eller lager en ny.
 *
 * Kan kun kalles fra en server action eller route handler – cookies kan
 * ikke settes fra en server component.
 */
export async function sikreEnhetsId(): Promise<string> {
  const kakebeholder = await cookies()
  const eksisterende = kakebeholder.get(NAVN)?.value
  if (eksisterende) return eksisterende

  const ny = crypto.randomUUID()
  kakebeholder.set(NAVN, ny, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TO_AR,
    path: '/',
  })
  return ny
}
