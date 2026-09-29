'use client'

import { createContext, useContext, useState } from 'react'

const MeldLevert = createContext<((melding: string) => void) | null>(null)

/**
 * Viser «… er levert.» etter en levering.
 *
 * Meldingen kan ikke ligge i Lever-knappen: når leveringen er ferdig,
 * tegnes siden på nytt uten leien, og knappen forsvinner med svaret sitt.
 * Rammen står rundt innholdet og blir stående, så den tar vare på det.
 */
export function LevertRamme({ children }: { children: React.ReactNode }) {
  const [melding, settMelding] = useState<string | null>(null)

  return (
    <MeldLevert value={settMelding}>
      {melding && (
        <p
          role="status"
          className="mb-4 border-l-4 border-hm-green bg-hm-green/10 p-3 text-sm font-semibold text-hm-green"
        >
          {melding}
        </p>
      )}
      {children}
    </MeldLevert>
  )
}

/** For Lever-knappen: si fra til rammen rundt at noe er levert. */
export function useMeldLevert() {
  return useContext(MeldLevert)
}
