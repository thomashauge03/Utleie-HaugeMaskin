import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { hentAdmin } from '@/lib/auth'
import { hentVerkstedMaskin } from '@/lib/verksted-data'
import { tid } from '@/lib/dato'
import { HMLogo } from '@/components/hm-logo'
import { ETIKETT, FELT, Kort, KortTittel, Merke } from '@/components/ui'
import {
  VERKSTED_MERKE,
  VERKSTED_STATUS_TEKST,
  type VerkstedStatus,
} from '@/lib/verksted'
import { DelVelger, StatusVelger } from './status-velger'
import { leggTilNotat, settKjeftDimensjon } from '../actions'

export const metadata: Metadata = { title: 'Verksted – HM' }
export const dynamic = 'force-dynamic'

export default async function VerkstedMaskinSide(
  props: PageProps<'/verksted/[id]'>,
) {
  const { id } = await props.params
  const [data, bruker] = await Promise.all([hentVerkstedMaskin(id), hentAdmin()])

  if (!data) notFound()
  const { maskin, deler, delStatus, logg } = data
  const innlogget = Boolean(bruker)

  return (
    <>
      <header className="relative overflow-hidden bg-hm-black px-5 pt-6 pb-8 text-white">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-16 h-[160%] w-40 skew-x-[-18deg] bg-hm-red/90"
        />
        <div className="relative mx-auto max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <HMLogo størrelse="sm" />
            <Link
              href="/verksted"
              className="text-xs font-bold tracking-wider text-white/70 uppercase underline underline-offset-4"
            >
              ← Hele lista
            </Link>
          </div>

          <h1 className="hm-display mt-6 text-2xl">{maskin.navn}</h1>
          <p className="mt-1 text-sm text-white/70">
            {[maskin.underkategori, maskin.internnummer, maskin.kjeft_dimensjon]
              .filter(Boolean)
              .join(' · ') || maskin.qr_kode}
          </p>
          <div className="mt-3">
            {maskin.verksted_status ? (
              <Merke type={VERKSTED_MERKE[maskin.verksted_status as VerkstedStatus]}>
                {VERKSTED_STATUS_TEKST[maskin.verksted_status as VerkstedStatus]}
              </Merke>
            ) : (
              <Merke type="nøytral">Ingen sak registrert</Merke>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-5 py-7">
        <Kort>
          <KortTittel>Status</KortTittel>
          <div className="p-5">
            {!innlogget && (
              <p className="mb-4 border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
                Du kan melde fra om at den må sveises. De andre valgene krever
                innlogging.
              </p>
            )}
            <StatusVelger
              maskinId={maskin.id}
              naavaerende={maskin.verksted_status}
              innlogget={innlogget}
            />
          </div>
        </Kort>

        <Kort>
          <KortTittel>Deler</KortTittel>
          <ul className="divide-y-2 divide-[var(--kant)]">
            {deler.map((d) => (
              <li key={d.id} className="p-5">
                <p className="hm-display mb-2 text-base">{d.navn}</p>
                <DelVelger
                  maskinId={maskin.id}
                  delId={d.id}
                  naavaerende={delStatus[d.id] ?? 'ok'}
                  innlogget={innlogget}
                />
              </li>
            ))}
          </ul>
        </Kort>

        {innlogget && (
          <Kort>
            <KortTittel>Kjeft-dimensjon</KortTittel>
            <form
              action={async (fd: FormData) => {
                'use server'
                await settKjeftDimensjon(maskin.id, fd)
              }}
              className="flex flex-wrap gap-3 p-5"
            >
              <div className="min-w-[10rem] flex-1">
                <label className={ETIKETT} htmlFor="kjeft">
                  Dimensjon
                </label>
                <input
                  id="kjeft"
                  name="kjeft_dimensjon"
                  defaultValue={maskin.kjeft_dimensjon ?? ''}
                  placeholder="1750L S70"
                  className={FELT}
                />
              </div>
              <button
                type="submit"
                className="hm-trykk hm-kant-skygge-sm mt-6 inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] px-4 text-xs font-bold tracking-wider uppercase"
              >
                Lagre
              </button>
            </form>
          </Kort>
        )}

        {innlogget && (
          <Kort>
            <KortTittel>Legg til i loggen</KortTittel>
            <form
              action={async (fd: FormData) => {
                'use server'
                await leggTilNotat(maskin.id, fd)
              }}
              className="space-y-3 p-5"
            >
              <textarea
                name="notat"
                rows={2}
                placeholder="Hva ble gjort? F.eks. «Sveiset sprekk i bunn»"
                className={FELT}
              />
              <button
                type="submit"
                className="hm-trykk hm-kant-skygge-sm inline-flex min-h-[2.75rem] items-center border-2 border-[var(--kant-sterk)] bg-hm-red px-4 text-xs font-bold tracking-wider text-white uppercase"
              >
                Legg til
              </button>
            </form>
          </Kort>
        )}

        <Kort>
          <KortTittel>Historikk</KortTittel>
          {logg.length === 0 ? (
            <p className="p-5 text-sm text-[var(--blekk-svak)]">
              Ingenting registrert ennå.
            </p>
          ) : (
            <ol className="p-5">
              {logg.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap gap-x-4 gap-y-0.5 border-l-2 border-[var(--kant)] py-2 pl-4 text-sm"
                >
                  <span className="hm-tall text-[var(--blekk-svak)]">
                    {tid(h.tid)}
                  </span>
                  <span className="font-semibold">{h.beskrivelse}</span>
                  <span className="w-full text-xs text-[var(--blekk-svak)]">
                    {h.aktor}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Kort>
      </main>
    </>
  )
}
