'use server'

import { revalidatePath } from 'next/cache'
import { confirmWrite } from '@/lib/confirmed-write'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode, getMyPersonId, belongsToFamily } from '@/lib/auth/family'
import { can, canAny } from '@/lib/auth/permissions'
import { requireMember, requireOwn } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedMany, embedOne, type PersonNameRow } from '@/lib/supabase/embed'
import { IMAGE_FORMATS, isAllowedUpload, uploadRejection } from '@/lib/upload-types'

/**
 * The Gallery — `/community/gallery`, and `review/photos` until 2026-08-22.
 *
 * ── IT WAS `app/actions/photos.ts` AND THE KEY WAS `review/photos` ─────────────────
 * `20260822000018` retired the Review worklist: this screen was walked, renamed **Gallery**
 * and moved to Community, and the key moved with the route because a resource key IS the route
 * without its leading slash (§1). Fourteen composed policies carried the old key as a literal
 * and were rewritten by that migration; every `canAny(..., 'community/gallery', ...)` below is
 * the app half of the same move.
 *
 * ── WHO MAY DO WHAT, AND THE ANSWER IS NOT "ANYBODY WHO CAN SEE IT" ────────────────
 * Reported and fixed on 2026-08-22. A photograph is somebody's, and until now the only thing
 * stopping a member editing a stranger's caption was that no screen offered it — which is not
 * a rule, it is an absence. The rule now, and it is the same one on both surfaces:
 *
 *   upload            any member (`community/gallery:create`, 'any' on the General template)
 *   caption a photo   ITS UPLOADER, or `:edit` at scope 'any'
 *   delete a photo    ITS UPLOADER, or `:delete` at scope 'any'
 *   tag / untag       any member who may edit the gallery at all
 *   delete an ALBUM   its creator, or `:delete` at scope 'any' — and it takes every
 *                     photograph in it, which is why the screen asks twice
 *
 * `requireOwn(key, action, ownerId)` is what expresses "theirs, or the unrestricted grant",
 * and it is the SAME helper `deleteDocument` uses. The uploader check therefore happens
 * against the id the DATABASE holds, read family-scoped before the grant is resolved — never
 * against an id the client sent.
 *
 * ── UPLOADS ARE IMAGES, AND THAT IS CHECKED HERE AND NOT ONLY IN THE PICKER ────────
 * `lib/upload-types.ts` is the one list, and its header argues why an extension and a MIME
 * type are both required. The `accept` attribute on the input is a hint a picker may ignore
 * and a drag-and-drop bypasses entirely; this is the gate, because a `'use server'` export is
 * a public HTTP endpoint (§2).
 *
 * ── THE ADMIN CLIENT IS USED FOR EXACTLY TWO READS, AND SAYS WHY EACH TIME ─────────
 * Everything else goes through the user client so RLS does the narrowing (§3).
 */

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

/** What the caller may do on this collection. Resolved on the server, passed down as props. */
export interface GalleryRights {
  /** `community/gallery:create` — may add photographs. */
  upload: boolean
  /** `:edit` at scope 'any' — may caption and tag ANY photograph, not only their own. */
  editAny: boolean
  /** `:delete` at scope 'any' — may remove any photograph, and any album. */
  deleteAny: boolean
  /** `:edit` at all, own or any — what tagging needs. */
  editOwn: boolean
}

// -------------------------------------------------------
// Reads
// -------------------------------------------------------

