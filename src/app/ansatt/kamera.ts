/**
 * Kamerastyring for skanneren: hvilket kamera, fokus og zoom – og å lese
 * en kode fra et bilde tatt med telefonens eget kamera. Se skanner.tsx.
 *
 * Det meste her finnes bare på noen telefoner. Chrome på Android kan
 * fokusere og zoome; Safari på iPhone kan ingen av delene. Alt spør
 * først hva kameraet kan, og gjør ingenting der svaret er nei.
 */

// Ikke i lib.dom ennå. Bare det som brukes her.
type Kan = {
  focusMode?: string[]
  zoom?: { min: number; max: number; step?: number }
}
type Ønske = MediaTrackConstraintSet & {
  focusMode?: string
  pointsOfInterest?: { x: number; y: number }[]
  zoom?: number
}
type BarcodeDetectorKlasse = {
  new (valg: { formats: string[] }): {
    detect(kilde: CanvasImageSource | ImageBitmap): Promise<{ rawValue: string }[]>
  }
  getSupportedFormats(): Promise<string[]>
}

export const VIDEO: MediaTrackConstraints = {
  facingMode: { ideal: 'environment' },
  // Uten ønsket oppløsning gir Chrome på Android 640×480: bildet ble
  // kornete strukket over skjermen, og koden fikk få punkter. `ideal`,
  // ikke `min` – et kamera som ikke klarer det, gir sitt beste.
  width: { ideal: 1920 },
  height: { ideal: 1080 },
}

/** Det kameraet kan, slik skanneren trenger å vite det. */
export type Kamerakontroll = {
  /** Trykk på bildet for å fokusere der. */
  fokus: boolean
  /** Zoomtrinnene som kan velges, eller tom når kameraet ikke zoomer. */
  zoom: number[]
}

/** Nettleserens egen QR-leser (Android, Chrome på Mac), der den finnes. */
export async function lagDetektor(): Promise<InstanceType<BarcodeDetectorKlasse> | null> {
  const BD = (globalThis as { BarcodeDetector?: BarcodeDetectorKlasse }).BarcodeDetector
  if (!BD) return null
  const formater = await BD.getSupportedFormats().catch(() => [] as string[])
  return formater.includes('qr_code') ? new BD({ formats: ['qr_code'] }) : null
}

/**
 * iPhone Pro-modellene velger hovedkameraet, som ikke fokuserer nærmere
 * enn 15–20 cm – koden ble uskarp når man holdt den nært. De samlede
 * kameraene («Triple», «Dual Wide») bytter selv til vidvinkel på nært
 * hold, som kameraappen gjør. Finnes ett av dem, startes det i stedet.
 *
 * Navnene finnes først etter at man har fått lov til kameraet, så dette
 * kjøres på strømmen som allerede går.
 */
export async function bedreIPhoneKamera(strøm: MediaStream): Promise<MediaStream> {
  const nå = strøm.getVideoTracks()[0]?.getSettings().deviceId
  const enheter = await navigator.mediaDevices.enumerateDevices().catch(() => [])
  const kameraer = enheter.filter((e) => e.kind === 'videoinput')
  const bedre =
    kameraer.find((e) => /triple|trippel/i.test(e.label)) ??
    kameraer.find((e) => /dual wide|doble? vidvinkel/i.test(e.label))
  if (!bedre || bedre.deviceId === nå) return strøm

  strøm.getTracks().forEach((t) => t.stop())
  // Starter det ikke, er det første kameraet fortsatt bedre enn ingen.
  return navigator.mediaDevices
    .getUserMedia({
      video: { ...VIDEO, facingMode: undefined, deviceId: { exact: bedre.deviceId } },
      audio: false,
    })
    .catch(() => navigator.mediaDevices.getUserMedia({ video: VIDEO, audio: false }))
}

/**
 * Slår på kontinuerlig autofokus og finner ut hva skanneren kan tilby.
 * Mange Android-kameraer står på fast fokus i nettleseren til de blir
 * bedt om noe annet.
 */
export async function klargjør(spor: MediaStreamTrack): Promise<Kamerakontroll> {
  const kan = (spor.getCapabilities?.() ?? {}) as Kan
  const moduser = kan.focusMode ?? []
  if (moduser.includes('continuous')) {
    await spor.applyConstraints({ advanced: [{ focusMode: 'continuous' } as Ønske] }).catch(() => {})
  }

  const z = kan.zoom
  const zoom =
    z && z.max >= 2
      ? [1, 2, 3, 5].filter((t) => t >= z.min && t <= z.max).concat(z.min > 1 ? [z.min] : [])
      : []
  return {
    fokus: moduser.includes('single-shot') || moduser.includes('continuous'),
    zoom: zoom.sort((a, b) => a - b),
  }
}

/**
 * Fokuserer på punktet (0–1 i bildet). Én gang der, så tilbake til
 * kontinuerlig fokus – men rundt samme punkt, så det ikke hopper vekk.
 */
export async function fokuserPå(spor: MediaStreamTrack, x: number, y: number) {
  const kan = (spor.getCapabilities?.() ?? {}) as Kan
  const moduser = kan.focusMode ?? []
  const punkt = navigator.mediaDevices.getSupportedConstraints?.() as { pointsOfInterest?: boolean }
  const der: Ønske = punkt?.pointsOfInterest ? { pointsOfInterest: [{ x, y }] } : {}

  const først = moduser.includes('single-shot') ? 'single-shot' : 'continuous'
  const ønske = (focusMode: string): Ønske => ({ ...der, focusMode })
  await spor.applyConstraints({ advanced: [ønske(først)] }).catch(() => {})
  if (først === 'single-shot' && moduser.includes('continuous')) {
    setTimeout(() => {
      if (spor.readyState !== 'live') return
      spor.applyConstraints({ advanced: [ønske('continuous')] }).catch(() => {})
    }, 2000)
  }
}

export async function settZoom(spor: MediaStreamTrack, zoom: number) {
  await spor.applyConstraints({ advanced: [{ zoom } as Ønske] }).catch(() => {})
}

/**
 * Leser en QR-kode fra et bilde tatt med telefonens eget kamera. Det
 * fokuserer alltid, også der nettleseren ikke får lov til det.
 *
 * Bildet er stort (12 MP), og koden kan være hvor som helst i det. jsQR
 * prøver derfor flere størrelser: en liten kode trenger mange punkter,
 * en stor leses raskest nedskalert.
 */
export async function lesBilde(fil: File): Promise<string | null> {
  const bilde = await createImageBitmap(fil)
  try {
    const detektor = await lagDetektor()
    if (detektor) {
      const funn = await detektor.detect(bilde).catch(() => [])
      if (funn[0]) return funn[0].rawValue
    }

    const { default: jsQR } = await import('jsqr')
    const lerret = document.createElement('canvas')
    const ktx = lerret.getContext('2d', { willReadFrequently: true })
    if (!ktx) return null
    const lengst = Math.max(bilde.width, bilde.height)
    for (const mål of [1600, 1000, 640]) {
      const skala = Math.min(1, mål / lengst)
      const b = Math.round(bilde.width * skala)
      const h = Math.round(bilde.height * skala)
      lerret.width = b
      lerret.height = h
      ktx.drawImage(bilde, 0, 0, b, h)
      const funn = jsQR(ktx.getImageData(0, 0, b, h).data, b, h)
      if (funn) return funn.data
    }
    return null
  } finally {
    bilde.close()
  }
}
