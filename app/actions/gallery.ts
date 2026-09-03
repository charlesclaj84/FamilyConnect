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
import {
  PHOTO_MAX_BYTES, PHOTO_UPLOAD_CHUNK, photoObjectPath, photoObjectPrefix, photoThumbPath,
} from '@/lib/photo-upload'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'

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
 * ── THE BYTES NO LONGER TRAVEL THROUGH A SERVER ACTION ────────────────────────────
 * Reported 2026-09-01: adding several photographs at once answered **500**, with no message,
 * from the framework rather than from anything here. `uploadPhotos(collectionId, formData)`
 * carried the files in the action's own request body, and that body is capped twice over —
 * Next.js at 1 MB by default and Vercel at 4.5 MB platform-side — so a single modern
 * photograph could exceed it and a batch always did. The 10 MB per file this screen promises
 * was never reachable.
 *
 * It is a THREE-STEP flow now, and only the first and last cross an action:
 *
 *   createPhotoUploadTickets   resolves every gate, then mints one signed upload URL per file
 *   (the browser)              PUTs each file straight to Supabase Storage with its token
 *   recordUploadedPhotos       re-resolves the gates, re-derives each path, writes the rows
 *
 * `lib/photo-upload.ts` holds the three facts both sides need. Both actions check the album
 * and the grant, because each is reachable on its own (§2).
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
  /** The FULL photograph. The lightbox and the download use this and nothing else. */
  url: string
  /**
   * What a GRID should draw — the thumbnail if there is one, otherwise the full photograph.
   *
   * ── RESOLVED HERE, NOT AT EVERY `<img>` ────────────────────────────────────────
   * The fallback is the whole feature (`20260902000003`: every row written before thumbnails
   * existed has none, and so does anything the uploading browser could not decode), so it has
   * to be somewhere that cannot be forgotten. A component choosing `p.thumb_url ?? p.url`
   * works until the day one of them does not, and the failure is invisible — the grid renders
   * perfectly and downloads a hundred megabytes.
   *
   * It is a SEPARATE FIELD rather than `url` quietly becoming the small one, because the
   * lightbox and the download need the original and a field that silently changed meaning is
   * how a gallery starts serving 640px images as the photograph.
   */
  grid_url: string
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
    .select('*, photos!photos_collection_id_fkey(id, file_path, thumb_path)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[gallery] collections read failed: ${error.message}`)
    return []
  }

  return (data ?? []).map(c => {
    const photoArr = embedMany<{ id: string; file_path: string; thumb_path: string | null }>(c.photos)
    // THE COVER IS A THUMBNAIL WHEREVER THERE IS ONE. This card is the single worst offender
    // on the old behaviour: `/community/gallery` drew one full photograph per album at about
    // 200px, so twelve albums was a dozen originals — tens of megabytes to render a page that
    // shows no photograph at full size at all.
    const cover = photoArr[0] ?? null
    const coverPath = cover ? (cover.thumb_path ?? cover.file_path) : null
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
    // THE FALLBACK IS THE FEATURE — see `Photo.grid_url`. A NULL `thumb_path` is the ordinary
    // state of every photograph uploaded before 2026-09-02 and of anything the uploader's
    // browser could not decode, so this is not an error path.
    const gridUrl = p.thumb_path
      ? supabase.storage.from('photos').getPublicUrl(p.thumb_path as string).data.publicUrl
      : publicUrl

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
      grid_url: gridUrl,
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
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }

  const familyCode = await getMyFamilyCode(user.id)
  const personId = await getMyPersonId(user.id)
  const name = input.name.trim()
  if (!name) return { success: false, message: t('act.giveAlbumName') }

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
 * TICKETS FOR A BATCH: the gates here, the bytes straight to Storage.
 *
 * ── WHY THIS IS NOT `uploadPhotos(collectionId, formData)` ANY MORE ────────────────
 * That action took the files themselves and 500'd on every real batch — and on a single
 * modern photograph. `lib/photo-upload.ts` records the two ceilings; the short version is
 * that Next.js refuses a Server Action body over 1 MB before the action runs, and Vercel
 * refuses a function request body over 4.5 MB whatever Next.js is configured to allow. So
 * the action's own "up to 10 MB each" was never reachable, and the framework's refusal is a
 * bare 500 rather than the per-file verdict the dialog exists to print.
 *
 * Now: this mints one **signed upload URL per file**, the browser PUTs each file straight to
 * Supabase Storage with it, and `recordUploadedPhotos` writes the rows. Nothing large crosses
 * a server action in either direction.
 *
 * ── EVERY GATE IS STILL ON THE SERVER, WHICH IS THE POINT OF A TICKET ──────────────
 * The obvious cheaper design is to let the browser call `supabase.storage.upload()` on its own
 * session: the bucket's INSERT policy (`20260820000006`) already pins the first path segment
 * to `auth_family_code()`. It is rejected because that policy knows about the FAMILY and
 * nothing about `community/gallery:create` — a member with no upload grant could write objects
 * into their family's public bucket for as long as they liked. A signed URL is minted only
 * after the grant is resolved, and it names ONE path, so it authorizes exactly the upload this
 * action agreed to.
 *
 * The URL is minted on the USER's client on purpose: the storage policy is then a second
 * boundary under the grant check rather than being bypassed by the service role (§3).
 * Measured 2026-09-01 against the local stack, as ALPHA's administrator:
 *
 *   createSignedUploadUrl('ALPHATEST/probe/own.jpg')      minted
 *   createSignedUploadUrl('BRAVOTEST/probe/theirs.jpg')   new row violates row-level security
 *
 * So even with every check here deleted, a ticket for another family's folder cannot be
 * minted. That is defence in depth and not the gate — `photos_family_insert` knows about the
 * FAMILY and nothing about the album, which is what `recordUploadedPhotos` is for.
 *
 * ── IT IS NOT ALL-OR-NOTHING, and that is unchanged ────────────────────────────────
 * A batch of forty with one `.heic` in it should ticket thirty-nine, and the caller is told
 * which one did not and why. `tickets` and `failed` are both returned; the screen prints both.
 */
export interface PhotoUploadTicket {
  /** The file this ticket is for, so the client can pair them up without relying on order. */
  name: string
  /** `<family code>/<collection id>/<photo id><ext>` — echoed back to `recordUploadedPhotos`. */
  path: string
  /** Supabase's one-shot upload token for that exact path. */
  token: string
  /**
   * Where the browser-made thumbnail goes, and the token for it — or null.
   *
   * ── NULL IS A REAL ANSWER AND THE CLIENT MUST HANDLE IT ─────────────────────────
   * Signing the thumbnail is a second Storage call per file and it is allowed to fail on its
   * own: an original with no thumbnail renders exactly as it did before this feature, from
   * `file_path`. Failing the whole ticket over it would make a Storage hiccup on a derived,
   * optional object cost the family their photograph.
   *
   * The client may also decline to use it — a format the canvas cannot decode (HEIC in
   * Chrome) produces no blob, and the browser then uploads the original alone. Which is why
   * `recordUploadedPhotos` takes `thumbPath` as optional rather than deriving it: the server
   * cannot know whether the bytes arrived, and a column pointing at an object that is not
   * there is worse than a NULL. It re-derives the path anyway and refuses a different one.
   */
  thumb: { path: string; token: string } | null
}

export async function createPhotoUploadTickets(
  collectionId: string,
  files: { name: string; type: string; size: number }[],
): Promise<{ success: boolean; tickets: PhotoUploadTicket[]; failed: string[]; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, tickets: [], failed: [], message: g.message }
  const { t } = g
  if (!(await canAny(g.userId, 'community/gallery', 'create'))) {
    return { success: false, tickets: [], failed: [], message: t('act.notAuthorized') }
  }

  // ── §4: THE COLLECTION IS A CLIENT-SUPPLIED ID THAT ENDS UP ON THE ROW ───────────
  // The `photos` row carries the CALLER's `family_code`, so every policy on it is satisfied
  // while `collection_id` points wherever the caller said — including into another family's
  // album. Nothing in the database is asked, because RLS is a predicate over the row being
  // written and not over the ids it references. `belongsToFamily` uses the service role on
  // purpose: the answer must not depend on the caller's view grant.
  //
  // IT IS CHECKED HERE AS WELL AS IN `recordUploadedPhotos`, and the two do different jobs.
  // The one there is the GATE: it is what stops a `photos` row being written against another
  // family's album, mutation-checked. This one refuses EARLY and is worth having anyway —
  // without it a member picks two hundred photographs, waits while every one of them uploads,
  // and is then told the album was not theirs, with two hundred orphaned objects left in the
  // bucket. Do not remove it as redundant; it is not the same check twice, it is the same
  // answer given before the expensive part.
  if (!(await belongsToFamily('photo_collections', collectionId, g.familyCode))) {
    return { success: false, tickets: [], failed: [], message: t('act.albumNotFound') }
  }

  if (files.length === 0) {
    return { success: false, tickets: [], failed: [], message: t('act.noFilesChosen') }
  }
  if (files.length > PHOTO_UPLOAD_CHUNK) {
    // The client chunks; a caller that does not is refused rather than served, because the
    // per-file signing below is a round trip each and an unbounded list is a way to hold a
    // function open. Not a security boundary — a bound.
    return {
      success: false, tickets: [], failed: [],
      message: t('gal.tooManyAtOnce', { n: String(PHOTO_UPLOAD_CHUNK) }),
    }
  }

  const supabase = await createClient()
  const tickets: PhotoUploadTicket[] = []
  const failed: string[] = []

  for (const file of files) {
    // THE SAME TWO CHECKS THE OLD ACTION MADE, and they still belong here rather than only in
    // the picker: this is the gate (§2), and `size` is the browser's own figure. It is not the
    // last word — a signed URL is good for one object of any size — so the cap is re-read from
    // the OBJECT in `recordUploadedPhotos`, which is where the file actually exists.
    if (!isAllowedUpload(file.name, file.type, IMAGE_FORMATS)) {
      failed.push(uploadRejection(file.name, IMAGE_FORMATS))
      continue
    }
    if (file.size > PHOTO_MAX_BYTES) {
      failed.push(t('gal.fileTooLarge', { name: file.name }))
      continue
    }

    // THE EXTENSION COMES FROM THE ALLOW-LIST'S OWN READING of the name, not from a split on
    // the raw string: `isAllowedUpload` has already established it is one of ours.
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    const path = photoObjectPath(g.familyCode, collectionId, crypto.randomUUID(), ext)

    const { data, error } = await supabase.storage.from('photos').createSignedUploadUrl(path)
    if (error || !data?.token) {
      console.error(`[gallery] could not sign an upload for ${path}: ${error?.message}`)
      failed.push(`${file.name}: ${error?.message ?? t('gal.couldNotStartUpload')}`)
      continue
    }
    // ── AND A TICKET FOR THE THUMBNAIL, WHICH MAY FAIL ON ITS OWN ─────────────────
    // Same bucket, same folder, `_thumb.jpg` suffix — see `photoThumbPath` for why it is not
    // a `thumbs/` prefix. A failure here is logged and carried as `null`; the photograph is
    // still uploaded and still shown, from the original, exactly as before thumbnails
    // existed.
    const thumbPath = photoThumbPath(path)
    let thumb: PhotoUploadTicket['thumb'] = null
    if (thumbPath) {
      const signed = await supabase.storage.from('photos').createSignedUploadUrl(thumbPath)
      if (signed.error || !signed.data) {
        console.error(`[gallery] could not sign a thumbnail for ${thumbPath}: ${signed.error?.message}`)
      } else {
        thumb = { path: thumbPath, token: signed.data.token }
      }
    }

    tickets.push({ name: file.name, path, token: data.token, thumb })
  }

  return { success: tickets.length > 0, tickets, failed }
}

