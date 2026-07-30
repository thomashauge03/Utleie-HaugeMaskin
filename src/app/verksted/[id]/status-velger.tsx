'use client'

import { useState, useTransition } from 'react'
import {
  DEL_STATUS_TEKST,
  VERKSTED_STATUS_TEKST,
  kanSettesAvAlle,
  type DelStatus,
  type VerkstedStatus,
} from '@/lib/verksted'
import { settDelStatus, settVerkstedStatus } from '../actions'

const STATUSER: VerkstedStatus[] = ['ma_sveises', 'deler_bestilt', 'klar']
const DEL_STATUSER: DelStatus[] = ['ok', 'ma_byttes', 'bestilt', 'byttet']

const farge: Record<string, string> = {
  ma_sveises: 'bg-hm-red text-white',
  deler_bestilt: 'bg-hm-amber text-white',
  klar: 'bg-hm-green text-white',
  ok: 'bg-hm-green text-white',
  ma_byttes: 'bg-hm-red text-white',
  bestilt: 'bg-hm-amber text-white',
  byttet: 'bg-hm-500 text-white',
}

function Knapperad({
  valg,
  aktiv,
  etikett,
  laast,
  onVelg,
  venter,
}: {
  valg: string[]
  aktiv: string | null
  etikett: (v: string) => string
  laast: (v: string) => boolean
  onVelg: (v: string) => void
  venter: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {valg.map((v) => {
        const erAktiv = aktiv === v
        const erLaast = laast(v)
        return (
          <button
            key={v}
            type="button"
            disabled={venter || erLaast}
            onClick={() => onVelg(v)}
            title={erLaast ? 'Krever innlogging' : undefined}
            className={`hm-trykk inline-flex min-h-[2.75rem] items-center border-2 px-3 text-xs font-bold tracking-wider uppercase disabled:cursor-not-allowed disabled:opacity-40 ${
              erAktiv
                ? `border-[var(--kant-sterk)] ${farge[v]}`
                : 'border-[var(--kant)] bg-[var(--flate-opp)]'
            }`}
          >
            {etikett(v)}
            {erLaast && ' 🔒'}
          </button>
        )
      })}
    </div>
  )
}

/** Verkstedstatus for hele maskinen. */
export function StatusVelger({
  maskinId,
  naavaerende,
  innlogget,
}: {
  maskinId: string
  naavaerende: string | null
  innlogget: boolean
}) {
  const [venter, start] = useTransition()
  const [feil, settFeil] = useState('')

  return (
    <div>
      <Knapperad
        valg={STATUSER}
        aktiv={naavaerende}
        etikett={(v) => VERKSTED_STATUS_TEKST[v as VerkstedStatus]}
        laast={(v) => !innlogget && !kanSettesAvAlle(v as VerkstedStatus)}
        venter={venter}
        onVelg={(v) =>
          start(async () => {
            const r = await settVerkstedStatus(maskinId, v)
            settFeil(r.feil ?? '')
          })
        }
      />
      {feil && (
        <p role="alert" className="mt-2 text-sm font-semibold text-hm-red-ink">
          {feil}
        </p>
      )}
    </div>
  )
}

/** Status per del. Krever innlogging – vises som låst ellers. */
export function DelVelger({
  maskinId,
  delId,
  naavaerende,
  innlogget,
}: {
  maskinId: string
  delId: string
  naavaerende: string
  innlogget: boolean
}) {
  const [venter, start] = useTransition()
  const [feil, settFeil] = useState('')

  return (
    <div>
      <Knapperad
        valg={DEL_STATUSER}
        aktiv={naavaerende}
        etikett={(v) => DEL_STATUS_TEKST[v as DelStatus]}
        laast={() => !innlogget}
        venter={venter}
        onVelg={(v) =>
          start(async () => {
            const r = await settDelStatus(maskinId, delId, v)
            settFeil(r.feil ?? '')
          })
        }
      />
      {feil && (
        <p role="alert" className="mt-2 text-sm font-semibold text-hm-red-ink">
          {feil}
        </p>
      )}
    </div>
  )
}
