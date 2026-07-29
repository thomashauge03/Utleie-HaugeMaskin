import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Sier tydelig fra om utsending faktisk er satt opp.
 *
 * Uten dette ville brytere kunne stå på uten at en eneste e-post gikk
 * ut, og ingen ville oppdaget det før en kunde spurte hvorfor de aldri
 * fikk kvittering.
 */
export async function EpostStatus() {
  const klar = Boolean(process.env.RESEND_API_KEY && process.env.VARSEL_FRA)

  const { data: siste } = await supabaseAdmin
    .from('epost_logg')
    .select('type, mottaker, status, feilmelding, sendt')
    .order('sendt', { ascending: false })
    .limit(5)

  const feilet = (siste ?? []).filter((e) => e.status === 'feilet')

  return (
    <div className="border-b-2 border-[var(--kant)] p-5">
      {klar ? (
        <p className="border-l-4 border-hm-green bg-[var(--flate-2)] p-3 text-sm">
          <span className="font-bold text-hm-green">Utsending er satt opp.</span>{' '}
          Varsler sendes med adressen i <code className="font-mono text-xs">VARSEL_FRA</code>.
        </p>
      ) : (
        <div className="border-l-4 border-hm-amber bg-[var(--flate-2)] p-3 text-sm">
          <p className="font-bold">Utsending er ikke satt opp ennå</p>
          <p className="mt-1 text-[var(--blekk-svak)]">
            Bryterne under kan settes nå, men ingen e-post går ut før{' '}
            <code className="font-mono text-xs">RESEND_API_KEY</code> og{' '}
            <code className="font-mono text-xs">VARSEL_FRA</code> er lagt inn i Vercel.
            Avsenderdomenet må også verifiseres hos Resend — uten det kan
            e-post kun sendes til din egen adresse.
          </p>
        </div>
      )}

      {siste && siste.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold tracking-widest text-[var(--blekk-svak)] uppercase">
            Siste utsendinger
          </p>
          <ul className="space-y-1 text-xs">
            {siste.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-3">
                <span className="hm-tall text-[var(--blekk-svak)]">
                  {new Date(e.sendt).toLocaleString('nb-NO', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span
                  className={`font-bold ${e.status === 'sendt' ? 'text-hm-green' : 'text-hm-red-ink'}`}
                >
                  {e.status === 'sendt' ? '✓' : '✗'} {e.type}
                </span>
                <span className="text-[var(--blekk-svak)]">{e.mottaker}</span>
                {e.feilmelding && (
                  <span className="w-full text-hm-red-ink">{e.feilmelding}</span>
                )}
              </li>
            ))}
          </ul>
          {feilet.length > 0 && (
            <p className="mt-2 text-xs text-hm-red-ink">
              {feilet.length} av de siste {siste.length} feilet.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
