'use client'

import { useActionState, useId, useState } from 'react'
import { ETIKETT, FELT, KNAPP_PRIMÆR } from '@/components/ui'
import type { ProsjektValg, UttakMaskin } from '@/lib/intern-leie'
import { tolkKode } from '@/lib/skannet-kode'
import { utenNullstilling } from '@/lib/skjema'
import { taUt, type UttakTilstand } from './actions'
import { Skanner, type SkannSvar } from './skanner'

const start: UttakTilstand = {}

type Felles = {
  prosjekter: ProsjektValg[]
  sistProsjektId: string | null
  /** yyyy-mm-dd i norsk tid, regnet på serveren – minste lovlige dato. */
  iDag: string
}

/**
 * Lista på /ansatt: kryss av én eller flere, velg prosjekt, ta ut.
 *
 * Søket filtrerer i nettleseren og skjuler rader med `hidden` i stedet
 * for å fjerne dem. Et skjult felt sendes fortsatt med skjemaet, så en
 * avkrysning forsvinner ikke fordi man søkte etter noe annet.
 */
export function UttakListe({ maskiner, prosjekter, sistProsjektId, iDag, returTil }: Felles & {
  maskiner: UttakMaskin[]
  /** Id-en på «Hos deg nå», som returkoden sender til. Null når ingenting er ute. */
  returTil: string | null
}) {
  const [valgte, settValgte] = useState<Set<string>>(() => new Set())
  const [søk, settSøk] = useState('')

  // Valgene tømmes i selve handlingen, ikke i en effekt etterpå – da står
  // ikke avkrysningene igjen på maskiner som nettopp ble tatt ut.
  const [tilstand, handling, venter] = useActionState(
    async (forrige: UttakTilstand, fd: FormData) => {
      const svar = await taUt(forrige, fd)
      if (svar.ok) settValgte(new Set())
      return svar
    },
    start,
  )

  const n = søk.toLowerCase().replace(/\s/g, '')
  const treff = (m: UttakMaskin) =>
    !n ||
    [m.navn, m.internnummer, m.underkategori, m.kategori]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().replace(/\s/g, '').includes(n))

  const grupper = new Map<string, UttakMaskin[]>()
  for (const m of maskiner) {
    if (!grupper.has(m.kategori)) grupper.set(m.kategori, [])
    grupper.get(m.kategori)!.push(m)
  }

  function veksle(id: string) {
    settValgte((før) => {
      const ny = new Set(før)
      if (ny.has(id)) ny.delete(id)
      else ny.add(id)
      return ny
    })
  }

  const perQr = new Map(maskiner.map((m) => [m.qr, m]))

  // Skanneren krysser bare av, aldri av igjen: holdes kameraet mot samme
  // kode to ganger, skal ikke maskinen forsvinne fra uttaket.
  function vedSkann(tekst: string): SkannSvar {
    const kode = tolkKode(tekst)
    if (kode.type === 'maskin') {
      const m = perQr.get(kode.qr)
      if (!m) return { tone: 'feil', tekst: 'Fant ikke maskinen' }
      if (m.opptatt) return { tone: 'info', tekst: `${m.navn}: ${m.opptatt}` }
      if (valgte.has(m.id)) return { tone: 'info', tekst: `${m.navn} er allerede valgt` }
      settValgte((før) => new Set(før).add(m.id))
      // Reservert senere: krysses av likevel, men svaret er gult.
      return m.reservert
        ? { tone: 'info', tekst: `✓ ${m.navn} – ${m.reservert}` }
        : { tone: 'ok', tekst: `✓ ${m.navn}` }
    }
    if (kode.type === 'kategori') {
      const navn = kode.navn.trim()
      if (!maskiner.some((m) => m.kategori.toLowerCase() === navn.toLowerCase())) {
        return { tone: 'feil', tekst: `Fant ingen ${navn} i lista` }
      }
      settSøk(navn)
      return { tone: 'info', tekst: `Viser ${navn} – kryss av i lista` }
    }
    if (kode.type === 'retur') {
      return returTil
        ? { tone: 'ok', tekst: 'Returkoden – lever under «Hos deg nå»', gåTil: returTil }
        : { tone: 'info', tekst: 'Dette er returkoden, men du har ikke noe ute.' }
    }
    return { tone: 'feil', tekst: 'Ukjent kode' }
  }

  // Den automatiske nullstillingen etter en innsending rører ikke
  // `valgte`, den kontrollerte tilstanden for avkrysningsboksene. Feilet
  // uttaket helt (f.eks. «Prosjektet er avsluttet»), sto boksene tomme
  // mens `valgte` fortsatt hadde ID-ene: det sto «N valgt» uten
  // avkrysning, og neste forsøk ga «Velg minst én ting».
  return (
    <form onSubmit={utenNullstilling(handling)} className="space-y-6">
      {prosjekter.length === 0 && <IngenProsjekter />}

      <div className="space-y-3">
        <Skanner onKode={vedSkann} antallValgt={valgte.size} />
        <input
          type="search"
          value={søk}
          onChange={(e) => settSøk(e.target.value)}
          placeholder="Søk på navn, internnummer eller type"
          aria-label="Søk i utstyret"
          className={FELT}
        />
      </div>

      {[...grupper.entries()].map(([kategori, liste]) => (
        <section key={kategori} hidden={!liste.some(treff)}>
          <h3 className="hm-display mb-2 text-lg">{kategori}</h3>
          <ul className="space-y-2">
            {liste.map((m) => (
              <li key={m.id} hidden={!treff(m)}>
                {m.opptatt ? (
                  <div className="flex min-h-[3.5rem] flex-wrap items-center justify-between gap-2 border-2 border-[var(--kant)] bg-[var(--flate-2)] px-4 py-2 opacity-70">
                    <Navn maskin={m} />
                    <span className="text-sm font-semibold">{m.opptatt}</span>
                  </div>
                ) : (
                  <label className="flex min-h-[3.5rem] cursor-pointer items-center gap-3 border-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] px-4 py-2 has-checked:border-hm-red has-checked:bg-hm-red/10">
                    <input
                      type="checkbox"
                      name="maskin_id"
                      value={m.id}
                      checked={valgte.has(m.id)}
                      onChange={() => veksle(m.id)}
                      className="size-6 shrink-0 accent-[var(--color-hm-red)]"
                    />
                    <Navn maskin={m} />
                  </label>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Bunnlinja ligger i skjemaet og er sticky, så den følger med mens
          man blar – og svaret blir stående etter at valgene er tømt. */}
      <div
        hidden={valgte.size === 0 && !tilstand.ok && !tilstand.feil && !tilstand.varsel}
        className="sticky bottom-0 -mx-5 space-y-3 border-t-2 border-[var(--kant-sterk)] bg-[var(--flate-opp)] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <Svar tilstand={tilstand} />
        {valgte.size > 0 && (
          <>
            <p className="hm-display text-lg">{valgte.size} valgt</p>
            <Felter
              prosjekter={prosjekter}
              sistProsjektId={sistProsjektId}
              iDag={iDag}
              venter={venter}
            />
          </>
        )}
      </div>
    </form>
  )
}

/** Det korte skjemaet på maskinens QR-side – maskinen er allerede valgt. */
export function UttakEnkel({ maskinId, prosjekter, sistProsjektId, iDag }: Felles & {
  maskinId: string
}) {
  const [tilstand, handling, venter] = useActionState(taUt, start)

  return (
    <form action={handling} onSubmit={utenNullstilling(handling)} className="space-y-4">
      <input type="hidden" name="maskin_id" value={maskinId} />
      {prosjekter.length === 0 && <IngenProsjekter />}
      <Felter
        prosjekter={prosjekter}
        sistProsjektId={sistProsjektId}
        iDag={iDag}
        venter={venter}
      />
      <Svar tilstand={tilstand} />
    </form>
  )
}

// Under dette er nedtrekkslista kort nok til å bla i, og søkefeltet
// bare står i veien.
const SØK_FRA = 12

function Felter({
  prosjekter,
  sistProsjektId,
  iDag,
  venter,
}: Felles & { venter: boolean }) {
  const [valgt, settValgt] = useState(sistProsjektId ?? '')
  const [søk, settSøk] = useState('')
  const listeId = useId()

  const treff = (tekst: string) => {
    const n = tekst.toLowerCase().replace(/\s/g, '')
    return n ? prosjekter.filter((p) => p.navn.toLowerCase().replace(/\s/g, '').includes(n)) : null
  }

  // Det valgte prosjektet blir stående selv om det ikke passer søket.
  // Forsvinner valget fra lista, velger nettleseren et annet på egen hånd,
  // og utstyret kunne blitt ført på feil prosjekt uten at noen så det.
  const passer = treff(søk)
  const valgtProsjekt = prosjekter.find((p) => p.id === valgt)
  const synlige =
    passer === null
      ? prosjekter
      : valgtProsjekt && !passer.includes(valgtProsjekt)
        ? [valgtProsjekt, ...passer]
        : passer

  function vedSøk(tekst: string) {
    settSøk(tekst)
    // Ett treff er nesten alltid det man lette etter, så det velges med
    // en gang i stedet for at man må åpne lista etterpå.
    const nye = treff(tekst)
    if (nye?.length === 1) settValgt(nye[0].id)
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="block">
        <label htmlFor={listeId} className={ETIKETT}>
          Prosjekt
        </label>
        {prosjekter.length >= SØK_FRA && (
          <input
            type="search"
            value={søk}
            onChange={(e) => vedSøk(e.target.value)}
            // Enter i søkefeltet skal ikke sende skjemaet og ta ut utstyret.
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault()
            }}
            placeholder="Søk på nummer eller navn"
            aria-label="Søk etter prosjekt"
            autoComplete="off"
            className={`${FELT} mb-2`}
          />
        )}
        <select
          id={listeId}
          name="prosjekt_id"
          required
          value={valgt}
          onChange={(e) => settValgt(e.target.value)}
          className={FELT}
        >
          <option value="" disabled>
            {passer?.length === 0 ? 'Ingen prosjekter passer søket' : 'Velg prosjekt'}
          </option>
          {synlige.map((p) => (
            <option key={p.id} value={p.id}>
              {p.navn}
            </option>
          ))}
        </select>
      </div>

      <label className="block">
        <span className={ETIKETT}>
          Tilbake <span className="normal-case">(valgfritt)</span>
        </span>
        <input type="date" name="planlagt_slutt" min={iDag} className={FELT} />
        <span className="mt-1.5 block text-xs text-[var(--blekk-svak)]">
          Tomt betyr på ubestemt tid
        </span>
      </label>

      <button
        type="submit"
        disabled={venter || prosjekter.length === 0}
        className={`${KNAPP_PRIMÆR} sm:col-span-2`}
      >
        {venter ? 'Tar ut …' : 'Ta ut'}
      </button>
    </div>
  )
}

function Svar({ tilstand }: { tilstand: UttakTilstand }) {
  return (
    <>
      {tilstand.ok && (
        <p role="status" className="text-sm font-semibold text-hm-green">
          {tilstand.ok}
        </p>
      )}
      {tilstand.feil && (
        <p
          role="alert"
          className="border-l-4 border-hm-red bg-hm-red/10 p-3 text-sm font-semibold text-hm-red-ink"
        >
          {tilstand.feil}
        </p>
      )}
      {tilstand.varsel && (
        <p className="border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm font-semibold">
          {tilstand.varsel}
        </p>
      )}
    </>
  )
}

// Står også når prosjektene finnes, men alle er avsluttet. Lista styres
// fra SmartDok, så det er der, og ikke i denne appen, det kan rettes.
function IngenProsjekter() {
  return (
    <p className="border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
      Ingen prosjekter er åpne for uttak nå. Prosjektene hentes fra SmartDok,
      så et nytt prosjekt må opprettes der eller i adminbordet.
    </p>
  )
}

function Navn({ maskin }: { maskin: UttakMaskin }) {
  const under = [maskin.internnummer, maskin.underkategori].filter(Boolean).join(' · ')
  return (
    <span className="min-w-0 flex-1">
      <span className="block font-semibold">{maskin.navn}</span>
      {under && <span className="block text-sm text-[var(--blekk-svak)]">{under}</span>}
      {/* Teksten i vanlig blekk og en gul firkant foran: gul tekst ville
          falt under kravet til kontrast i mørkt tema. */}
      {maskin.reservert && (
        <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
          <span aria-hidden="true" className="size-2 shrink-0 bg-hm-amber" />
          {maskin.reservert}
        </span>
      )}
    </span>
  )
}