export async function getPhotoCollections(): Promise<PhotoCollection[]> {
  const supabase = await createClient()
  // §8: the error is READ. This select is the one whose PGRST201 emptied every family's
  // gallery for a day when `events` was dropped and its embed stayed — caught by the RLS
  // suite's positive control rather than by anything on screen.
  //
  // photos!photos_collection_id_fkey, not photos: there are two relationships between these
  // tables — the collection's photos, and its `cover_photo_id` pointing back at one.
  const { data, error } = await supabase
    .from('photo_collections')
    .select('*, photos!photos_collection_id_fkey(id, file_path)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[gallery] collections read failed: ${error.message}`)
    return []
  }

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
    supabase.from('photo_collections').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('photos')
      // people!photo_tags_person_id_fkey on the INNER embed: `photo_tags` has TWO foreign keys
      // to `people` — `person_id` (who is IN the photo) and `tagged_by` (who said so) — so a
      // bare nested embed is PGRST201, which refuses the WHOLE query. That is §8's nested
      // case and it emptied this page for a year. The OUTER `people(...)` is unambiguous:
      // `photos` has one path (`uploader_id`).
      .select('*, people(first_name, last_name), photo_tags(person_id, people!photo_tags_person_id_fkey(first_name, last_name))')
      .eq('collection_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (photosRes.error) {
    console.error(`[gallery] photos read failed for ${id}: ${photosRes.error.message}`)
  }
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
    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(p.file_path)

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
 * What the caller may do here, as four booleans.
 *
 * RESOLVED ONCE PER PAGE and passed down, rather than asked per photograph: the per-row half
 * is "is this mine", which the client can answer from `uploader_id` it already has. These are
 * AFFORDANCES and never the gate — every action below resolves its own grant (§2).
 */
export async function getGalleryRights(): Promise<GalleryRights> {
  const g = await requireMember()
  if (!g.ok) return { upload: false, editAny: false, deleteAny: false, editOwn: false }
  // `can` FOR THE LAST ONE AND `canAny` FOR THE OTHER THREE, and the difference is the whole
  // point of the pair. `editOwn` asks "may they edit AT ALL", which scope 'own' satisfies and
  // which is what tagging and captioning their own photograph needs; `editAny` asks whether
  // the grant reaches somebody else's row. Using `canAny` for both would hide the own-scoped
  // member's own controls; using `can` for both would offer them everybody's.
  const [upload, editAny, deleteAny, editOwn] = await Promise.all([
    canAny(g.userId, 'community/gallery', 'create'),
    canAny(g.userId, 'community/gallery', 'edit'),
    canAny(g.userId, 'community/gallery', 'delete'),
    can(g.userId, 'community/gallery', 'edit'),
  ])
  return { upload, editAny, deleteAny, editOwn }
}

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
  const personId = await getMyPersonId(user.id)
  const name = input.name.trim()
  if (!name) return { success: false, message: 'Give the album a name' }

  const { data, error } = await supabase.from('photo_collections').insert({
    family_code: familyCode,
    name,
    description: input.description?.trim() || null,
    created_by: personId || null,
  }).select('id').single()

  if (error) return { success: false, message: error.message }
  revalidatePath('/community/gallery')
  return { success: true, id: data.id }
}

/**
 * UPLOAD MANY AT ONCE, which is what the ask was and what a reunion actually produces.
 *
 * ── ONE ACTION PER BATCH, AND IT REPORTS PER FILE ──────────────────────────────────
 * The alternative was to leave `uploadPhoto` alone and let the client call it in a loop. That
 * is worse in the way that matters: the collection check, the family lookup and the person
 * lookup are three round trips EACH TIME, so forty photographs cost a hundred and twenty
 * queries to answer one question a hundred and twenty times. Here they are answered once.
 *
 * IT IS NOT ALL-OR-NOTHING, and that is deliberate. A batch of forty with one `.heic` in it
 * should upload thirty-nine, and the caller is told which one did not and why — because the
 * alternative is a member who has to find the offending file themselves and start again.
 * `uploaded` and `failed` are both returned; the screen prints both.
 *
 * ── THE CAPTION IS PER BATCH AND IS DELIBERATELY NOT PER FILE ──────────────────────
 * A picker returns a list, not a form per file, and forty caption boxes is not a screen. One
 * caption applies to the batch — "Saturday, at the lake" — and the list view is where an
 * individual one is corrected afterwards, which is the other half of the same ask.
 */
