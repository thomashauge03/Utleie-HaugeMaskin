import { visTelefon } from '@/lib/telefon'
import { dato, tid } from '@/lib/dato'
import { perEnhet, prisEnhet } from '@/lib/pris'
import type { Kunde, Leie, Maskin } from '@/lib/types'
import 'server-only'

const RØD = '#D81E28'
const SVART = '#0B0B0C'

/**
 * Escaper verdier som skal inn i HTML-malene.
 *
 * Kundenavn og fritekstkommentarer er brukerstyrt. Uten escaping kunne
 * en kunde skrevet «<a href=…>» eller annen markup som ble rendret i
 * admin sin og andre kunders innboks – et phishing-smutthull. Alt som
 * interpoleres i en mal går gjennom denne.
 */
function esc(v: string | null | undefined): string {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Rammen rundt alle e-poster.
 *
 * Tabellbasert oppsett med innebygde stiler, fordi e-postklienter
 * fortsatt ikke kan stoles på med flexbox eller <style>-blokker.
 * Outlook er verstingen.
 */
function ramme(tittel: string, innhold: string, firmanavn: string) {
  return `<!doctype html>
<html lang="nb"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${tittel}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${SVART}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:2px solid ${SVART}">
  <tr><td style="background:${SVART};padding:18px 24px">
    <span style="color:#ffffff;font-size:19px;font-weight:700;letter-spacing:.5px">
      ${esc(firmanavn) || 'HM UTLEIE'}
    </span>
  </td></tr>
  <tr><td style="height:5px;background:${RØD};font-size:0;line-height:0">&nbsp;</td></tr>
  <tr><td style="padding:26px 24px">${innhold}</td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;line-height:1.5">
    Denne meldingen er sendt automatisk fra utleiesystemet. Du kan svare
    på den om du har spørsmål.
  </td></tr>
</table>
</td></tr></table></body></html>`
}

const h1 = (t: string) =>
  `<h1 style="margin:0 0 14px;font-size:21px;line-height:1.25">${t}</h1>`
const p = (t: string) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${t}</p>`

function fakta(rader: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #e4e4e7">
  ${rader
    .map(
      ([k, v], i) => `<tr${i % 2 ? ' style="background:#fafafa"' : ''}>
    <td style="padding:9px 12px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.8px;white-space:nowrap">${esc(k)}</td>
    <td style="padding:9px 12px;font-size:15px;font-weight:600;text-align:right">${esc(v)}</td></tr>`,
    )
    .join('')}
</table>`
}

