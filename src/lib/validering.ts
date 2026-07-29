/**
 * Delte valideringsregler.
 *
 * Bildestien må ha nøyaktig formatet route-handleren i
 * /api/bilder/ny genererer: «ÅÅÅÅ-MM/<type>-<uuid>.jpg». Uten denne
 * sjekken kunne en klient sendt en vilkårlig streng som «bilde_sti»,
 * og server action ville lagret den ukritisk.
 */
export const BILDE_STI =
  /^\d{4}-\d{2}\/(henting|levering)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/

export const MAKS_KOMMENTAR = 1000
