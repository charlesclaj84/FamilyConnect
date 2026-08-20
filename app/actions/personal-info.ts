'use server'

import { revalidatePath } from 'next/cache'
import { confirmWrite } from '@/lib/confirmed-write'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode, belongsToFamily } from '@/lib/auth/family'
import { pickProfileColumns } from '@/lib/profile-columns'

/**
 * The extensions the `avatars` bucket accepts, keyed by the MIME type that goes with each.
 *
 * ── THE EXTENSION IS DERIVED FROM THE TYPE, NEVER FROM THE FILENAME ─────────────────
 * It used to be `file.name.split('.').pop()`, which is a string the caller chose. That is not
 * the worst kind of untrusted input — the object path is `{auth.uid()}/avatar.{ext}` and since
 * 20260820000002 storage refuses anything outside the caller's own folder, so it could not be
 * aimed at somebody else's picture — but it decided two things it had no business deciding:
 *
 *   * WHICH FILE THE UPSERT REPLACES. Upload a JPEG, then a PNG, and the paths differ, so the
 *     `upsert` replaces nothing and `avatar.jpg` is left behind forever — a public object the
 *     product has forgotten about, still served by URL.
 *   * WHETHER THE TYPE IS ONE WE ACCEPT AT ALL. The bucket has an `allowed_mime_types` list
 *     (20260609000000), so a `.svg` was going to be refused by storage anyway — with
 *     storage's own message, which reads as a bug rather than as "we take JPEG, PNG or WebP".
 *
 * Deriving it from `file.type` fixes both: one canonical path per type, and a refusal we can
 * word. GIF is deliberately NOT here even though the bucket admits it — the `accept` attribute
 * on the input has only ever offered three, and an animated avatar is a decision nobody made.
 */
