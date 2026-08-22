'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode, belongsToFamily } from '@/lib/auth/family'
import { propagateChapterToChildren } from '@/lib/chapter-propagation'
import { canAny } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { pickProfileColumns } from '@/lib/profile-columns'
import { emailOrigin } from '@/lib/email/send'
import type { PersonalInfoData } from '@/app/actions/personal-info'

export type MyRoleSummary = import('@/lib/role-utils').RoleSummary

/**
 * `getFamilyMembersWithRoles()` AND ITS TWO TYPES WERE DELETED ON 2026-08-19, with Events.
 *
 * It published the whole roster — `primary_email` included — through the service role, and
 * its one caller was the Event Detail screen. That screen is gone, and a `'use server'` export
 * with no caller is not dead code: it is a live HTTP endpoint nobody exercises, which is
 * exactly the shape AGENTS.md records two afternoons of finding holes in. Its gate was
 * `admin/events:view`, a key `20260819000006` deletes, so leaving it would also have left a
 * function resolving a resource that no longer exists.
 *
 * `AssignedRole` and `MemberWithRoles` went with it, having no other reader.
 *
 * ── `getAllRoles()` AND `FamilyRole` WENT THE SAME WAY ON 2026-08-21, FOR THE SAME REASON
 * AND WITH THE SAME TWIST. It read the family's board positions for the Elections position
 * picker, and it was gated on `requireRead('review/election-management')` — a key
 * 20260821000000 DELETES, because the organizer's screen is `admin/elections` again. Left
 * behind it would have been the exact failure that paragraph describes, and worse in one way
 * that is worth writing down:
 *
 *   `resolveScope` falls back to `resource_visibility` for an unregistered key, and 'everyone'
 *   is the default for anything not shaped `admin/…`. `review/election-management` is not, so
 *   the gate would not merely have stopped working — it would have RESOLVED TO 'any' FOR EVERY
 *   SIGNED-IN MEMBER, publishing the family's board roster to anybody with the anon key and a
 *   session. A key that fails closed when it disappears is `admin/`-shaped; this one was not.
 *
 * What replaced it is `getElectionScopeOptions()` in app/actions/elections.ts, which returns
 * the regions, the chapters AND the offices in one read, gated on `admin/elections:view`. The
 * offices come back with their `scope`, because the level match is what stops a chapter
 * election filling a national office — see `rolesForScope` in lib/election-area.ts.
 */

export async function getMyRoles(): Promise<MyRoleSummary[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_roles')
    .select('scope, family_roles(name), chapters(name)')
    .eq('user_id', user.id)
    .eq('family_code', familyCode)

  // §8. Discarded until 2026-08-19, which made a refused read indistinguishable from holding
  // no position — and the two look identical on the dashboard.
  if (error) {
    console.error(`[users] own board positions read failed for ${familyCode}: ${error.message}`)
    return []
  }

  return (data ?? [])
    .map(r => ({
      role_name:        (r.family_roles as unknown as { name: string } | null)?.name ?? '',
      assignment_scope: r.scope,
      chapter_name:     (r.chapters as unknown as { name: string } | null)?.name ?? null,
    }))
    // A row whose position embed resolved to nothing would print as "National " with a
    // trailing space, because `formatRoleTitle` interpolates the name unconditionally. The
    // embed cannot fail on the admin client today; dropping the row is what keeps that from
    // being load-bearing.
    .filter(r => r.role_name !== '')
}

