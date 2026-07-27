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
}

export default nextConfig
