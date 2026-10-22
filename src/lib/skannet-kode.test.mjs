import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tolkKode, videresendingsId } from './skannet-kode.ts'

const ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b'

test('etiketter fra QR-admin gir id-en til videresendingen', () => {
  assert.equal(videresendingsId(`https://qr-admin-fawn.vercel.app/q?k=${ID}`), ID)
  assert.equal(videresendingsId(` https://qr-admin-fawn.vercel.app/q/?k=${ID.toUpperCase()}\n`), ID)
})

test('alt annet er ingen videresending', () => {
  for (const tekst of [
    '',
    `https://x.no/q?k=ikke-en-id`,
    `https://x.no/q`,
    `https://x.no/r?k=${ID}`,
    `javascript:/q?k=${ID}`,
    'https://utleie-hauge-maskin.vercel.app/m/M-0007',
  ]) {
    assert.equal(videresendingsId(tekst), null, tekst)
  }
})

test('maskinkoden gir qr-koden', () => {
  assert.deepEqual(tolkKode('https://utleie-hauge-maskin.vercel.app/m/M-0007'), {
    type: 'maskin',
    qr: 'M-0007',
  })
})

test('verten spiller ingen rolle – koder med eldre adresse virker', () => {
  assert.deepEqual(tolkKode('http://localhost:3000/m/M-0001'), { type: 'maskin', qr: 'M-0001' })
})

test('spørring, anker, skråstrek til slutt og mellomrom tåles', () => {
  assert.deepEqual(tolkKode('  https://x.no/m/M-0007/?utm=1#a \n'), { type: 'maskin', qr: 'M-0007' })
})

test('kategorinavnet dekodes', () => {
  assert.deepEqual(tolkKode('https://x.no/kategori/Skuffer%20og%20grab'), {
    type: 'kategori',
    navn: 'Skuffer og grab',
  })
})

test('returkoden', () => {
  assert.deepEqual(tolkKode('https://x.no/retur'), { type: 'retur' })
})

test('alt annet er ukjent', () => {
  for (const tekst of [
    '',
    'M-0007',
    'hei',
    'https://x.no/',
    'https://x.no/m/',
    'https://x.no/m/a/b',
    'https://x.no/leie/L-2609-0001',
    'javascript:alert(1)',
    'https://x.no/kategori/%E0%A4%A',
  ]) {
    assert.deepEqual(tolkKode(tekst), { type: 'ukjent' }, tekst)
  }
})
