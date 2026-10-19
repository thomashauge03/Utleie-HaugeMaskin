import { test } from 'node:test'
import assert from 'node:assert/strict'
import { norskSluttAvDag, nyligLevert, returDato } from './dato.ts'

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

test('uten dato står det «ubestemt tid»', () => {
  assert.equal(returDato(null), 'ubestemt tid')
  assert.equal(returDato('2026-07-15T21:59:59.000Z'), '15.07.2026')
})

const dagerSiden = (n) => new Date(Date.now() - n * 86_400_000).toISOString()

test('levert de siste dagene vises som nylig levert', () => {
  assert.equal(nyligLevert(new Date().toISOString()), 'Levert i dag')
  assert.equal(nyligLevert(dagerSiden(1)), 'Levert i går')
  assert.equal(nyligLevert(dagerSiden(3)), 'Levert for 3 dager siden')
})

test('eldre leveringer er ikke nylige', () => {
  assert.equal(nyligLevert(dagerSiden(4)), null)
  assert.equal(nyligLevert(dagerSiden(30)), null)
})
