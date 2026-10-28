'use client'

import { useActionState, useState, useTransition, type FormEvent } from 'react'
import { ETIKETT, FELT, KNAPP_SEKUNDÆR } from '@/components/ui'
import { utenNullstilling } from '@/lib/skjema'
import type { TripletexStatus, TripletexVedlegg } from '@/lib/types'
import {
  leggVedPaNytt,
  opprettTripletexOrdre,
  type TripletexTilstand,
} from './tripletex-actions'

const start: TripletexTilstand = {}

/**
 * Ordren i Tripletex, under fakturagrunnlaget.
 *
 * Appen oppretter bare ordren. Fakturering og utsending gjøres i Tripletex,
 * og det står her så ingen tror knappen sender noe til kunden.
 */
export function TripletexOrdre({
  leieId,
  oppsatt,
  status,
  ordrenr,
  kundenr,
  vedlegg,
  lagretFeil,
  ordreForlatt,
  vedleggForlatt,
}: {
  leieId: string
  /** TRIPLETEX_NOKKEL finnes på serveren. */
  oppsatt: boolean
  status: TripletexStatus | null
  ordrenr: string | null
  /** Forslag: det leien ble sendt med, ellers det kunden fikk sist. */
  kundenr: number | null
  vedlegg: TripletexVedlegg | null
  lagretFeil: string | null
  /** «oppretter» i over fem minutter: kallet døde, og ordren kan finnes. */
  ordreForlatt: boolean
  vedleggForlatt: boolean
}) {
  const [tilstand, handling, venter] = useActionState(
    opprettTripletexOrdre.bind(null, leieId),
    start,
  )
  const [vedleggSvar, settVedleggSvar] = useState<TripletexTilstand>({})
  const [leggerVed, startVedlegg] = useTransition()

  const kanVaereOpprettet = status === 'ukjent' || (status === 'oppretter' && ordreForlatt)

  const send = (e: FormEvent<HTMLFormElement>) => {
    const knapp = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    if (
      knapp?.value === '1' &&
      !confirm(
        'Har du sjekket i Tripletex at ordren ikke finnes? Finnes den, blir det to ordre for samme leie.',
      )
    ) {
      e.preventDefault()
      return
    }
    utenNullstilling(handling)(e)
  }

  const leggVed = (bekreftet: boolean) => {
    if (
      bekreftet &&
      !confirm('PDF-en kan alt ligge på ordren. Har du sett etter i Tripletex? Ellers kan den bli liggende to ganger.')
    ) {
      return
    }
    startVedlegg(async () => settVedleggSvar(await leggVedPaNytt(leieId, bekreftet)))
  }

  const svar = { ...tilstand, ...(vedleggSvar.ok || vedleggSvar.feil ? vedleggSvar : {}) }

  return (
    <div className="mt-6 border-t-2 border-[var(--kant)] pt-5">
      <h3 className="mb-1 text-xs font-bold tracking-widest text-[var(--blekk-svak)] uppercase">
        Tripletex
      </h3>

      {status === 'opprettet' ? (
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-hm-green">
            ✓ Ordre {ordrenr ?? ''} er opprettet i Tripletex
            {kundenr ? ` · kundenr. ${kundenr}` : ''}
          </p>
          <VedleggLinje
            vedlegg={vedlegg}
            forlatt={vedleggForlatt}
            leggerVed={leggerVed}
            leggVed={leggVed}
          />
        </div>
      ) : status === 'oppretter' && !ordreForlatt ? (
        <p className="text-sm">Oppretter ordre i Tripletex … Last siden på nytt om litt.</p>
      ) : !oppsatt ? (
        <p className="text-sm text-[var(--blekk-svak)]">
          Ikke satt opp. Legg API-nøkkelen i Vercel som <code>TRIPLETEX_NOKKEL</code>, så kan
          ordren opprettes herfra.
        </p>
      ) : (
        <form action={handling} onSubmit={send} className="space-y-3">
          <p className="text-sm text-[var(--blekk-svak)]">
            Lager en ordre med én linje, «Pris ihht vedlegg», og legger ved PDF-en. Ingenting
            faktureres eller sendes til kunden – det gjør dere i Tripletex.
          </p>

          {kanVaereOpprettet && (
            <p role="alert" className="border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
              <strong>Ordren kan være opprettet.</strong>{' '}
              {lagretFeil ?? 'Forrige forsøk fikk ikke svar fra Tripletex.'} Se etter den i
              Tripletex{kundenr ? ` på kundenr. ${kundenr}` : ''} før du prøver igjen.
            </p>
          )}
          {status === 'feilet' && lagretFeil && !svar.feil && (
            <p className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm text-hm-red-ink">
              {lagretFeil}
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label>
              <span className={ETIKETT}>Tripletex-kundenr.</span>
              <input
                name="kundenr"
                inputMode="numeric"
                required
                defaultValue={kundenr ?? ''}
                className={`${FELT} hm-tall w-40`}
              />
            </label>
            {kanVaereOpprettet ? (
              <button
                type="submit"
                name="bekreftet"
                value="1"
                disabled={venter}
                className={KNAPP_SEKUNDÆR}
              >
                {venter ? 'Oppretter …' : 'Jeg har sjekket – opprett likevel'}
              </button>
            ) : (
              <button type="submit" disabled={venter} className={KNAPP_SEKUNDÆR}>
                {venter ? 'Oppretter …' : 'Opprett ordre i Tripletex'}
              </button>
            )}
          </div>
        </form>
      )}

      {svar.ok && (
        <p role="status" className="mt-3 border-l-4 border-hm-green bg-hm-green/10 p-3 text-sm font-semibold text-hm-green">
          {svar.ok}
        </p>
      )}
      {svar.feil && (
        <p role="alert" className="mt-3 border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink">
          {svar.feil}
        </p>
      )}
      {svar.tripletexTekst && (
        <p className="mt-2 text-xs text-[var(--blekk-svak)]">
          Tripletex svarte: {svar.tripletexTekst}
        </p>
      )}
    </div>
  )
}

function VedleggLinje({
  vedlegg,
  forlatt,
  leggerVed,
  leggVed,
}: {
  vedlegg: TripletexVedlegg | null
  forlatt: boolean
  leggerVed: boolean
  leggVed: (bekreftet: boolean) => void
}) {
  if (vedlegg === 'lagt_ved') return <p>PDF-en er lagt ved, og følger fakturaen når dere lager den.</p>
  if (vedlegg === 'laster_opp' && !forlatt) return <p>Legger ved PDF-en …</p>
  if (vedlegg === 'feilet') {
    return (
      <p className="flex flex-wrap items-center gap-3">
        <span className="text-hm-red-ink">PDF-en er ikke lagt ved.</span>
        <button type="button" disabled={leggerVed} onClick={() => leggVed(false)} className={KNAPP_SEKUNDÆR}>
          {leggerVed ? 'Legger ved …' : 'Legg ved PDF på nytt'}
        </button>
      </p>
    )
  }
  if (vedlegg === 'ukjent' || vedlegg === 'laster_opp') {
    return (
      <p className="flex flex-wrap items-center gap-3">
        <span>PDF-en kan være lagt ved. Se på ordren i Tripletex.</span>
        <button type="button" disabled={leggerVed} onClick={() => leggVed(true)} className={KNAPP_SEKUNDÆR}>
          {leggerVed ? 'Legger ved …' : 'Legg ved likevel …'}
        </button>
      </p>
    )
  }
  return null
}