export async function uploadPhotos(
  collectionId: string,
  formData: FormData,
): Promise<{ success: boolean; uploaded: number; failed: string[]; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, uploaded: 0, failed: [], message: g.message }
  if (!(await canAny(g.userId, 'community/gallery', 'create'))) {
    return { success: false, uploaded: 0, failed: [], message: 'Not authorized' }
  }

  // ── §4: THE COLLECTION IS A CLIENT-SUPPLIED ID WRITTEN ONTO THE ROW ──────────────
  // The `photos` row carries the CALLER's `family_code`, so every policy on it is satisfied
  // while `collection_id` points wherever the caller said — including into another family's
  // album. Nothing in the database is asked, because RLS is a predicate over the row being
  // written and not over the ids it references. `belongsToFamily` uses the service role on
  // purpose: the answer must not depend on the caller's view grant.
  if (!(await belongsToFamily('photo_collections', collectionId, g.familyCode))) {
    return { success: false, uploaded: 0, failed: [], message: 'Album not found' }
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) {
    return { success: false, uploaded: 0, failed: [], message: 'No files were chosen' }
  }
  const caption = (formData.get('caption') as string | null)?.trim() || null

  const supabase = await createClient()
  const failed: string[] = []
  let uploaded = 0

  for (const file of files) {
    if (!isAllowedUpload(file.name, file.type, IMAGE_FORMATS)) {
      failed.push(uploadRejection(file.name, IMAGE_FORMATS))
      continue
    }
    if (file.size > 10 * 1024 * 1024) {
      failed.push(`${file.name} is larger than 10 MB.`)
      continue
    }

    const photoId = crypto.randomUUID()
    // THE EXTENSION COMES FROM THE ALLOW-LIST'S OWN READING of the name, not from a split on
    // the raw string: `isAllowedUpload` has already established it is one of ours.
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    const filePath = `${g.familyCode}/${collectionId}/${photoId}${ext}`

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, file, { contentType: file.type || undefined, upsert: false })
    if (uploadError) {
      failed.push(`${file.name}: ${uploadError.message}`)
      continue
    }

    const { error: dbError } = await supabase.from('photos').insert({
      collection_id: collectionId,
      family_code: g.familyCode,
      uploader_id: g.personId || null,
      file_path: filePath,
      caption,
    })
    if (dbError) {
      // The object goes back if the row did not land, or the bucket accumulates files nothing
      // points at. The reverse ordering — row first — would leave a row pointing at nothing,
      // which renders as a broken image for everybody.
      await supabase.storage.from('photos').remove([filePath])
      failed.push(`${file.name}: ${dbError.message}`)
      continue
    }
    uploaded += 1
  }

  if (uploaded > 0) revalidatePath(`/community/gallery/${collectionId}`)
  return {
    // A BATCH THAT UPLOADED NOTHING IS A FAILURE, and one that uploaded some is not. The
    // screen needs to tell those apart to decide whether to close its dialog.
    success: uploaded > 0,
    uploaded,
    failed,
    message: uploaded === 0 ? 'Nothing was uploaded.' : undefined,
  }
}

/**
 * Change one photograph's caption.
 *
 * ── THE OWNER CHECK IS AGAINST THE ROW, NOT THE ARGUMENT ───────────────────────────
 * `uploader_id` is read family-scoped on the admin client BEFORE the grant is resolved, and
 * `requireOwn` then answers "theirs, or `:edit` at 'any'". Reading it on the USER client would
 * make the answer depend on the caller's view grant, and reading it after would mean deciding
 * who the owner is from something the client sent.
 *
 * `confirmWrite`, because the UPDATE that follows is narrowed by RLS as well: `photos` maps to
 * `community/gallery` with an `own_expr` of `uploader_id = auth_person_id()`, so a caller
 * holding `edit` at 'own' who somehow reached somebody else's row would match zero rows and be
 * told it saved (§8b). The guard above should make that unreachable; `confirmWrite` is what
 * makes "should" observable.
 */
