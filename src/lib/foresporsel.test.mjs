import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAKS_DAGER, opptattePerioder, overlapper, validerForesporsel } from './foresporsel.ts'

const I_DAG = '2026-10-01'
const NÅ = Date.parse('2026-10-01T10:00:00Z')

const gyldig = (mer = {}) => ({
  maskin_id: '00000000-0000-4000-8000-000000000001',
  fra: '2026-10-14',
  til: '2026-10-16',
  navn: ' Ola Hansen ',
  telefon: '412 34 567',
  epost: '',
  melding: '',
  nettside: '',
  startet: NÅ - 60_000,
  ...mer,
})

const feil = (kropp) => {
  const u = validerForesporsel(kropp, I_DAG, NÅ)
  assert.equal(u.ok, false, JSON.stringify(kropp))
  return u
}

test('en gyldig forespørsel går gjennom, ryddet', () => {
  const u = validerForesporsel(gyldig(), I_DAG, NÅ)
  assert.deepEqual(u, {
    ok: true,
    data: {
      maskin_id: '00000000-0000-4000-8000-000000000001',
      fra: '2026-10-14',
      til: '2026-10-16',
      navn: 'Ola Hansen',
      telefon: '412 34 567',
      epost: null,
      melding: null,
    },
  })
})

test('e-post og melding tas med når de er fylt ut', () => {
  const u = validerForesporsel(gyldig({ epost: 'ola@example.com', melding: 'Henter kl. 7' }), I_DAG, NÅ)
  assert.equal(u.ok && u.data.epost, 'ola@example.com')
  assert.equal(u.ok && u.data.melding, 'Henter kl. 7')
})

test('roboter får en generisk feil: honningfelt, for rask eller uten startet', () => {
  const generisk = 'Kunne ikke sende forespørselen. Prøv igjen.'
  assert.equal(feil(gyldig({ nettside: 'http://spam.example' })).feil, generisk)
  assert.equal(feil(gyldig({ startet: NÅ - 1_000 })).feil, generisk)
  assert.equal(feil(gyldig({ startet: undefined })).feil, generisk)
})

test('datoene må henge sammen', () => {
  assert.match(feil(gyldig({ fra: '2026-09-30', til: '2026-10-02' })).feil, /har vært/)
  assert.match(feil(gyldig({ fra: '2026-10-16', til: '2026-10-14' })).feil, /før/)
  assert.match(feil(gyldig({ fra: '2026-02-31', til: '2026-03-01' })).feil, /datoer/)
  assert.match(feil(gyldig({ fra: '2027-10-10', til: '2027-10-12' })).feil, /ett år/)
})

test(`høyst ${MAKS_DAGER} dager, begge med`, () => {
  assert.equal(validerForesporsel(gyldig({ fra: '2026-10-02', til: '2026-11-30' }), I_DAG, NÅ).ok, true)
  assert.match(feil(gyldig({ fra: '2026-10-02', til: '2026-12-01' })).feil, /60 dager/)
})

test('felt som ikke holder mål', () => {
  assert.equal(feil(gyldig({ navn: 'O' })).status, 400)
  assert.equal(feil(gyldig({ telefon: '' })).status, 400)
  assert.match(feil(gyldig({ epost: 'ikke-en-adresse' })).feil, /e-post/i)
  assert.match(feil(gyldig({ melding: 'x'.repeat(501) })).feil, /500/)
  assert.equal(feil(gyldig({ maskin_id: 'tull' })).status, 400)
  assert.equal(feil('ikke et objekt').status, 400)
})

test('overlapp teller begge endedager', () => {
  const opptatt = [{ fra: '2026-10-10', til: '2026-10-12' }]
  assert.equal(overlapper('2026-10-12', '2026-10-14', opptatt), true)
  assert.equal(overlapper('2026-10-08', '2026-10-10', opptatt), true)
  assert.equal(overlapper('2026-10-13', '2026-10-14', opptatt), false)
  assert.equal(overlapper('2026-10-01', '2026-10-09', opptatt), false)
  assert.equal(overlapper('2026-10-01', '2026-10-31', opptatt), true)
  assert.equal(overlapper('2026-10-01', '2026-10-31', []), false)
})

test('opptatte perioder: aktive reservasjoner og leier, uten kjent slutt til i dag', () => {
  const perioder = opptattePerioder(
    [
      { fra_dato: '2026-10-14', til_dato: '2026-10-16', status: 'aktiv' },
      { fra_dato: '2026-10-20', til_dato: '2026-10-21', status: 'forespurt' },
      { fra_dato: '2026-10-22', til_dato: '2026-10-23', status: 'avlyst' },
    ],
    [
      { startDag: '2026-09-20', sluttDag: '2026-10-05' },
      { startDag: '2026-09-01', sluttDag: null },
      { startDag: '2026-08-01', sluttDag: '2026-09-01' },
    ],
    I_DAG,
  )
  assert.deepEqual(perioder, [
    { fra: '2026-10-14', til: '2026-10-16' },
    { fra: '2026-09-20', til: '2026-10-05' },
    { fra: '2026-09-01', til: I_DAG },
    { fra: '2026-08-01', til: I_DAG },
  ])
})
