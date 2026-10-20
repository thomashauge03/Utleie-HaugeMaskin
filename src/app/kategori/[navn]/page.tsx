import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Maskin } from '@/lib/types'
import { HMLogo } from '@/components/hm-logo'
import { MaskinListe, erLedig } from '@/components/maskin-liste'
import { TomTilstand } from '@/components/ui'

export const dynamic = 'force-dynamic'

export async function generateMetadata(
  props: PageProps<'/kategori/[navn]'>,
): Promise<Metadata> {
  const { navn } = await props.params
  return { title: `${decodeURIComponent(navn)} – HM Utleie` }
}

/**
 * Felles utleieside for en hel kategori.
 *
 * Skuffer og lignende har ikke QR-kode per enhet – én kode henger på
 * lageret, og kunden velger fra lista. Valget sender videre til den
 * vanlige leieflyten på /m/[qr], så ingenting er duplisert.
 */
export default async function KategoriSide(props: PageProps<'/kategori/[navn]'>) {
  const { navn } = await props.params
  const kategori = decodeURIComponent(navn)

  const { data } = await supabaseAdmin
    .from('maskiner')
    .select('*')
    .eq('kategori', kategori)
    .eq('aktiv', true)
    .order('underkategori', { nullsFirst: false })
    .order('internnummer')
    .order('navn')

  const maskiner = (data ?? []) as Maskin[]
  if (maskiner.length === 0) notFound()

  const ledige = maskiner.filter(erLedig)

  // Grupper på type, slik at Graveskuff og Pusseskuff står hver for seg.
  const grupper = new Map<string, Maskin[]>()
  for (const m of maskiner) {
    const t = m.underkategori?.trim() || ''
    if (!grupper.has(t)) grupper.set(t, [])
    grupper.get(t)!.push(m)
  }

  return (
    <>
      <header className="relative overflow-hidden bg-hm-black px-5 pt-6 pb-8 text-white">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-16 h-[160%] w-40 skew-x-[-18deg] bg-hm-red/90"
        />
        <div className="relative mx-auto max-w-md">
          <HMLogo størrelse="sm" />
          <h1 className="hm-display mt-6 text-3xl">{kategori}</h1>
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
              Velg hvilken du vil leie.
            </p>

            <div className="space-y-6">
              {[...grupper.entries()].map(([type, liste]) => (
                <section key={type || 'utype'}>
                  {type && (
                    <div className="mb-2 flex items-center gap-3">
                      <span className="hm-skrastrek !h-1 !w-5" aria-hidden="true" />
                      <h2 className="hm-display text-lg">{type}</h2>
                    </div>
                  )}

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
