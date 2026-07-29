import { headers } from 'next/headers'
import 'server-only'

/**
 * Enkel ratebegrensning i minnet.
 *
 * Holder et tak på hvor ofte et uautentisert endepunkt kan treffes fra
 * samme IP. Dette er ikke vanntett – på flere serverinstanser har hver
 * sitt eget minne, og en angriper med mange IP-er slipper unna. Men det
 * stopper det som faktisk skjer i praksis: én maskin som hamrer løs for
 * å høste telefonnnumre, spamme leier eller fylle bildelageret.
 *
 * Trenger dere hardere garantier senere, bytt ut kroppen her med et
 * kall til Upstash Ratelimit e.l. – grensesnittet kan stå.
 */

type Vindu = { antall: number; nullstilles: number }
const lager = new Map<string, Vindu>()

// Rydder bort utgåtte vinduer så kartet ikke vokser i det uendelige.
function rydd(nå: number) {
  if (lager.size < 5000) return
  for (const [k, v] of lager) {
    if (v.nullstilles < nå) lager.delete(k)
  }
}

/** Klientens IP, så godt det lar seg gjøre bak Vercels proxy. */
export async function hentIp(): Promise<string> {
  const h = await headers()
  const framover = h.get('x-forwarded-for')
  if (framover) return framover.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'ukjent'
}

/**
 * Returnerer true om handlingen er innenfor grensen, false om den skal
 * avvises. `nøkkel` skiller de ulike endepunktene fra hverandre.
 */
export async function innenforGrense(
  nøkkel: string,
  maks: number,
  vinduMs: number,
): Promise<boolean> {
  const ip = await hentIp()
  const id = `${nøkkel}:${ip}`
  const nå = Date.now()
  rydd(nå)

  const v = lager.get(id)
  if (!v || v.nullstilles < nå) {
    lager.set(id, { antall: 1, nullstilles: nå + vinduMs })
    return true
  }

  if (v.antall >= maks) return false
  v.antall++
  return true
}
