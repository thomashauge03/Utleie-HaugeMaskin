import type { Metadata } from 'next'
import Link from 'next/link'
import { krevInnlogget } from '@/lib/auth'
import { HMLogo } from '@/components/hm-logo'
import { ByttPassordSkjema } from './skjema'

export const metadata: Metadata = { title: 'Bytt passord – HM Utleie' }
export const dynamic = 'force-dynamic'

/**
 * Ligger utenfor (panel)-rutegruppa med vilje.
 *
 * Adminlayouten kaller krevAdmin, som sender brukere med midlertidig
 * passord hit – lå siden inni, ville den sendt dem til seg selv i en
 * evig omdirigering.
 */
export default async function ByttPassordSide() {
  const bruker = await krevInnlogget()
  const påkrevd = bruker.maByttePassord

  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-hm-black px-5 py-12">
      <div
        aria-hidden="true"
        className="absolute -top-40 -right-40 h-[150%] w-96 skew-x-[-18deg] bg-hm-red/90"
      />

      <div className="relative w-full max-w-sm">
        <HMLogo størrelse="lg" />
        <h1 className="hm-display mt-6 text-3xl text-white">
          {påkrevd ? 'Sett ditt eget passord' : 'Bytt passord'}
        </h1>
        <p className="mt-1 mb-8 text-sm text-white/70">
          {påkrevd
            ? 'Du logget inn med et midlertidig passord. Velg ditt eget før du går videre — da er det ingen andre som kjenner det.'
            : `Innlogget som ${bruker.epost}`}
        </p>

        <div className="border-2 border-white bg-white p-6">
          <ByttPassordSkjema />
        </div>

        {!påkrevd && (
          <Link
            href={bruker.rolle === 'service' ? '/verksted' : '/admin'}
            className="mt-5 inline-flex min-h-[2.75rem] items-center text-sm font-semibold text-white/70 underline underline-offset-4 hover:text-white"
          >
            ← Tilbake uten å endre
          </Link>
        )}
      </div>
    </main>
  )
}
