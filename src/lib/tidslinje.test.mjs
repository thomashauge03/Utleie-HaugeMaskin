import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baner, plasser } from './tidslinje.ts'

const OKTOBER = ['2026-10-01', '2026-10-31']

test('periode inne i måneden får dagene sine som kolonner', () => {
  assert.deepEqual(plasser({ fra: '2026-10-03', til: '2026-10-09' }, ...OKTOBER), {
    fraKol: 3,
    tilKol: 9,
    førMåneden: false,
    etterMåneden: false,
  })
})

test('periode som begynte før måneden, starter i kolonne 1', () => {
  assert.deepEqual(plasser({ fra: '2026-09-28', til: '2026-10-02' }, ...OKTOBER), {
    fraKol: 1,
    tilKol: 2,
    førMåneden: true,
    etterMåneden: false,
  })
})

test('uten slutt går perioden ut måneden og fortsetter', () => {
  assert.deepEqual(plasser({ fra: '2026-09-20', til: null }, ...OKTOBER), {
    fraKol: 1,
    tilKol: 31,
    førMåneden: true,
    etterMåneden: true,
  })
})

test('uten slutt dekker den hele neste måned også', () => {
  assert.deepEqual(plasser({ fra: '2026-10-05', til: null }, '2026-11-01', '2026-11-30'), {
    fraKol: 1,
    tilKol: 30,
    førMåneden: true,
    etterMåneden: true,
  })
})

test('slutt på siste dag i måneden fortsetter ikke', () => {
  assert.equal(plasser({ fra: '2026-10-20', til: '2026-10-31' }, ...OKTOBER).etterMåneden, false)
})

test('periode helt før eller helt etter måneden tegnes ikke', () => {
  assert.equal(plasser({ fra: '2026-09-08', til: '2026-09-15' }, ...OKTOBER), null)
  assert.equal(plasser({ fra: '2026-11-02', til: '2026-11-04' }, ...OKTOBER), null)
  assert.equal(plasser({ fra: '2026-11-02', til: null }, ...OKTOBER), null)
})

test('periode som slutter før den begynner, tegnes ikke', () => {
  assert.equal(plasser({ fra: '2026-10-10', til: '2026-10-08' }, ...OKTOBER), null)
})

test('stolper som overlapper, havner i hver sin bane', () => {
  const ubestemt = { id: 'ubestemt', fraKol: 1, tilKol: 31 }
  const reservasjon = { id: 'reservasjon', fraKol: 20, tilKol: 22 }
  assert.deepEqual(
    baner([reservasjon, ubestemt]).map((bane) => bane.map((s) => s.id)),
    [['ubestemt'], ['reservasjon']],
  )
})

test('stolper etter hverandre deler bane, men ikke når de deler en dag', () => {
  const a = { id: 'a', fraKol: 3, tilKol: 9 }
  const b = { id: 'b', fraKol: 10, tilKol: 12 }
  const c = { id: 'c', fraKol: 9, tilKol: 11 }
  assert.deepEqual(
    baner([b, c, a]).map((bane) => bane.map((s) => s.id)),
    [['a', 'b'], ['c']],
  )
})
