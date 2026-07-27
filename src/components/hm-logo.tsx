import Image from 'next/image'

const høyder = { sm: 26, md: 36, lg: 56, xl: 84 } as const

/**
 * HM-logoen. Bakgrunnen er gjort gjennomsiktig, så den kan stå på både
 * hvitt og svart. Bredde/høyde er alltid satt for å unngå layouthopp
 * mens bildet lastes.
 */
export function HMLogo({
  størrelse = 'md',
  className = '',
}: {
  størrelse?: keyof typeof høyder
  className?: string
}) {
  const h = høyder[størrelse]
  const b = Math.round(h * (942 / 591))

  return (
    <Image
      src="/hm-logo.png"
      alt="Hauge Maskin"
      width={b}
      height={h}
      priority={størrelse === 'lg' || størrelse === 'xl'}
      className={`h-auto w-auto ${className}`}
      style={{ height: h, width: b }}
    />
  )
}
