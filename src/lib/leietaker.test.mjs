import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leietaker, leietakerTekst, opptattGrunn, prosjektNavn } from './leietaker.ts'

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

const meg = 'meg'
const ledig = { status: 'ledig', påVerksted: false, leie: null, megId: meg }

test('ledig maskin kan tas ut', () => {
  assert.equal(opptattGrunn(ledig), null)
})

test('hos kunde står det bare «Utleid», aldri navnet', () => {
  assert.equal(
    opptattGrunn({ ...ledig, status: 'utleid', leie: { ansatt_id: null, ansattNavn: null, prosjekt: null } }),
    'Utleid',
  )
})

test('hos deg selv', () => {
  assert.equal(
    opptattGrunn({ ...ledig, status: 'utleid', leie: { ansatt_id: meg, ansattNavn: 'Deg', prosjekt: 'Kvamsøy bru' } }),
    'Hos deg · Kvamsøy bru',
  )
})

test('hos en kollega, så du vet hvem du skal spørre', () => {
  assert.equal(
    opptattGrunn({ ...ledig, status: 'utleid', leie: { ansatt_id: 'ola', ansattNavn: 'Ola Nordmann', prosjekt: 'Kvamsøy bru' } }),
    'Hos Ola Nordmann · Kvamsøy bru',
  )
})

test('verksted og service', () => {
  assert.equal(opptattGrunn({ ...ledig, påVerksted: true }), 'Til reparasjon')
  assert.equal(opptattGrunn({ ...ledig, status: 'service' }), 'Ute av drift')
})