export async function updatePhotoCaption(
  photoId: string,
  caption: string,
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('photos').select('uploader_id, family_code, collection_id').eq('id', photoId).maybeSingle()
  if (!row) return { success: false, message: 'Photo not found' }

  const g = await requireOwn('community/gallery', 'edit', row.uploader_id)
  if (!g.ok) return { success: false, message: g.message }
  if (row.family_code !== g.familyCode) return { success: false, message: 'Photo not found' }

  const supabase = await createClient()
  const outcome = await confirmWrite(() =>
    supabase.from('photos').update({ caption: caption.trim() || null }).eq('id', photoId)
      .select('id'))
  if (!outcome.ok) return { success: false, message: outcome.message }

  revalidatePath(`/community/gallery/${row.collection_id}`)
  return { success: true }
}

/**
 * Remove one photograph, and its file.
 *
 * THE OWNER CHECK ARRIVED 2026-08-22. Before it, this leaned entirely on the composed DELETE
 * policy's `own_expr` — which is correct, and which meant the SCREEN had to decide what to
 * offer and could get it wrong in the generous direction with nothing reporting it. Now the
 * action refuses first and the policy is the second line.
 */
export async function deletePhoto(
  id: string,
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('photos').select('uploader_id, family_code, collection_id').eq('id', id).maybeSingle()
  if (!row) return { success: false, message: 'Photo not found' }

  const g = await requireOwn('community/gallery', 'delete', row.uploader_id)
  if (!g.ok) return { success: false, message: g.message }
  if (row.family_code !== g.familyCode) return { success: false, message: 'Photo not found' }

  const supabase = await createClient()
  // THE ROW COUNT IS THE ANSWER, NOT THE ERROR (§8b). `file_path` is in the projection so the
  // storage delete uses the path from the ROW rather than one the caller sent — a mismatched
  // path would take out a DIFFERENT photograph's file inside the same family.
  const outcome = await confirmWrite(() =>
    supabase.from('photos').delete().eq('id', id).select('id, file_path'))
  if (!outcome.ok) return { success: false, message: outcome.message }

  // Storage AFTER the row, and not fatal: a failed object delete leaves a file nothing points
  // at, while the reverse leaves a row pointing at nothing.
  const removed = outcome.rows[0]?.file_path
  if (removed) await supabase.storage.from('photos').remove([removed])
  revalidatePath(`/community/gallery/${row.collection_id}`)
  return { success: true }
}

