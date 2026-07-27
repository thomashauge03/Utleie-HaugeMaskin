'use client'

import { useEffect } from 'react'
import { glemAlleBilder } from '@/lib/kladd'

/**
 * Rydder bort mellomlagrede bildestier.
 *
 * Plasseres på sider man bare når fram til etter at et bilde faktisk er
 * knyttet til en leie – kvitteringen. Da kan ikke stien bli gjenbrukt av
 * neste skjema.
 */
export function TømBildekladd() {
  useEffect(() => {
    glemAlleBilder()
  }, [])

  return null
}
