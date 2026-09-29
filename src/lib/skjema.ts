'use client'

import { startTransition, type FormEvent } from 'react'

/**
 * onSubmit som sender skjemaet uten at React tømmer feltene etterpå.
 *
 * Med bare `<form action>` nullstiller React alle ukontrollerte felt
 * etter hver innsending – også når handlingen svarer med en feil. Da
 * forsvant det folk hadde skrevet: en kunde med en skrivefeil i
 * mobilnummeret måtte fylle ut hele leieskjemaet på nytt. Stoppes
 * innsendingen her og handlingen kjøres i en transition, lar React
 * feltene stå, og useFormStatus virker som før.
 *
 * La `action` stå på skjemaet i tillegg: den tar innsendinger som kommer
 * før siden er ferdig lastet. Skal feltene tømmes når det gikk bra, må
 * skjemaet gjøre det selv (`skjema.current?.reset()`).
 */
export function utenNullstilling(handling: (fd: FormData) => void | Promise<void>) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const knapp = (e.nativeEvent as SubmitEvent).submitter
    const fd = new FormData(e.currentTarget, knapp)
    startTransition(() => handling(fd))
  }
}
