'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function uploadAvatar(
  formData: FormData
): Promise<{ success: boolean; url?: string; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { success: false, message: 'No file provided' }
  if (file.size > 2 * 1024 * 1024) return { success: false, message: 'File must be under 2 MB' }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${user.id}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return { success: false, message: uploadError.message }

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('people')
    .update({ avatar_url: publicUrl })
    .eq('user_id', user.id)

  if (updateError) return { success: false, message: updateError.message }

  revalidatePath('/personal-info')
  revalidatePath('/dashboard')
  return { success: true, url: publicUrl }
}

export interface PersonalInfoData {
  prefix?: string
  first_name: string
  middle_name?: string
  last_name: string
  nick_name?: string
  suffix?: string
  primary_email?: string
  primary_phone?: string
  street_address?: string
  apartment?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  date_of_birth?: string
  sunset_date?: string
  tshirt_category?: string
  tshirt_size?: string
  chapter_id?: string | null
  time_zone?: string | null
}

export type PersonalInfoRecord = PersonalInfoData & {
  id: string
  user_id: string
  family_code: string
  is_minor: boolean
  nick_name?: string | null
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export async function getPersonalInfo(): Promise<PersonalInfoRecord | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('people')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return data ?? null
}

// Saves only the supplied fields — used by the section-level edit cards.
// On conflict (existing record) Supabase updates ONLY the columns provided,
// leaving all other columns unchanged.
export async function saveProfileSection(
  fields: Partial<PersonalInfoData>
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const dateFields = new Set(['date_of_birth', 'sunset_date'])
  const cleaned: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(fields)) {
    if (dateFields.has(key)) {
      cleaned[key] = (val as string) || null
    } else if (typeof val === 'string') {
      cleaned[key] = val.trim() || null
    } else {
      cleaned[key] = val ?? null
    }
  }

  const { error } = await supabase
    .from('people')
    .upsert(
      {
        user_id: user.id,
        family_code: user.app_metadata?.family_code ?? '',
        is_minor: false,
        created_by: user.id,
        ...cleaned,
      },
      { onConflict: 'user_id' }
    )

  if (error) return { success: false, message: error.message }

  revalidatePath('/personal-info')
  return { success: true }
}

export async function upsertPersonalInfo(
  input: PersonalInfoData
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode = user.app_metadata?.family_code
  if (!familyCode) return { success: false, message: 'No family code associated with account' }

  const normalize = (v?: string) => v?.trim() || null

  const { error } = await supabase
    .from('people')
    .upsert(
      {
        user_id: user.id,
        family_code: familyCode,
        is_minor: false,
        created_by: user.id,
        prefix: normalize(input.prefix),
        first_name: input.first_name.trim(),
        middle_name: normalize(input.middle_name),
        last_name: input.last_name.trim(),
        suffix: normalize(input.suffix),
        primary_email: normalize(input.primary_email),
        primary_phone: normalize(input.primary_phone),
        street_address: normalize(input.street_address),
        apartment: normalize(input.apartment),
        city: normalize(input.city),
        state: normalize(input.state),
        zip_code: normalize(input.zip_code),
        country: normalize(input.country),
        date_of_birth: input.date_of_birth || null,
        sunset_date: input.sunset_date || null,
        nick_name: normalize(input.nick_name),
        tshirt_category: normalize(input.tshirt_category),
        tshirt_size: normalize(input.tshirt_size),
        chapter_id: input.chapter_id ?? null,
      },
      { onConflict: 'user_id' }
    )

  if (error) return { success: false, message: error.message }

  revalidatePath('/personal-info')
  return { success: true }
}

// Saves chapter_id on the user's own record AND propagates to their minor children.
export async function saveChapterAndPropagate(
  chapterId: string | null
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode = user.app_metadata?.family_code ?? ''

  // Update own record
  const { data: myRecord, error: myError } = await supabase
    .from('people')
    .upsert({ user_id: user.id, family_code: familyCode, is_minor: false, created_by: user.id, chapter_id: chapterId ?? null }, { onConflict: 'user_id' })
    .select('id')
    .single()

  if (myError) return { success: false, message: myError.message }

  // Propagate to minor children (person_relationships where I'm the parent)
  if (myRecord?.id) {
    const { data: childRelTypes } = await supabase
      .from('relationship_types')
      .select('id')
      .in('name', ['Son', 'Daughter'])

    if (childRelTypes?.length) {
      const { data: childRels } = await supabase
        .from('person_relationships')
        .select('related_person_id')
        .eq('person_id', myRecord.id)
        .in('relationship_type_id', childRelTypes.map(t => t.id))

      if (childRels?.length) {
        await supabase
          .from('people')
          .update({ chapter_id: chapterId ?? null })
          .in('id', childRels.map(r => r.related_person_id))
          .eq('is_minor', true)
      }
    }
  }

  revalidatePath('/personal-info')
  revalidatePath('/dashboard')
  return { success: true }
}
