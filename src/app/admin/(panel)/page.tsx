import type { Metadata } from 'next'
import Link from 'next/link'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Oversikt – Utleie' }
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
    { tall: utleid, tekst: 'Utleid nå', href: '/admin/leier', vekt: false },
    { tall: venter, tekst: 'Venter godkjenning', href: '/admin/leier', vekt: venter > 0 },
    { tall: forfalt, tekst: 'Forfalt', href: '/admin/leier', vekt: forfalt > 0 },
    { tall: ledige, tekst: 'Ledige maskiner', href: '/admin/maskiner', vekt: false },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hei, {admin.navn.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Oversikt over utleie akkurat nå.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kort.map((k) => (
          <Link
            key={k.tekst}
            href={k.href}
            className={`rounded-xl border p-5 transition hover:shadow-sm ${
              k.vekt
                ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <div className="text-3xl font-semibold tabular-nums">{k.tall}</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{k.tekst}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
