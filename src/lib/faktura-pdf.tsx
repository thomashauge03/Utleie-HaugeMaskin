import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { visTelefon } from '@/lib/telefon'
import { dato, tid } from '@/lib/dato'
import type { Kunde, Leie, Maskin } from '@/lib/types'
import 'server-only'

const RØD = '#D81E28'
const SVART = '#0B0B0C'
const GRÅ = '#71717A'
const KANT = '#D0D0D5'

const s = StyleSheet.create({
  side: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontSize: 10, color: SVART },
  topp: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { height: 34 },
  tittel: { fontSize: 22, fontWeight: 'bold', letterSpacing: 0.5 },
  refLinje: { fontSize: 9, color: GRÅ, marginTop: 2 },
  strek: { height: 4, backgroundColor: RØD, marginTop: 14, marginBottom: 22 },

  kolonner: { flexDirection: 'row', gap: 28, marginBottom: 26 },
  kolonne: { flex: 1 },
  etikett: { fontSize: 7.5, color: GRÅ, letterSpacing: 1.2, marginBottom: 5, fontWeight: 'bold' },
  linje: { marginBottom: 2.5, lineHeight: 1.4 },
  sterk: { fontWeight: 'bold' },

  tabellTopp: {
    flexDirection: 'row',
    backgroundColor: SVART,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tabellTekst: { color: '#FFFFFF', fontSize: 7.5, letterSpacing: 1, fontWeight: 'bold' },
  rad: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: KANT,
  },
  sum: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: SVART,
  },
  sumTall: { fontSize: 17, fontWeight: 'bold' },

  merknad: {
    marginTop: 24,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: RØD,
    backgroundColor: '#F4F4F5',
  },
  bilder: { flexDirection: 'row', gap: 12, marginTop: 12 },
  bilde: { flex: 1, borderWidth: 1, borderColor: KANT },
  bunn: {
    position: 'absolute',
    bottom: 26,
    left: 44,
    right: 44,
    fontSize: 7.5,
    color: GRÅ,
    borderTopWidth: 1,
    borderTopColor: KANT,
    paddingTop: 8,
  },
})

export type FakturaData = {
  leie: Leie
  kunde: Kunde | null
  maskin: Maskin | null
  firmanavn: string
  /** Rå bildebytes, allerede hentet ned. */
  bilder: { type: string; data: Buffer }[]
}

const kr = (n: number) =>
  `${n.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`

