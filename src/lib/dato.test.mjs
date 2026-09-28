import { test } from 'node:test'
import assert from 'node:assert/strict'
import { norskSluttAvDag, returDato } from './dato.ts'

test('vintertid: 23:59:59 norsk er 22:59:59 UTC', () => {
  assert.equal(norskSluttAvDag('2026-01-15')?.toISOString(), '2026-01-15T22:59:59.000Z')
})

test('sommertid: 23:59:59 norsk er 21:59:59 UTC', () => {
  assert.equal(norskSluttAvDag('2026-07-15')?.toISOString(), '2026-07-15T21:59:59.000Z')
})

test('feil format gir null', () => {
  assert.equal(norskSluttAvDag('15.07.2026'), null)
  assert.equal(norskSluttAvDag(''), null)
})

test('uten dato står det «til videre»', () => {
  assert.equal(returDato(null), 'til videre')
  assert.equal(returDato('2026-07-15T21:59:59.000Z'), '15.07.2026')
})
