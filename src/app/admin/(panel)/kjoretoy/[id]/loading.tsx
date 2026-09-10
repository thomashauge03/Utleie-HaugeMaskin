import { DetaljSkjelett } from '@/components/skjelett'

/**
 * Må finnes selv om den er triviell: uten en egen loading.tsx her
 * arver detaljsiden listeskjelettet fra mappa over, og da blinker
 * feil form opp før innholdet.
 */
export default function Laster() {
  return <DetaljSkjelett kort={4} />
}
