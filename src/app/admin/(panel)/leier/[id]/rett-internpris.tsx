'use client'

import { useActionState } from 'react'
import { ETIKETT, FELT, KNAPP_SEKUNDÆR, Kort, KortTittel } from '@/components/ui'
import { utenNullstilling } from '@/lib/skjema'
import { rettInternpris, type GodkjennTilstand } from './actions'

const start: GodkjennTilstand = {}

export function RettInternpris({
  leieId,
  antall,
  belop,
  antallEtikett,
}: {
  leieId: string
  antall: number | null
  belop: number | null
  antallEtikett: string
}) {
  const [tilstand, handling, venter] = useActionState(rettInternpris.bind(null, leieId), start)

  return (
    <Kort>
      <KortTittel>Rett antall og beløp</KortTittel>
      <form
        action={handling}
        onSubmit={utenNullstilling(handling)}
        className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <label>
          <span className={ETIKETT}>{antallEtikett}</span>
          <input
            name="antall_dogn"
            inputMode="decimal"
            defaultValue={antall ?? ''}
            className={FELT}
          />
        </label>
        <label>
          <span className={ETIKETT}>Beløp (kr)</span>
          <input name="belop" inputMode="decimal" defaultValue={belop ?? ''} className={FELT} />
        </label>
        <button type="submit" disabled={venter} className={KNAPP_SEKUNDÆR}>
          {venter ? 'Lagrer …' : 'Lagre'}
        </button>
        {tilstand.feil && (
          <p
            role="alert"
            className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink sm:col-span-3"
          >
            {tilstand.feil}
          </p>
        )}
        {tilstand.ok && (
          <p role="status" className="text-sm font-semibold text-hm-green sm:col-span-3">
            {tilstand.ok}
          </p>
        )}
      </form>
    </Kort>
  )
}
