import type { Metadata } from 'next'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { Kort, KortTittel, Seksjonstittel } from '@/components/ui'
import { KopierLenke } from '../maskiner/kopier-lenke'
import { FirmaSkjema, type Innstillinger } from './firma-skjema'
import { Kategorier, type Kategori } from './kategorier'
import { nyttIcalToken } from './actions'

export const metadata: Metadata = { title: 'Innstillinger – HM Utleie' }
export const dynamic = 'force-dynamic'

export default async function InnstillingerSide() {
  await krevAdmin()
  const supabase = await lagServerKlient()

  const [{ data: innst }, { data: kategoriRader }, { data: maskiner }] =
    await Promise.all([
      supabase.from('innstillinger').select('*').maybeSingle(),
      supabase.from('kategorier').select('id, navn').order('navn'),
      supabase.from('maskiner').select('kategori').eq('aktiv', true),
    ])

  // Tell maskiner per kategori, så admin ser konsekvensen av å slette.
  const antall = new Map<string, number>()
  for (const m of maskiner ?? []) {
    if (m.kategori) antall.set(m.kategori, (antall.get(m.kategori) ?? 0) + 1)
  }

  const kategorier: Kategori[] = (kategoriRader ?? []).map((k) => ({
    id: k.id,
    navn: k.navn,
    antallMaskiner: antall.get(k.navn) ?? 0,
  }))

  const icalUrl = innst?.ical_token
    ? `${env.NEXT_PUBLIC_SITE_URL}/api/ical/${innst.ical_token}.ics`
    : null

  return (
    <div className="space-y-8">
      <Seksjonstittel under="Det du endrer her slår ut i hele systemet">
        Innstillinger
      </Seksjonstittel>

      <Kort>
        <KortTittel>Varetyper</KortTittel>
        <Kategorier kategorier={kategorier} />
      </Kort>

      <Kort>
        <KortTittel>Firma</KortTittel>
        <FirmaSkjema
          innstillinger={{
            firmanavn: innst?.firmanavn ?? '',
            varsel_epost: innst?.varsel_epost ?? null,
            vis_pris_standard: innst?.vis_pris_standard ?? true,
            vilkar_tekst: innst?.vilkar_tekst ?? '',
          }}
        />
      </Kort>

      <Kort>
        <KortTittel>Kalenderabonnement</KortTittel>
        <div className="p-5">
          <p className="mb-4 text-sm text-[var(--blekk-svak)]">
            Lenken lar Google Kalender, Outlook eller Apple Kalender hente inn
            alle utleier. Den inneholder kundenavn og telefonnummer — del den
            kun internt.
          </p>

          {icalUrl && (
            <div className="flex flex-wrap items-center gap-3">
              <code className="border-2 border-[var(--kant)] bg-[var(--flate-2)] px-2 py-1 font-mono text-xs break-all">
                {icalUrl}
              </code>
              <KopierLenke url={icalUrl} etikett="Kopier" />
            </div>
          )}

          <form action={nyttIcalToken} className="mt-5 border-t-2 border-[var(--kant)] pt-5">
            <p className="mb-3 text-sm text-[var(--blekk-svak)]">
              Har lenken kommet på avveie? Lag en ny — da slutter den gamle å
              virke, og alle som abonnerer må legge inn den nye.
            </p>
            <button
              type="submit"
              className="hm-trykk inline-flex min-h-[2.75rem] items-center border-2 border-hm-red px-4 text-xs font-bold tracking-wider text-hm-red-ink uppercase"
            >
              Lag ny lenke
            </button>
          </form>
        </div>
      </Kort>
    </div>
  )
}