function knapp(url: string, tekst: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 18px">
  <tr><td style="background:${RØD};border:2px solid ${SVART}">
    <a href="${url}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:.5px;text-transform:uppercase">${tekst}</a>
  </td></tr></table>`
}

export type Sammenheng = {
  leie: Leie
  kunde: Kunde | null
  maskin: Maskin | null
  firmanavn: string
  nettadresse: string
}

export type Mal = { emne: string; html: string; tekst: string }

/* ── Til kunden: leien er startet ───────────────────────── */

export function kvitteringStart(s: Sammenheng): Mal {
  const url = `${s.nettadresse}/leie/${s.leie.referanse}`
  const maskin = s.maskin?.navn ?? 'maskin'

  return {
    emne: `Leien din er registrert – ${maskin}`,
    html: ramme(
      'Leien din er registrert',
      h1('Leien din er registrert') +
        p(`Hei ${esc(s.kunde?.navn?.split(' ')[0])}! Du har nå leid <strong>${esc(maskin)}</strong>.`) +
        fakta([
          ['Referanse', s.leie.referanse],
          ['Hentet', tid(s.leie.start_tid)],
          ['Forventet levering', dato(s.leie.planlagt_slutt)],
          ...(s.maskin?.vis_pris && s.maskin.dogn_pris
            ? ([
                [
                  `Pris ${perEnhet(prisEnhet(s.maskin.pris_enhet))}`,
                  `${s.maskin.dogn_pris.toLocaleString('nb-NO')} kr`,
                ],
              ] as [string, string][])
            : []),
        ]) +
        p('Når du skal levere tilbake, skanner du returkoden på arbeidsstedet og tar et bilde av maskinen.') +
        knapp(url, 'Se leien din'),
      s.firmanavn,
    ),
    tekst: `Leien din er registrert.

${maskin}
Referanse: ${s.leie.referanse}
Hentet: ${tid(s.leie.start_tid)}
Forventet levering: ${dato(s.leie.planlagt_slutt)}

Se leien: ${url}`,
  }
}

/* ── Til admin: ny leie ─────────────────────────────────── */

export function nyLeieAdmin(s: Sammenheng): Mal {
  const url = `${s.nettadresse}/admin/leier`
  const maskin = s.maskin?.navn ?? 'Ukjent maskin'
  const nyKunde = s.kunde?.status === 'ny'

  return {
    emne: `Ny utleie: ${maskin} – ${s.kunde?.navn ?? 'ukjent kunde'}`,
    html: ramme(
      'Ny utleie',
      h1('Ny utleie') +
        (nyKunde
          ? p(`<span style="background:#fef3c7;padding:3px 8px;font-weight:700;font-size:13px">NY KUNDE</span> — ikke registrert hos dere fra før.`)
          : '') +
        fakta([
          ['Maskin', maskin],
          ['Kunde', s.kunde?.navn ?? '–'],
          ['Mobil', s.kunde ? visTelefon(s.kunde.telefon) : '–'],
          ['E-post', s.kunde?.epost ?? '–'],
          ['Adresse', s.kunde?.adresse ?? '–'],
          ['Hentet', tid(s.leie.start_tid)],
          ['Forventet levering', dato(s.leie.planlagt_slutt)],
          ['Referanse', s.leie.referanse],
        ]) +
        (s.leie.kommentar_start ? p(`<em>«${esc(s.leie.kommentar_start)}»</em>`) : '') +
        knapp(url, 'Åpne adminpanelet'),
      s.firmanavn,
    ),
    tekst: `Ny utleie.

Maskin: ${maskin}
Kunde: ${s.kunde?.navn ?? '–'} (${s.kunde ? visTelefon(s.kunde.telefon) : '–'})
Hentet: ${tid(s.leie.start_tid)}
Forventet levering: ${dato(s.leie.planlagt_slutt)}
Referanse: ${s.leie.referanse}

${url}`,
  }
}

/* ── Til admin: innlevering venter ──────────────────────── */

export function returAdmin(s: Sammenheng): Mal {
  const url = `${s.nettadresse}/admin/leier?status=venter_godkjenning`
  const maskin = s.maskin?.navn ?? 'Ukjent maskin'

  return {
    emne: `Innlevert – venter godkjenning: ${maskin}`,
    html: ramme(
      'Innlevering venter på godkjenning',
      h1('Innlevering venter på godkjenning') +
        fakta([
          ['Maskin', maskin],
          ['Kunde', s.kunde?.navn ?? '–'],
          ['Levert', s.leie.slutt_tid ? tid(s.leie.slutt_tid) : '–'],
          ['Referanse', s.leie.referanse],
        ]) +
        (s.leie.kommentar_retur ? p(`<em>«${esc(s.leie.kommentar_retur)}»</em>`) : '') +
        p('Maskinen blir ikke ledig før du har sett over bildet og godkjent.') +
        knapp(url, 'Se over og godkjenn'),
      s.firmanavn,
    ),
    tekst: `Innlevering venter på godkjenning.

Maskin: ${maskin}
Kunde: ${s.kunde?.navn ?? '–'}
Levert: ${s.leie.slutt_tid ? tid(s.leie.slutt_tid) : '–'}
Referanse: ${s.leie.referanse}

${url}`,
  }
}

/* ── Til kunden: innlevering mottatt ────────────────────── */

export function kvitteringRetur(s: Sammenheng): Mal {
  const maskin = s.maskin?.navn ?? 'maskinen'

  return {
    emne: `Innlevering registrert – ${maskin}`,
    html: ramme(
      'Innleveringen er registrert',
      h1('Takk – innleveringen er registrert') +
        p(`Vi har mottatt bildet ditt av <strong>${esc(maskin)}</strong>. Leien ble avsluttet ${s.leie.slutt_tid ? tid(s.leie.slutt_tid) : 'nå'}.`) +
        fakta([
          ['Referanse', s.leie.referanse],
          ['Hentet', dato(s.leie.start_tid)],
          ['Levert', s.leie.slutt_tid ? tid(s.leie.slutt_tid) : '–'],
        ]) +
        p('Utleier ser over bildet og bekrefter. Du betaler ikke for ventetiden — leien stoppet i det du sendte inn. Faktura kommer separat.'),
      s.firmanavn,
    ),
    tekst: `Innleveringen er registrert.

${maskin}
Referanse: ${s.leie.referanse}
Levert: ${s.leie.slutt_tid ? tid(s.leie.slutt_tid) : '–'}

Utleier ser over bildet og bekrefter. Faktura kommer separat.`,
  }
}

/* ── Forfalt ────────────────────────────────────────────── */

export function forfaltKunde(s: Sammenheng, dagerOver: number): Mal {
  const maskin = s.maskin?.navn ?? 'maskinen'

  return {
    emne: `Påminnelse: ${maskin} skulle vært levert`,
    html: ramme(
      'Påminnelse om levering',
      h1('Vennlig påminnelse') +
        p(`Hei ${esc(s.kunde?.navn?.split(' ')[0])}! Ifølge systemet vårt har du fortsatt <strong>${esc(maskin)}</strong>, som var ventet tilbake ${dato(s.leie.planlagt_slutt)}.`) +
        fakta([
          ['Referanse', s.leie.referanse],
          ['Avtalt levering', dato(s.leie.planlagt_slutt)],
          ['Dager over', String(dagerOver)],
        ]) +
        p('Leien løper videre til maskinen er levert. Har du allerede levert den, eller trenger du den lenger, er det bare å ta kontakt.') +
        knapp(`${s.nettadresse}/leie/${s.leie.referanse}`, 'Lever tilbake'),
      s.firmanavn,
    ),
    tekst: `Påminnelse: ${maskin} var ventet tilbake ${dato(s.leie.planlagt_slutt)} (${dagerOver} dager siden).

Leien løper videre til maskinen er levert.
${s.nettadresse}/leie/${s.leie.referanse}`,
  }
}

export function forfaltAdmin(
  firmanavn: string,
  nettadresse: string,
  rader: { maskin: string; kunde: string; telefon: string; dager: number; ref: string }[],
): Mal {
  return {
    emne: `${rader.length} ${rader.length === 1 ? 'maskin' : 'maskiner'} på overtid`,
    html: ramme(
      'Maskiner på overtid',
      h1(`${rader.length} ${rader.length === 1 ? 'maskin' : 'maskiner'} på overtid`) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #e4e4e7">
      <tr style="background:${SVART}">
        <td style="padding:8px 10px;color:#fff;font-size:11px;letter-spacing:.8px">MASKIN</td>
        <td style="padding:8px 10px;color:#fff;font-size:11px;letter-spacing:.8px">KUNDE</td>
        <td style="padding:8px 10px;color:#fff;font-size:11px;letter-spacing:.8px;text-align:right">DAGER</td>
      </tr>
      ${rader
        .map(
          (r, i) => `<tr${i % 2 ? ' style="background:#fafafa"' : ''}>
        <td style="padding:9px 10px;font-size:14px;font-weight:600">${esc(r.maskin)}</td>
        <td style="padding:9px 10px;font-size:14px">${esc(r.kunde)}<br><span style="color:#71717a;font-size:12px">${esc(r.telefon)}</span></td>
        <td style="padding:9px 10px;font-size:16px;font-weight:700;color:${RØD};text-align:right">${r.dager}</td>
      </tr>`,
        )
        .join('')}
    </table>` +
        knapp(`${nettadresse}/admin/leier?status=forfalt`, 'Se alle forfalte'),
      firmanavn,
    ),
    tekst:
      `${rader.length} maskiner på overtid:\n\n` +
      rader
        .map((r) => `- ${r.maskin} · ${r.kunde} (${r.telefon}) · ${r.dager} dager · ${r.ref}`)
        .join('\n') +
      `\n\n${nettadresse}/admin/leier?status=forfalt`,
  }
}