// FOUR EXPORTS WERE DELETED HERE ON 2026-08-19, and the deletion is the point.
//
//   getFamilyMemberRoles      a map of every member's titles, gated by a session alone, with
//                             NO CALL SITE anywhere in the product.
//   assignRole                gated `can(…, 'admin/members/board-positions', 'edit')` — which scope
//                             'own' satisfies — and then wrote FOUR client-supplied ids
//                             (`targetUserId`, `roleId`, `chapterId`, `regionId`) onto a
//                             `user_roles` row carrying the caller's own family_code. Every
//                             policy was satisfied; the row pointed wherever the caller said.
//                             AGENTS.md §4 — and the `roleId` half is how one family came to
//                             be able to assign another family's board position.
//   revokeRoleByAssignmentId  `.delete().eq('id', assignmentId)` on the service-role client
//                             with no family conjunct at all — the `deleteRegion` hole in a
//                             second costume.
//   revokeRole                the one that was right, and it went with them.
//
// None of the four had a caller: there has never been a UI in this product that gives
// somebody a board position. So they were live HTTP endpoints with holes in them, kept warm
// for a screen that did not exist. `getMyGatheringTaskCount` was the same shape and had its
// own TODO entry until the Dashboard grew a My Tasks quick action and gave it a caller; the
// difference is that these four were exploitable, and that is why they were deleted rather
// than waiting for a screen.
//
// `assignBoardPosition` and `revokeBoardPosition` in app/actions/admin/chapters.ts replace
// the two that matter, beside the catalogue they operate on, and `/admin/members/board-positions` is
// the screen that calls them. Rewriting rather than patching was deliberate: the new pair
// takes a **people.id** and resolves the account itself, so §4's question is answered by the
// same read that supplies the value the table stores.

