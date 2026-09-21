import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase/admin'
import 'server-only'

export type Varseltype =
  | 'ny_leie_admin'
  | 'kvittering_start'
  | 'retur_admin'
  | 'kvittering_retur'
  | 'forfalt_admin'
  | 'forfalt_kunde'

export type Innstillinger = {
  firmanavn: string
  avsender_navn: string
  varsel_epost: string | null
  varsel_kopi: string | null
  varsle_ny_leie: boolean
  varsle_retur: boolean
  varsle_forfalt: boolean
  kvittering_start: boolean
  kvittering_retur: boolean
  purring_forfalt: boolean
}

export async function hentVarselInnstillinger(): Promise<Innstillinger | null> {
  const { data } = await supabaseAdmin.from('innstillinger').select('*').maybeSingle()
  return (data as Innstillinger) ?? null
}

/** «a@b.no, c@d.no» → ['a@b.no', 'c@d.no'] */
export function adresser(rå: string | null | undefined): string[] {
  if (!rå) return []
  return rå
    .split(/[,;\s]+/)
    .map((a) => a.trim())
    .filter((a) => a.includes('@'))
}

type SendArgs = {
  type: Varseltype
  til: string[]
  kopi?: string[]
  emne: string
  html: string
  tekst: string
  leieId?: string
  avsenderNavn: string
}

/**
 * Sender e-post og fører den i loggen.
 *
 * Kaster aldri. En e-post som ikke går ut skal ikke velte en leie som
 * kunden står midt oppe i – da mister vi noe langt viktigere enn et
 * varsel. Feilen havner i loggen og kan sees i adminpanelet.
 */
export async function sendEpost(args: SendArgs): Promise<boolean> {
  const nøkkel = process.env.RESEND_API_KEY
  const fra = process.env.VARSEL_FRA

  if (!nøkkel || !fra) {
    await loggfør(args, 'feilet', 'RESEND_API_KEY eller VARSEL_FRA mangler')
    return false
  }
  if (args.til.length === 0) {
    await loggfør(args, 'feilet', 'Ingen mottaker')
    return false
  }

  try {
    const resend = new Resend(nøkkel)
    const { error } = await resend.emails.send({
      from: `${args.avsenderNavn} <${fra}>`,
      to: args.til,
      cc: args.kopi?.length ? args.kopi : undefined,
      subject: args.emne,
      html: args.html,
      text: args.tekst,
    })

    if (error) {
      await loggfør(args, 'feilet', error.message)
      return false
    }

    await loggfør(args, 'sendt')
    return true
  } catch (e) {
    await loggfør(args, 'feilet', e instanceof Error ? e.message : 'Ukjent feil')
    return false
  }
}

async function loggfør(args: SendArgs, status: string, feilmelding?: string) {
  try {
    await supabaseAdmin.from('epost_logg').insert({
      leie_id: args.leieId ?? null,
      type: args.type,
      mottaker: [...args.til, ...(args.kopi ?? [])].join(', ') || '–',
      emne: args.emne,
      status,
      feilmelding: feilmelding ?? null,
    })
  } catch {
    // Loggingen må heller ikke kunne velte noe.
  }
}
