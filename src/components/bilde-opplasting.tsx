'use client'

import { useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { lagNettleserKlient } from '@/lib/supabase/client'

type Status = 'tom' | 'jobber' | 'ferdig' | 'feil'

type Props = {
  type: 'henting' | 'levering'
  etikett: string
  hjelpetekst?: string
}

/**
 * Tar bilde med telefonkameraet, komprimerer det, og laster det opp
 * direkte til Supabase Storage.
 *
 * Stien legges i et skjult felt slik at server action bare får en
 * filsti å forholde seg til – aldri selve fila. Se docs/TEKNISK-PLAN.md
 * pkt. 9 om hvorfor opplastingen går utenom serveren.
 */
export function BildeOpplasting({ type, etikett, hjelpetekst }: Props) {
  const [status, settStatus] = useState<Status>('tom')
  const [sti, settSti] = useState('')
  const [forhåndsvisning, settForhåndsvisning] = useState<string | null>(null)
  const [feilmelding, settFeilmelding] = useState('')
  const [posisjon, settPosisjon] = useState<GeolocationCoordinates | null>(null)
  const filvelger = useRef<HTMLInputElement>(null)

  /** Posisjon er frivillig – leien skal fungere om kunden sier nei. */
  function spørOmPosisjon() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => settPosisjon(p.coords),
      () => settPosisjon(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    )
  }

  async function håndterFil(fil: File) {
    settStatus('jobber')
    settFeilmelding('')
    spørOmPosisjon()

    try {
      const komprimert = await imageCompression(fil, {
        maxWidthOrHeight: 1200,
        maxSizeMB: 0.4,
        useWebWorker: true,
        fileType: 'image/jpeg',
      })

      const svar = await fetch('/api/bilder/ny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      if (!svar.ok) throw new Error('Kunne ikke klargjøre opplasting')
      const { sti: målSti, token } = await svar.json()

      const supabase = lagNettleserKlient()
      const { error } = await supabase.storage
        .from('bilder')
        .uploadToSignedUrl(målSti, token, komprimert, { contentType: 'image/jpeg' })

      if (error) throw new Error(error.message)

      settSti(målSti)
      settForhåndsvisning(URL.createObjectURL(komprimert))
      settStatus('ferdig')
    } catch (e) {
      settStatus('feil')
      settFeilmelding(
        e instanceof Error ? e.message : 'Noe gikk galt under opplasting',
      )
    }
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium">{etikett}</span>
      {hjelpetekst && (
        <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">{hjelpetekst}</p>
      )}

      {/* Server action leser kun disse. Fila går aldri via serveren. */}
      <input type="hidden" name="bilde_sti" value={sti} />
      <input type="hidden" name="lat" value={posisjon?.latitude ?? ''} />
      <input type="hidden" name="lng" value={posisjon?.longitude ?? ''} />
      <input type="hidden" name="noyaktighet" value={posisjon?.accuracy ?? ''} />

      <input
        ref={filvelger}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const fil = e.target.files?.[0]
          if (fil) void håndterFil(fil)
        }}
      />

      {status === 'ferdig' && forhåndsvisning ? (
        <div className="space-y-2">
          {/* Lokal blob-URL – next/image gir ingenting her. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={forhåndsvisning}
            alt="Bildet du tok"
            className="max-h-56 w-full rounded-lg border border-slate-200 object-cover dark:border-slate-700"
          />
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-700 dark:text-green-400">✓ Bilde lagret</span>
            <button
              type="button"
              onClick={() => filvelger.current?.click()}
              className="text-slate-600 underline underline-offset-4 dark:text-slate-400"
            >
              Ta nytt
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={status === 'jobber'}
          onClick={() => filvelger.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-sm font-medium transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-900"
        >
          {status === 'jobber' ? 'Laster opp …' : '📷 Ta bilde'}
        </button>
      )}

      {status === 'feil' && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {feilmelding}. Prøv igjen.
        </p>
      )}
    </div>
  )
}