export async function updateUserProfile(
  peopleId: string,
  data: Partial<PersonalInfoData>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  // THE KEY WAS `admin/boardpositions:edit` UNTIL 2026-08-19, through a helper shared with
  // the role-assignment actions above — so a family that let somebody curate its board
  // positions thereby let them rewrite any member's profile. Two mistakes in one line: the
  // wrong resource, and `can()` rather than `canAny()`, which scope 'own' passes.
  // `admin/users` is the screen this write belongs to, and it is `canAny` because the row is
  // somebody ELSE's — 'own' on `people` means the caller's own row, which is
  // `saveProfileSection`'s job, not this one's.
  if (!(await canAny(user.id, 'admin/members', 'edit'))) return { success: false, error: 'Not authorized' }

  // Two things this needs that it did not have, both required by AGENTS.md §3 for a
  // service-role write — which sees past RLS entirely, so nothing else was applying
  // either:
  //
  //   1. FAMILY SCOPING. `.eq('id', peopleId)` alone matches a people row in ANY
  //      family, so a user manager in one family could rewrite a member of another
  //      just by passing their id.
  //   2. AN ALLOW-LIST on `data`. It arrives as JSON from the client; the
  //      Partial<PersonalInfoData> annotation is erased at runtime. Unfiltered it could
  //      set user_id (reassigning the row to a different account), family_code (moving
  //      a member between families) or, since Phase 3, membership_status — admitting
  //      somebody without going through Member Approvals, which is the surface that
  //      exists to make that decision reviewable.
  const familyCode = await getMyFamilyCode(user.id)
  if (!familyCode) return { success: false, error: 'No family associated with account' }

  const fields = pickProfileColumns(data)
  //   4. AND NEVER THE ADDRESS, which `pickProfileColumns` does allow — this is the same
  //      `delete patch.primary_email` that `editPersonRecord` carries, added here on
  //      2026-08-19 for the same two reasons, both of which reach a row this action can
  //      write. A person with an account is the authority on their own address, and
  //      `saveProfileSection` is where they change it. And a person WITHOUT one holds a
  //      GENERATED address paired with `email_is_placeholder` and a stated reason
  //      (AGENTS.md §4b): writing a real address in leaves both flags describing an address
  //      that is no longer generated, so anything checking before mailing then refuses a
  //      working mailbox and `invitePersonRecord` cannot mint an invitation to it. The
  //      address changes exactly once, when `redeem_family_invitation` clears both flags.
  delete fields.primary_email
  if (Object.keys(fields).length === 0) return { success: true }

  //   3. A REFERENCE CHECK on chapter_id (AGENTS.md §4) — the SECOND layer, and today a
  //      no-op: `chapter_id` came off the profile allow-list, so `fields` cannot carry
  //      it. Kept because re-adding a column to that list is a one-line change nobody
  //      would think of as a security decision, and this path has no RLS underneath it
  //      at all — `people.chapter_id` is `REFERENCES chapters(id)`, which constrains
  //      existence and not ownership, so nothing else here would notice.
  if (fields.chapter_id != null && fields.chapter_id !== '') {
    if (typeof fields.chapter_id !== 'string'
      || !(await belongsToFamily('chapters', fields.chapter_id, familyCode))) {
      return { success: false, error: 'Chapter not found' }
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('people')
    .update(fields)
    .eq('id', peopleId)
    .eq('family_code', familyCode)
  return error ? { success: false, error: error.message } : { success: true }
}

// ══════════════════════════════════════════════════════════════════════════════
// EDITING SOMEBODY ELSE'S PROFILE FROM MEMBERS & ACCESS
// ══════════════════════════════════════════════════════════════════════════════
//
// `updateUserProfile` above was a live endpoint with no caller for months — TODO.md carried
// the choice between deleting it and giving it a screen. It has a screen now: the member
// detail dialog on Members & Access offers **Edit profile**, which opens a form over the same
// three profile sections a member sees at /personal-info, minus Sign-in & Security.
//
// ── WHY THE READ IS ITS OWN ACTION AND NOT A WIDER ROSTER PROJECTION ────────────────
// AGENTS.md §5: gate the FETCH, not the button. `searchMembers` publishes name, email, phone,
// location, chapter, region, template and status for every row on the page — a form needs
// nineteen more columns including date of birth, gender and a full street address. Adding
// those to the roster would put the whole family's PII in the RSC payload of a screen that
// mostly lists people, for the sake of one dialog that is open for one of them; and it would
// do it under `admin/members:view`, whereas editing is `admin/members:edit`.
//
// So this reads ONE person, on demand, and demands the EDIT grant to do it. A caller who may
// only view the roster cannot reach it at all, which is the correct answer for a projection
// that exists solely to be edited.

/** One member's editable profile, as the admin edit dialog needs it. */
export interface MemberProfileForEdit {
  peopleId: string
  /** For the dialog title. Composed here so one person reads the same on both screens. */
  name: string
  /**
   * Whether a real account is attached (`user_id IS NOT NULL`). It decides two things in the
   * dialog and nothing about permission: whether the password-reset offer appears at all, and
   * which sentence explains why the email field is read-only.
   */
  hasAccount: boolean
  /**
   * True when `primary_email` is the GENERATED address an account-less record carries
   * (AGENTS.md §4b). Shown rather than hidden, because an administrator looking at a
   * generated no-reply address and no explanation will try to correct it.
   */
  emailIsPlaceholder: boolean
  /** Read-only in the dialog. `updateUserProfile` deletes this column from any patch. */
  email: string | null
  /** Every column on WRITABLE_PROFILE_COLUMNS except primary_email, as form values. */
  fields: PersonalInfoData
  /**
   * The member's chapter in THIS family, or '' for none.
   *
   * ── NOT PART OF `fields`, AND THAT IS THE WHOLE OF WHY IT HAS ITS OWN ACTION ──────
   * `chapter_id` is deliberately absent from `WRITABLE_PROFILE_COLUMNS`
   * (`lib/profile-columns.ts` argues it at length): every other column there is the SAME VALUE
   * in every family the user belongs to and is propagated by the sync trigger, while a chapter
   * belongs to exactly one family and is excluded from both directions of that trigger. Folding
   * it back into the profile patch would re-open two write paths that no longer need the §4
   * reference check, to save one round trip.
   *
   * So the dialog reads it here and writes it with `setMemberChapter`, which is the
   * administrator's counterpart to `saveChapterAndPropagate` — and, like it, carries the
   * member's account-less children across.
   */
  chapterId: string
  /** Every chapter in the family, for the picker. Empty for a family with none. */
  chapters: { id: string; name: string }[]
}

export async function getMemberProfileForEdit(
  peopleId: string
): Promise<{ success: boolean; error?: string; profile?: MemberProfileForEdit }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // The SAME gate as the write it feeds — `admin/members:edit` at `canAny`, because the row is
  // somebody else's and scope 'own' on `people` means the caller's own row, which is
  // `getPersonalInfo`'s job. Reading a form's initial values is part of the edit, so it must
  // not be reachable one grant cheaper than the save.
  if (!(await canAny(user.id, 'admin/members', 'edit'))) return { success: false, error: 'Not authorized' }

  const familyCode = await getMyFamilyCode(user.id)
  if (!familyCode) return { success: false, error: 'No family associated with account' }

  // Admin client with the family conjunct written by hand (AGENTS.md §3). It has to be the
  // admin client: the `people` SELECT policy is keyed on `community/directory`, so a family
  // that has restricted its Directory would otherwise break its own Members & Access — the
  // same coupling `belongsToFamily` uses the service role to avoid.
  const admin = createAdminClient()
  // THE CHAPTER LIST COMES BACK WITH THE PROFILE, in one round trip, because a picker with no
  // options and a member with no chapter are different things the dialog has to tell apart.
  //
  // It reads on the ADMIN client with the family conjunct by hand, for the reason
  // `getDuesScopeOptions`, `familyPlaces` and `readChapters` all settled first: the composed
  // SELECT policy on `chapters` demands `admin/members/organization:view = 'any'`, so through
  // the user client an administrator who may edit members and not redraw regions reads NO
  // chapter at all — and PostgREST answers that with `[]` rather than an error. NAMES OF
  // CHAPTERS ARE FAMILY STRUCTURE RATHER THAN PII; what that key protects is EDITING the
  // family's shape.
  const [{ data, error }, chaptersRes] = await Promise.all([
    admin
    .from('people')
    // ONE STRING LITERAL, not a concatenation. supabase-js derives the row type from the
    // literal it is handed, so `'a, b' + 'c'` types every column as GenericStringError and
    // the whole projection stops compiling — which is the useful direction of that inference
    // and the reason this line is long rather than wrapped.
    .select('id, user_id, first_name, last_name, nick_name, prefix, middle_name, suffix, primary_email, primary_phone, email_is_placeholder, street_address, apartment, city, state, zip_code, country, date_of_birth, sunset_date, gender, tshirt_category, tshirt_size, time_zone, chapter_id')
    .eq('id', peopleId)
    .eq('family_code', familyCode)
    .maybeSingle(),
    admin.from('chapters').select('id, name').eq('family_code', familyCode).order('name'),
  ])

  // §8 — the error is READ rather than discarded, or a refused query is indistinguishable
  // from a member who is not in this family, and the dialog would report the wrong thing.
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Member not found' }

  // §8 on the chapter list too, and the failure mode is worth naming: an empty picker and a
  // refused read look identical, and the second would let an administrator save "no chapter"
  // over a member who has one, believing the family had none.
  if (chaptersRes.error) {
    return { success: false, error: `Could not read this family’s chapters: ${chaptersRes.error.message}` }
  }

  const t = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    success: true,
    profile: {
      peopleId: data.id as string,
      name: [data.first_name, data.last_name].filter(Boolean).join(' ').trim(),
      hasAccount: data.user_id != null,
      emailIsPlaceholder: Boolean(data.email_is_placeholder),
      email: (data.primary_email as string | null) ?? null,
      fields: {
        prefix: t(data.prefix), first_name: t(data.first_name), middle_name: t(data.middle_name),
        last_name: t(data.last_name), nick_name: t(data.nick_name), suffix: t(data.suffix),
        primary_phone: t(data.primary_phone),
        street_address: t(data.street_address), apartment: t(data.apartment),
        city: t(data.city), state: t(data.state), zip_code: t(data.zip_code),
        country: t(data.country),
        date_of_birth: t(data.date_of_birth), sunset_date: t(data.sunset_date),
        gender: t(data.gender),
        tshirt_category: t(data.tshirt_category), tshirt_size: t(data.tshirt_size),
        time_zone: t(data.time_zone),
      },
      chapterId: t(data.chapter_id),
      chapters: (chaptersRes.data ?? []) as { id: string; name: string }[],
    },
  }
}

