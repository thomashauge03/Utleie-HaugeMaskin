'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { krevAdmin } from '@/lib/auth'
import { lagServerKlient } from '@/lib/supabase/server'

const status = z.enum(['ny', 'godkjent', 'sperret'])

export async function settKundeStatus(kundeId: string, ny: string) {
  await krevAdmin()
  const gyldig = status.safeParse(ny)
  if (!gyldig.success) return

  const supabase = await lagServerKlient()
  await supabase.from('kunder').update({ status: gyldig.data }).eq('id', kundeId)
  revalidatePath('/admin/kunder')
}

export async function lagreKundeNotat(kundeId: string, notat: string) {
  await krevAdmin()
  const supabase = await lagServerKlient()
  await supabase
    .from('kunder')
    .update({ admin_notat: notat.trim() || null })
    .eq('id', kundeId)
  revalidatePath('/admin/kunder')
}
