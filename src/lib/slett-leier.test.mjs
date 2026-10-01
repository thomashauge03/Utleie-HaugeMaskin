import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filerIgjenTekst, slettLeier, slettefeil } from './slett-leier.ts'

/**
 * Falsk Supabase-klient for de tre kallene slettLeier gjør. Hvert kall
 * logges med argumentene, så både rekkefølgen og innholdet kan sjekkes.
 * Svarene har samme form som i supabase-js: `{ data, error }`, der data
 * er null når error er satt.
 */
function klient({ bilder = [], bildeFeil = null, slettet, sletteFeil = null, filFeil = null } = {}) {
  const kall = []
  const svar = (data, error) =>
    Promise.resolve({
      data: error ? null : data,
      error,
      count: null,
      status: error ? 409 : 200,
      statusText: error ? 'Conflict' : 'OK',
    })

  return {
    kall,
    from(tabell) {
      return {
        select(kolonner) {
          return {
            in(kolonne, verdier) {
              kall.push(['select', tabell, kolonner, kolonne, verdier])
              return svar(
                bilder.map((fil_sti) => ({ fil_sti })),
                bildeFeil,
              )
            },
          }
        },
        delete() {
          return {
            in(kolonne, verdier) {
              return {
                select(kolonner) {
                  kall.push(['delete', tabell, kolonne, verdier, kolonner])
                  return svar(
                    (slettet ?? verdier).map((id) => ({ id })),
                    sletteFeil,
                  )
                },
              }
            },
          }
        },
      }
    },
    storage: {
      from(bøtte) {
        return {
          remove(stier) {
            kall.push(['remove', bøtte, stier])
            return Promise.resolve({
              data: filFeil ? null : stier.map((name) => ({ name })),
              error: filFeil,
            })
          },
        }
      },
    },
  }
}

const RESERVASJON_LEIE = {
  code: '23503',
  message:
    'update or delete on table "leier" violates foreign key constraint ' +
    '"reservasjoner_leie_id_fkey" on table "reservasjoner"',
  details: 'Key (id)=(l1) is still referenced from table "reservasjoner".',
  hint: null,
}

test('radene slettes før filene', async () => {
  const db = klient({ bilder: ['2026-09/henting-a.jpg', '2026-09/levering-b.jpg'] })

  const svar = await slettLeier(db, ['l1', 'l2'])

  assert.deepEqual(db.kall, [
    ['select', 'bilder', 'fil_sti', 'leie_id', ['l1', 'l2']],
    ['delete', 'leier', 'id', ['l1', 'l2'], 'id'],
    ['remove', 'bilder', ['2026-09/henting-a.jpg', '2026-09/levering-b.jpg']],
  ])
  assert.deepEqual(svar, { slettet: 2, filerIgjen: [] })
})

test('nekter databasen å slette, røres ingen filer', async () => {
  const db = klient({ bilder: ['2026-09/henting-a.jpg'], sletteFeil: RESERVASJON_LEIE })

  const svar = await slettLeier(db, ['l1'])

  assert.equal(db.kall.some(([hva]) => hva === 'remove'), false)
  assert.equal(typeof svar.feil, 'string')
  assert.equal('slettet' in svar, false)
})

test('feiler bildeoppslaget, slettes ingenting', async () => {
  const db = klient({ bildeFeil: { code: '08000', message: 'tilkoblingen falt ut' } })

  const svar = await slettLeier(db, ['l1'])

  assert.deepEqual(db.kall, [['select', 'bilder', 'fil_sti', 'leie_id', ['l1']]])
  assert.match(svar.feil, /tilkoblingen falt ut/)
})

test('filer Storage ikke fjernet, kommer tilbake og logges med stiene', async (t) => {
  const logg = t.mock.method(console, 'error', () => {})
  const db = klient({
    bilder: ['2026-09/henting-a.jpg', '2026-09/levering-b.jpg'],
    filFeil: { message: 'Storage svarer ikke' },
  })

  const svar = await slettLeier(db, ['l1'])

  assert.deepEqual(svar, {
    slettet: 1,
    filerIgjen: ['2026-09/henting-a.jpg', '2026-09/levering-b.jpg'],
  })
  assert.equal(logg.mock.callCount(), 1)
  const skrevet = logg.mock.calls[0].arguments.flat().join(' ')
  assert.match(skrevet, /2026-09\/henting-a\.jpg/)
  assert.match(skrevet, /2026-09\/levering-b\.jpg/)
})

test('bare leiene som faktisk ble slettet, telles', async () => {
  // l2 var allerede borte – noen andre rakk det først.
  const db = klient({ slettet: ['l1'] })

  const svar = await slettLeier(db, ['l1', 'l2'])

  assert.deepEqual(svar, { slettet: 1, filerIgjen: [] })
})

test('ingen leier å slette gir ingen kall', async () => {
  const db = klient()

  const svar = await slettLeier(db, [])

  assert.deepEqual(db.kall, [])
  assert.deepEqual(svar, { slettet: 0, filerIgjen: [] })
})

test('leier uten bilder rører ikke Storage', async () => {
  const db = klient({ bilder: [] })

  await slettLeier(db, ['l1'])

  assert.deepEqual(
    db.kall.map(([hva]) => hva),
    ['select', 'delete'],
  )
})

test('en reservasjon som stopper slettingen, peker på migrasjon 0015', () => {
  for (const nøkkel of ['reservasjoner_leie_id_fkey', 'reservasjoner_maskin_id_fkey']) {
    const tekst = slettefeil({
      code: '23503',
      message: `update or delete on table "x" violates foreign key constraint "${nøkkel}" on table "reservasjoner"`,
    })
    assert.match(tekst, /0015_reservasjoner_slettes_med\.sql/, nøkkel)
  }
})

test('andre feil vises med databasens egen melding', () => {
  const annenNøkkel = {
    code: '23503',
    message:
      'update or delete on table "leier" violates foreign key constraint ' +
      '"fakturaer_leie_id_fkey" on table "fakturaer"',
  }
  const tekst = slettefeil(annenNøkkel)

  assert.doesNotMatch(tekst, /0015/)
  assert.ok(tekst.includes(annenNøkkel.message))
})

test('hendelsen nevner filer som ble liggende, og bare da', () => {
  assert.equal(filerIgjenTekst([]), '')
  assert.match(filerIgjenTekst(['a.jpg']), /\b1 bildefil\b/)
  assert.doesNotMatch(filerIgjenTekst(['a.jpg']), /bildefiler/)
  assert.match(filerIgjenTekst(['a.jpg', 'b.jpg']), /\b2 bildefiler\b/)
})
