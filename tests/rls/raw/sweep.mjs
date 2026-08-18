/**
 * The probes for `20260806000011` §6's approval sweep — the policies no server action can
 * reach.
 *
 * ── WHAT THE SWEEP IS ───────────────────────────────────────────────────────────────
 * Phase 3 made a `people` row possible without its owner having been admitted, which
 * created a caller nothing in the database had ever had to think about: somebody INSIDE the
 * family boundary — `auth_family_code()` resolves their family, deliberately and
 * permanently — who has not been let in. Every policy whose only conjunct was
 * `family_code = auth_family_code()` admitted them.
 *
 * §6 added `auth_membership_approved()` to all of those. The tables it covers are the ones
 * where being in the family was previously the whole of the question:
 *
 *   permission_templates    SELECT   the family's access map
 *   template_permissions    SELECT   every grant in the family
 *   resource_visibility     SELECT   which pages the family has restricted
 *   person_relationships    SELECT   the whole family tree
 *   notifications           INSERT   THE HEADLINE — a title and a LINK into every bell
 *   chat_participants       SELECT   who is in which room
 *   event_rsvp              SELECT   who is coming
 *   event_assignments       SELECT   who is bringing what
 *   user_roles              SELECT   who holds which board position
 *
 * ── WHY THESE ARE PROBES AND NOT ACTIONS ────────────────────────────────────────────
 * Because there is no action to call. `notifications` INSERT is the sharpest case and the
 * clearest illustration: it is written only by `lib/notifications.ts`, a PLAIN module with
 * no URL, precisely so that no server action exposes an arbitrary-recipient notifier. The
 * policy is therefore load-bearing and unreachable from the suite that exists to test
 * policies. `cases.mjs`'s `UNCOVERED` note recorded that as a structural gap from Phase 3
 * until 2026-08-17; these close it.
 *
 * Each function takes NO actor argument, exactly as a server action's `createClient()`
 * takes none — `currentActor()` supplies it. That is what lets `run.mjs` drive them with no
 * change at all: `loadAction` already imports `../../${mod}`, so a case naming
 * `tests/rls/raw/sweep.mjs` resolves like any other module.
 *
 * ── EVERY PROBE RETURNS THE ERROR ───────────────────────────────────────────────────
 * `42501` (the policy refused) and `[]` (the policy matched nothing) are opposite facts and
 * both look like an empty response. `raw.mjs`'s header has the full argument; the shape here
 * is that a SELECT probe returns rows so the marker scan can judge them, and the INSERT
 * probe returns the error CODE so its case can assert on the refusal rather than on
 * emptiness.
 *
 * ── ONE TABLE IS DELIBERATELY ABSENT ────────────────────────────────────────────────
 * `adults`. `permission_table_map` still carries a row for it with an `auth.uid()`-based
 * self expression, so the migration's computed sweep list names it — and
 * `to_regclass('public.adults')` is NULL, because `20260602000003` dropped the table. The
 * migration skips it with a NOTICE; a probe would fail with 42P01. TODO.md carries dropping
 * the stale map row.
 */
import { rawSelect, rawInsert, rawUpdate, rawRpc } from '../raw.mjs'

// ── (b) tables: family scoping was the ONLY conjunct before §6 ───────────────────────

export async function selectPermissionTemplates() {
  return rawSelect('permission_templates', 'id, name, family_code')
}

export async function selectTemplatePermissions() {
  return rawSelect('template_permissions', 'template_id, resource_key, action, scope')
}

export async function selectResourceVisibility() {
  return rawSelect('resource_visibility', 'family_code, resource_key, visibility')
}

export async function selectPersonRelationships() {
  return rawSelect('person_relationships', 'id, person_id, related_person_id, family_code, link_kind')
}

/**
 * THE ONE WRITE, and the reason this file exists.
 *
 * An applicant inserting into `notifications` reaches every bell in the family with a
 * title and a `link` of their choosing — a phishing surface inside a product whose whole
 * premise is that only the family can see it.
 *
 * The row is written with the marker title the case's probe filters on, so the probe can
 * tell "the write was refused" from "the write landed" without depending on counting rows
 * in a table the fixture also seeds.
 *
 * `recipient_id` is ALPHA's own member — the point is not that the applicant reaches
 * somebody else's family, it is that they reach their own family's members while not
 * having been admitted to it.
 */
export const SWEEP_NOTIFICATION_TITLE = 'ZZ sweep probe — an applicant wrote this'