const AVATAR_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function uploadAvatar(
  formData: FormData
): Promise<{ success: boolean; url?: string; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { success: false, message: 'No file provided' }
  if (file.size > 2 * 1024 * 1024) return { success: false, message: 'File must be under 2 MB' }

  // SERVER-SIDE, because `accept` on the input is a hint to a file picker and this action is a
  // public HTTP endpoint like every other. `file.type` is still the browser's claim about the
  // bytes rather than a fact about them — the bucket's `allowed_mime_types` is the layer that
  // does not take our word for it, and it is why this list matches that one.
  const ext = AVATAR_TYPES[file.type]
  if (!ext) {
    return { success: false, message: 'Choose a JPEG, PNG or WebP image' }
  }

  const path = `${user.id}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return { success: false, message: uploadError.message }

  // ── THE OTHER EXTENSIONS ARE REMOVED, AND FAILING TO IS NOT FATAL ─────────────────
  // `upsert` replaces the object at THIS path. Somebody who had a JPEG and uploads a PNG leaves
  // `avatar.jpg` behind — orphaned, and still served by URL from a public bucket, which is the
  // half that matters: an old photograph a member believes they replaced is still fetchable by
  // anybody who noted the address.
  //
  // Best-effort on purpose. The new picture is already uploaded and `avatar_url` is about to
  // point at it, so a failed cleanup must not be reported as a failed upload — that would send
  // the member back to try again over a photo that is already theirs. The error is logged
  // because a bucket quietly accumulating orphans is exactly the thing nobody notices.
  const stale = Object.values(AVATAR_TYPES)
    .filter(other => other !== ext)
    .map(other => `${user.id}/avatar.${other}`)
  const { error: cleanupError } = await supabase.storage.from('avatars').remove(stale)
  if (cleanupError) {
    console.error(`[avatar] could not remove the previous file(s) for ${user.id}: ${cleanupError.message}`)
  }

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

  // avatar_url is a shared profile field, so this intentionally has no
  // family_code filter: the picture applies to every family the user is in.
  //
  // ── CONFIRMED, BECAUSE THE FAILURE HERE IS INVISIBLE (lib/confirmed-write.ts) ──────
  // `people` maps to `community/directory` with `user_id = (SELECT auth.uid())` as both its
  // own- and self-expression, so a member always reaches their own row and this should
  // never match nothing. "Should never" is the reason to check rather than the reason not
  // to: the object is ALREADY in a public bucket by this point, so a zero-row update leaves
  // a photograph uploaded and served by URL while every screen still renders the old one —
  // and the member is told it saved. There is nothing to roll back and nothing to notice.
  //
  // `.select('id')` also counts the rows across every family the user belongs to, which is
  // the right count for a shared column: one member of three families expects three.
  const updated = await confirmWrite(() =>
    supabase
      .from('people')
      .update({ avatar_url: publicUrl })
      .eq('user_id', user.id)
      .select('id'))

  if (!updated.ok) return { success: false, message: updated.message }

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
  /** 'male' | 'female', or absent. Constrained by a CHECK — see lib/gender.ts. */
  gender?: string
  tshirt_category?: string
  tshirt_size?: string
  chapter_id?: string | null
  time_zone?: string | null
}

export type PersonalInfoRecord = PersonalInfoData & {
  id: string
  user_id: string
  family_code: string
  nick_name?: string | null
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export async function getPersonalInfo(): Promise<PersonalInfoRecord | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // A multi-family user has one row per family. Profile fields are kept in sync
  // across them, but chapter_id / is_admin are per-family, so read the row for
  // the family currently being viewed.
  const familyCode = await getMyFamilyCode(user.id)

  const { data } = await supabase
    .from('people')
    .select('*')
    .eq('user_id', user.id)
    .eq('family_code', familyCode)
    .maybeSingle()

  return data ?? null
}

/**
 * Is this `chapters.id` one of ours? The §4 check every `chapter_id` write owes.
 *
 * NOT EXPORTED, deliberately: this file is `'use server'`, so an export would publish
 * it at a URL of its own — and a helper that answers questions about another family's
 * ids is not something to hand out, even though the answer is a boolean.
 *
 * Absent means "this write is not touching the column"; null and '' mean "clear it".
 * None of the three reference a row, so all three pass — the same shape as the optional
 * `milestone_id` guard in recordDisbursement.
 */
async function chapterIsOurs(chapterId: unknown, familyCode: string): Promise<boolean> {
  if (chapterId === undefined || chapterId === null || chapterId === '') return true
  if (typeof chapterId !== 'string') return false
  return belongsToFamily('chapters', chapterId, familyCode)
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
  // Allow-listed BEFORE anything else touches it. `fields` is a JSON object off the
  // wire, and every column of `people` is writable by its owner as far as RLS is
  // concerned — including membership_status. See lib/profile-columns.ts.
  for (const [key, val] of Object.entries(pickProfileColumns(fields))) {
    if (dateFields.has(key)) {
      cleaned[key] = (val as string) || null
    } else if (typeof val === 'string') {
      cleaned[key] = val.trim() || null
    } else {
      cleaned[key] = val ?? null
    }
  }

  // Write to the row for the family being viewed. app_metadata.family_code is
  // only the family the account was created in, which is the wrong target once a
  // user belongs to more than one. Shared profile columns propagate to the user's
  // other families via the people_sync_shared_profile trigger.
  const familyCode = (await getMyFamilyCode(user.id)) || user.app_metadata?.family_code || ''
  if (!familyCode) return { success: false, message: 'No family associated with account' }

  // THE SECOND LAYER, not the only one, and today not the one doing the work:
  // `chapter_id` is no longer on the profile allow-list, so `cleaned` cannot carry it
  // and this is a no-op. Kept anyway, for the reason AGENTS.md gives about grants —
  // the outer layer has been re-opened before, and re-adding a column to a list is a
  // one-line change nobody would think of as a security decision. If it ever comes
  // back, the §4 check is already here rather than needing to be remembered.
  if (!(await chapterIsOurs(cleaned.chapter_id, familyCode))) {
    return { success: false, message: 'Chapter not found' }
  }

  const { error } = await supabase
    .from('people')
    .upsert(
      {
        user_id: user.id,
        family_code: familyCode,
        created_by: user.id,
        ...cleaned,
      },
      { onConflict: 'user_id,family_code' }
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

  // The family being viewed, not the one the account was created in.
  const familyCode = (await getMyFamilyCode(user.id)) || user.app_metadata?.family_code
  if (!familyCode) return { success: false, message: 'No family code associated with account' }

  // §4 — chapter_id is a client-supplied reference written onto the caller's own row.
  if (!(await chapterIsOurs(input.chapter_id, familyCode))) {
    return { success: false, message: 'Chapter not found' }
  }

  const normalize = (v?: string) => v?.trim() || null

  const { error } = await supabase
    .from('people')
    .upsert(
      {
        user_id: user.id,
        family_code: familyCode,
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
      { onConflict: 'user_id,family_code' }
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

  // chapter_id is per-family, so this must target the family being viewed —
  // chapters themselves belong to a single family.
  const familyCode = (await getMyFamilyCode(user.id)) || user.app_metadata?.family_code || ''
  if (!familyCode) return { success: false, message: 'No family associated with account' }

  // The comment above already knew chapters belong to a single family; it scoped the
  // people ROW to this family and never checked the CHAPTER. That is exactly §4 — the
  // row is the caller's, so RLS is satisfied, while the id it carries is not theirs.
  // This one also propagates to every minor child below, so an unchecked id spread.
  if (!(await chapterIsOurs(chapterId, familyCode))) {
    return { success: false, message: 'Chapter not found' }
  }

  // Update own record
  const { data: myRecord, error: myError } = await supabase
    .from('people')
    .upsert({ user_id: user.id, family_code: familyCode, created_by: user.id, chapter_id: chapterId ?? null }, { onConflict: 'user_id,family_code' })
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
        // WHO FOLLOWS THE PARENT: children with NO ACCOUNT, not children flagged as
        // minors. This was `.eq('is_minor', true)` until 20260813000006 dropped that
        // column, and the swap is a correction rather than a translation.
        //
        // The rule was always meant to be "somebody who cannot set their own chapter",
        // and age was a poor proxy for it in both directions: a 20-year-old with no
        // account was left behind while a 16-year-old who had claimed one had their
        // chapter overwritten by a parent. `user_id IS NULL` is the fact that actually
        // decides it, and it is the same test every other surface now uses to mean
        // "a record rather than a member".
        await supabase
          .from('people')
          .update({ chapter_id: chapterId ?? null })
          .in('id', childRels.map(r => r.related_person_id))
          .is('user_id', null)
      }
    }
  }

  revalidatePath('/personal-info')
  revalidatePath('/dashboard')
  return { success: true }
}
