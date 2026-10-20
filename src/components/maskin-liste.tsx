import Link from 'next/link'
import { krPer, prisEnhet } from '@/lib/pris'
import { kanLeiesUt } from '@/lib/verksted'
import type { Maskin } from '@/lib/types'
import { Merke } from '@/components/ui'

// Utstyr som venter på sveising eller deler er ikke ledig, uansett
// hva utleiestatusen sier.
export const erLedig = (m: Maskin) => m.status === 'ledig' && kanLeiesUt(m.verksted_status)

/**
 * Maskinene i en liste der kunden velger selv. Ledige går videre til den
 * vanlige leieflyten på /m/[qr], så ingenting er duplisert. Med `kunde`
 * får /m/[qr] kundeskjemaet også når enheten er logget inn som ansatt.
 */
export function MaskinListe({ maskiner, kunde = false }: { maskiner: Maskin[]; kunde?: boolean }) {
  return (
    <ul className="space-y-3">
      {maskiner.map((m) => {
        const ledig = erLedig(m)
        return (
          <li key={m.id}>
            {ledig ? (
              <Link
                href={kunde ? `/m/${m.qr_kode}?kunde` : `/m/${m.qr_kode}`}
                className="hm-trykk hm-kant-skygge-sm block border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] p-4"
              >
                <Rad maskin={m} ledig />
              </Link>
            ) : (
              /* Utleide vises, men er ikke klikkbare – ellers
                 virker lista tom uten forklaring. */
              <div className="border-2 border-[var(--kant)] bg-[var(--flate-2)] p-4 opacity-60">
                <Rad
                  maskin={m}
                  ledig={false}
                  grunn={!kanLeiesUt(m.verksted_status) ? 'Til reparasjon' : 'Utleid'}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Rad({
  maskin,
  ledig,
  grunn,
}: {
  maskin: Maskin
  ledig: boolean
  grunn?: string
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="hm-display block text-base">{maskin.navn}</span>
        {maskin.internnummer && (
          <span className="mt-0.5 block text-sm text-[var(--blekk-svak)]">
            {maskin.internnummer}
          </span>
        )}
        {maskin.vis_pris && maskin.dogn_pris !== null && (
          <span className="mt-1 block text-sm font-semibold">
            {maskin.dogn_pris.toLocaleString('nb-NO')}{' '}
            <span className="font-normal text-[var(--blekk-svak)]">
              {krPer(prisEnhet(maskin.pris_enhet))}
            </span>
          </span>
        )}
      </div>
      <Merke type={ledig ? 'grønn' : grunn === 'Til reparasjon' ? 'rød' : 'gul'}>
        {ledig ? 'Ledig' : (grunn ?? 'Utleid')}
      </Merke>
    </div>
  )
}
