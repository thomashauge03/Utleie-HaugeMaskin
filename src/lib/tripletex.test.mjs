import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LINJETEKST,
  TripletexFeil,
  byggOrdre,
  finnKunde,
  leggVedOrdre,
  opprettOrdre,
  sesjonstoken,
} from './tripletex.ts'

/** Falsk fetch som husker hvert kall og svarer fra lista. */
function falskHent(...svar) {
  const kall = []
  const hent = async (url, init) => {
    kall.push({ url: String(url), metode: init?.method ?? 'GET', init })
    const neste = svar.shift()
    if (neste instanceof Error) throw neste
    return new Response(typeof neste.kropp === 'string' ? neste.kropp : JSON.stringify(neste.kropp ?? {}), {
      status: neste.status ?? 200,
    })
  }
  return { hent, kall }
}

const grunnlag = { kundeId: 44017379, belop: 1250.5, dato: '2026-10-27', referanse: 'HM-1001', maskin: 'Minigraver' }

/*
 * Fila skal aldri kunne fakturere eller sende noe. Hvert kall i prøvene
 * samles og sjekkes mot denne lista, med metode og adresse.
 */
const TILLATT = [
  /^POST https:\/\/tripletex\.no\/v2\/token\/session\/:createFromRefreshToken$/,
  /^GET https:\/\/tripletex\.no\/v2\/customer\?from=\d+&count=1000&fields=id,customerNumber,name$/,
  /^POST https:\/\/tripletex\.no\/v2\/order$/,
  /^PUT https:\/\/tripletex\.no\/v2\/order\/\d+\/:attach\?addToInvoiceMode=NEXT&addToOrderMode=NONE$/,
]
function sjekkTillatt(kall) {
  for (const k of kall) {
    const linje = `${k.metode} ${k.url}`
    assert.ok(TILLATT.some((r) => r.test(linje)), `ikke tillatt: ${linje}`)
    assert.doesNotMatch(new URL(k.url).pathname, /invoice|:send|sendToCustomer/i)
  }
}

test('ordren har én linje, «Pris ihht vedlegg», med beløpet eks. mva.', () => {
  const o = byggOrdre(grunnlag)
  assert.equal(o.orderLines.length, 1)
  assert.deepEqual(o.orderLines[0], {
    description: LINJETEKST,
    count: 1,
    unitPriceExcludingVatCurrency: 1250.5,
    vatType: { id: 3 },
  })
  assert.equal(LINJETEKST, 'Pris ihht vedlegg')
  assert.equal(o.isPrioritizeAmountsIncludingVat, false)
  assert.equal('unitPriceIncludingVatCurrency' in o.orderLines[0], false)
  assert.deepEqual(o.customer, { id: 44017379 })
  assert.equal(o.orderDate, '2026-10-27')
  assert.match(o.internalComment, /HM-1001/)
})

test('beløpet rundes til øre', () => {
  assert.equal(byggOrdre({ ...grunnlag, belop: 99.999 }).orderLines[0].unitPriceExcludingVatCurrency, 100)
})

test('ingen ordre på 0 kr, minus eller NaN', () => {
  for (const belop of [0, -5, NaN, Infinity]) {
    assert.throws(() => byggOrdre({ ...grunnlag, belop }), /beløp/)
  }
  assert.throws(() => byggOrdre({ ...grunnlag, dato: '27.10.2026' }), /dato/)
})

test('sesjonstokenet: nøkkelen står i kroppen, ikke i adressen', async () => {
  const { hent, kall } = falskHent({ kropp: { value: { token: 'tok' } } })
  assert.equal(await sesjonstoken('hemmelig', hent), 'tok')
  assert.doesNotMatch(kall[0].url, /hemmelig/)
  assert.match(kall[0].init.body, /hemmelig/)
  sjekkTillatt(kall)
})

test('feil nøkkel gir vår egen melding', async () => {
  const { hent } = falskHent({ status: 401, kropp: { message: 'token hemmelig ugyldig' } })
  await assert.rejects(sesjonstoken('x', hent), (e) => {
    assert.ok(e instanceof TripletexFeil)
    assert.match(e.message, /TRIPLETEX_NOKKEL/)
    assert.equal(e.tripletexTekst, '')
    assert.equal(e.kanVaereUtfort, false)
    return true
  })
})