/**
 * Write the rows for objects the browser has just put in the bucket.
 *
 * ── THE PATH IS RE-DERIVED, NEVER TRUSTED ──────────────────────────────────────────
 * A `'use server'` export has a URL (§2), so `entries` is whatever the caller sent — and
 * `file_path` is what every reader turns into an image URL. A path pointing into another
 * family's folder would put their photograph in this album under this family's row, with
 * `family_code` correct and every policy satisfied: §4 exactly, arriving through a string
 * rather than through an id. So each path must sit DIRECTLY inside
 * `<family code>/<collection id>/`, which `photoObjectPrefix` is the one definition of, and a
 * path with a further slash in it is refused too — otherwise `ALPHA/album/../../BRAVO/x.jpg`
 * is a prefix match.
 *
 * ── THE OBJECT IS READ BACK, WHICH IS WHAT MAKES THE SIZE CAP REAL ─────────────────
 * A signed upload URL authorizes one path and says nothing about how many bytes go through
 * it, so the 10 MB in `createPhotoUploadTickets` is a courtesy until it is checked against the
 * object that now exists. `list({ search })` on the album's folder answers both questions at
 * once — is it there, and how big — and it is one call per file rather than a scan, because an
 * album is not small and `list` pages at a hundred.
 *
 * ── AN ORPHANED OBJECT IS POSSIBLE AND IS THE RIGHT WAY ROUND ──────────────────────
 * If the row write fails the object is removed here, as the old action did. If the BROWSER
 * dies between the upload and this call, the object stays in the bucket with no row — a file
 * nothing points at, which costs storage and shows nobody anything. The reverse ordering would
 * leave a row pointing at nothing, which renders as a broken image for the whole family.
 */