export async function tagPersonInPhoto(
  photoId: string,
  personId: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  // §4 ON BOTH IDS. The `photo_tags` row carries the caller's family, so a policy is satisfied
  // by a tag naming another family's person on another family's photograph.
  if (!(await belongsToFamily('photos', photoId, g.familyCode))) {
    return { success: false, message: 'Photo not found' }
  }
  if (!(await belongsToFamily('people', personId, g.familyCode))) {
    return { success: false, message: 'Person not found' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('photo_tags').insert({
    photo_id: photoId,
    person_id: personId,
    tagged_by: g.personId || null,
  })
  // AN INSERT REFUSED BY RLS RAISES 42501 and is already honest, which is why this is not
  // `confirmWrite` — that helper is for the idempotent two, and a retried INSERT after one
  // that landed creates a second row.
  if (error) {
    return {
      success: false,
      message: error.code === '23505'
        ? 'They are already tagged in this photo.'
        : error.message,
    }
  }

  const { data: photo } = await supabase.from('photos').select('collection_id').eq('id', photoId).maybeSingle()
  if (photo) revalidatePath(`/community/gallery/${photo.collection_id}`)
  return { success: true }
}

export async function untagPersonFromPhoto(
  photoId: string,
  personId: string,
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  // `photo_tags` maps to `community/gallery` with a `self_expr` of the literal `false`, so
  // there is no self-service route to this and a member without `delete` at 'own' or 'any'
  // matches nothing while being told the tag went (§8b).
  const outcome = await confirmWrite(() =>
    supabase.from('photo_tags').delete()
      .eq('photo_id', photoId).eq('person_id', personId).select('photo_id'))
  if (!outcome.ok) return { success: false, message: outcome.message }

  const { data: photo } = await supabase.from('photos').select('collection_id').eq('id', photoId).maybeSingle()
  if (photo) revalidatePath(`/community/gallery/${photo.collection_id}`)
  return { success: true }
}

/**
 * Delete a whole album, and every photograph in it.
 *
 * ── THE FILES GO TOO, WHICH IS THE HALF THAT USED TO BE HALF-DONE ──────────────────
 * The row cascade has always removed the `photos` rows. Until `20260820000006` the storage
 * policy for the `photos` bucket wanted `auth.uid()` as the first path segment while every
 * path begins with a family code, so `remove()` matched nothing FOR ANYBODY — and Storage
 * reports a refused remove as 200 with an empty array, so no caller could tell. Every album a
 * family "deleted" left its images in a PUBLIC bucket, fetchable by URL, indefinitely.
 *
 * So this now reads the paths BEFORE the cascade, deletes the rows, removes the objects, and
 * REPORTS what it could not remove. A family told an album is gone must not be left with the
 * pictures still served.
 *
 * ── PAGED, BECAUSE `remove()` TAKES A LIST AND AN ALBUM IS NOT SMALL ───────────────
 * A reunion album is hundreds of files. Supabase's `remove()` caps a call well below that, so
 * the paths go in batches; a failure in one batch is collected rather than thrown, because
 * stopping halfway would leave the rest served with the row already gone.
 */
export async function deleteCollection(
  id: string,
): Promise<{ success: boolean; message?: string; removedPhotos?: number }> {
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('photo_collections').select('created_by, family_code, name').eq('id', id).maybeSingle()
  if (!row) return { success: false, message: 'Album not found' }

  // Deleting an album cascades to every photograph in it, so its creator may remove their own
  // and anybody else needs the unrestricted delete grant.
  const g = await requireOwn('community/gallery', 'delete', row.created_by)
  if (!g.ok) return { success: false, message: g.message }
  if (row.family_code !== g.familyCode) return { success: false, message: 'Album not found' }

  // THE PATHS BEFORE THE CASCADE, on the admin client and family-scoped by hand (§3): the
  // rows are about to be unreachable, and a user-client read here would additionally miss any
  // photograph the caller cannot see — which would leave exactly those files behind.
  const { data: photos, error: readError } = await admin
    .from('photos').select('file_path').eq('collection_id', id).eq('family_code', g.familyCode)
  if (readError) {
    console.error(`[gallery] could not list ${id} before deleting it: ${readError.message}`)
    return { success: false, message: 'Could not read the album. Nothing was deleted.' }
  }

  const { error } = await admin
    .from('photo_collections').delete().eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }

  const paths = (photos ?? []).map(p => p.file_path as string)
  let unremoved = 0
  for (let i = 0; i < paths.length; i += 100) {
    const { error: rmError } = await admin.storage.from('photos').remove(paths.slice(i, i + 100))
    if (rmError) {
      unremoved += Math.min(100, paths.length - i)
      console.error(`[gallery] could not remove objects for ${id}: ${rmError.message}`)
    }
  }

  revalidatePath('/community/gallery')
  if (unremoved > 0) {
    return {
      success: true,
      removedPhotos: paths.length - unremoved,
      message: `The album is gone, but ${unremoved} of its image files could not be removed from storage. `
        + 'They are no longer listed anywhere; tell an administrator so they can be swept.',
    }
  }
  return { success: true, removedPhotos: paths.length }
}
