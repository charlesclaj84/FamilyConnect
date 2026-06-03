'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface KidData {
  first_name: string
  middle_name?: string
  last_name: string
  date_of_birth?: string
  tshirt_category?: string
  tshirt_size?: string
}

export type KidRecord = KidData & {
  id: string
  parent_user_id: string
  family_code: string
  created_at: string
  updated_at: string
}

const normalize = (v?: string) => v?.trim() || null

export async function getKids(): Promise<KidRecord[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('kids')
    .select('*')
    .eq('parent_user_id', user.id)
    .order('date_of_birth', { ascending: true, nullsFirst: false })

  return data ?? []
}

export async function addKid(
  input: KidData
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const { error } = await supabase.from('kids').insert({
    parent_user_id: user.id,
    family_code: user.user_metadata?.family_code ?? '',
    first_name: input.first_name.trim(),
    middle_name: normalize(input.middle_name),
    last_name: input.last_name.trim(),
    date_of_birth: input.date_of_birth || null,
    tshirt_category: normalize(input.tshirt_category),
    tshirt_size: normalize(input.tshirt_size),
  })

  if (error) return { success: false, message: error.message }
  revalidatePath('/direct-lineage')
  return { success: true }
}

export async function updateKid(
  id: string,
  input: KidData
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const { error } = await supabase
    .from('kids')
    .update({
      first_name: input.first_name.trim(),
      middle_name: normalize(input.middle_name),
      last_name: input.last_name.trim(),
      date_of_birth: input.date_of_birth || null,
      tshirt_category: normalize(input.tshirt_category),
      tshirt_size: normalize(input.tshirt_size),
    })
    .eq('id', id)
    .eq('parent_user_id', user.id)

  if (error) return { success: false, message: error.message }
  revalidatePath('/direct-lineage')
  return { success: true }
}

export async function deleteKid(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const { error } = await supabase
    .from('kids')
    .delete()
    .eq('id', id)
    .eq('parent_user_id', user.id)

  if (error) return { success: false, message: error.message }
  revalidatePath('/direct-lineage')
  return { success: true }
}

export async function convertKidToAdult(
  kidId: string,
  email: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  // Fetch the kid — RLS ensures this user owns the record
  const { data: kid, error: fetchError } = await supabase
    .from('kids')
    .select('*')
    .eq('id', kidId)
    .eq('parent_user_id', user.id)
    .single()

  if (fetchError || !kid) return { success: false, message: 'Child record not found' }

  // Insert into adults using admin client (user_id is null — no auth account yet)
  const { error: insertError } = await admin.from('adults').insert({
    family_code: kid.family_code,
    first_name: kid.first_name,
    middle_name: kid.middle_name,
    last_name: kid.last_name,
    date_of_birth: kid.date_of_birth,
    tshirt_category: kid.tshirt_category,
    tshirt_size: kid.tshirt_size,
    primary_email: email.trim().toLowerCase(),
    user_id: null,
  })

  if (insertError) return { success: false, message: insertError.message }

  // Delete the kid record
  const { error: deleteError } = await supabase
    .from('kids')
    .delete()
    .eq('id', kidId)
    .eq('parent_user_id', user.id)

  if (deleteError) {
    // Attempt rollback — best effort
    await admin.from('adults').delete().eq('primary_email', email.trim().toLowerCase()).is('user_id', null)
    return { success: false, message: deleteError.message }
  }

  revalidatePath('/direct-lineage')
  return { success: true }
}
