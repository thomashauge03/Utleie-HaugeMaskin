import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { vegvesenErSattOpp } from '@/lib/vegvesen'
import { fristerFor } from '@/lib/frister'
import { dagerTil, dato } from '@/lib/dato'
import {
  KJØRETØY_MERKE,
  KJØRETØY_STATUS_TEKST,
  type Kjøretøy,
  type KjøretøyStatus,
} from '@/lib/types'
import { Merke, Seksjonstittel, TomTilstand } from '@/components/ui'
import { Søkefelt } from '@/components/sokefelt'
import { NyttKjøretøy } from './nytt-kjoretoy'

export const metadata: Metadata = { title: 'Kjøretøy – HM Utleie' }
export const dynamic = 'force-dynamic'

const FILTRE = [
  { verdi: 'alle', tekst: 'Alle' },
  { verdi: 'frist', tekst: 'Frist snart' },
  { verdi: 'i_drift', tekst: 'I drift' },
  { verdi: 'avskiltet', tekst: 'Avskiltet' },
  { verdi: 'solgt', tekst: 'Solgt' },
] as const

export default async function KjøretøySide(props: PageProps<'/admin/kjoretoy'>) {
  await krevAdmin()

  const sp = await props.searchParams
  const søk = typeof sp.q === 'string' ? sp.q.trim() : ''
  const filter = typeof sp.status === 'string' ? sp.status : 'alle'

  const supabase = await lagServerKlient()
  const { data, error } = await supabase
    .from('kjoretoy')
    .select('*')
    .order('eu_frist', { ascending: true, nullsFirst: false })
    .limit(500)

  const alle = (data ?? []) as Kjøretøy[]

  const normalisert = søk.toLowerCase().replace(/\s/g, '')
  const treff = alle.filter((k) => {
    if (filter === 'frist') {
      if (k.status !== 'i_drift') return false
      if (!fristerFor(k).some((f) => f.dager <= 30)) return false
    } else if (filter !== 'alle' && k.status !== filter) {
      return false
    }

    if (!normalisert) return true
    return [k.reg_nr, k.internt_navn, k.merke, k.modell, k.ansvarlig_navn]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().replace(/\s/g, '').includes(normalisert))
  })

  const lenke = (verdi: string) => {
    const p = new URLSearchParams()
    if (søk) p.set('q', søk)
    if (verdi !== 'alle') p.set('status', verdi)
    const s = p.toString()
    return s ? `/admin/kjoretoy?${s}` : '/admin/kjoretoy'
  }

  return (
    <div className="space-y-6">
      <Seksjonstittel under="Egne kjøretøy, med EU-kontroll og andre frister.">
        Kjøretøy
      </Seksjonstittel>

      <NyttKjøretøy vegvesen={vegvesenErSattOpp()} />

      {error && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          Kunne ikke hente kjøretøyene: {error.message}
        </p>
      )}

      <div className="space-y-3">
        <Søkefelt verdi={søk} plassholder="Søk på skilt, navn, merke eller ansvarlig …" />
        <ul className="flex flex-wrap gap-2">
          {FILTRE.map((f) => {
            const aktiv = filter === f.verdi
            return (
              <li key={f.verdi}>
                <Link
                  href={lenke(f.verdi)}
                  aria-current={aktiv ? 'true' : undefined}
                  className={`inline-flex min-h-[2.25rem] items-center border-2 px-3 text-xs font-bold tracking-wider uppercase transition-colors ${
                    aktiv
                      ? 'border-[var(--kant-sterk)] bg-hm-black text-white'
                      : 'border-[var(--kant)] hover:border-[var(--kant-sterk)]'
                  }`}
                >
                  {f.tekst}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {treff.length === 0 ? (
        <TomTilstand tittel="Ingen kjøretøy">
          {søk
            ? `Fant ingen kjøretøy som matcher «${søk}».`
            : 'Legg inn det første kjøretøyet, så holder systemet styr på fristene.'}
        </TomTilstand>
      ) : (
        <ul className="divide-y-2 divide-[var(--kant)] border-2 border-[var(--kant)]">
          {treff.map((k) => (
            <li key={k.id}>
              <Link
                href={`/admin/kjoretoy/${k.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-[var(--flate-2)]"
              >
                <span className="hm-tall shrink-0 border-2 border-[var(--kant-sterk)] px-2 py-0.5 text-sm font-bold tracking-wider">
                  {k.reg_nr}
                </span>
                <span className="hm-display min-w-0 flex-1 truncate text-base">
                  {k.internt_navn || [k.merke, k.modell].filter(Boolean).join(' ') || '–'}
                </span>
                <EuFrist frist={k.eu_frist} />
                <Merke type={KJØRETØY_MERKE[k.status as KjøretøyStatus] ?? 'nøytral'}>
                  {KJØRETØY_STATUS_TEKST[k.status as KjøretøyStatus] ?? k.status}
                </Merke>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-[var(--blekk-svak)]">
        Kjøretøyopplysninger fra Statens vegvesen · CC BY 4.0
      </p>
    </div>
  )
}

/**
 * Fristen er det eneste tallet i lista folk faktisk leser, så den får
 * farge og ord – aldri farge alene, som ellers i appen.
 */
function EuFrist({ frist }: { frist: string | null }) {
  if (!frist) {
    return <span className="text-xs text-[var(--blekk-svak)]">EU-frist ukjent</span>
  }

  const dager = dagerTil(frist)
  const stil =
    dager < 0
      ? 'text-hm-red-ink font-bold'
      : dager <= 30
        ? 'text-hm-amber font-bold'
        : 'text-[var(--blekk-svak)]'

  return (
    <span className={`hm-tall text-xs ${stil}`}>
      EU {dato(frist)}
      {dager < 0 ? ` · forfalt for ${Math.abs(dager)} d siden` : dager <= 30 ? ` · om ${dager} d` : ''}
    </span>
  )
}
