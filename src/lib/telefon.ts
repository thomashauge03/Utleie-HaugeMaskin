/**
 * Normaliserer norske mobilnumre til åtte siffer uten mellomrom.
 *
 * Kunder skriver nummeret på alle tenkelige måter – «+47 900 00 000»,
 * «004790000000», «90 00 00 00». Uten normalisering blir samme person
 * til flere kunder i basen, og gjenkjenning ved neste leie svikter.
 */
export function normaliserTelefon(rå: string): string | null {
  const siffer = rå.replace(/[\s\-()]/g, '').replace(/^\+47/, '').replace(/^0047/, '')
  return /^\d{8}$/.test(siffer) ? siffer : null
}

/** 90000000 → «900 00 000» */
export function visTelefon(nummer: string): string {
  return /^\d{8}$/.test(nummer)
    ? `${nummer.slice(0, 3)} ${nummer.slice(3, 5)} ${nummer.slice(5)}`
    : nummer
}
