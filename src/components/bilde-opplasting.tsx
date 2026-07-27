'use client'

import { useEffect, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { lagNettleserKlient } from '@/lib/supabase/client'
import { lagreBildeSti, lesBildeSti } from '@/lib/kladd'
import { ETIKETT } from '@/components/ui'

type Status = 'tom' | 'jobber' | 'ferdig' | 'feil'

type Props = {
  type: 'henting' | 'levering'
  etikett: string
  hjelpetekst?: string
  /** Slås mellomlagring på, overlever bildet at kunden forlater siden. */
  kladdNøkkel?: string
}

/**
 * Tar bilde med telefonkameraet, komprimerer det, og laster det opp
 * direkte til Supabase Storage.
 *
 * Stien legges i et skjult felt, slik at server action bare får en
 * filsti å forholde seg til – aldri selve fila. Se docs/TEKNISK-PLAN.md
 * pkt. 9 om hvorfor opplastingen går utenom serveren.
 */
export function BildeOpplasting({
  type,
  etikett,
  hjelpetekst,
  kladdNøkkel,
}: Props) {
  const [status, settStatus] = useState<Status>('tom')
  const [sti, settSti] = useState('')
  const [forhåndsvisning, settForhåndsvisning] = useState<string | null>(null)
  const [feilmelding, settFeilmelding] = useState('')
  const [posisjon, settPosisjon] = useState<GeolocationCoordinates | null>(null)
  const filvelger = useRef<HTMLInputElement>(null)

  /*
   * Bildet ligger allerede i Storage, så det er nok å hente fram stien.
   * Miniatyrbildet er borte – blob-URL-en døde med forrige sidevisning –
   * men kunden slipper å ta bildet på nytt, som er det som betyr noe.
   */
  useEffect(() => {
    if (!kladdNøkkel) return
    const lagret = lesBildeSti(kladdNøkkel)
    if (lagret) {
      settSti(lagret)
      settStatus('ferdig')
    }
  }, [kladdNøkkel])

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
      if (kladdNøkkel) lagreBildeSti(kladdNøkkel, målSti)
    } catch (e) {
      settStatus('feil')
      settFeilmelding(
        e instanceof Error ? e.message : 'Noe gikk galt under opplasting',
      )
    }
  }

  return (
    <div>
      <span className={ETIKETT}>{etikett}</span>
      {hjelpetekst && (
        <p className="mb-3 text-sm text-[var(--blekk-svak)]">{hjelpetekst}</p>
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

      {status === 'ferdig' ? (
        <div>
          {forhåndsvisning ? (
            <div className="relative border-2 border-[var(--kant-sterk)]">
              {/* Lokal blob-URL – next/image gir ingenting her. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={forhåndsvisning}
                alt="Bildet du tok av maskinen"
                className="block max-h-64 w-full object-cover"
              />
              <span className="absolute top-0 left-0 bg-hm-green px-2 py-1 text-[11px] font-bold tracking-wider text-white uppercase">
                ✓ Lagret
              </span>
            </div>
          ) : (
            /* Gjenopprettet kladd: stien finnes, men miniatyrbildet er borte. */
            <div className="flex items-center gap-3 border-2 border-hm-green bg-[var(--flate-2)] p-4">
              <span className="bg-hm-green px-2 py-1 text-[11px] font-bold tracking-wider text-white uppercase">
                ✓ Lagret
              </span>
              <p className="text-sm text-[var(--blekk-svak)]">
                Bildet du tok er tatt vare på.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => filvelger.current?.click()}
            className="mt-2 inline-flex min-h-[2.75rem] items-center text-sm font-semibold text-hm-red-ink underline underline-offset-4"
          >
            Ta nytt bilde
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={status === 'jobber'}
          onClick={() => filvelger.current?.click()}
          className="hm-trykk flex min-h-[7rem] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--kant-sterk)] bg-[var(--flate-2)] px-4 py-6 disabled:opacity-60"
        >
          <Kamera />
          <span className="hm-display text-lg">
            {status === 'jobber' ? 'Laster opp …' : 'Ta bilde'}
          </span>
        </button>
      )}

      {status === 'feil' && (
        <p
          role="alert"
          className="mt-2 border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {feilmelding}. Trykk for å prøve igjen.
        </p>
      )}
    </div>
  )
}

function Kamera() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}
