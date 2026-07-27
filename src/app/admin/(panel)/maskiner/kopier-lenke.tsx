'use client'

import { useState } from 'react'
import { KNAPP_LITEN } from '@/components/ui'

export function KopierLenke({
  url,
  etikett = 'Kopier lenke',
}: {
  url: string
  etikett?: string
}) {
  const [kopiert, settKopiert] = useState(false)

  async function kopier() {
    try {
      await navigator.clipboard.writeText(url)
      settKopiert(true)
      setTimeout(() => settKopiert(false), 2000)
    } catch {
      // Utklippstavla krever sikker kontekst (https eller localhost) og
      // kan nektes av nettleseren. Da må brukeren kunne kopiere selv.
      window.prompt('Kopier lenken:', url)
    }
  }

  return (
    <button
      type="button"
      onClick={kopier}
      title={url}
      className={`${KNAPP_LITEN} whitespace-nowrap ${kopiert ? 'border-hm-green text-hm-green' : ''}`}
    >
      {kopiert ? '✓ Kopiert' : etikett}
    </button>
  )
}
