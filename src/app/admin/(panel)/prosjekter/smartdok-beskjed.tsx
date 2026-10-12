const ADMINBORDET = 'https://hauge-maskin-adminbord.vercel.app/prosjekter'

/**
 * Prosjektlista eies av SmartDok og skrives hit av synken i adminbordet.
 * Endringer gjort her ville blitt overskrevet innen et kvarter, så appen
 * viser bare lista og forteller hvor den rettes.
 */
export function SmartDokBeskjed() {
  return (
    <p className="border-l-4 border-[var(--kant-sterk)] bg-[var(--flate-2)] p-3 text-sm">
      Prosjektene hentes fra SmartDok gjennom adminbordet. Nye prosjekter
      opprettes i SmartDok eller under{' '}
      <a href={ADMINBORDET} className="font-semibold underline underline-offset-4">
        Prosjekter i adminbordet
      </a>
      , og dukker opp her innen et kvarter.
    </p>
  )
}
