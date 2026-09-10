import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { vegvesenErSattOpp } from '@/lib/vegvesen'
import { fristerFor } from '@/lib/frister'
import { dato, tid } from '@/lib/dato'
import {
  KJØRETØY_MERKE,
  KJØRETØY_STATUS_TEKST,
  type Kjøretøy,
  type KjøretøyStatus,
} from '@/lib/types'
import { Kort, KortTittel, Merke, Seksjonstittel } from '@/components/ui'
import { BekreftKnapp } from '@/components/bekreft-knapp'
import { RedigerSkjema } from './rediger-skjema'
import { OppdaterFraVegvesen } from './oppdater-fra-vegvesen'
import { slettKjøretøy } from './actions'

export const metadata: Metadata = { title: 'Kjøretøy – HM Utleie' }
export const dynamic = 'force-dynamic'

export default async function KjøretøyDetaljSide(
  props: PageProps<'/admin/kjoretoy/[id]'>,
) {
  await krevAdmin()
  const { id } = await props.params

  const supabase = await lagServerKlient()
  const { data } = await supabase.from('kjoretoy').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()

  const k = data as Kjøretøy
  const frister = fristerFor(k)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Seksjonstittel
          under={[k.merke, k.modell, k.arsmodell].filter(Boolean).join(' · ') || 'Ingen tekniske data'}
        >
          {k.internt_navn ?? k.reg_nr}
        </Seksjonstittel>
        <Merke type={KJØRETØY_MERKE[k.status as KjøretøyStatus] ?? 'nøytral'}>
          {KJØRETØY_STATUS_TEKST[k.status as KjøretøyStatus] ?? k.status}
        </Merke>
      </div>

      <Link href="/admin/kjoretoy" className="inline-block text-sm font-semibold underline">
        ← Alle kjøretøy
      </Link>

      <Kort>
        <KortTittel>Registreringsnummer</KortTittel>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="hm-tall border-2 border-[var(--kant-sterk)] px-3 py-1 text-lg font-bold tracking-widest">
            {k.reg_nr}
          </span>
          {k.reg_status && (
            <span className="text-sm text-[var(--blekk-svak)]">
              Vegvesen: {k.reg_status}
            </span>
          )}
        </div>
      </Kort>

      <Kort>
        <KortTittel>Frister</KortTittel>
        {frister.length === 0 ? (
          <p className="p-5 text-sm text-[var(--blekk-svak)]">
            Ingen frister er lagt inn ennå.
          </p>
        ) : (
          <ul className="divide-y-2 divide-[var(--kant)]">
            {frister.map((f) => (
              <li key={f.type} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                <span className="hm-display min-w-0 flex-1 text-base">{f.tekst}</span>
                <span className="hm-tall text-sm">{dato(f.dato)}</span>
                <span
                  className={`text-xs font-bold tracking-wider uppercase ${
                    f.dager < 0
                      ? 'text-hm-red-ink'
                      : f.dager <= 30
                        ? 'text-hm-amber'
                        : 'text-[var(--blekk-svak)]'
                  }`}
                >
                  {f.dager < 0
                    ? `Forfalt for ${Math.abs(f.dager)} dager siden`
                    : f.dager === 0
                      ? 'I dag'
                      : `Om ${f.dager} dager`}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* ── Kilde ─────────────────────────────────────────
            Sagt eksplisitt, fordi et tall man ikke vet hvor kommer
            fra, ikke er verdt noe når fristen nærmer seg. */}
        <div className="flex flex-wrap items-center gap-3 border-t-2 border-[var(--kant)] p-5">
          <span className="text-xs text-[var(--blekk-svak)]">
            {k.svv_hentet
              ? `Hentet fra Vegvesen ${tid(k.svv_hentet)}`
              : 'Lagt inn manuelt · aldri bekreftet mot Vegvesen'}
          </span>
          {vegvesenErSattOpp() && <OppdaterFraVegvesen id={k.id} />}
        </div>
      </Kort>

      <Kort>
        <KortTittel>Rediger</KortTittel>
        <RedigerSkjema kjøretøy={k} />
      </Kort>

      <Kort className="!border-hm-red">
        <KortTittel>Slett</KortTittel>
        <div className="space-y-3 p-5">
          <p className="text-sm text-[var(--blekk-svak)]">
            Er kjøretøyet solgt eller avskiltet, sett heller status – da beholder
            du historikken uten at det maser om frister.
          </p>
          <form action={slettKjøretøy.bind(null, k.id)}>
            <BekreftKnapp
              etikett="Slett kjøretøyet"
              bekreft={`Slett ${k.reg_nr}`}
              fare
            />
          </form>
        </div>
      </Kort>
    </div>
  )
}