export async function recordUploadedPhotos(
  collectionId: string,
  entries: { name: string; path: string; thumbPath?: string | null }[],
  caption: string,
): Promise<{ success: boolean; uploaded: number; failed: string[]; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, uploaded: 0, failed: [], message: g.message }
  const { t } = g
  if (!(await canAny(g.userId, 'community/gallery', 'create'))) {
    return { success: false, uploaded: 0, failed: [], message: t('act.notAuthorized') }
  }
  if (!(await belongsToFamily('photo_collections', collectionId, g.familyCode))) {
    return { success: false, uploaded: 0, failed: [], message: t('act.albumNotFound') }
  }
  if (entries.length === 0) {
    return { success: false, uploaded: 0, failed: [], message: t('act.noFilesChosen') }
  }
  if (entries.length > PHOTO_UPLOAD_CHUNK) {
    // The same bound the ticket action keeps, and for the same reason: each entry below is a
    // storage round trip and then an insert, so an unbounded list is a way to hold a function
    // open. The client sends one round's worth because that is all it was given tickets for.
    return {
      success: false, uploaded: 0, failed: [],
      message: t('gal.tooManyAtOnce', { n: String(PHOTO_UPLOAD_CHUNK) }),
    }
  }

  const supabase = await createClient()
  const prefix = photoObjectPrefix(g.familyCode, collectionId)
  const trimmed = caption.trim() || null
  const failed: string[] = []
  let uploaded = 0

  for (const entry of entries) {
    const objectName = entry.path.startsWith(prefix) ? entry.path.slice(prefix.length) : null
    if (!objectName || objectName.includes('/')) {
      // Not a per-file rejection with an explanation: nothing a member can do produces this,
      // so the honest report is the same refusal the album check gives.
      failed.push(`${entry.name}: ${t('act.albumNotFound')}`)
      continue
    }

    const { data: found, error: listError } = await supabase.storage
      .from('photos').list(prefix.slice(0, -1), { search: objectName, limit: 1 })
    if (listError) {
      failed.push(`${entry.name}: ${listError.message}`)
      continue
    }
    // `search` is a prefix match rather than an equality, so the name is compared here.
    const object = (found ?? []).find(o => o.name === objectName)
    if (!object) {
      failed.push(t('gal.uploadDidNotArrive', { name: entry.name }))
      continue
    }
    const size = (object.metadata as { size?: number } | null)?.size
    if (typeof size === 'number' && size > PHOTO_MAX_BYTES) {
      await supabase.storage.from('photos').remove([entry.path])
      failed.push(t('gal.fileTooLarge', { name: entry.name }))
      continue
    }

    // ── THE THUMBNAIL PATH IS RE-DERIVED, NEVER TRUSTED ───────────────────────────
    // §4 in miniature: `thumbPath` arrives from the client, and a row carrying the caller's
    // own `family_code` while pointing at another family's object satisfies every policy.
    // So the client's value is only ever COMPARED against what this path must be — it says
    // WHETHER a thumbnail was uploaded, and never WHERE. A mismatch is treated as "no
    // thumbnail" rather than refused: the photograph is what the family came for, and the
    // fallback to `file_path` is already the correct rendering.
    const derivedThumb = photoThumbPath(entry.path)
    const thumbPath = entry.thumbPath && entry.thumbPath === derivedThumb ? derivedThumb : null

    const { error: dbError } = await supabase.from('photos').insert({
      collection_id: collectionId,
      family_code: g.familyCode,
      uploader_id: g.personId || null,
      file_path: entry.path,
      thumb_path: thumbPath,
      caption: trimmed,
    })
    if (dbError) {
      // The object goes back if the row did not land, or the bucket accumulates files nothing
      // points at.
      await supabase.storage.from('photos').remove([entry.path])
      failed.push(`${entry.name}: ${dbError.message}`)
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
    message: uploaded === 0 ? t('gal.nothingUploaded') : undefined,
  }
}

