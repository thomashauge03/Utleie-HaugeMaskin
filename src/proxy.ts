import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'

/**
 * Het `middleware.ts` fram til Next.js 16.
 *
 * Eneste oppgave her er å friske opp Supabase-sesjonen slik at
 * innloggede admins ikke blir kastet ut midt i en økt. Selve
 * tilgangskontrollen ligger i `src/app/admin/layout.tsx` og i hver
 * enkelt server action – Next-dokumentasjonen er tydelig på at proxy
 * ikke skal være eneste autorisasjonsmekanisme, blant annet fordi
 * server actions kjører som POST mot siden de brukes fra.
 *
 * Matcher kun /admin. Kundeflyten har ingen sesjon å friske opp, og
 * skal slippe et unødvendig nettverkskall per forespørsel.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
