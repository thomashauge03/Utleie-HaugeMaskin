import { KundeSkjelett } from '@/components/skjelett'

/*
 * Dette er siden kunden står med ute på plassen, ofte på mobildata.
 * Den skal vise at noe skjer med én gang QR-en er skannet.
 */
export default function Laster() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
      <KundeSkjelett />
    </main>
  )
}
