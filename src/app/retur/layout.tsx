import { hentAdmin } from '@/lib/auth'
import { SkannIntro } from '@/components/skann-intro'

// Egne folk sendes videre til /ansatt, og der hører ingen intro hjemme.
// Kunder med én leie sendes til /leie/…/retur, som fortsetter introen.
export default async function ReturLayout({ children }: LayoutProps<'/retur'>) {
  const ansatt = await hentAdmin()
  return (
    <>
      {!ansatt && <SkannIntro tittel="Lever tilbake" />}
      {children}
    </>
  )
}
