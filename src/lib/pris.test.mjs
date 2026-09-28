import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beregnPris, internleieRad, summerInternleie } from './pris.ts'

const start = '2026-09-01T08:00:00.000Z'

test('påbegynt døgn teller som helt', () => {
  assert.deepEqual(beregnPris(start, '2026-09-02T09:00:00.000Z', 'dogn', 450), {
    antall: 2,
    belop: 900,
  })
})

test('minst én enhet, også for ti minutter', () => {
  assert.deepEqual(beregnPris(start, '2026-09-01T08:10:00.000Z', 'dogn', 450), {
    antall: 1,
    belop: 450,
  })
})

test('timepris regner timer', () => {
  assert.deepEqual(beregnPris(start, '2026-09-01T10:30:00.000Z', 'time', 200), {
    antall: 3,
    belop: 600,
  })
})

test('uten pris blir beløpet null, ikke 0', () => {
  assert.deepEqual(beregnPris(start, '2026-09-03T08:00:00.000Z', 'dogn', null), {
    antall: 2,
    belop: null,
  })
})

test('hele kroner, som forslaget på godkjenningssiden', () => {
  assert.equal(beregnPris(start, '2026-09-02T08:00:00.000Z', 'dogn', 333.33).belop, 333)
})

test('levert og løpende summeres hver for seg', () => {
  const sum = summerInternleie(
    [
      { status: 'avsluttet', start_tid: '2026-08-01T08:00:00.000Z', belop: 900, pris: 450, enhet: 'dogn' },
      { status: 'aktiv', start_tid: '2026-09-01T08:00:00.000Z', belop: null, pris: 450, enhet: 'dogn' },
    ],
    '2026-09-03T08:00:00.000Z',
  )
  assert.deepEqual(sum, { levert: 900, løpende: 900, ute: 1, manglerPris: false })
})

test('maskin uten pris sier fra i stedet for å telle 0 kr', () => {
  const sum = summerInternleie(
    [
      { status: 'aktiv', start_tid: '2026-09-01T08:00:00.000Z', belop: null, pris: null, enhet: 'dogn' },
      { status: 'avsluttet', start_tid: '2026-08-01T08:00:00.000Z', belop: null, pris: null, enhet: 'dogn' },
    ],
    '2026-09-02T08:00:00.000Z',
  )
  assert.deepEqual(sum, { levert: 0, løpende: 0, ute: 1, manglerPris: true })
})

test('internleieRad henter pris og enhet fra maskinen', () => {
  assert.deepEqual(
    internleieRad({
      status: 'aktiv',
      start_tid: '2026-09-01T08:00:00.000Z',
      belop: null,
      maskiner: { dogn_pris: 450, pris_enhet: 'time' },
    }),
    { status: 'aktiv', start_tid: '2026-09-01T08:00:00.000Z', belop: null, pris: 450, enhet: 'time' },
  )
  assert.deepEqual(
    internleieRad({ status: 'avsluttet', start_tid: '2026-09-01T08:00:00.000Z', belop: 900, maskiner: null }),
    { status: 'avsluttet', start_tid: '2026-09-01T08:00:00.000Z', belop: 900, pris: null, enhet: 'dogn' },
  )
})
