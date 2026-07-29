import type { NextConfig } from 'next'

// Bildene ligger i Supabase Storage. next/image krever at verten er
// eksplisitt tillatt – `images.domains` er utfaset i Next 16.
const supabaseVert = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseVert
      ? [{ protocol: 'https', hostname: supabaseVert, pathname: '/storage/v1/object/**' }]
      : [],
  },

  // Sikkerhetshoder på alle svar. Ingen CSP her: den krever nøye
  // tilpasning til Next sine inline-skript og ville lett brutt appen
  // uten å gi mye i en app uten brukergenerert HTML. De under er trygge
  // og fanger de vanligste angrepene.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Hindrer at siden legges i en <iframe> på et fremmed nettsted
          // (clickjacking).
          { key: 'X-Frame-Options', value: 'DENY' },
          // Nettleseren skal ikke gjette filtype og f.eks. kjøre en
          // opplastet fil som skript.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Lekk aldri full URL med referanse eller token til andre nettsteder.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Slå av API-er siden ikke bruker. Geoposisjon trengs på
          // kundeflyten og beholdes for eget opphav.
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), geolocation=(self), microphone=(), payment=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