/**
 * Set a member's chapter, from Members & Access.
 *
 * ── THE ADMINISTRATOR'S COUNTERPART TO `saveChapterAndPropagate` ───────────────────
 * Added 2026-08-21. Before it, the only way a chapter could be set was by the member
 * themselves on My Profile — so an administrator filing a relative who had never signed in,
 * or correcting somebody who had put themselves in the wrong one, had no route at all.
 *
 * IT IS A SEPARATE ACTION AND NOT A COLUMN ON THE PROFILE PATCH, for the reason
 * `MemberProfileForEdit.chapterId` gives: `chapter_id` is per-family where every other
 * writable profile column floats across families, and `lib/profile-columns.ts` took it off the
 * allow-list deliberately. Putting it back would re-open two write paths that no longer need
 * the §4 reference check.
 *
 * ── THE SAME GATE AS THE REST OF THE DIALOG ────────────────────────────────────────
 * `admin/members:edit` at `canAny`. `canAny` and not `can`, for `updateUserProfile`'s reason:
 * the row is somebody ELSE's, and scope 'own' on `people` means the caller's own row, which is
 * `saveChapterAndPropagate`'s job.
 *
 * ── §3 AND §4, BOTH BY HAND ────────────────────────────────────────────────────────
 * The service-role client sees past RLS entirely, so `.eq('family_code', …)` is on the write,
 * and `chapterId` — a client parameter written onto a row whose own `family_code` satisfies
 * every policy — is verified with `belongsToFamily` first. `people.chapter_id` is
 * `REFERENCES chapters(id)`, which constrains EXISTENCE and not ownership, so nothing else
 * here would notice a chapter from another family.
 *
 * ── AND THE UNDER-18 CHILDREN FOLLOW, THROUGH THE SHARED HELPER ────────────────────
 * `propagateChapterToChildren`, the same function My Profile calls. Two implementations of one
 * rule is what this avoids — and the member-facing one was BROKEN when this was written, so a
 * fresh copy here would have been a correct one beside a silent failure.
 *
 * WHAT IT MOVES IS NARROW AND IS NOT A HOUSEHOLD: a son or daughter, under eighteen, with no
 * account of their own. Everybody else in this family is their own person and keeps the chapter
 * they were filed in — including an adult child with no account, who was moved until
 * 2026-08-22 and should not have been.
 */
