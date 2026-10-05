'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Ruller tidslinja sidelengs fram til dagens kolonne når siden åpnes. På
 * mobil er bare en uke synlig om gangen, og det er i dag og dagene etter
 * man vil se. Gjør ingenting når i dag ikke er i måneden, eller alt får
 * plass.
 */
export function RullTilIDag({ className, children }: { className: string; children: ReactNode }) {
  const boks = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const b = boks.current
    const iDag = b?.querySelector<HTMLElement>('[data-idag]')
    const maskinkol = b?.querySelector<HTMLElement>('[data-maskinkol]')
    if (!b || !iDag || !maskinkol || b.scrollWidth <= b.clientWidth) return
    // To dager før i dag synes også, så man ser hva som nettopp skjedde.
    const venstre = iDag.getBoundingClientRect().left - b.getBoundingClientRect().left + b.scrollLeft
    b.scrollLeft = venstre - maskinkol.offsetWidth - 2 * iDag.offsetWidth
  }, [])

  return (
    <div ref={boks} className={className}>
      {children}
    </div>
  )
}
