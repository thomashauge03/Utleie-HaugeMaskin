import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { visTelefon } from '@/lib/telefon'
import { dato, dagerTil, tidKort } from '@/lib/dato'
import type { Kunde, Leie, Maskin } from '@/lib/types'
import { Kort, KortTittel, Merke, Seksjonstittel } from '@/components/ui'

export const metadata: Metadata = { title: 'Oversikt – HM Utleie' }
export const dynamic = 'force-dynamic'

type Rad = Leie & { maskiner: Maskin | null; kunder: Kunde | null }

export default async function OversiktSide() {
  const admin = await krevAdmin()
  const supabase = await lagServerKlient()
  const nå = new Date().toISOString()

  const [{ data: aktiveData }, { data: venterData }, { data: ufakturertData }, ledige, { data: hendelser }] =
    await Promise.all([
      supabase
        .from('leier')
        .select('*, maskiner(*), kunder(*)')
        .eq('status', 'aktiv')
        .order('planlagt_slutt'),
      supabase
        .from('leier')
        .select('*, maskiner(*), kunder(*)')
        .eq('status', 'venter_godkjenning')
        .order('slutt_tid'),
      supabase
        .from('leier')
        .select('*, maskiner(*), kunder(*)')
        .eq('status', 'avsluttet')
        .eq('fakturert', false)
        .order('godkjent_tid', { ascending: false })
        .limit(6),
      supabase
        .from('maskiner')
        .select('id', { count: 'exact', head: true })
        .eq('aktiv', true)
        .eq('status', 'ledig'),
      supabase.from('hendelser').select('*').order('tid', { ascending: false }).limit(8),
    ])

  const aktive = (aktiveData ?? []) as Rad[]
  const venter = (venterData ?? []) as Rad[]
  const ufakturert = (ufakturertData ?? []) as Rad[]
  const forfalt = aktive.filter((l) => l.planlagt_slutt < nå)

  const kort = [
    { tall: aktive.length, tekst: 'Utleid nå', href: '/admin/leier?status=aktiv', tone: 'nøytral' },
    { tall: venter.length, tekst: 'Venter godkjenning', href: '/admin/leier?status=venter_godkjenning', tone: 'gul' },
    { tall: forfalt.length, tekst: 'Forfalt', href: '/admin/leier?status=forfalt', tone: 'rød' },
    { tall: ledige.count ?? 0, tekst: 'Ledige maskiner', href: '/admin/maskiner', tone: 'nøytral' },
  ] as const

  return (
    <div className="space-y-8">
      <Seksjonstittel under={`Innlogget som ${admin.navn}`}>Oversikt</Seksjonstittel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kort.map((k, i) => {
          const varsler = k.tall > 0 && k.tone !== 'nøytral'
          return (
            <Link
              key={k.tekst}
              href={k.href}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`hm-inn hm-trykk hm-kant-skygge border-2 border-[var(--kant-sterk)] p-5 ${
                varsler && k.tone === 'rød'
                  ? 'bg-hm-red text-white'
                  : varsler
                    ? 'bg-hm-amber text-white'
                    : 'bg-[var(--flate-opp)]'
              }`}
            >
              <span className="hm-display hm-tall block text-5xl leading-none">{k.tall}</span>
              <span
                className={`mt-2 block text-xs font-bold tracking-widest uppercase ${
                  varsler ? 'text-white/80' : 'text-[var(--blekk-svak)]'
                }`}
              >
                {k.tekst}
              </span>
            </Link>
          )
        })}
      </div>

      {/* ── Krever handling ───────────────────────────────── */}
      {venter.length > 0 && (
        <Kort className="!border-hm-amber">
          <h2 className="hm-display bg-hm-amber px-5 py-3 text-lg text-white">
            Venter på deg · {venter.length}
          </h2>
          <ul className="divide-y-2 divide-[var(--kant)]">
            {venter.map((l) => (
              <li key={l.id}>
                <Link href={`/admin/leier/${l.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition-colors hover:bg-[var(--flate-2)]">
                  <span className="hm-display min-w-0 flex-1 truncate text-base">
                    {l.maskiner?.navn ?? 'Ukjent maskin'}
                  </span>
                  <span className="text-sm text-[var(--blekk-svak)]">
                    {l.kunder?.navn ?? '–'}
                  </span>
                  <span className="hm-tall text-xs text-[var(--blekk-svak)]">
                    Levert {l.slutt_tid ? tidKort(l.slutt_tid) : '–'}
                  </span>
                  <span className="text-xs font-bold tracking-wider text-hm-amber uppercase">
                    Godkjenn →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Kort>
      )}

      {forfalt.length > 0 && (
        <Kort className="!border-hm-red">
          <h2 className="hm-display bg-hm-red px-5 py-3 text-lg text-white">
            Forfalt · {forfalt.length}
          </h2>
          <ul className="divide-y-2 divide-[var(--kant)]">
            {forfalt.map((l) => (
              <li key={l.id}>
                <Link href={`/admin/leier/${l.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition-colors hover:bg-[var(--flate-2)]">
                  <span className="hm-display min-w-0 flex-1 truncate text-base">
                    {l.maskiner?.navn ?? 'Ukjent maskin'}
                  </span>
                  <span className="text-sm">
                    {l.kunder?.navn ?? '–'}
                    {l.kunder && (
                      <span className="hm-tall text-[var(--blekk-svak)]">
                        {' · '}
                        {visTelefon(l.kunder.telefon)}
                      </span>
                    )}
                  </span>
                  <Merke type="rød">
                    {Math.abs(dagerTil(l.planlagt_slutt))} dager på overtid
                  </Merke>
                </Link>
              </li>
            ))}
          </ul>
        </Kort>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Ute nå ──────────────────────────────────────── */}
        <Kort>
          <KortTittel>Ute nå</KortTittel>
          {aktive.length === 0 ? (
            <p className="p-5 text-sm text-[var(--blekk-svak)]">
              Ingen maskiner er ute akkurat nå.
            </p>
          ) : (
            <ul className="divide-y-2 divide-[var(--kant)]">
              {aktive.slice(0, 8).map((l) => {
                const dager = dagerTil(l.planlagt_slutt)
                return (
                  <li key={l.id}>
                    <Link href={`/admin/leier/${l.id}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-[var(--flate-2)]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {l.maskiner?.navn ?? 'Ukjent'}
                        </span>
                        <span className="block truncate text-sm text-[var(--blekk-svak)]">
                          {l.kunder?.navn ?? '–'}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="hm-tall block text-sm font-semibold">
                          {dato(l.planlagt_slutt)}
                        </span>
                        <span
                          className={`block text-xs font-bold tracking-wider uppercase ${
                            dager < 0
                              ? 'text-hm-red'
                              : dager <= 1
                                ? 'text-hm-amber'
                                : 'text-[var(--blekk-svak)]'
                          }`}
                        >
                          {dager < 0
                            ? `${Math.abs(dager)} d på overtid`
                            : dager === 0
                              ? 'I dag'
                              : dager === 1
                                ? 'I morgen'
                                : `om ${dager} dager`}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {aktive.length > 8 && (
            <Link
              href="/admin/leier?status=aktiv"
              className="block border-t-2 border-[var(--kant)] p-3 text-center text-xs font-bold tracking-wider uppercase underline underline-offset-4"
            >
              Se alle {aktive.length}
            </Link>
          )}
        </Kort>

        {/* ── Klar til fakturering ────────────────────────── */}
        <Kort>
          <KortTittel>Klar til fakturering</KortTittel>
          {ufakturert.length === 0 ? (
            <p className="p-5 text-sm text-[var(--blekk-svak)]">
              Ingenting venter på fakturering.
            </p>
          ) : (
            <ul className="divide-y-2 divide-[var(--kant)]">
              {ufakturert.map((l) => (
                <li key={l.id}>
                  <Link href={`/admin/leier/${l.id}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-[var(--flate-2)]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {l.kunder?.navn ?? '–'}
                      </span>
                      <span className="block truncate text-sm text-[var(--blekk-svak)]">
                        {l.maskiner?.navn ?? 'Ukjent'} · {l.antall_dogn ?? '–'} døgn
                      </span>
                    </span>
                    <span className="hm-display hm-tall shrink-0 text-lg">
                      {l.belop !== null ? `${l.belop.toLocaleString('nb-NO')} kr` : '–'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/leier?status=ufakturert"
            className="block border-t-2 border-[var(--kant)] p-3 text-center text-xs font-bold tracking-wider uppercase underline underline-offset-4"
          >
            Se alle ufakturerte
          </Link>
        </Kort>
      </div>

      {/* ── Siste hendelser ───────────────────────────────── */}
      {hendelser && hendelser.length > 0 && (
        <Kort>
          <KortTittel>Siste hendelser</KortTittel>
          <ol className="p-5">
            {hendelser.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap gap-x-4 gap-y-0.5 border-l-2 border-[var(--kant)] py-2 pl-4 text-sm"
              >
                <span className="hm-tall shrink-0 text-[var(--blekk-svak)]">
                  {tidKort(h.tid)}
                </span>
                <span className="font-semibold">{h.beskrivelse || h.type}</span>
              </li>
            ))}
          </ol>
        </Kort>
      )}
    </div>
  )
}
