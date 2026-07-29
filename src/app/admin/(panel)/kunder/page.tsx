import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { visTelefon } from '@/lib/telefon'
import type { Kunde } from '@/lib/types'
import { KNAPP_LITEN, Merke, Seksjonstittel, TomTilstand } from '@/components/ui'
import { Søkefelt } from '@/components/sokefelt'
import { BekreftKnapp } from '@/components/bekreft-knapp'
import { settKundeStatus } from './actions'
import { KundeNotat } from './kunde-notat'

export const metadata: Metadata = { title: 'Kunder – HM Utleie' }
export const dynamic = 'force-dynamic'

const merkeType = { ny: 'gul', godkjent: 'grønn', sperret: 'rød' } as const
const statusTekst = { ny: 'Ny', godkjent: 'Godkjent', sperret: 'Sperret' }

const FILTRE = [
  { verdi: 'alle', tekst: 'Alle' },
  { verdi: 'aktiv_leie', tekst: 'Har maskin ute' },
  { verdi: 'ny', tekst: 'Nye' },
  { verdi: 'godkjent', tekst: 'Godkjente' },
  { verdi: 'sperret', tekst: 'Sperrede' },
] as const

type Rad = Kunde & { leier: { id: string; status: string }[] }

export default async function KunderSide(props: PageProps<'/admin/kunder'>) {
  await krevAdmin()
  const sp = await props.searchParams
  const valgt = typeof sp.filter === 'string' ? sp.filter : 'alle'
  const søk = typeof sp.q === 'string' ? sp.q.trim() : ''

  const supabase = await lagServerKlient()
  let spørring = supabase
    .from('kunder')
    .select('*, leier(id, status)')
    .order('opprettet', { ascending: false })
    .limit(500)

  if (valgt === 'ny' || valgt === 'godkjent' || valgt === 'sperret') {
    spørring = spørring.eq('status', valgt)
  }

  const { data } = await spørring
  let kunder = (data ?? []) as Rad[]

  if (valgt === 'aktiv_leie') {
    kunder = kunder.filter((k) => k.leier.some((l) => l.status === 'aktiv'))
  }

  if (søk) {
    const n = søk.toLowerCase().replace(/\s/g, '')
    kunder = kunder.filter((k) =>
      [k.navn, k.telefon, k.epost, k.adresse]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().replace(/\s/g, '').includes(n)),
    )
  }

  const lenke = (filter: string) => {
    const p = new URLSearchParams()
    if (filter !== 'alle') p.set('filter', filter)
    if (søk) p.set('q', søk)
    const s = p.toString()
    return s ? `/admin/kunder?${s}` : '/admin/kunder'
  }

  return (
    <div className="space-y-6">
      <Seksjonstittel
        under={
          søk
            ? `${kunder.length} treff på «${søk}»`
            : `${kunder.length} ${kunder.length === 1 ? 'kunde' : 'kunder'} · opprettes automatisk ved første leie`
        }
      >
        Kunder
      </Seksjonstittel>

      <Søkefelt
        verdi={søk}
        plassholder="Søk på navn, telefon, e-post eller adresse"
      />

      <div className="flex flex-wrap gap-2">
        {FILTRE.map((f) => {
          const aktiv = valgt === f.verdi
          return (
            <Link
              key={f.verdi}
              href={lenke(f.verdi)}
              aria-current={aktiv ? 'true' : undefined}
              className={`inline-flex min-h-[2.75rem] items-center border-2 px-4 text-xs font-bold tracking-wider uppercase transition-colors ${
                aktiv
                  ? 'border-[var(--kant-sterk)] bg-hm-black text-white'
                  : 'border-[var(--kant)] bg-[var(--flate-opp)] hover:border-[var(--kant-sterk)]'
              }`}
            >
              {f.tekst}
            </Link>
          )
        })}
      </div>

      {kunder.length === 0 ? (
        <TomTilstand tittel={søk ? 'Ingen treff' : 'Ingen kunder her'}>
          {søk
            ? `Fant ingen kunde som matcher «${søk}».`
            : 'Første kunde dukker opp så snart noen skanner en QR-kode og starter en leie.'}
        </TomTilstand>
      ) : (
        <div className="space-y-4">
          {kunder.map((k) => {
            const aktive = k.leier.filter((l) => l.status === 'aktiv').length
            return (
              <article
                key={k.id}
                className={`border-2 bg-[var(--flate-opp)] p-5 ${
                  k.status === 'sperret' ? 'border-hm-red' : 'border-[var(--kant-sterk)]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="hm-display text-xl">{k.navn}</h2>
                      <Merke type={merkeType[k.status]}>{statusTekst[k.status]}</Merke>
                      {aktive > 0 && (
                        <Merke type="grønn">
                          {aktive} maskin{aktive > 1 ? 'er'  : ''} ute
                        </Merke>
                      )}
                    </div>

                    <p className="hm-tall mt-1.5 text-sm">
                      {visTelefon(k.telefon)}
                      <span className="text-[var(--blekk-svak)]"> · {k.epost}</span>
                    </p>
                    <p className="text-sm text-[var(--blekk-svak)]">{k.adresse}</p>
                    <p className="mt-2 text-xs font-bold tracking-wider text-[var(--blekk-svak)] uppercase">
                      {k.leier.length} leier totalt
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {k.status !== 'godkjent' && (
                      <form action={settKundeStatus.bind(null, k.id, 'godkjent')}>
                        <button className={KNAPP_LITEN}>Godkjenn</button>
                      </form>
                    )}
                    {k.status !== 'sperret' ? (
                      <form action={settKundeStatus.bind(null, k.id, 'sperret')}>
                        <BekreftKnapp etikett="Sperr" bekreft="Bekreft sperring" fare />
                      </form>
                    ) : (
                      <form action={settKundeStatus.bind(null, k.id, 'godkjent')}>
                        <button className={KNAPP_LITEN}>Opphev sperring</button>
                      </form>
                    )}
                    <Link href={`/admin/leier?q=${encodeURIComponent(k.telefon)}`} className={KNAPP_LITEN}>
                      Se leier
                    </Link>
                  </div>
                </div>

                <KundeNotat kundeId={k.id} notat={k.admin_notat} />
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
