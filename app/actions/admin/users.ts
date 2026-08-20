'use server'

import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode, belongsToFamily } from '@/lib/auth/family'
import { canAny } from '@/lib/auth/permissions'
import { requireRead } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { pickProfileColumns } from '@/lib/profile-columns'
import type { PersonalInfoData } from '@/app/actions/personal-info'

export interface FamilyRole {
  id: string
  name: string
  category: 'executive_officer' | 'appointed_position'
  scope: 'national' | 'regional' | 'chapter'
  sort_order: number
}

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
 * `AssignedRole` and `MemberWithRoles` went with it, having no other reader. `FamilyRole`
 * above stays — the Elections position picker below returns it.
 */

/**
 * The board positions this family has, for the Elections screen's position dropdown.
 *
 * TWO THINGS CHANGED ON 2026-08-19. It demanded nothing but a session — a live endpoint
 * publishing the family's catalogue to anybody signed in, and `/admin/elections` being
 * `status: 'future'` withholds the page and never the action (AGENTS.md, "Coming Soon
 * withholds a page. It does not withhold an action"). And it read the 25 built-in positions
 * plus the family's own, minus a `family_role_exclusions` filter; `20260819000004` retired
 * all three of those things, so this is now one family-scoped read.
 *
 * It is NOT `getBoardPositions()` from app/actions/admin/chapters.ts, which gates on
 * `admin/boardpositions`: an elections organiser may hold this screen and not that one, so
 * the two keys are two jobs. The reads are deliberately similar and deliberately separate.
 */
export async function getAllRoles(): Promise<FamilyRole[]> {
  const g = await requireRead('admin/elections')
  if (!g.ok) return []

  const { data, error } = await createAdminClient()
    .from('family_roles')
    .select('id, name, category, scope, sort_order')
    .eq('family_code', g.familyCode)
    .order('sort_order')

  // §8. A refused read renders "No positions defined yet" over a family that has twelve.
  if (error) {
    console.error(`[users] board positions read failed for ${g.familyCode}: ${error.message}`)
    return []
  }
  return (data ?? []) as FamilyRole[]
}

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
//   assignRole                gated `can(…, 'admin/boardpositions', 'edit')` — which scope
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
// for a screen that did not exist — the shape TODO.md flags for `getMyGatheringTaskCount`,
// with the difference that these were exploitable.
//
// `assignBoardPosition` and `revokeBoardPosition` in app/actions/admin/chapters.ts replace
// the two that matter, beside the catalogue they operate on, and `/admin/boardpositions` is
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
  if (!(await canAny(user.id, 'admin/users', 'edit'))) return { success: false, error: 'Not authorized' }

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
