import { SkannIntro } from '@/components/skann-intro'

export default async function KategoriLayout(props: LayoutProps<'/kategori/[navn]'>) {
  const { navn } = await props.params
  return (
    <>
      <SkannIntro tittel={decodeURIComponent(navn)} under="Velg hvilken du tar" />
      {props.children}
    </>
  )
}