export async function setMemberChapter(
  peopleId: string,
  chapterId: string | null,
): Promise<{ success: boolean; error?: string; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!(await canAny(user.id, 'admin/members', 'edit'))) {
    return { success: false, error: 'Not authorized' }
  }

  const familyCode = await getMyFamilyCode(user.id)
  if (!familyCode) return { success: false, error: 'No family associated with account' }

  // '' from a `<select>` with nothing chosen is "no chapter", which is a legitimate value and
  // not a missing one. Normalised before the reference check so the check is not asked about
  // the empty string.
  const target = chapterId && chapterId.trim() ? chapterId.trim() : null
  if (target && !(await belongsToFamily('chapters', target, familyCode))) {
    return { success: false, error: 'Chapter not found' }
  }

  const admin = createAdminClient()
  // `.select('id')` so a write that matched nothing is distinguishable from one that landed.
  // There is no RLS under this — the service role ignores it — so the only thing that can
  // match zero rows is a `peopleId` outside this family, and reporting THAT as a success is
  // how an administrator comes to believe they have filed somebody they have not.
  const { data: updated, error } = await admin
    .from('people')
    .update({ chapter_id: target })
    .eq('id', peopleId)
    .eq('family_code', familyCode)
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!(updated ?? []).length) return { success: false, error: 'Member not found' }

  const propagation = await propagateChapterToChildren(peopleId, familyCode, target)

  revalidatePath('/admin/members')
  revalidatePath('/community/directory')

  // A PARTIAL SUCCESS, said out loud — the member's own row is written, so this is not a
  // failed save, and silence about the half that did not happen is the defect this whole
  // helper exists to close.
  if (propagation.error) {
    return {
      success: true,
      message: 'Chapter saved, but their children under 18 with no account of their own '
        + 'could not be moved with them. Try again, or set each chapter individually.',
    }
  }
  if (propagation.moved > 0) {
    return {
      success: true,
      message: `Chapter saved. ${propagation.moved} relative`
        + `${propagation.moved === 1 ? '' : 's'} without an account moved with them.`,
    }
  }
  return { success: true }
}