export async function insertNotification(familyCode, recipientPersonId) {
  return rawInsert('notifications', {
    family_code: familyCode,
    recipient_id: recipientPersonId,
    // `type`, not `kind` — the column names were read off the live schema rather than
    // guessed, because a 42703 from a mistyped column looks exactly like a policy
    // refusal in the shape this probe returns.
    type: 'membership',
    title: SWEEP_NOTIFICATION_TITLE,
    body: 'If this row exists, an unadmitted applicant reached every bell in the family.',
    link: '/dashboard',
  })
}

// ── (a) tables: a self branch OR-ed outside the permission check ─────────────────────

export async function selectChatParticipants() {
  return rawSelect('chat_participants', 'id, room_id, user_id')
}

export async function selectEventRsvp() {
  return rawSelect('event_rsvp', 'id, event_id, submitted_by, is_attending')
}

export async function selectEventAssignments() {
  return rawSelect('event_assignments', 'id, event_id, assigned_to, response_status')
}

export async function selectUserRoles() {
  return rawSelect('user_roles', 'id, user_id, role_id, family_code')
}

// ── The two guards on `people`, reached where only a raw call can reach them ─────────

/**
 * A self-approval, by PATCH, straight at the column.
 *
 * `cases.mjs` already covers the route THROUGH `saveProfileSection` — but there
 * `pickProfileColumns` is what refuses, so the TRIGGER is never reached and the case is
 * evidence for the allow-list rather than for the guard. This is the call that exercises
 * `people_guard_membership_status` itself: the applicant's own row, which every policy
 * genuinely admits them to write, carrying the one column that would let them let
 * themselves in.
 *
 * Expect `42501` and the guard's own message. That the row is theirs is the whole point —
 * this is not a family-isolation probe, it is the column boundary.
 */
export async function selfApprove(ownPersonId) {
  return rawUpdate('people', ownPersonId, { membership_status: 'approved' })
}

/** The same, for the other guarded column: a self-promotion onto an admin template. */
export async function selfPromote(ownPersonId, templateId) {
  return rawUpdate('people', ownPersonId, { permission_template_id: templateId })
}

// ── The guard on `families`, and the only way to reach it (20260817000006 §2) ─────────

/**
 * Removing a family from devtools, by PATCH, straight at the column.
 *
 * THIS IS THE ATTACK THE EMAILED CODE EXISTS TO STOP BEING POSSIBLE, and no server action
 * can express it. `families` has carried an UPDATE policy since `20260812000000` that
 * admits an administrator holding `admin/family:edit = 'any'` to their own family's row —
 * and a policy has no opinion about WHICH column changed. So without the trigger:
 *
 *     PATCH /rest/v1/families?family_code=eq.MINE   {"status": "removed"}
 *
 * removes the family with the RENAME grant, past `admin/family/remove`, past the
 * confirmation code, past `removeFamily()` entirely. The code would be a dialog rather
 * than a gate.
 *
 * The subject is the caller's OWN family, addressed by primary key, and the actor holds
 * every grant their family can confer. Nothing about family isolation is being tested here
 * — the column boundary is, exactly as `selfApprove` above tests one on `people`.
 *
 * Expect `42501` and the guard's own message. `rawUpdate` carries a `.select()`, which ANDs
 * the SELECT policy in; that policy admits a member's own family, so the row is reachable
 * and the trigger is genuinely what refuses.
 */
export async function removeFamilyByPatch(familyRowId) {
  return rawUpdate('families', familyRowId, { status: 'removed' })
}

/**
 * And the record columns, which `families_guard_removal` covers for their own sake.
 *
 * A PATCH that sets `removed_by` while leaving `status` alone is a false accusation with no
 * other symptom — the family stays open and its row now says somebody switched it off. The
 * guard tests all three columns with IS DISTINCT FROM for exactly this, and a version that
 * watched only `status` would pass every other assertion in this file.
 */
export async function forgeRemovalRecord(familyRowId, personId) {
  return rawUpdate('families', familyRowId, { removed_by: personId })
}

// ── The fail-closed admin default (20260817000004) ───────────────────────────────────

/**
 * `auth_permission()` as the caller, which is the only way to observe a RESOLUTION rather
 * than a row.
 *
 * Granted to `authenticated` because the composed policies reference it, so this is a call
 * the browser can genuinely make — asserting on it is asserting on something real.
 *
 * Its arguments are named for PostgREST: `p_resource`, `p_action`.
 */
export async function permissionFor(resourceKey, action = 'view') {
  return rawRpc('auth_permission', { p_resource: resourceKey, p_action: action })
}
