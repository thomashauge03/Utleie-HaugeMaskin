'use client'

import { useEffect, type RefObject } from 'react'
import { lagreFelter, lesFelter } from '@/lib/kladd'

/** Felter som aldri skal mellomlagres. */
const HOPP_OVER = new Set(['bilde_sti', 'lat', 'lng', 'noyaktighet', 'vilkar'])

/**
 * Gjenoppretter utfylte tekstfelter ved oppstart, og lagrer dem
 * fortløpende mens kunden skriver.
 *
 * Avkrysningen for vilkår lagres bevisst ikke – et samtykke skal
 * gjøres aktivt hver gang, ikke huskes fra sist.
 */
export function useSkjemakladd(
  nøkkel: string,
  skjema: RefObject<HTMLFormElement | null>,
) {
  useEffect(() => {
    const el = skjema.current
    if (!el) return

    const lagret = lesFelter(nøkkel)
    if (lagret) {
      for (const [navn, verdi] of Object.entries(lagret)) {
        const felt = el.elements.namedItem(navn)
        if (
          (felt instanceof HTMLInputElement ||
            felt instanceof HTMLTextAreaElement) &&
          !felt.value
        ) {
          felt.value = verdi
        }
      }
    }

    let tidsavbrudd: ReturnType<typeof setTimeout>
    const lagre = () => {
      clearTimeout(tidsavbrudd)
      tidsavbrudd = setTimeout(() => {
        const data = new FormData(el)
        const felter: Record<string, string> = {}
        for (const [navn, verdi] of data.entries()) {
          if (!HOPP_OVER.has(navn) && typeof verdi === 'string' && verdi) {
            felter[navn] = verdi
          }
        }
        lagreFelter(nøkkel, felter)
      }, 400)
    }

    el.addEventListener('input', lagre)
    el.addEventListener('change', lagre)
    return () => {
      clearTimeout(tidsavbrudd)
      el.removeEventListener('input', lagre)
      el.removeEventListener('change', lagre)
    }
  }, [nøkkel, skjema])
}
