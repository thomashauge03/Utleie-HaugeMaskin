import { supabaseAdmin } from '@/lib/supabase/admin'
import { SkannIntro } from '@/components/skann-intro'

/**
 * Introen ligger i layouten, ikke på siden: da står den i det første
 * svaret og dekker ventetiden mens siden henter leien og prosjektene.
 */
export default async function MaskinLayout(props: LayoutProps<'/m/[qr]'>) {
  const { qr } = await props.params
  const { data } = await supabaseAdmin
    .from('maskiner')
    .select('navn, kategori')
    .eq('qr_kode', qr)
    .eq('aktiv', true)
    .maybeSingle()

  return (
    <>
      {data && <SkannIntro tittel={data.navn} under={data.kategori} />}
      {props.children}
    </>
  )
}
