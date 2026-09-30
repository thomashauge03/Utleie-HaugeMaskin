'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { KNAPP_PRIMÆR, KNAPP_SEKUNDÆR } from '@/components/ui'

/** Svaret på én skannet kode, vist nederst i skanneren. */
export type SkannSvar = { tone: 'ok' | 'info' | 'feil'; tekst: string }

type Leser = (video: HTMLVideoElement) => Promise<string | null>

// Ikke i lib.dom ennå. Bare det som brukes her.
type BarcodeDetectorKlasse = {
  new (valg: { formats: string[] }): {
    detect(kilde: HTMLVideoElement): Promise<{ rawValue: string }[]>
  }
  getSupportedFormats(): Promise<string[]>
}

const PAUSE_MS = 200
// Så lenge koden er i bildet, leses den ikke på nytt. Først når den har
// vært ute av bildet så lenge, teller den som en ny skanning.
const SAMME_KODE_MS = 2500
const MAKS_BREDDE = 640

const TONE: Record<SkannSvar['tone'], string> = {
  ok: 'border-hm-green',
  info: 'border-hm-amber',
  feil: 'border-hm-red',
}

/**
 * Nettleserens egen QR-leser der den finnes (Android, Chrome på Mac).
 * Ellers jsQR, som lastes først her – iPhone og PC betaler ikke for den
 * før skanneren åpnes, og resten av /ansatt ikke i det hele tatt.
 */
async function lagLeser(): Promise<Leser> {
  const BD = (globalThis as { BarcodeDetector?: BarcodeDetectorKlasse }).BarcodeDetector
  if (BD) {
    const formater = await BD.getSupportedFormats().catch(() => [] as string[])
    if (formater.includes('qr_code')) {
      const detektor = new BD({ formats: ['qr_code'] })
      return async (video) => (await detektor.detect(video))[0]?.rawValue ?? null
    }
  }

  const { default: jsQR } = await import('jsqr')
  const lerret = document.createElement('canvas')
  const ktx = lerret.getContext('2d', { willReadFrequently: true })
  return async (video) => {
    const skala = Math.min(1, MAKS_BREDDE / video.videoWidth)
    const b = Math.round(video.videoWidth * skala)
    const h = Math.round(video.videoHeight * skala)
    if (!ktx || !b || !h) return null
    lerret.width = b
    lerret.height = h
    ktx.drawImage(video, 0, 0, b, h)
    return jsQR(ktx.getImageData(0, 0, b, h).data, b, h)?.data ?? null
  }
}

function kameraFeil(e: unknown): string {
  const navn = e instanceof DOMException ? e.name : ''
  if (navn === 'NotAllowedError' || navn === 'SecurityError') {
    return 'Fikk ikke bruke kameraet. Gi siden tilgang til kameraet i nettleseren, og prøv igjen.'
  }
  if (navn === 'NotFoundError' || navn === 'OverconstrainedError') {
    return 'Fant ikke noe kamera på denne enheten.'
  }
  if (navn === 'NotReadableError') return 'Kameraet er i bruk av en annen app.'
  return 'Kameraet startet ikke. Du kan fortsatt krysse av i lista.'
}

/**
 * Kameraskanner for uttak: les QR-kodene på utstyret, én etter én.
 *
 * Komponenten vet ingenting om maskiner. Den gir teksten til `onKode`, som
 * svarer med hva som skal stå på skjermen – slik bor all logikken om lista
 * i lista.
 *
 * <dialog> med showModal() gir fokus, Esc og tilbakeknappen på Android.
 * Kameraet stoppes når dialogen lukkes, uansett hvordan.
 */
export function Skanner({
  onKode,
  antallValgt,
}: {
  onKode: (tekst: string) => SkannSvar
  antallValgt: number
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [åpen, settÅpen] = useState(false)
  const [svar, settSvar] = useState<SkannSvar | null>(null)

  const vedKode = useEffectEvent((tekst: string) => {
    const s = onKode(tekst)
    settSvar(s)
    if (s.tone === 'ok') navigator.vibrate?.(60)
  })
  const vedFeil = useEffectEvent((tekst: string) => settSvar({ tone: 'feil', tekst }))

  useEffect(() => {
    const v = video.current
    if (!åpen || !v) return
    let avbrutt = false
    let strøm: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const sistSett = new Map<string, number>()

    async function start(v: HTMLVideoElement) {
      if (!navigator.mediaDevices?.getUserMedia) {
        vedFeil('Nettleseren gir ikke tilgang til kameraet her.')
        return
      }
      let s: MediaStream
      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch (e) {
        if (!avbrutt) vedFeil(kameraFeil(e))
        return
      }
      // Lukket mens nettleseren spurte om lov: slipp kameraet med en gang.
      if (avbrutt) {
        s.getTracks().forEach((t) => t.stop())
        return
      }
      strøm = s
      v.srcObject = s
      await v.play().catch(() => {})
      const les = await lagLeser()

      const runde = async () => {
        if (avbrutt) return
        const tekst = v.readyState >= 2 ? await les(v).catch(() => null) : null
        if (tekst && !avbrutt) {
          const nå = Date.now()
          if (nå - (sistSett.get(tekst) ?? 0) > SAMME_KODE_MS) vedKode(tekst)
          sistSett.set(tekst, nå)
        }
        if (!avbrutt) timer = setTimeout(runde, PAUSE_MS)
      }
      runde()
    }

    start(v)
    return () => {
      avbrutt = true
      clearTimeout(timer)
      strøm?.getTracks().forEach((t) => t.stop())
      v.srcObject = null
    }
  }, [åpen])

  function åpne() {
    settSvar(null)
    dialog.current?.showModal()
    settÅpen(true)
  }

  return (
    <>
      <button type="button" onClick={åpne} className={`${KNAPP_SEKUNDÆR} w-full`}>
        <QrIkon />
        Skann QR-kode
      </button>

      {/* open:flex, ikke flex: en lukket dialog skal beholde display: none. */}
      <dialog
        ref={dialog}
        onClose={() => settÅpen(false)}
        aria-label="Skann QR-kode"
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col border-0 bg-hm-black p-0 text-white open:flex backdrop:bg-hm-black"
      >
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={video}
            playsInline
            muted
            className="absolute inset-0 size-full object-cover"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid place-items-center"
          >
            <div className="aspect-square w-[70vmin] max-w-80 border-4 border-white/90 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
          </div>
        </div>

        <div className="space-y-3 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p
            role="status"
            className={`min-h-[3.25rem] border-l-4 bg-white/10 p-3 text-sm font-semibold ${svar ? TONE[svar.tone] : 'border-white/30'}`}
          >
            {svar?.tekst ?? 'Hold kameraet mot QR-koden på utstyret.'}
          </p>
          <button type="button" onClick={() => dialog.current?.close()} className={KNAPP_PRIMÆR}>
            Ferdig ({antallValgt} valgt)
          </button>
        </div>
      </dialog>
    </>
  )
}

function QrIkon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-5"
    >
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
    </svg>
  )
}
