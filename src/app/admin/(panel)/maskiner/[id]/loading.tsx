import { DetaljSkjelett } from '@/components/skjelett'

// Uten denne arver detaljsiden listeskjelettet fra maskiner/loading.tsx.
export default function Laster() {
  return <DetaljSkjelett kort={3} />
}
