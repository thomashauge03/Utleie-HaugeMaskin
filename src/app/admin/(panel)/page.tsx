import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { Seksjonstittel } from '@/components/ui'

export const metadata: Metadata = { title: 'Oversikt – HM Utleie' }
export const dynamic = 'force-dynamic'

export default async function OversiktSide() {
  const admin = await krevAdmin()
  const supabase = await lagServerKlient()
  const nå = new Date().toISOString()

  const antall = { count: 'exact' as const, head: true }

  const [utleid, venter, forfalt, ledige] = await Promise.all([
    supabase.from('leier').select('id', antall).eq('status', 'aktiv'),
    supabase.from('leier').select('id', antall).eq('status', 'venter_godkjenning'),
    supabase.from('leier').select('id', antall).eq('status', 'aktiv').lt('planlagt_slutt', nå),
    supabase.from('maskiner').select('id', antall).eq('aktiv', true).eq('status', 'ledig'),
  ]).then((svar) => svar.map((s) => s.count ?? 0))

  const kort = [
    { tall: utleid, tekst: 'Utleid nå', href: '/admin/leier?status=aktiv', tone: 'nøytral' as const },
    { tall: venter, tekst: 'Venter godkjenning', href: '/admin/leier?status=venter_godkjenning', tone: 'gul' as const },
    { tall: forfalt, tekst: 'Forfalt', href: '/admin/leier?status=aktiv', tone: 'rød' as const },
    { tall: ledige, tekst: 'Ledige maskiner', href: '/admin/maskiner', tone: 'nøytral' as const },
  ]

  return (
    <div className="space-y-8">
      <Seksjonstittel under={`Innlogget som ${admin.navn}`}>
        Oversikt
      </Seksjonstittel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kort.map((k, i) => {
          // Null å gjøre er ikke et varsel. Bare farg kortet når tallet betyr noe.
          const varsler = k.tall > 0 && k.tone !== 'nøytral'

          return (
            <Link
              key={k.tekst}
              href={k.href}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`hm-inn hm-trykk hm-kant-skygge border-2 p-5 ${
                varsler && k.tone === 'rød'
                  ? 'border-[var(--kant-sterk)] bg-hm-red text-white'
                  : varsler
                    ? 'border-[var(--kant-sterk)] bg-hm-amber text-white'
                    : 'border-[var(--kant-sterk)] bg-[var(--flate-opp)]'
              }`}
            >
              <span className="hm-display hm-tall block text-5xl leading-none">
                {k.tall}
              </span>
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

      {venter > 0 && (
        <div className="border-l-4 border-hm-amber bg-[var(--flate-opp)] p-4">
          <p className="hm-display text-lg">
            {venter} innlevering venter på deg
          </p>
          <p className="mt-1 text-sm text-[var(--blekk-svak)]">
            Kunden betaler ikke for ventetiden — klokka stoppet da bildet kom
            inn.
          </p>
        </div>
      )}
    </div>
  )
}
