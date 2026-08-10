import { DetaljSkjelett } from '@/components/skjelett'

/*
 * Egen fil selv om /verksted/loading.tsx ville dekket ruta: den tegner
 * søkefelt og en liste med maskinkort, altså feil form for én maskin.
 */
export default function Laster() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-7">
      <DetaljSkjelett kort={4} />
    </main>
  )
}
