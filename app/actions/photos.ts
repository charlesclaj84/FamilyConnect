'use server'

import { revalidatePath } from 'next/cache'
import { confirmWrite } from '@/lib/confirmed-write'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode, belongsToFamily } from '@/lib/auth/family'
import { requireOwn } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedMany, embedOne, type PersonNameRow } from '@/lib/supabase/embed'

export interface PhotoCollection {
  id: string
  family_code: string
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
    // NO `events(name)` EMBED SINCE 2026-08-19. That table is dropped (20260819000006), and
    // an embed of a relation PostgREST cannot resolve refuses the WHOLE query — which, with
    // the error discarded here, is an empty gallery over photographs that exist. Caught by
    // the RLS suite's own positive control ("owner saw none of their own data"), which is
    // exactly what that control is for.
    //
    // photos!photos_collection_id_fkey, not photos: there are two relationships
    // between these tables — the collection's photos, and its cover_photo_id
    // pointing back at one. An ambiguous embed fails the query with PGRST201,
    // and since the error is discarded the page just shows no albums at all.
    .select('*, photos!photos_collection_id_fkey(id, file_path)')
    .order('created_at', { ascending: false })

  return (data ?? []).map(c => {
    const photoArr = embedMany<{ id: string; file_path: string }>(c.photos)
    const coverPath = photoArr[0]?.file_path ?? null
    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(coverPath ?? '')

    return {
      id: c.id,
      family_code: c.family_code,
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
      // No `events(name)` — see the note in `getPhotoCollections`.
      .select('*')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('photos')
      // people!photo_tags_person_id_fkey, not people: `photo_tags` has TWO foreign keys to
      // `people` — `person_id` (who is IN the photo) and `tagged_by` (who said so) — and has
      // had both since 20260610000001 created the table. A bare nested embed is therefore
      // PGRST201, which PostgREST answers by refusing the WHOLE query — and `photosRes.error`
      // is never read, so this select has been returning `[]` and the page has been
      // rendering an empty collection over photographs that exist. Measured against the
      // live stack on 2026-08-19. The OUTER `people(...)` is correct as it stands — `photos`
      // has exactly one foreign key to `people` (`uploader_id`) — and `photo_tags`' pair is
      // enforced by `UNIQUE (photo_id, person_id)` beside a surrogate `id` primary key rather
      // than by a composite PK, so it is not read as a many-to-many between `photos` and
      // `people` either (AGENTS.md §8, and `announcement_unpins` is the incident that
      // distinction comes from).
      .select('*, people(first_name, last_name), photo_tags(person_id, people!photo_tags_person_id_fkey(first_name, last_name))')
      .eq('collection_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!collectionRes.data) return { collection: null, photos: [] }

  const c = collectionRes.data
  const photoArr = photosRes.data ?? []

  const collection: PhotoCollection = {
    id: c.id,
    family_code: c.family_code,
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

    const tags = embedMany<{ person_id: string; people: unknown }>(p.photo_tags).map(t => {
      const tagged = embedOne<PersonNameRow>(t.people)
      return {
        person_id: t.person_id,
        person_name: tagged ? `${tagged.first_name} ${tagged.last_name}` : 'Unknown',
      }
    })

    const uploader = embedOne<PersonNameRow>(p.people)

    return {
      id: p.id,
      collection_id: p.collection_id,
      file_path: p.file_path,
      url: publicUrl,
      caption: p.caption,
      taken_at: p.taken_at,
      uploader_id: p.uploader_id,
      uploader_name: uploader ? `${uploader.first_name} ${uploader.last_name}` : null,
      tags,
      created_at: p.created_at,
    }
  })

  return { collection, photos }
}

/**
 * `getOrCreateEventCollection()` WAS DELETED HERE ON 2026-08-19, with the Events product.
 *
 * It had no caller — the Event Detail screen was the only one — and it was a `'use server'`
 * export, so it was a live HTTP endpoint that took an `eventId` from the client, read the
 * `events` table with the SERVICE ROLE and INSERTED a `photo_collections` row carrying that
 * id, with no `belongsToFamily` check on it and no permission check of any kind. That is §4
 * exactly, on a public endpoint, for a screen that no longer exists.
 *
 * `photo_collections.event_id` went too (`20260819000006`). A collection is named for what it
 * holds; if a gallery ever needs to belong to a GATHERING that is a new column with a new
 * foreign key, not this one repurposed.
 */

// -------------------------------------------------------
// Mutations
// -------------------------------------------------------

export async function createCollection(input: {
  name: string
  description?: string
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
    created_by: myPerson?.id ?? null,
  }).select('id').single()

  if (error) return { success: false, message: error.message }
  revalidatePath('/review/photos')
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

  // ── §4: THE COLLECTION IS A CLIENT-SUPPLIED ID WRITTEN ONTO THE ROW ──────────────
  // Missing until 2026-08-20, and it is the hole AGENTS.md §4 is entirely about: the
  // `photos` row this creates carries the CALLER's `family_code`, so every policy on it is
  // satisfied, while `collection_id` points wherever the caller said — including into
  // another family's album. Nothing in the database was asked, because nothing in the
  // database can be: RLS is a predicate over the row being written, not over the ids it
  // references.
  //
  // The damage is the shape `audit_cross_family_refs.sql` exists to find and that no screen
  // will ever report: the reading side scopes by family, so the photograph resolves to
  // nothing and both families render a gap where an image should be.
  //
  // `belongsToFamily` uses the service role on purpose — the answer must not depend on the
  // caller holding view permission on `photo_collections`.
  if (!(await belongsToFamily('photo_collections', collectionId, familyCode))) {
    return { success: false, message: 'Collection not found' }
  }

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

  revalidatePath(`/review/photos/${collectionId}`)
  return { success: true }
}

/**
 * `filePath` is accepted for call-site compatibility and deliberately IGNORED — the path
 * comes from the deleted row's own RETURNING. See the note beside the storage call, and
 * `deleteDocument`, which carries the same parameter for the same reason.
 */
export async function deletePhoto(
  id: string,
  filePath: string,
  collectionId: string
): Promise<{ success: boolean; message?: string }> {
  void filePath
  const supabase = await createClient()

  // ── THE ROW COUNT IS THE ANSWER, NOT THE ERROR (lib/confirmed-write.ts) ───────────
  // This is the action TODO.md's table named: `photos` maps to `review/photos`, whose
  // `delete` falls back to scope 'none', so a member without the grant matched zero rows
  // and PostgREST reported no error — and this returned `{ success: true }` over a
  // photograph that was still there on reload. The `.select(...)` is what makes the empty
  // match visible; `confirmWrite` retries once and then says so. `file_path` is in that
  // projection so the STORAGE delete below can use the path from the ROW rather than the
  // one the caller sent — see the note beside it.
  const outcome = await confirmWrite(() =>
    supabase.from('photos').delete().eq('id', id).select('id, file_path'))
  if (!outcome.ok) return { success: false, message: outcome.message }

  // Storage AFTER the row, and its failure is deliberately not fatal — the same ordering
  // `deleteDocument` uses, for the same reason: a failed object delete leaves a file
  // nothing points at, while the reverse leaves a row pointing at nothing.
  //
  // ── AND THE PATH COMES FROM THE ROW, NEVER FROM THE PARAMETER ────────────────────
  // Until 2026-08-20 the client's `filePath` went straight to `remove()`. Two things made
  // that worse than it looks. `20260820000006` is what finally lets this delete succeed at
  // all — the old policy wanted `auth.uid()` as the first folder while every path starts
  // with the family code, so it matched nothing for anyone and every "deleted" photograph
  // stayed in a PUBLIC bucket, still fetchable by URL. And now that it does succeed, a
  // caller holding the delete grant could pass a mismatched path and take out a DIFFERENT
  // photograph's file inside their own family, leaving a row pointing at nothing. Reading
  // the path off the row is the same repair `deleteDocument` made by ignoring its own
  // `filePath` argument; here the delete's own RETURNING already has the authoritative one.
  const removed = outcome.rows[0]?.file_path
  if (removed) await supabase.storage.from('photos').remove([removed])
  revalidatePath(`/review/photos/${collectionId}`)
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
  revalidatePath(`/review/photos/${collectionId}`)
  return { success: true }
}

export async function untagPersonFromPhoto(
  photoId: string,
  personId: string,
  collectionId: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  // `photo_tags` maps to `review/photos` too, with a `self_expr` of the literal `false` —
  // so there is no self-service route to this and a member without `delete` at 'own' or
  // 'any' matched nothing while being told the tag was removed. Same fix as deletePhoto.
  const outcome = await confirmWrite(() =>
    supabase
      .from('photo_tags')
      .delete()
      .eq('photo_id', photoId)
      .eq('person_id', personId)
      .select('photo_id'))
  if (!outcome.ok) return { success: false, message: outcome.message }

  revalidatePath(`/review/photos/${collectionId}`)
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
  const g = await requireOwn('review/photos', 'delete', row.created_by)
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

  revalidatePath('/review/photos')
  return { success: true }
}
