import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trygtNeste } from './neste.ts'

test('lokale stier godtas', () => {
  assert.equal(trygtNeste('/m/M-0012'), '/m/M-0012')
  assert.equal(trygtNeste('/ansatt'), '/ansatt')
})

test('alt som kan peke til en annen vert avvises', () => {
  for (const ond of ['//evil.no', '/\\evil.no', 'https://evil.no', 'evil.no', '/\t/evil.no', '']) {
    assert.equal(trygtNeste(ond), null, JSON.stringify(ond))
  }
})

test('manglende eller ikke-tekst avvises', () => {
  assert.equal(trygtNeste(null), null)
  assert.equal(trygtNeste(undefined), null)
  assert.equal(trygtNeste(['/ansatt']), null)
})
