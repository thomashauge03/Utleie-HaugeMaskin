'use client'

import { useState } from 'react'

export function KopierLenke({ url, etikett = 'Kopier lenke' }: { url: string; etikett?: string }) {
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
      className="rounded-md border border-slate-300 px-2 py-1 text-xs whitespace-nowrap transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      {kopiert ? '✓ Kopiert' : etikett}
    </button>
  )
}
