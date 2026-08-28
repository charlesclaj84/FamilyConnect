'use server'

import { revalidatePath } from 'next/cache'
import { propagateChapterToChildren } from '@/lib/chapter-propagation'
import { confirmWrite } from '@/lib/confirmed-write'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode, belongsToFamily } from '@/lib/auth/family'
import { familyShowsPhotos } from '@/lib/auth/tier'
import { pickProfileColumns } from '@/lib/profile-columns'
import { isSupportedLocale } from '@/lib/i18n/locales'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'

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
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }

  // ── THE ONE TIER CHECK ON A WRITE IN THIS PRODUCT, AND WHY IT IS ADMISSIBLE ────────
  // AGENTS.md forbids tier-checking the actions behind a paid page, and the reason is precise:
  // "the first time a family downgraded, one would start answering 'Not authorized' for their
  // own history." That argument is about REACHING WHAT ALREADY EXISTS. This creates something
  // new, and nothing a Free family uploads here would ever render for them — every read gate
  // is `familyShowsPhotos` — so accepting the file would take a 2 MB upload, replace the
  // object in a public bucket, stamp every family row the member has, and report success for a
  // picture they will not see. Refusing is the honest answer and the form does not offer the
  // control in the first place (§2: the form is a convenience, this is the gate).
  //
  // IT DOES NOT DELETE OR HIDE A ROW. A member of a Standard family and a Free one uploads
  // while viewing the Standard one and the picture lands for both, rendering in the family
  // that pays for it. That is the whole shape, and it is the reason the gate is on the READ
  // everywhere else.
  if (!(await familyShowsPhotos(user.id))) {
    return {
      success: false,
      message: t('act.profilePicturesPartStandardPlan'),
    }
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { success: false, message: t('act.noFileProvided') }
  if (file.size > 2 * 1024 * 1024) return { success: false, message: t('act.fileMustUnder2Mb') }

  // SERVER-SIDE, because `accept` on the input is a hint to a file picker and this action is a
  // public HTTP endpoint like every other. `file.type` is still the browser's claim about the
  // bytes rather than a fact about them — the bucket's `allowed_mime_types` is the layer that
  // does not take our word for it, and it is why this list matches that one.
  const ext = AVATAR_TYPES[file.type]
  if (!ext) {
    return { success: false, message: t('act.chooseJpegPngWebpImage') }
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
  /**
   * Which language this member reads the product in — a two-character code.
   *
   * Part of the SHARED profile, so it floats across every family they belong to
   * (20260826000002). `null`/absent means they have not chosen, which resolves through
   * `Accept-Language` and then English rather than through a stored default — see
   * `lib/auth/locale.ts`.
   */
  locale?: string | null
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
  const { user } = await currentUser()
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

  if (!data) return null

  // ── THE PICTURE IS WITHHELD BY PLAN, NOT BY GRANT (2026-08-22) ─────────────────────
  // Profile pictures are Standard. `uploadAvatar` writes `avatar_url` to every family row the
  // user has, so a Free family's copy may well be populated — and this is the read that
  // decides whether this family shows it. `lib/auth/tier.ts`'s `familyShowsPhotos` carries the
  // whole argument for why the gate is here rather than on the write.
  //
  // NARROWED, NOT REFUSED: one column comes back null and the other twenty are untouched. A
  // pending member reaches this page in full (see the page), and they get the same answer —
  // the tier is a fact about the family, not about how far through joining they are.
  if (!(await familyShowsPhotos(user.id))) return { ...data, avatar_url: null }

  return data
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
/**
 * Change the language this member reads the product in.
 *
 * ── WHY NOT JUST `saveProfileSection({ locale })` ───────────────────────────────────
 * It would work, and the switcher would be posting a PROFILE SECTION to change one dropdown in
 * the top bar. Three things fall out of having its own action instead:
 *
 *   * **It takes one argument of one shape.** `saveProfileSection` takes a `Partial<>` off the
 *     wire and leans on `pickProfileColumns` to decide what reaches the row; this takes a
 *     locale code, checks it against the registry, and can write nothing else even in
 *     principle. A narrower endpoint is a smaller thing to reason about.
 *   * **It reports differently.** A profile save says "Saved"; this has to revalidate the whole
 *     layout, because the rail, the top bar and every caption in the shell are what change.
 *   * **The validation is here rather than only in the database.** `people_locale_check`
 *     (`20260826000002`) refuses an unsupported code, but a CHECK violation surfaces as a
 *     Postgres error a member cannot act on. `isSupportedLocale` is what turns it into a
 *     sentence — and the CHECK remains the layer a caller who never loads the page cannot get
 *     past (§2).
 *
 * ── IT IS SELF-SERVICE, SO `requireMember()` AND NOT A GRANT ────────────────────────
 * Choosing a language is something every member may do by definition, exactly like sending a
 * chat message or editing their own profile — `create` and `edit` default to scope `'none'`, so
 * demanding a grant would lock the whole family out of their own interface. What it still owes
 * is the OTHER check AGENTS.md §2 requires of a self-service action: that the row being touched
 * is genuinely the caller's. `.eq('user_id', user.id)` is that, and it is the only filter here
 * — the write deliberately reaches EVERY family the caller belongs to, because a language is
 * part of the shared profile and `people_sync_shared_profile` would propagate it anyway.
 */
export async function setMyLocale(
  locale: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }

  if (!isSupportedLocale(locale)) {
    return { success: false, message: t('act.notLanguageWeSpeakYet') }
  }

  // The USER client, so the `people` UPDATE policy — which admits a member's write to their own
  // row — is what authorizes this. `.select()` for §8b's reason: a write the policy matched zero
  // rows with would otherwise come back as `{ success: true }` over an unchanged row.
  const { data, error } = await supabase
    .from('people')
    .update({ locale })
    .eq('user_id', user.id)
    .select('id')

  if (error) {
    console.error(`[personal-info] locale change failed for ${user.id}: ${error.message}`)
    return { success: false, message: t('act.couldNotChangeLanguagePlease') }
  }
  if (!data || data.length === 0) {
    return { success: false, message: t('act.notAuthorized') }
  }

  // THE WHOLE LAYOUT, not this route: the rail, the top bar, the account menu and every caption
  // in the shell are what this changes. `renameFamily` revalidates the same way for a narrower
  // reason.
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function saveProfileSection(
  fields: Partial<PersonalInfoData>
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }

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
  if (!familyCode) return { success: false, message: t('act.noFamilyAssociatedAccount') }

  // THE SECOND LAYER, not the only one, and today not the one doing the work:
  // `chapter_id` is no longer on the profile allow-list, so `cleaned` cannot carry it
  // and this is a no-op. Kept anyway, for the reason AGENTS.md gives about grants —
  // the outer layer has been re-opened before, and re-adding a column to a list is a
  // one-line change nobody would think of as a security decision. If it ever comes
  // back, the §4 check is already here rather than needing to be remembered.
  if (!(await chapterIsOurs(cleaned.chapter_id, familyCode))) {
    return { success: false, message: t('act.chapterNotFound') }
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
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }

  // The family being viewed, not the one the account was created in.
  const familyCode = (await getMyFamilyCode(user.id)) || user.app_metadata?.family_code
  if (!familyCode) return { success: false, message: t('act.noFamilyCodeAssociatedAccount') }

  // §4 — chapter_id is a client-supplied reference written onto the caller's own row.
  if (!(await chapterIsOurs(input.chapter_id, familyCode))) {
    return { success: false, message: t('act.chapterNotFound') }
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

// Saves chapter_id on the user's own record AND propagates to their under-18 children who
// have no account of their own. Nothing else moves: every other member is their own person.
export async function saveChapterAndPropagate(
  chapterId: string | null
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }

  // chapter_id is per-family, so this must target the family being viewed —
  // chapters themselves belong to a single family.
  const familyCode = (await getMyFamilyCode(user.id)) || user.app_metadata?.family_code || ''
  if (!familyCode) return { success: false, message: t('act.noFamilyAssociatedAccount') }

  // The comment above already knew chapters belong to a single family; it scoped the
  // people ROW to this family and never checked the CHAPTER. That is exactly §4 — the
  // row is the caller's, so RLS is satisfied, while the id it carries is not theirs.
  // This one also propagates to the caller's under-18 children below, so an unchecked id
  // would have spread rather than sitting on one row.
  if (!(await chapterIsOurs(chapterId, familyCode))) {
    return { success: false, message: t('act.chapterNotFound') }
  }

  // Update own record
  const { data: myRecord, error: myError } = await supabase
    .from('people')
    .upsert({ user_id: user.id, family_code: familyCode, created_by: user.id, chapter_id: chapterId ?? null }, { onConflict: 'user_id,family_code' })
    .select('id')
    .single()

  if (myError) return { success: false, message: myError.message }

  // ── THE UNDER-18 CHILDREN FOLLOW, AND UNTIL 2026-08-21 THEY DID NOT ──────────
  // This was fifteen lines of reads and one UPDATE, all on the USER client — and `people`
  // maps to `community/directory` with `user_id = (SELECT auth.uid())` as both its own- and
  // self-expression, so the write matched ZERO ROWS for any member without
  // `community/directory:edit` at 'any'. The result was discarded, so nothing noticed: a
  // parent changed their chapter, was correctly told it saved, and their account-less children
  // stayed where they were. AGENTS.md §8b and TODO.md both carried it as an open defect.
  //
  // `lib/chapter-propagation.ts` is the repair and it runs on the ADMIN client with §3 scoping
  // by hand, which is what `editPersonRecord` does and for the same reason: the rows are ones
  // nobody owns, so no policy can admit them. It is a MODULE rather than inline here so that
  // `npm run audit:people` sees one service-role write needing one verdict, instead of putting
  // all six of this file's `people` writes on the review list — the cost AGENTS.md names when
  // it describes this repair.
  //
  // IT IS ALSO WHY THE ADMINISTRATOR'S VERSION IS NOT A SECOND COPY. `setMemberChapter` in
  // app/actions/admin/users.ts calls the same function.
  const propagation = myRecord?.id
    ? await propagateChapterToChildren(myRecord.id, familyCode, chapterId ?? null)
    : { moved: 0 }

  revalidatePath('/personal-info')
  revalidatePath('/dashboard')

  // A PARTIAL SUCCESS IS SAID OUT LOUD. The caller's own row is already written, so this is
  // not a failed save and must not read as one — but it is not the whole of what the member
  // asked for either, and silence is precisely what hid this for months.
  if (propagation.error) {
    return {
      success: true,
      message: t('act.yourChapterSavedButYour'),
    }
  }
  return { success: true }
}
