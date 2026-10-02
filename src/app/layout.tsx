import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Barlow_Condensed } from 'next/font/google'
import './globals.css'
import { Lukkar } from '@/components/Lukkar'
import { Nokkelknapp } from '@/components/Nokkelknapp'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

// Kondensert og industriell – samme familie av former som logoen.
const barlow = Barlow_Condensed({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'HM Utleie', template: '%s' },
  description:
    'Hauge Maskin utleie. Skann QR-koden på maskinen for å leie – uten innlogging.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0b0c',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="nb"
      className={`${geistSans.variable} ${geistMono.variable} ${barlow.variable} h-full`}
      /* Lukkeren setter data-hm-lukkar på <html> før React tar over sida.
         Uten denne regnes attributtet som et avvik. Gjelder bare <html>
         selv, ikke det som ligger inni. */
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {/* Først i body, så platene er malt før noe annet rekker å vises. */}
        <Lukkar />
        {/* Rett etter lukkeren: nøkkelknappen må ligge i HTML-en serveren sender. */}
        <Nokkelknapp />
        {children}
      </body>
    </html>
  )
}
