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
 * Matcher alle sider der en innlogget bruker kan stå: adminpanelet,
 * verkstedet, uttakssiden og kundesidene, der ansatte får egne valg.
 * Server components kan ikke skrive informasjonskapsler, så uten dette
 * ble en utløpt sesjon på de sidene aldri fornyet, og brukeren ble
 * logget ut etter omtrent en time.
 */
export async function proxy(request: NextRequest) {
  // Uten Supabase-informasjonskapsel finnes det ingen sesjon å friske
  // opp. Det gjelder alle kunder på /m og /retur – de skal ikke betale
  // et nettverkskall for en innlogging de ikke har.
  if (!request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) {
    return NextResponse.next({ request })
  }

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
  matcher: ['/admin/:path*', '/ansatt/:path*', '/verksted/:path*', '/m/:path*', '/retur'],
}
