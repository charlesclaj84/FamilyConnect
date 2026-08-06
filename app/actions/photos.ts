'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode } from '@/lib/auth/family'
import { requireOwn } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

export interface PhotoCollection {
  id: string
  family_code: string
  event_id: string | null
  event_name: string | null
  name: string
  description: string | null
  cover_photo_url: string | null
  photo_count: number
  created_by: string | null
  created_at: string
}

export interface Photo {
  id: string
  collection_id: string
  file_path: string
  url: string
  caption: string | null
  taken_at: string | null
  uploader_id: string | null
  uploader_name: string | null
  tags: { person_id: string; person_name: string }[]
  created_at: string
}

// -------------------------------------------------------
// Reads
// -------------------------------------------------------

export async function getPhotoCollections(): Promise<PhotoCollection[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('photo_collections')
    .select('*, events(name), photos(id, file_path)')
    .order('created_at', { ascending: false })

  return (data ?? []).map(c => {
    const photoArr = (c.photos as any[]) ?? []
    const coverPath = photoArr[0]?.file_path ?? null
    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(coverPath ?? '')

    return {
      id: c.id,
      family_code: c.family_code,
      event_id: c.event_id,
      event_name: (c.events as any)?.name ?? null,
      name: c.name,
      description: c.description,
      cover_photo_url: coverPath ? publicUrl : null,
      photo_count: photoArr.length,
      created_by: c.created_by,
      created_at: c.created_at,
    }
  })
}

export async function getCollectionDetail(id: string): Promise<{
  collection: PhotoCollection | null
  photos: Photo[]
}> {
  const supabase = await createClient()
  const [collectionRes, photosRes] = await Promise.all([
    supabase
      .from('photo_collections')
      .select('*, events(name)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('photos')
      .select('*, people(first_name, last_name), photo_tags(person_id, people(first_name, last_name))')
      .eq('collection_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!collectionRes.data) return { collection: null, photos: [] }

  const c = collectionRes.data
  const photoArr = photosRes.data ?? []

  const collection: PhotoCollection = {
    id: c.id,
    family_code: c.family_code,
    event_id: c.event_id,
    event_name: (c.events as any)?.name ?? null,
    name: c.name,
    description: c.description,
    cover_photo_url: null,
    photo_count: photoArr.length,
    created_by: c.created_by,
    created_at: c.created_at,
  }

  const photos: Photo[] = photoArr.map(p => {
    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(p.file_path)

    const tags = ((p.photo_tags as any[]) ?? []).map((t: any) => ({
      person_id: t.person_id,
      person_name: t.people
        ? `${t.people.first_name} ${t.people.last_name}`
        : 'Unknown',
    }))

    return {
      id: p.id,
      collection_id: p.collection_id,
      file_path: p.file_path,
      url: publicUrl,
      caption: p.caption,
      taken_at: p.taken_at,
      uploader_id: p.uploader_id,
      uploader_name: p.people
        ? `${(p.people as any).first_name} ${(p.people as any).last_name}`
        : null,
      tags,
      created_at: p.created_at,
    }
  })

  return { collection, photos }
}

export async function getOrCreateEventCollection(eventId: string): Promise<{ id: string } | null> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const familyCode = await getMyFamilyCode(user.id)

  // Check if a collection already exists for this event
  const { data: existing } = await supabase
    .from('photo_collections')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle()

  if (existing) return { id: existing.id }

  // Get event name for the collection title
  const { data: event } = await admin.from('events').select('name').eq('id', eventId).maybeSingle()
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

  const { data: created, error } = await admin.from('photo_collections').insert({
    family_code: familyCode,
    event_id: eventId,
    name: event?.name ?? 'Event Photos',
    created_by: myPerson?.id ?? null,
  }).select('id').single()

  if (error) return null
  revalidatePath('/photos')
  return { id: created.id }
}

// -------------------------------------------------------
// Mutations
// -------------------------------------------------------

export async function createCollection(input: {
  name: string
  description?: string
  event_id?: string | null
}): Promise<{ success: boolean; id?: string; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode = await getMyFamilyCode(user.id)
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

  const { data, error } = await supabase.from('photo_collections').insert({
    family_code: familyCode,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    event_id: input.event_id ?? null,
    created_by: myPerson?.id ?? null,
  }).select('id').single()

  if (error) return { success: false, message: error.message }
  revalidatePath('/photos')
  return { success: true, id: data.id }
}

export async function uploadPhoto(
  collectionId: string,
  formData: FormData
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode = await getMyFamilyCode(user.id)
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

  const file = formData.get('file') as File | null
  const caption = (formData.get('caption') as string | null) ?? null

  if (!file) return { success: false, message: 'No file provided' }
  if (file.size > 10 * 1024 * 1024) return { success: false, message: 'File must be under 10 MB' }

  const ext = file.name.split('.').pop()
  const photoId = crypto.randomUUID()
  const filePath = `${familyCode}/${collectionId}/${photoId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(filePath, file, { contentType: file.type, upsert: false })

  if (uploadError) return { success: false, message: uploadError.message }

  const { error: dbError } = await supabase.from('photos').insert({
    collection_id: collectionId,
    family_code: familyCode,
    uploader_id: myPerson?.id ?? null,
    file_path: filePath,
    caption: caption?.trim() || null,
  })

  if (dbError) {
    await supabase.storage.from('photos').remove([filePath])
    return { success: false, message: dbError.message }
  }

  revalidatePath(`/photos/${collectionId}`)
  return { success: true }
}

export async function deletePhoto(
  id: string,
  filePath: string,
  collectionId: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { error: dbError } = await supabase.from('photos').delete().eq('id', id)
  if (dbError) return { success: false, message: dbError.message }
  await supabase.storage.from('photos').remove([filePath])
  revalidatePath(`/photos/${collectionId}`)
  return { success: true }
}

export async function tagPersonInPhoto(
  photoId: string,
  personId: string,
  collectionId: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: myPerson } = await supabase
    .from('people')
    .select('id')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .maybeSingle()

  const { error } = await supabase.from('photo_tags').insert({
    photo_id: photoId,
    person_id: personId,
    tagged_by: myPerson?.id ?? null,
  })

  if (error) return { success: false, message: error.message }
  revalidatePath(`/photos/${collectionId}`)
  return { success: true }
}

export async function untagPersonFromPhoto(
  photoId: string,
  personId: string,
  collectionId: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('photo_tags')
    .delete()
    .eq('photo_id', photoId)
    .eq('person_id', personId)

  if (error) return { success: false, message: error.message }
  revalidatePath(`/photos/${collectionId}`)
  return { success: true }
}

export async function deleteCollection(id: string): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('photo_collections').select('created_by, family_code').eq('id', id).maybeSingle()
  if (!row) return { success: false, message: 'Collection not found' }

  // Deleting a collection cascades to every photo in it, so the creator may remove
  // their own and anyone else needs the unrestricted delete grant.
  const g = await requireOwn('photos', 'delete', row.created_by)
  if (!g.ok) return { success: false, message: g.message }
  if (row.family_code !== g.familyCode) return { success: false, message: 'Collection not found' }

  // Get all photo paths before cascading delete
  const { data: photosInCollection } = await supabase
    .from('photos')
    .select('file_path')
    .eq('collection_id', id)

  const { error } = await admin.from('photo_collections').delete().eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }

  if ((photosInCollection ?? []).length > 0) {
    const paths = (photosInCollection ?? []).map(p => p.file_path)
    await supabase.storage.from('photos').remove(paths)
  }

  revalidatePath('/photos')
  return { success: true }
}
