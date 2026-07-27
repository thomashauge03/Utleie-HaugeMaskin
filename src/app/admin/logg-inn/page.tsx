import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { hentAdmin } from '@/lib/auth'
import { LoggInnSkjema } from './skjema'

export const metadata: Metadata = { title: 'Logg inn – Utleie' }

// Innloggingsstatus avhenger av cookies og må aldri forhåndsrendres.
export const dynamic = 'force-dynamic'

export default async function LoggInnSide() {
  if (await hentAdmin()) redirect('/admin')

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Utleie</h1>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          Innlogging for administratorer
        </p>
        <LoggInnSkjema />
      </div>
    </main>
  )
}
