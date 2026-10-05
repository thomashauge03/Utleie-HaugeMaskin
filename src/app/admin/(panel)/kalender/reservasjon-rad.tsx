import { visTelefon } from '@/lib/telefon'
import { kortDag, type Reservasjon } from '@/lib/reservasjon'
import { BekreftKnapp } from '@/components/bekreft-knapp'
import { avlysReservasjon } from './actions'

export type ReservasjonVisning = Reservasjon & {
  notat: string | null
  maskiner?: { navn: string; kategori?: string | null; internnummer?: string | null } | null
}

/**
 * Én reservasjon med datoer, kunde og «Avlys» – i kalenderen og på
 * maskinsida. Stiplet gul kant, som i rutenettet. Avlys krever et ekstra
 * trykk; en avlyst reservasjon må legges inn på nytt.
 */
export function ReservasjonRad({ r, visMaskin }: { r: ReservasjonVisning; visMaskin: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-3 border-2 border-dashed border-hm-amber bg-[var(--flate-opp)] p-4">
      <span className="hm-display hm-tall shrink-0 text-base whitespace-nowrap">
        {kortDag(r.fra_dato)} → {kortDag(r.til_dato)}
      </span>
      {/* På mobil får teksten egen linje under datoer og knapp. Med
          flex-1 alene krympet den i stedet for å bryte – og med
          «Ja, avlys» åpen ble den rundt 100 px bred. */}
      <span className="order-last min-w-0 basis-full sm:order-none sm:basis-0 sm:flex-1">
        {visMaskin && (
          <span className="hm-display block truncate text-lg">
            {r.maskiner?.navn ?? 'Ukjent maskin'}
          </span>
        )}
        <span className="block text-sm">
          <span className="font-semibold">{r.kunde_navn}</span> · {visTelefon(r.kunde_telefon)}
          {r.notat && <span className="text-[var(--blekk-svak)]"> · {r.notat}</span>}
        </span>
      </span>
      <form action={avlysReservasjon.bind(null, r.id)} className="ml-auto">
        <BekreftKnapp etikett="Avlys" bekreft="Ja, avlys" fare />
      </form>
    </li>
  )
}
