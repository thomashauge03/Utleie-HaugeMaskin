import { OversiktSkjelett } from '@/components/skjelett'

/*
 * Uten denne blir hele panelet stående på forrige side til serveren er
 * ferdig – trykket ser ut som om det ikke ble registrert. Med den bytter
 * innholdet umiddelbart, mens toppen og menyen står i ro.
 *
 * Gjelder /admin og alle undersider som ikke har sin egen.
 */
export default function Laster() {
  return <OversiktSkjelett />
}
