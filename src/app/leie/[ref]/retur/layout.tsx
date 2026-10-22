import { SkannIntro } from '@/components/skann-intro'

// Samme tittel som på /retur, som sender hit når kunden har én leie –
// introen fortsetter da der den var, uten å hoppe. Kommer man fra
// leiesida med et trykk, vises den ikke (se SkannIntro).
export default function LeieReturLayout({ children }: LayoutProps<'/leie/[ref]/retur'>) {
  return (
    <>
      <SkannIntro tittel="Lever tilbake" />
      {children}
    </>
  )
}
