import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leggTilManeder, norskSluttAvDag, returDato } from './dato.ts'

test('vintertid: 23:59:59 norsk er 22:59:59 UTC', () => {
  assert.equal(norskSluttAvDag('2026-01-15')?.toISOString(), '2026-01-15T22:59:59.000Z')
})

test('sommertid: 23:59:59 norsk er 21:59:59 UTC', () => {
  assert.equal(norskSluttAvDag('2026-07-15')?.toISOString(), '2026-07-15T21:59:59.000Z')
})

test('sommertid starter: 2026-03-29 er offset +2 hele døgnet', () => {
  assert.equal(norskSluttAvDag('2026-03-29')?.toISOString(), '2026-03-29T21:59:59.000Z')
})

test('sommertid slutter: 2026-10-25 er offset +1 hele døgnet', () => {
  assert.equal(norskSluttAvDag('2026-10-25')?.toISOString(), '2026-10-25T22:59:59.000Z')
})

test('feil format gir null', () => {
  assert.equal(norskSluttAvDag('15.07.2026'), null)
  assert.equal(norskSluttAvDag(''), null)
})

test('uten dato står det «til videre»', () => {
  assert.equal(returDato(null), 'til videre')
  assert.equal(returDato('2026-07-15T21:59:59.000Z'), '15.07.2026')
})

test('leggTilManeder: 24 måneder fram, samme klokkeslett', () => {
  assert.equal(leggTilManeder('2026-08-03T16:32:37.759Z', 24), '2028-08-03T16:32:37.759Z')
})

test('leggTilManeder: dag som ikke finnes, blir siste dag i måneden – som i Postgres', () => {
  assert.equal(leggTilManeder('2024-02-29T12:00:00.000Z', 24), '2026-02-28T12:00:00.000Z')
  assert.equal(leggTilManeder('2026-01-31T00:00:00.000Z', 1), '2026-02-28T00:00:00.000Z')
})