/**
 * Send a member the ordinary "reset your password" email.
 *
 * ── WHY THIS IS NOT THE MAIL CANNON AGENTS.md FORBIDS ───────────────────────────────
 * That rule is about an action taking an ADDRESS: GoTrue already publishes
 * `POST /auth/v1/recover` reachable with the anon key that ships in the browser bundle, so a
 * `'use server'` wrapper taking an email is a second public endpoint whose only job is to
 * reach the first — one that hides every caller behind our server's address in front of the
 * only rate limiter there is. `ForgotPasswordForm` therefore calls GoTrue from the browser.
 *
 * This takes a **people.id** and resolves the address itself, from a row it has already
 * scoped to the caller's own family, behind `admin/members:edit`. The caller cannot choose
 * the recipient — they can only name somebody their family already holds a record for — which
 * is the same distinction `redeem_family_invitation` draws about `p_user_id` (§2b) and the
 * reason `assignBoardPosition` was rewritten to take a people id rather than an auth id.
 *
 * ── TWO REFUSALS BEFORE ANY MAIL, AND BOTH ARE ABOUT §4b ────────────────────────────
 * A `people` row without a `user_id` has no account to reset, and it carries a GENERATED
 * address paired with `email_is_placeholder`. Mailing that address cannot reach anybody, and
 * a hard bounce is charged to our sending domain's reputation — `sendEmail` refuses reserved
 * TLDs for exactly that reason. So both are refused here, with the sentence that says what to
 * do instead: an account-less relative is INVITED, not reset.
 *
 * ── AND IT CANNOT REPORT DELIVERY, WHICH THE COPY HAS TO OWN ────────────────────────
 * `/auth/v1/recover` answers 200 for an address with an account, one without, and one that
 * has never been seen — deliberately, so it cannot be used to enumerate accounts. So a
 * success here means "GoTrue accepted the request", never "a mail arrived", and the dialog
 * says exactly that rather than "Sent". Same honesty `ForgotPasswordForm` and the resend
 * offer on `/login` are written for.
 */
export async function sendMemberPasswordReset(
  peopleId: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  if (!(await canAny(user.id, 'admin/members', 'edit'))) return { success: false, error: 'Not authorized' }

  const familyCode = await getMyFamilyCode(user.id)
  if (!familyCode) return { success: false, error: 'No family associated with account' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('people')
    .select('user_id, primary_email, email_is_placeholder')
    .eq('id', peopleId)
    .eq('family_code', familyCode)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Member not found' }

  if (data.user_id == null) {
    return {
      success: false,
      error: 'This relative has no account yet, so there is no password to reset. '
        + 'Invite them from the family tree instead.',
    }
  }
  if (data.email_is_placeholder || !data.primary_email) {
    return {
      success: false,
      error: 'This record has a placeholder email address, so a reset link has nowhere to go.',
    }
  }

  // THE ADDRESS COMES FROM `auth.users`, NOT FROM `people.primary_email`. The two are kept in
  // step by the app and only the first is what GoTrue will match — a profile whose address was
  // edited without the account following would otherwise get a 200 and no mail, reported here
  // as a success. Reading it back is also the last check that the account still exists.
  const { data: account, error: accountError } = await admin.auth.admin.getUserById(data.user_id as string)
  if (accountError || !account?.user?.email) {
    return { success: false, error: 'That member has no sign-in address on record.' }
  }

  // The ORIGIN comes from configuration, never a request header: `Host` and
  // `X-Forwarded-Host` are attacker-controlled, and here they would control the hostname
  // inside a link an email tells somebody to trust. See lib/email/send.ts.
  const { error: sendError } = await supabase.auth.resetPasswordForEmail(account.user.email, {
    redirectTo: `${emailOrigin()}/update-password`,
  })
  if (sendError) return { success: false, error: sendError.message }

  return {
    success: true,
    message: 'A reset link has been requested for that member. '
      + 'They will receive it if their address is reachable.',
  }
}
