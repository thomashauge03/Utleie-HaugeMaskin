'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { HMLogo } from './hm-logo'

// Til platene har gått helt opp. Stemmer med tidene i globals.css.
const VARIGHET_MS = 1650

const ingenting = () => () => {}

// Siden ble malt rundt første byte, og animasjonen startet da – ikke
// når React kom i gang.
function sidenLasting() {
  const nav = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined
  return performance.now() - (nav?.responseStart ?? 0)
}

/**
 * Det første som møter den som skanner en QR-kode med vanlig kamera:
 * navnet stemples på lukkerens skrå plater, og platene går opp mot
 * høyre og viser siden, som har lastet bak dem.
 *
 * Animasjonen er ren CSS (`.hm-intro` i globals.css) og spiller fra
 * første maling, før React er i gang. Komponenten gjør bare tre ting:
 * fjerner den etterpå, lar et trykk hoppe over den, og fortsetter der den
 * var når en videresending bytter side midt i (/retur → /leie/…/retur).
 *
 * Bare en sidelasting gir intro. Kommer man hit med et trykk inne i
 * appen, er sida allerede lastet for lenge siden, og ingenting vises.
 *
 * Åpnet mobilappen sida, spiller lukkeren i stedet – se Lukkar.tsx.
 */
export function SkannIntro({ tittel, under }: { tittel: string; under?: string | null }) {
  // Usant på serveren og under hydreringen, sant når komponenten dukker
  // opp senere i nettleseren. Hydreres den, er animasjonen allerede i
  // gang fra serverens HTML og skal stå urørt.
  const iEtterkant = useSyncExternalStore(ingenting, () => true, () => false)
  const [forskyv] = useState(() => (iEtterkant ? sidenLasting() : 0))
  const [vis, settVis] = useState(forskyv < VARIGHET_MS)

  useEffect(() => {
    if (!vis) return
    const t = setTimeout(() => settVis(false), Math.max(0, VARIGHET_MS - sidenLasting()))
    return () => clearTimeout(t)
  }, [vis])

  if (!vis) return null

  return (
    <div
      aria-hidden="true"
      onClick={() => settVis(false)}
      className="hm-intro"
      style={forskyv ? ({ '--hm-intro-forskyv': `${-forskyv}ms` } as React.CSSProperties) : undefined}
    >
      <i />
      <i />
      <i />
      <div className="hm-intro-tekst">
        <HMLogo størrelse="lg" className="hm-intro-logo" />
        <p className="hm-display hm-intro-tittel">{tittel}</p>
        {under && <p className="hm-intro-under">{under}</p>}
      </div>
    </div>
  )
}
