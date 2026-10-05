import { test } from 'node:test'
import assert from 'node:assert/strict'
import { erForfalt, påUbestemtTid } from './types.ts'

test('internleie uten dato er aldri forfalt', () => {
  assert.equal(erForfalt({ status: 'aktiv', planlagt_slutt: null }), false)
})

test('aktiv leie med dato i går er forfalt', () => {
  const iGår = new Date(Date.now() - 86_400_000).toISOString()
  assert.equal(erForfalt({ status: 'aktiv', planlagt_slutt: iGår }), true)
})

test('avsluttet leie med dato i går er ikke forfalt', () => {
  const iGår = new Date(Date.now() - 86_400_000).toISOString()
  assert.equal(erForfalt({ status: 'avsluttet', planlagt_slutt: iGår }), false)
})

test('internleie uten dato er ute på ubestemt tid', () => {
  assert.equal(påUbestemtTid({ status: 'aktiv', planlagt_slutt: null }), true)
})

test('leie med dato er ikke på ubestemt tid', () => {
  assert.equal(
    påUbestemtTid({ status: 'aktiv', planlagt_slutt: '2026-10-20T21:59:59.000Z' }),
    false,
  )
})

test('levert internleie uten dato er ikke lenger ute', () => {
  assert.equal(påUbestemtTid({ status: 'avsluttet', planlagt_slutt: null }), false)
})
