import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { hentAdmin } from '@/lib/auth'
import { HMLogo } from '@/components/hm-logo'
import { LoggInnSkjema } from './skjema'

export const metadata: Metadata = { title: 'Logg inn – HM Utleie' }
export const dynamic = 'force-dynamic'

export default async function LoggInnSide() {
  if (await hentAdmin()) redirect('/admin')

  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-hm-black px-5 py-12">
      <div
        aria-hidden="true"
        className="absolute -top-40 -right-40 h-[150%] w-96 skew-x-[-18deg] bg-hm-red/90"
      />
      <div
        aria-hidden="true"
        className="absolute -top-40 right-[22rem] h-[150%] w-10 skew-x-[-18deg] bg-white/10"
      />

      <div className="relative w-full max-w-sm">
        <HMLogo størrelse="lg" />
        <h1 className="hm-display mt-6 text-3xl text-white">Adminpanel</h1>
        <p className="mt-1 mb-8 text-sm text-white/60">
          Innlogging for ansatte hos Hauge Maskin
        </p>

        <div className="border-2 border-white bg-white p-6">
          <LoggInnSkjema />
        </div>
      </div>
    </main>
  )
}
