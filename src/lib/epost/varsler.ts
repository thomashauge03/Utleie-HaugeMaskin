import { supabaseAdmin } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import type { Kjøretøy, Kunde, Leie, Maskin } from '@/lib/types'
import { kommendeFrister, treffserTerskel } from '@/lib/frister'
import { adresser, hentVarselInnstillinger, sendEpost } from './send'
import * as maler from './maler'
import 'server-only'

/**
 * Varslene som utløses av en handling i systemet.
 *
 * Alle er «fire and forget»: de venter ikke på at e-posten går ut, og
 * de kaster aldri. En treg eller nede e-posttjeneste skal ikke gjøre
 * at kunden står og venter på anleggsplassen.
 */

async function hentSammenheng(leieId: string) {
  const { data } = await supabaseAdmin
    .from('leier')
    .select('*, maskiner(*), kunder(*)')
    .eq('id', leieId)
    .maybeSingle()

  if (!data) return null

  const leie = data as Leie & { maskiner: Maskin | null; kunder: Kunde | null }
  const innst = await hentVarselInnstillinger()
  if (!innst) return null

  return {
    innst,
    sammenheng: {
      leie,
      kunde: leie.kunder,
      maskin: leie.maskiner,
      firmanavn: innst.firmanavn ?? '',
      nettadresse: env.NEXT_PUBLIC_SITE_URL,
    } satisfies maler.Sammenheng,
  }
}

export async function varsleNyLeie(leieId: string) {
  try {
    const k = await hentSammenheng(leieId)
    if (!k) return
    const { innst, sammenheng } = k

    if (innst.varsle_ny_leie) {
      const m = maler.nyLeieAdmin(sammenheng)
      await sendEpost({
        type: 'ny_leie_admin',
        til: adresser(innst.varsel_epost),
        kopi: adresser(innst.varsel_kopi),
        emne: m.emne,
        html: m.html,
        tekst: m.tekst,
        leieId,
        avsenderNavn: innst.avsender_navn,
      })
    }

    if (innst.kvittering_start && sammenheng.kunde?.epost) {
      const m = maler.kvitteringStart(sammenheng)
      await sendEpost({
        type: 'kvittering_start',
        til: [sammenheng.kunde.epost],
        emne: m.emne,
        html: m.html,
        tekst: m.tekst,
        leieId,
        avsenderNavn: innst.avsender_navn,
      })
    }
  } catch {
    // Varsling skal aldri velte leien.
  }
}

export async function varsleRetur(leieId: string) {
  try {
    const k = await hentSammenheng(leieId)
    if (!k) return
    const { innst, sammenheng } = k

    if (innst.varsle_retur) {
      const m = maler.returAdmin(sammenheng)
      await sendEpost({
        type: 'retur_admin',
        til: adresser(innst.varsel_epost),
        kopi: adresser(innst.varsel_kopi),
        emne: m.emne,
        html: m.html,
        tekst: m.tekst,
        leieId,
        avsenderNavn: innst.avsender_navn,
      })
    }

    if (innst.kvittering_retur && sammenheng.kunde?.epost) {
      const m = maler.kvitteringRetur(sammenheng)
      await sendEpost({
        type: 'kvittering_retur',
        til: [sammenheng.kunde.epost],
        emne: m.emne,
        html: m.html,
        tekst: m.tekst,
        leieId,
        avsenderNavn: innst.avsender_navn,
      })
    }
  } catch {
    /* som over */
  }
}

/**
 * Går gjennom alle forfalte leier og sender ut varsler.
 *
 * Databasen har en unik indeks på (leie, type, dato), så en purring kan
 * ikke sendes to ganger samme dag selv om jobben kjøres om igjen.
 */
