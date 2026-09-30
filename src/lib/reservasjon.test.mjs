import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ansattVarsel,
  dagFør,
  egneReservasjoner,
  kortDag,
  kundeGrense,
  nesteReservasjon,
  reservasjonTekst,
} from './reservasjon.ts'

const r = (fra, til, mer = {}) => ({
  id: fra,
  maskin_id: 'm',
  fra_dato: fra,
  til_dato: til,
  kunde_navn: 'Ola',
  kunde_telefon: '90000000',
  status: 'aktiv',
  ...mer,
})

test('dagen før, over måneds- og årsskifte og skuddår', () => {
  assert.equal(dagFør('2026-10-14'), '2026-10-13')
  assert.equal(dagFør('2026-11-01'), '2026-10-31')
  assert.equal(dagFør('2027-01-01'), '2026-12-31')
  assert.equal(dagFør('2028-03-01'), '2028-02-29')
})

test('kort dag', () => {
  assert.equal(kortDag('2026-10-04'), '04.10.')
})

test('neste reservasjon er den tidligste aktive som ikke er over', () => {
  const liste = [
    r('2026-11-01', '2026-11-02'),
    r('2026-10-14', '2026-10-16'),
    r('2026-09-01', '2026-09-05'),
    r('2026-10-10', '2026-10-11', { status: 'avlyst' }),
    r('2026-10-12', '2026-10-12', { status: 'hentet' }),
    r('2026-10-05', '2026-10-06', { status: 'forespurt' }),
  ]
  assert.equal(nesteReservasjon(liste, '2026-10-01')?.fra_dato, '2026-10-14')
  assert.equal(nesteReservasjon([], '2026-10-01'), null)
})

test('egen mobil teller ikke som neste reservasjon', () => {
  const liste = [
    r('2026-10-14', '2026-10-16', { kunde_telefon: '41111111' }),
    r('2026-10-20', '2026-10-21'),
  ]
  assert.equal(nesteReservasjon(liste, '2026-10-01', '41111111')?.fra_dato, '2026-10-20')
})

test('kundegrensen: fri, frist og sperret', () => {
  const liste = [r('2026-10-14', '2026-10-16')]
  assert.deepEqual(kundeGrense([], '2026-10-01'), { type: 'fri' })
  assert.deepEqual(kundeGrense(liste, '2026-10-01'), {
    type: 'frist',
    fra: '2026-10-14',
    sisteDag: '2026-10-13',
  })
  assert.deepEqual(kundeGrense(liste, '2026-10-14'), { type: 'sperret', til: '2026-10-16' })
  assert.deepEqual(kundeGrense(liste, '2026-10-16'), { type: 'sperret', til: '2026-10-16' })
  assert.deepEqual(kundeGrense(liste, '2026-10-17'), { type: 'fri' })
})

test('starter reservasjonen i morgen, må kunden levere i dag', () => {
  assert.deepEqual(kundeGrense([r('2026-10-02', '2026-10-03')], '2026-10-01'), {
    type: 'frist',
    fra: '2026-10-02',
    sisteDag: '2026-10-01',
  })
})

test('kunden med reservasjonen sperres av neste, ikke av sin egen', () => {
  const liste = [
    r('2026-10-14', '2026-10-16', { kunde_telefon: '41111111' }),
    r('2026-10-20', '2026-10-21'),
  ]
  assert.deepEqual(kundeGrense(liste, '2026-10-14', '41111111'), {
    type: 'frist',
    fra: '2026-10-20',
    sisteDag: '2026-10-19',
  })
})

test('tekstene nevner aldri kunden', () => {
  assert.equal(
    reservasjonTekst(r('2026-10-14', '2026-10-16'), '2026-10-01'),
    'Reservert fra 14.10. – lever innen 13.10.',
  )
  assert.equal(
    reservasjonTekst(r('2026-10-14', '2026-10-16'), '2026-10-15'),
    'Reservert for en kunde til 16.10.',
  )
})

test('ansattvarsel bare når returen går inn i reservasjonen', () => {
  const liste = [r('2026-10-14', '2026-10-16')]
  assert.equal(ansattVarsel(liste, '2026-10-01', '2026-10-13'), null)
  assert.equal(
    ansattVarsel(liste, '2026-10-01', '2026-10-14'),
    'Reservert fra 14.10. – lever innen 13.10.',
  )
  assert.equal(
    ansattVarsel(liste, '2026-10-01', null),
    'Reservert fra 14.10. – lever innen 13.10.',
  )
  assert.equal(ansattVarsel([], '2026-10-01', null), null)
})

test('egne reservasjoner som leien dekker', () => {
  const liste = [
    r('2026-10-14', '2026-10-16', { id: 'a', kunde_telefon: '41111111' }),
    r('2026-10-20', '2026-10-21', { id: 'b', kunde_telefon: '41111111' }),
    r('2026-10-14', '2026-10-16', { id: 'c' }),
  ]
  assert.deepEqual(egneReservasjoner(liste, '41111111', '2026-10-14', '2026-10-16'), ['a'])
  assert.deepEqual(egneReservasjoner(liste, '41111111', '2026-10-14', '2026-10-25'), ['a', 'b'])
})
