import type { Metadata } from 'next'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Maskin } from '@/lib/types'
import { HMLogo } from '@/components/hm-logo'
import { MaskinListe, erLedig } from '@/components/maskin-liste'
import { TomTilstand } from '@/components/ui'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Lei uten QR-kode – HM Utleie' }

/**
 * For kunder som ikke står ved maskinen. De velger fra lista og havner i
 * samme leieflyt som QR-koden sender til.
 */
export default async function MaskinerSide() {
  const { data, error } = await supabaseAdmin
    .from('maskiner')
    .select('*')
    .eq('aktiv', true)
    .order('kategori', { nullsFirst: false })
    .order('underkategori', { nullsFirst: false })
    .order('internnummer')
    .order('navn')

  // En feil skal ikke se ut som «ingen maskiner».
  if (error) throw new Error(`Kunne ikke hente maskinene: ${error.message}`)

  const maskiner = (data ?? []) as Maskin[]
  const ledige = maskiner.filter(erLedig)

  const grupper = new Map<string, Maskin[]>()
  for (const m of maskiner) {
    const k = m.kategori?.trim() || 'Annet'
    if (!grupper.has(k)) grupper.set(k, [])
    grupper.get(k)!.push(m)
  }

  return (
    <>
      <header className="relative overflow-hidden bg-hm-black px-5 pt-6 pb-8 text-white">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-16 h-[160%] w-40 skew-x-[-18deg] bg-hm-red/90"
        />
        <div className="relative mx-auto max-w-md">
          <Link href="/" aria-label="Til forsiden">
            <HMLogo størrelse="sm" />
          </Link>
          <h1 className="hm-display mt-6 text-3xl">Velg maskin</h1>
          <p className="mt-1 text-sm text-white/70">
            {ledige.length} av {maskiner.length} ledig nå
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-7">
        {ledige.length === 0 ? (
          <TomTilstand tittel="Alt er utleid nå">
            Ta kontakt med utleier for å høre når noe blir ledig.
          </TomTilstand>
        ) : (
          <>
            <p className="mb-5 text-sm text-[var(--blekk-svak)]">
              Trykk på maskinen du vil leie. Står du ved den, kan du like gjerne
              skanne QR-koden.
            </p>

            <div className="space-y-6">
              {[...grupper.entries()].map(([kategori, liste]) => (
                <section key={kategori}>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="hm-skrastrek !h-1 !w-5" aria-hidden="true" />
                    <h2 className="hm-display text-lg">{kategori}</h2>
                  </div>
                  <MaskinListe maskiner={liste} />
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  )
}
