import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beregnPris } from './pris.ts'

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
