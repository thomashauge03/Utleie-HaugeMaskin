'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { KNAPP_PRIMÆR, KNAPP_SEKUNDÆR } from '@/components/ui'
import {
  VIDEO,
  bedreIPhoneKamera,
  fokuserPå,
  klargjør,
  lagDetektor,
  lesBilde,
  settZoom,
  type Kamerakontroll,
} from './kamera'

/**
 * Svaret på én skannet kode, vist nederst i skanneren. Med `gåTil` lukkes
 * skanneren, og siden rulles til elementet med den id-en.
 */
export type SkannSvar = { tone: 'ok' | 'info' | 'feil'; tekst: string; gåTil?: string }

type Leser = (video: HTMLVideoElement) => Promise<string | null>

const PAUSE_MS = 200
// Så lenge koden er i bildet, leses den ikke på nytt. Først når den har
// vært ute av bildet så lenge, teller den som en ny skanning.
const SAMME_KODE_MS = 2500
// Sida på utsnittet jsQR leser. Nok til en liten kode på armlengdes
// avstand, og fortsatt raskt nok på en eldre telefon.
const MAKS_SIDE = 960
const INGEN_KONTROLL: Kamerakontroll = { fokus: false, zoom: [] }

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
  const detektor = await lagDetektor()
  if (detektor) return async (video) => (await detektor.detect(video))[0]?.rawValue ?? null

  // Bare kvadratet midt i bildet leses, der søkeren står. Før ble hele
  // bildet krympet til 640 punkter bredt, og koden ble for grovkornet.
  const { default: jsQR } = await import('jsqr')
  const lerret = document.createElement('canvas')
  const ktx = lerret.getContext('2d', { willReadFrequently: true })
  return async (video) => {
    const kilde = Math.min(video.videoWidth, video.videoHeight)
    const side = Math.round(Math.min(kilde, MAKS_SIDE))
    if (!ktx || !side) return null
    const x = (video.videoWidth - kilde) / 2
    const y = (video.videoHeight - kilde) / 2
    lerret.width = side
    lerret.height = side
    ktx.drawImage(video, x, y, kilde, kilde, 0, 0, side, side)
    // Printede koder er mørke på lyst. Å prøve invertert også dobler tida.
    return (
      jsQR(ktx.getImageData(0, 0, side, side).data, side, side, {
        inversionAttempts: 'dontInvert',
      })?.data ?? null
    )
  }
}

