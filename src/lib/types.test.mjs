import { test } from 'node:test'
import assert from 'node:assert/strict'
import { erForfalt } from './types.ts'

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
