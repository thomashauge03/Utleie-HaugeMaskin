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

  const { data } = await supabase.from('admin_brukere').select('*').order('navn')
  const brukere = (data ?? []) as Bruker[]

  return (
    <div className="space-y-7">
      <Seksjonstittel under="Admin ser alt. Servicearbeidere ser kun verkstedet.">
        Brukere
      </Seksjonstittel>

      <NyBruker />

      <div className="divide-y-2 divide-[var(--kant)] border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)]">
        {brukere.map((b) => (
          <RedigerBruker key={b.id} bruker={b} erMeg={b.id === meg.id} />
        ))}
      </div>

      <p className="text-xs text-[var(--blekk-svak)]">
        Brukere deaktiveres, ikke slettes — da beholder historikken navnet på
        den som godkjente en leie.
      </p>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-[11px] font-bold tracking-widest uppercase">
      {children}
    </th>
  )
}