/**
 * Rename an album, and re-word its description.
 *
 * ── THE SAME OWNER RULE AS DELETING ONE, ONE RUNG QUIETER ──────────────────────────
 * `requireOwn('community/gallery', 'edit', created_by)`: its creator, or somebody holding the
 * unrestricted edit grant. That is `updatePhotoCaption`'s rule applied to the album rather
 * than to a picture in it, and it is deliberately `edit` and not `delete` — a mis-typed name
 * is repaired by typing it again, where a deleted album takes every photograph with it.
 *
 * The row is read on the ADMIN client and family-scoped by hand (§3) BEFORE the grant is
 * resolved, because `requireOwn` needs the owner and reading it on the caller's client would
 * make who the owner is depend on the caller's view grant.
 *
 * `confirmWrite`, because the UPDATE underneath is narrowed by RLS as well: `photo_collections`
 * maps to `community/gallery` with an `own_expr` of `created_by = auth_person_id()`, so a
 * caller holding `edit` at 'own' who somehow reached somebody else's album would match zero
 * rows and be told it saved (§8b). The guard above should make that unreachable; `confirmWrite`
 * is what makes "should" observable.
 */
export async function updateCollection(
  id: string,
  input: { name: string; description?: string },
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { user } = await currentUser()
  // The translator BEFORE the row read, because the "not found" below runs before the guard.
  const { t } = await callerI18n(user?.id ?? null)
  const { data: row } = await admin
    .from('photo_collections').select('created_by, family_code').eq('id', id).maybeSingle()
  if (!row) return { success: false, message: t('act.albumNotFound') }

  const g = await requireOwn('community/gallery', 'edit', row.created_by)
  if (!g.ok) return { success: false, message: g.message }
  if (row.family_code !== g.familyCode) return { success: false, message: t('act.albumNotFound') }

  const name = input.name.trim()
  if (!name) return { success: false, message: t('act.giveAlbumName') }

  const supabase = await createClient()
  const outcome = await confirmWrite(() =>
    supabase.from('photo_collections')
      .update({ name, description: input.description?.trim() || null })
      .eq('id', id)
      .select('id'))
  if (!outcome.ok) return { success: false, message: outcome.message }

  // BOTH PATHS: the index prints the name on a tile and the album page prints it as the
  // heading, and a rename that shows on one of them reads as a save that half worked.
  revalidatePath('/community/gallery')
  revalidatePath(`/community/gallery/${id}`)
  return { success: true }
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
  const { user } = await currentUser()
  // The translator BEFORE the row read, because the "not found" below runs
  // before the guard: `requireOwn` needs the row's owner, so the row has to
  // be read first. `currentUser()` is cached and the guard calls it anyway.
  const { t } = await callerI18n(user?.id ?? null)
  const { data: row } = await admin
    .from('photos').select('uploader_id, family_code, collection_id').eq('id', photoId).maybeSingle()
  if (!row) return { success: false, message: t('act.photoNotFound') }

  const g = await requireOwn('community/gallery', 'edit', row.uploader_id)
  if (!g.ok) return { success: false, message: g.message }
  if (row.family_code !== g.familyCode) return { success: false, message: t('act.photoNotFound') }

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
  const { user } = await currentUser()
  // The translator BEFORE the row read, because the "not found" below runs
  // before the guard: `requireOwn` needs the row's owner, so the row has to
  // be read first. `currentUser()` is cached and the guard calls it anyway.
  const { t } = await callerI18n(user?.id ?? null)
  const { data: row } = await admin
    .from('photos').select('uploader_id, family_code, collection_id').eq('id', id).maybeSingle()
  if (!row) return { success: false, message: t('act.photoNotFound') }

  const g = await requireOwn('community/gallery', 'delete', row.uploader_id)
  if (!g.ok) return { success: false, message: g.message }
  if (row.family_code !== g.familyCode) return { success: false, message: t('act.photoNotFound') }

  const supabase = await createClient()
  // THE ROW COUNT IS THE ANSWER, NOT THE ERROR (§8b). `file_path` is in the projection so the
  // storage delete uses the path from the ROW rather than one the caller sent — a mismatched
  // path would take out a DIFFERENT photograph's file inside the same family.
  const outcome = await confirmWrite(() =>
    supabase.from('photos').delete().eq('id', id).select('id, file_path, thumb_path'))
  if (!outcome.ok) return { success: false, message: outcome.message }

  // Storage AFTER the row, and not fatal: a failed object delete leaves a file nothing points
  // at, while the reverse leaves a row pointing at nothing.
  //
  // BOTH OBJECTS. `thumb_path` is in the projection for the same reason `file_path` is — the
  // paths come from the ROW rather than from anything a caller sent — and it is NULL for every
  // photograph uploaded before 2026-09-02, which `filter(Boolean)` is what handles. Missing it
  // would leave a thumbnail in a `public: true` bucket, fetchable by URL, after the family had
  // deleted the photograph: exactly the failure `20260820000006` found on the `photos` DELETE
  // policy, in a new place.
  const gone = outcome.rows[0]
  const paths = [gone?.file_path, gone?.thumb_path].filter((x): x is string => Boolean(x))
  if (paths.length > 0) await supabase.storage.from('photos').remove(paths)
  revalidatePath(`/community/gallery/${row.collection_id}`)
  return { success: true }
}

