'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode } from '@/lib/auth/family'
import { requireOwn } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

export interface EventPhoto {
  id: string
  file_path: string
  caption: string | null
  taken_at: string | null
  created_at: string
  uploader_name: string | null
  url: string
}

export async function getEventPhotos(eventId: string): Promise<EventPhoto[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('event_photos')
    .select('*, people(first_name, last_name)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  return (data ?? []).map(p => {
    const { data: { publicUrl } } = supabase.storage.from('event-photos').getPublicUrl(p.file_path)
    return {
      id: p.id,
      file_path: p.file_path,
      caption: p.caption,
      taken_at: p.taken_at,
      created_at: p.created_at,
      uploader_name: p.people
        ? `${(p.people as { first_name: string; last_name: string }).first_name} ${(p.people as { first_name: string; last_name: string }).last_name}`
        : null,
      url: publicUrl,
    }
  })
}

export async function uploadEventPhoto(
  eventId: string,
  formData: FormData
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)

  const file = formData.get('file') as File | null
  const caption = (formData.get('caption') as string | null)?.trim() || null

  if (!file || file.size === 0) return { success: false, message: 'No file provided' }
  if (file.size > 10 * 1024 * 1024) return { success: false, message: 'File must be under 10 MB' }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const photoId = crypto.randomUUID()
  const filePath = `${familyCode}/${eventId}/${photoId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('event-photos')
    .upload(filePath, file, { contentType: file.type })

  if (uploadError) return { success: false, message: uploadError.message }

  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

  const { error: dbError } = await supabase.from('event_photos').insert({
    event_id: eventId,
    family_code: familyCode,
    uploader_id: myPerson?.id ?? null,
    file_path: filePath,
    caption,
  })

  if (dbError) {
    await supabase.storage.from('event-photos').remove([filePath])
    return { success: false, message: dbError.message }
  }

  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

/**
 * `filePath` is accepted for call-site compatibility and deliberately IGNORED — see
 * deleteDocument for why taking a storage path from the caller was the bug.
 */
export async function deleteEventPhoto(
  id: string,
  filePath: string | undefined,
  eventId: string
): Promise<{ success: boolean; message?: string }> {
  void filePath
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('event_photos').select('file_path, uploader_id, family_code').eq('id', id).maybeSingle()
  if (!row) return { success: false, message: 'Photo not found' }

  const g = await requireOwn('photos', 'delete', row.uploader_id)
  if (!g.ok) return { success: false, message: g.message }
  if (row.family_code !== g.familyCode) return { success: false, message: 'Photo not found' }

  const { error } = await admin.from('event_photos').delete().eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }
  await admin.storage.from('event-photos').remove([row.file_path])
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}