test('kunden finnes på kundenummer, også på side to', async () => {
  const side1 = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, customerNumber: 10000 + i, name: `K${i}` }))
  const { hent, kall } = falskHent(
    { kropp: { values: side1 } },
    { kropp: { values: [{ id: 777, customerNumber: 30753, name: 'Kari Nordmann AS' }] } },
  )
  assert.deepEqual(await finnKunde('tok', 30753, hent), { id: 777, navn: 'Kari Nordmann AS' })
  assert.equal(kall.length, 2)
  assert.match(kall[1].url, /from=1000/)
  sjekkTillatt(kall)
})

test('ukjent kundenummer gir null, ikke en annen kunde', async () => {
  const { hent } = falskHent({ kropp: { values: [{ id: 1, customerNumber: 123, name: 'Feil' }] } })
  assert.equal(await finnKunde('tok', 12, hent), null)
})

test('kundenummeret må være likt som tall, ikke som tekst', async () => {
  const { hent } = falskHent({ kropp: { values: [{ id: 1, customerNumber: '30753', name: 'Tekst' }] } })
  assert.equal(await finnKunde('tok', 30753, hent), null)
})

test('ordren opprettes med POST og gir id og ordrenummer', async () => {
  const { hent, kall } = falskHent({ status: 201, kropp: { value: { id: 507737853, number: '1042' } } })
  assert.deepEqual(await opprettOrdre('tok', byggOrdre(grunnlag), hent), { id: 507737853, nummer: '1042' })
  assert.equal(kall[0].metode, 'POST')
  assert.match(kall[0].init.headers.Authorization, /^Basic /)
  sjekkTillatt(kall)
})

test('avvist ordre: ingenting er opprettet, og teksten vises uten å bli meldingen', async () => {
  const { hent } = falskHent({
    status: 422,
    kropp: { message: 'Validering feilet', validationMessages: [{ field: 'customer', message: 'Kari finnes ikke' }] },
  })
  await assert.rejects(opprettOrdre('tok', byggOrdre(grunnlag), hent), (e) => {
    assert.equal(e.kanVaereUtfort, false)
    assert.match(e.tripletexTekst, /Kari finnes ikke/)
    assert.doesNotMatch(e.message, /Kari/)
    assert.doesNotMatch(JSON.stringify(e), /Kari/)
    return true
  })
})

test('serverfeil, tidsavbrudd og ok uten id: ordren KAN finnes', async () => {
  for (const svar of [{ status: 500 }, { status: 502 }, new TypeError('fetch failed'), { status: 200, kropp: {} }]) {
    const { hent } = falskHent(svar)
    await assert.rejects(opprettOrdre('tok', byggOrdre(grunnlag), hent), (e) => {
      assert.equal(e.kanVaereUtfort, true, String(svar.status ?? svar))
      assert.match(e.message, /kan være opprettet/)
      return true
    })
  }
})

test('ordren prøves aldri på nytt av seg selv', async () => {
  const { hent, kall } = falskHent({ status: 503 }, { status: 201, kropp: { value: { id: 1 } } })
  await assert.rejects(opprettOrdre('tok', byggOrdre(grunnlag), hent))
  assert.equal(kall.length, 1)
})

test('vedlegget: PUT med NEXT og NONE, og PDF-en som fil', async () => {
  const { hent, kall } = falskHent({ status: 200 })
  const pdf = new TextEncoder().encode('%PDF-1.4 test')
  await leggVedOrdre('tok', 507737853, pdf, 'fakturagrunnlag-HM-1001.pdf', hent)
  assert.equal(kall[0].metode, 'PUT')
  const fil = kall[0].init.body.get('file')
  assert.equal(fil.name, 'fakturagrunnlag-HM-1001.pdf')
  assert.equal(fil.type, 'application/pdf')
  sjekkTillatt(kall)
})

test('vedlegg uten svar KAN være lagt ved, avvist er det ikke', async () => {
  const pdf = new Uint8Array([1])
  await assert.rejects(leggVedOrdre('tok', 1, pdf, 'a.pdf', falskHent({ status: 500 }).hent), (e) => e.kanVaereUtfort === true)
  await assert.rejects(leggVedOrdre('tok', 1, pdf, 'a.pdf', falskHent({ status: 404 }).hent), (e) => e.kanVaereUtfort === false)
})

test('ugyldig ordre-id gir ingen adresse', async () => {
  const { hent, kall } = falskHent()
  await assert.rejects(leggVedOrdre('tok', 0, new Uint8Array([1]), 'a.pdf', hent))
  assert.equal(kall.length, 0)
})