export async function tagPersonInPhoto(
  photoId: string,
  personId: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g

  // §4 ON BOTH IDS. The `photo_tags` row carries the caller's family, so a policy is satisfied
  // by a tag naming another family's person on another family's photograph.
  if (!(await belongsToFamily('photos', photoId, g.familyCode))) {
    return { success: false, message: t('act.photoNotFound') }
  }
  if (!(await belongsToFamily('people', personId, g.familyCode))) {
    return { success: false, message: t('act.personNotFound') }
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
  const { user } = await currentUser()
  // The translator BEFORE the row read, because the "not found" below runs
  // before the guard: `requireOwn` needs the row's owner, so the row has to
  // be read first. `currentUser()` is cached and the guard calls it anyway.
  const { t } = await callerI18n(user?.id ?? null)
  const { data: row } = await admin
    .from('photo_collections').select('created_by, family_code, name').eq('id', id).maybeSingle()
  if (!row) return { success: false, message: t('act.albumNotFound') }

  // Deleting an album cascades to every photograph in it, so its creator may remove their own
  // and anybody else needs the unrestricted delete grant.
  const g = await requireOwn('community/gallery', 'delete', row.created_by)
  if (!g.ok) return { success: false, message: g.message }
  if (row.family_code !== g.familyCode) return { success: false, message: t('act.albumNotFound') }

  // THE PATHS BEFORE THE CASCADE, on the admin client and family-scoped by hand (§3): the
  // rows are about to be unreachable, and a user-client read here would additionally miss any
  // photograph the caller cannot see — which would leave exactly those files behind.
  const { data: photos, error: readError } = await admin
    .from('photos').select('file_path, thumb_path').eq('collection_id', id).eq('family_code', g.familyCode)
  if (readError) {
    console.error(`[gallery] could not list ${id} before deleting it: ${readError.message}`)
    return { success: false, message: t('act.couldNotReadAlbumNothing') }
  }

  const { error } = await admin
    .from('photo_collections').delete().eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }

  // BOTH OBJECTS PER PHOTOGRAPH — see `deletePhoto` for why a missed thumbnail is a leak
  // rather than a tidiness problem. `thumb_path` is NULL for everything uploaded before
  // 2026-09-02 and for anything the uploader's browser could not decode.
  const paths = (photos ?? []).flatMap(p => [p.file_path, p.thumb_path])
    .filter((x): x is string => Boolean(x))
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
      message: t(unremoved === 1
        ? 'gal.albumGoneFilesLeftOne'
        : 'gal.albumGoneFilesLeftMany', { n: String(unremoved) }),
    }
  }
  return { success: true, removedPhotos: paths.length }
}
