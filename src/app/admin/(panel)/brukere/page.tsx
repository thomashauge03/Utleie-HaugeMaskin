import type { Metadata } from 'next'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { Seksjonstittel } from '@/components/ui'
import { NyBruker } from './ny-bruker'
import { RedigerBruker, type Bruker } from './rediger-bruker'

export const metadata: Metadata = { title: 'Brukere – HM Utleie' }
export const dynamic = 'force-dynamic'

export default async function BrukereSide() {
  const meg = await krevAdmin()
  const supabase = await lagServerKlient()

  const [{ data }, { data: uteRader }] = await Promise.all([
    supabase.from('admin_brukere').select('*').order('navn'),
    supabase
      .from('leier')
      .select('ansatt_id')
      .eq('status', 'aktiv')
      .not('ansatt_id', 'is', null),
  ])
  const brukere = (data ?? []) as Bruker[]

  const ute = new Map<string, number>()
  for (const r of (uteRader ?? []) as { ansatt_id: string }[]) {
    ute.set(r.ansatt_id, (ute.get(r.ansatt_id) ?? 0) + 1)
  }

  return (
    <div className="space-y-7">
      <Seksjonstittel under="Admin ser alt. Service har verkstedet. Alle kan ta ut utstyr til prosjekter.">
        Brukere
      </Seksjonstittel>

      <NyBruker />

      <div className="divide-y-2 divide-[var(--kant)] border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)]">
        {brukere.map((b) => (
          <RedigerBruker
            key={b.id}
            bruker={b}
            erMeg={b.id === meg.id}
            ute={ute.get(b.id) ?? 0}
          />
        ))}
      </div>

      <p className="text-xs text-[var(--blekk-svak)]">
        Brukere deaktiveres, ikke slettes — da beholder historikken navnet på
        den som godkjente en leie.
      </p>
    </div>
  )
}