function Dokument({ leie, kunde, maskin, firmanavn, bilder, logo }: FakturaData & { logo: string | null }) {
  const dogn = leie.antall_dogn ?? 0
  const belop = leie.belop ?? 0
  const enhetspris = dogn > 0 ? belop / dogn : 0

  return (
    <Document
      title={`Fakturagrunnlag ${leie.referanse}`}
      author={firmanavn || 'Hauge Maskin'}
    >
      <Page size="A4" style={s.side}>
        <View style={s.topp}>
          <View>
            {logo && <Image src={logo} style={s.logo} />}
            {firmanavn ? <Text style={{ marginTop: 8, ...s.sterk }}>{firmanavn}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.tittel}>FAKTURAGRUNNLAG</Text>
            <Text style={s.refLinje}>{leie.referanse}</Text>
            <Text style={s.refLinje}>Utstedt {dato(new Date().toISOString())}</Text>
          </View>
        </View>

        <View style={s.strek} />

        <View style={s.kolonner}>
          <View style={s.kolonne}>
            <Text style={s.etikett}>KUNDE</Text>
            {kunde ? (
              <>
                <Text style={[s.linje, s.sterk]}>{kunde.navn}</Text>
                <Text style={s.linje}>{kunde.adresse}</Text>
                <Text style={s.linje}>{kunde.epost}</Text>
                <Text style={s.linje}>{visTelefon(kunde.telefon)}</Text>
              </>
            ) : (
              <Text style={s.linje}>Ukjent kunde</Text>
            )}
          </View>

          <View style={s.kolonne}>
            <Text style={s.etikett}>LEIEPERIODE</Text>
            <Text style={s.linje}>
              Hentet: <Text style={s.sterk}>{tid(leie.start_tid)}</Text>
            </Text>
            <Text style={s.linje}>
              Levert:{' '}
              <Text style={s.sterk}>{leie.slutt_tid ? tid(leie.slutt_tid) : '–'}</Text>
            </Text>
            <Text style={s.linje}>
              Avtalt levering: {dato(leie.planlagt_slutt)}
            </Text>
            {leie.godkjent_tid && (
              <Text style={[s.linje, { color: GRÅ }]}>
                Godkjent {tid(leie.godkjent_tid)}
              </Text>
            )}
          </View>
        </View>

        <View style={s.tabellTopp}>
          <Text style={[s.tabellTekst, { flex: 3 }]}>BESKRIVELSE</Text>
          <Text style={[s.tabellTekst, { flex: 1, textAlign: 'right' }]}>DØGN</Text>
          <Text style={[s.tabellTekst, { flex: 1.3, textAlign: 'right' }]}>PRIS</Text>
          <Text style={[s.tabellTekst, { flex: 1.3, textAlign: 'right' }]}>SUM</Text>
        </View>

        <View style={s.rad}>
          <View style={{ flex: 3 }}>
            <Text style={s.sterk}>{maskin?.navn ?? 'Maskin'}</Text>
            {(maskin?.internnummer || maskin?.qr_kode) && (
              <Text style={{ fontSize: 8, color: GRÅ, marginTop: 2 }}>
                {[maskin.internnummer, maskin.qr_kode].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>
          <Text style={{ flex: 1, textAlign: 'right' }}>{dogn}</Text>
          <Text style={{ flex: 1.3, textAlign: 'right' }}>{kr(enhetspris)}</Text>
          <Text style={{ flex: 1.3, textAlign: 'right' }}>{kr(belop)}</Text>
        </View>

        <View style={s.sum}>
          <Text style={{ marginRight: 14, color: GRÅ, paddingTop: 5 }}>
            Sum eks. mva.
          </Text>
          <Text style={s.sumTall}>{kr(belop)}</Text>
        </View>

        {leie.manuelt_justert && (
          <Text style={{ fontSize: 8, color: GRÅ, marginTop: 6, textAlign: 'right' }}>
            Beløpet er justert manuelt av utleier.
          </Text>
        )}

        {(leie.avvik || leie.kommentar_retur) && (
          <View style={s.merknad}>
            {leie.avvik ? (
              <Text style={s.linje}>
                <Text style={s.sterk}>Avvik: </Text>
                {leie.avvik}
              </Text>
            ) : null}
            {leie.kommentar_retur ? (
              <Text style={s.linje}>
                <Text style={s.sterk}>Kundens kommentar: </Text>
                {leie.kommentar_retur}
              </Text>
            ) : null}
          </View>
        )}

        {bilder.length > 0 && (
          <View wrap={false}>
            <Text style={[s.etikett, { marginTop: 26 }]}>DOKUMENTASJON</Text>
            <View style={s.bilder}>
              {bilder.map((b, i) => (
                <View key={i} style={s.bilde}>
                  <Image src={b.data} />
                  <Text style={{ fontSize: 7.5, color: GRÅ, padding: 4 }}>
                    {b.type === 'henting' ? 'Ved henting' : 'Ved levering'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={s.bunn} fixed>
          {leie.referanse} · Dette er et fakturagrunnlag, ikke en faktura. Det
          dokumenterer leieforholdet og maskinens tilstand ved henting og
          innlevering.
        </Text>
      </Page>
    </Document>
  )
}

export async function lagFakturaPdf(data: FakturaData): Promise<Buffer> {
  // Logoen leses fra disk. next/image-optimalisering finnes ikke her.
  let logo: string | null = null
  try {
    const fil = await readFile(path.join(process.cwd(), 'public', 'hm-logo.png'))
    logo = `data:image/png;base64,${fil.toString('base64')}`
  } catch {
    // Uten logo blir dokumentet nøkternt, men fullt brukbart.
  }

  return renderToBuffer(<Dokument {...data} logo={logo} />)
}
