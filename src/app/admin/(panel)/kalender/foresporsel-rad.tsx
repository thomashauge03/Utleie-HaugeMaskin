import { visTelefon } from '@/lib/telefon'
import { kortDag } from '@/lib/reservasjon'
import { BekreftKnapp } from '@/components/bekreft-knapp'
import { avslaForesporsel } from './actions'
import { GodkjennKnapp } from './godkjenn-knapp'
import type { ReservasjonVisning } from './reservasjon-rad'

export type ForesporselVisning = ReservasjonVisning & { kunde_epost: string | null }

/**
 * Én forespørsel fra haugemaskin.no: datoer, maskin, kunde med mobil å
 * ringe, valgfri e-post og melding, og «Godkjenn» / «Avslå». Grå stiplet
 * kant – den sperrer ingenting før den er godkjent.
 */
export function ForesporselRad({ r }: { r: ForesporselVisning }) {
  return (
    <li className="flex flex-wrap items-start gap-x-5 gap-y-3 border-2 border-dashed border-[var(--blekk-svak)] bg-[var(--flate-opp)] p-4">
      <span className="hm-display hm-tall shrink-0 text-base whitespace-nowrap">
        {kortDag(r.fra_dato)} → {kortDag(r.til_dato)}
      </span>

      {/* Som reservasjonsraden: på mobil egen linje under datoer og knapper. */}
      <span className="order-last min-w-0 basis-full sm:order-none sm:basis-0 sm:flex-1">
        <span className="hm-display block truncate text-lg">
          {r.maskiner?.navn ?? 'Ukjent maskin'}
        </span>
        <span className="block text-sm">
          <span className="font-semibold">{r.kunde_navn}</span> ·{' '}
          <a href={`tel:+47${r.kunde_telefon}`} className="underline underline-offset-4">
            {visTelefon(r.kunde_telefon)}
          </a>
          {r.kunde_epost && (
            <>
              {' · '}
              <a href={`mailto:${r.kunde_epost}`} className="underline underline-offset-4">
                {r.kunde_epost}
              </a>
            </>
          )}
        </span>
        {r.notat && (
          <span className="mt-1 block text-sm text-[var(--blekk-svak)]">«{r.notat}»</span>
        )}
      </span>

      <span className="ml-auto flex items-start gap-2">
        <GodkjennKnapp id={r.id} />
        <form action={avslaForesporsel.bind(null, r.id)}>
          <BekreftKnapp etikett="Avslå" bekreft="Ja, avslå" fare />
        </form>
      </span>
    </li>
  )
}