export async function varsleForfalte(): Promise<{
  forfalte: number
  adminSendt: boolean
  purringer: number
}> {
  const innst = await hentVarselInnstillinger()
  if (!innst) return { forfalte: 0, adminSendt: false, purringer: 0 }

  const { data } = await supabaseAdmin
    .from('leier')
    .select('*, maskiner(*), kunder(*)')
    .eq('status', 'aktiv')
    .lt('planlagt_slutt', new Date().toISOString())
    .order('planlagt_slutt')

  const forfalte = (data ?? []) as (Leie & {
    maskiner: Maskin | null
    kunder: Kunde | null
  })[]

  if (forfalte.length === 0) return { forfalte: 0, adminSendt: false, purringer: 0 }

  const dagerOver = (l: Leie) =>
    Math.max(
      1,
      Math.floor((Date.now() - new Date(l.planlagt_slutt).getTime()) / 86_400_000),
    )

  let adminSendt = false
  if (innst.varsle_forfalt) {
    const m = maler.forfaltAdmin(
      innst.firmanavn ?? '',
      env.NEXT_PUBLIC_SITE_URL,
      forfalte.map((l) => ({
        maskin: l.maskiner?.navn ?? 'Ukjent',
        kunde: l.kunder?.navn ?? '–',
        telefon: l.kunder?.telefon ?? '–',
        dager: dagerOver(l),
        ref: l.referanse,
      })),
    )
    adminSendt = await sendEpost({
      type: 'forfalt_admin',
      til: adresser(innst.varsel_epost),
      kopi: adresser(innst.varsel_kopi),
      emne: m.emne,
      html: m.html,
      tekst: m.tekst,
      avsenderNavn: innst.avsender_navn,
    })
  }

  let purringer = 0
  if (innst.purring_forfalt) {
    for (const l of forfalte) {
      if (!l.kunder?.epost) continue

      // Har kunden allerede fått purring i dag?
      const iDag = new Date().toISOString().slice(0, 10)
      const { data: alt } = await supabaseAdmin
        .from('epost_logg')
        .select('id')
        .eq('leie_id', l.id)
        .eq('type', 'forfalt_kunde')
        .eq('status', 'sendt')
        .gte('sendt', `${iDag}T00:00:00`)
        .maybeSingle()

      if (alt) continue

      const m = maler.forfaltKunde(
        {
          leie: l,
          kunde: l.kunder,
          maskin: l.maskiner,
          firmanavn: innst.firmanavn ?? '',
          nettadresse: env.NEXT_PUBLIC_SITE_URL,
        },
        dagerOver(l),
      )

      if (
        await sendEpost({
          type: 'forfalt_kunde',
          til: [l.kunder.epost],
          emne: m.emne,
          html: m.html,
          tekst: m.tekst,
          leieId: l.id,
          avsenderNavn: innst.avsender_navn,
        })
      ) {
        purringer++
      }
    }
  }

  return { forfalte: forfalte.length, adminSendt, purringer }
}

/**
 * Samle-e-post om frister på egne kjøretøy.
 *
 * Sender bare på dager der noe treffer en terskel nøyaktig, eller
 * nettopp har forfalt. «Alt under 30 dager» ville gitt samme e-post
 * tretti dager på rad, og da leser ingen den den dagen det gjelder.
 */
export async function varsleEuKontroll(): Promise<{
  frister: number
  sendt: boolean
  hoppetOver: string | null
}> {
  const innst = await hentVarselInnstillinger()
  if (!innst) return { frister: 0, sendt: false, hoppetOver: 'ingen innstillinger' }
  if (!innst.varsle_eu_kontroll) {
    return { frister: 0, sendt: false, hoppetOver: 'avslått' }
  }

  const { data } = await supabaseAdmin
    .from('kjoretoy')
    .select('*')
    .eq('status', 'i_drift')
    .limit(500)

  const alle = kommendeFrister((data ?? []) as Kjøretøy[])
  if (alle.length === 0) return { frister: 0, sendt: false, hoppetOver: 'ingenting nær frist' }
  if (!treffserTerskel(alle)) {
    return { frister: alle.length, sendt: false, hoppetOver: 'ingen terskel i dag' }
  }

  /*
   * epost_logg.leie_id er fremmednøkkel mot leier og kan ikke peke på
   * et kjøretøy, så den unike indeksen som stopper dobbeltsending for
   * purringer dekker ikke denne typen. Dedup må derfor skje her.
   */
  const iDag = new Date().toISOString().slice(0, 10)
  const { data: alt } = await supabaseAdmin
    .from('epost_logg')
    .select('id')
    .eq('type', 'eu_kontroll_admin')
    .eq('status', 'sendt')
    .gte('sendt', `${iDag}T00:00:00`)
    .maybeSingle()

  if (alt) return { frister: alle.length, sendt: false, hoppetOver: 'allerede sendt i dag' }

  const m = maler.euKontrollAdmin(
    innst.firmanavn ?? '',
    env.NEXT_PUBLIC_SITE_URL,
    alle.map((f) => ({
      reg_nr: f.kjøretøy.reg_nr,
      navn:
        f.kjøretøy.internt_navn ??
        [f.kjøretøy.merke, f.kjøretøy.modell].filter(Boolean).join(' '),
      hva: f.tekst,
      frist: f.dato,
      dager: f.dager,
    })),
  )

  const sendt = await sendEpost({
    type: 'eu_kontroll_admin',
    til: adresser(innst.varsel_epost),
    kopi: adresser(innst.varsel_kopi),
    emne: m.emne,
    html: m.html,
    tekst: m.tekst,
    avsenderNavn: innst.avsender_navn,
  })

  return { frister: alle.length, sendt, hoppetOver: null }
}