// Dialogen gir fokus tilbake til Skann-knappen når den lukkes. Målet tar
// det over etterpå, så skjermleseren også havner der.
function lukkOgGåTil(dialog: HTMLDialogElement | null, id: string) {
  dialog?.close()
  requestAnimationFrame(() => {
    const mål = document.getElementById(id)
    mål?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    mål?.focus({ preventScroll: true })
  })
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
 * Der kameraet kan det, fokuserer et trykk på bildet, og zoomknapper lar
 * en holde telefonen lenger unna. «Ta bilde» bruker telefonens eget
 * kamera, som alltid fokuserer – også på iPhone, der nettleseren ikke får.
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
  const filfelt = useRef<HTMLInputElement>(null)
  const spor = useRef<MediaStreamTrack | null>(null)
  const [åpen, settÅpen] = useState(false)
  // Kameraet er sluppet mens telefonens eget kamera tar et bilde.
  const [pause, settPause] = useState(false)
  const [svar, settSvar] = useState<SkannSvar | null>(null)
  const [kontroll, settKontroll] = useState(INGEN_KONTROLL)
  const [zoom, settValgtZoom] = useState(1)
  const [ring, settRing] = useState<{ x: number; y: number; n: number } | null>(null)

  function svarPå(tekst: string) {
    const s = onKode(tekst)
    settSvar(s)
    if (s.tone === 'ok') navigator.vibrate?.(60)
    if (s.gåTil) lukkOgGåTil(dialog.current, s.gåTil)
  }
  const vedKode = useEffectEvent(svarPå)
  const vedFeil = useEffectEvent((tekst: string) => settSvar({ tone: 'feil', tekst }))
  const vedKontroll = useEffectEvent((k: Kamerakontroll) => {
    settKontroll(k)
    settValgtZoom(1)
  })

  useEffect(() => {
    const v = video.current
    if (!åpen || pause || !v) return
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
        s = await navigator.mediaDevices.getUserMedia({ video: VIDEO, audio: false })
        if (!avbrutt) s = await bedreIPhoneKamera(s)
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
      const t = s.getVideoTracks()[0]
      spor.current = t
      vedKontroll(t ? await klargjør(t) : INGEN_KONTROLL)
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
      spor.current = null
      v.srcObject = null
    }
  }, [åpen, pause])

  // Lukkes telefonens kamera uten bilde, startes vårt igjen.
  useEffect(() => {
    const f = filfelt.current
    if (!f) return
    const avbryt = () => settPause(false)
    f.addEventListener('cancel', avbryt)
    return () => f.removeEventListener('cancel', avbryt)
  }, [])

  function åpne() {
    settSvar(null)
    settPause(false)
    dialog.current?.showModal()
    settÅpen(true)
  }

  // Bildet fyller flata med object-cover, så kantene er klippet bort.
  // Punktet regnes om til en andel av hele kamerabildet.
  function vedTrykk(e: React.PointerEvent<HTMLDivElement>) {
    const t = spor.current
    const v = video.current
    if (!t || !v || !kontroll.fokus || !v.videoWidth) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    const skala = Math.max(r.width / v.videoWidth, r.height / v.videoHeight)
    const b = v.videoWidth * skala
    const h = v.videoHeight * skala
    settRing({ x: px, y: py, n: e.timeStamp })
    fokuserPå(t, (px + (b - r.width) / 2) / b, (py + (h - r.height) / 2) / h)
  }

  function velgZoom(z: number) {
    settValgtZoom(z)
    if (spor.current) settZoom(spor.current, z)
  }

  function taBilde() {
    settPause(true)
    filfelt.current?.click()
  }

  async function vedBilde(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0]
    e.target.value = ''
    if (fil) {
      settSvar({ tone: 'info', tekst: 'Leser bildet …' })
      const tekst = await lesBilde(fil).catch(() => null)
      if (tekst) svarPå(tekst)
      else settSvar({ tone: 'feil', tekst: 'Fant ingen QR-kode i bildet. Prøv igjen, med koden midt i.' })
    }
    settPause(false)
  }

  const hint = kontroll.fokus
    ? 'Hold kameraet mot QR-koden. Trykk på bildet for å fokusere.'
    : 'Hold kameraet mot QR-koden. Blir det uskarpt, hold litt lenger unna – eller ta et bilde.'

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
        <div onPointerDown={vedTrykk} className="relative flex-1 touch-manipulation overflow-hidden">
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

          {ring && (
            <span
              key={ring.n}
              aria-hidden="true"
              className="hm-fokusring pointer-events-none absolute size-16 border-2 border-white"
              style={{ left: ring.x - 32, top: ring.y - 32 }}
            />
          )}

          {pause && (
            <div className="absolute inset-0 grid place-items-center bg-hm-black p-6">
              <button
                type="button"
                onClick={() => settPause(false)}
                className={`${KNAPP_SEKUNDÆR} border-white bg-transparent text-white hover:bg-white/10`}
              >
                Skann med kameraet igjen
              </button>
            </div>
          )}

          {!pause && kontroll.zoom.length > 1 && (
            <div
              role="group"
              aria-label="Zoom"
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute inset-x-0 bottom-4 flex justify-center gap-2"
            >
              {kontroll.zoom.map((z) => (
                <button
                  key={z}
                  type="button"
                  aria-pressed={zoom === z}
                  onClick={() => velgZoom(z)}
                  className={`hm-tall min-h-11 min-w-12 border-2 px-3 text-sm font-bold ${
                    zoom === z
                      ? 'border-white bg-white text-hm-black'
                      : 'border-white/80 bg-hm-black/60 text-white'
                  }`}
                >
                  {z.toLocaleString('nb-NO')}×
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p
            role="status"
            className={`min-h-[3.25rem] border-l-4 bg-white/10 p-3 text-sm font-semibold ${svar ? TONE[svar.tone] : 'border-white/30'}`}
          >
            {svar?.tekst ?? hint}
          </p>
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <button
              type="button"
              onClick={taBilde}
              className={`${KNAPP_SEKUNDÆR} min-h-[3.5rem] border-white bg-transparent text-white hover:bg-white/10`}
            >
              <KameraIkon />
              Ta bilde
            </button>
            <button type="button" onClick={() => dialog.current?.close()} className={KNAPP_PRIMÆR}>
              Ferdig ({antallValgt} valgt)
            </button>
          </div>
          {/* Telefonens eget kamera: fokuserer selv, også på iPhone. */}
          <input
            ref={filfelt}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={vedBilde}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />
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

function KameraIkon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-5"
    >
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}
