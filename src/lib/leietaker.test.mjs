import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leietaker, leietakerTekst, prosjektNavn } from './leietaker.ts'

const ola = { navn: 'Ola Nordmann', telefon: null }
const kvamsøy = { navn: 'Kvamsøy bru', nummer: 'P-2317' }

test('kundeleie viser kunden', () => {
  assert.deepEqual(
    leietaker({ ansatt_id: null, kunder: { navn: 'Kari Kunde', telefon: '90000000' } }),
    { intern: false, navn: 'Kari Kunde', telefon: '90000000', prosjekt: null },
  )
})

test('internleie viser ansatt og prosjekt med nummer', () => {
  assert.deepEqual(leietaker({ ansatt_id: 'a1', ansatt: ola, prosjekter: kvamsøy }), {
    intern: true,
    navn: 'Ola Nordmann',
    telefon: null,
    prosjekt: 'Kvamsøy bru (P-2317)',
  })
})

test('prosjekt uten nummer er bare navnet', () => {
  assert.equal(prosjektNavn({ navn: 'Lager', nummer: null }), 'Lager')
})

test('manglende innbygde rader velter ingenting', () => {
  assert.deepEqual(leietaker({ ansatt_id: 'a1' }), {
    intern: true,
    navn: 'Ukjent ansatt',
    telefon: null,
    prosjekt: null,
  })
  assert.deepEqual(leietaker({}), { intern: false, navn: '–', telefon: null, prosjekt: null })
})

test('på én linje', () => {
  assert.equal(
    leietakerTekst({ ansatt_id: 'a1', ansatt: ola, prosjekter: { navn: 'Kvamsøy bru', nummer: null } }),
    'Ola Nordmann · Kvamsøy bru',
  )
  assert.equal(leietakerTekst({ kunder: { navn: 'Kari', telefon: '1' } }), 'Kari')
})
