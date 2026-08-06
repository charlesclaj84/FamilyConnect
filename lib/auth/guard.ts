import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode, getMyPersonId } from '@/lib/auth/family'
import { can, canAny, canOn, type PermissionAction } from '@/lib/auth/permissions'

/**
 * The preamble every mutating server action needs, in one call.
 *
 * A `'use server'` function is a public HTTP endpoint: Next.js gives it a URL and any
 * signed-in user can post to it with arguments of their choosing. The page that
 * renders the form is not in the request path, so an action that trusts it is
 * unprotected. That makes this preamble non-optional — and repeating it by hand
 * across sixty actions is how three of them end up missing a line.
 *
 * It answers all three questions at once:
 *
 *   1. Is there a caller?
 *   2. May they do this? (permission, by the resource that governs the TABLE — the
 *      same key the RLS policy uses, so code and database cannot drift apart)
 *   3. Which family are they acting in? — needed by every service-role query, which
 *      bypasses RLS and must re-apply family scoping by hand.
 *
 * Usage:
 *
 *   const g = await requireEdit('admin/events')
 *   if (!g.ok) return { success: false, message: g.message }
 *   // g.familyCode, g.personId, g.userId
 */

export interface GuardOk {
  ok: true
  userId: string
  familyCode: string
  /** people.id in the active family. Null only if the caller has no person row. */
  personId: string | null
}

export interface GuardFail {
  ok: false
  message: string
}

export type GuardResult = GuardOk | GuardFail

async function resolve(userId: string): Promise<GuardOk> {
  const [familyCode, personId] = await Promise.all([
    getMyFamilyCode(userId),
    getMyPersonId(userId),
  ])
  return { ok: true, userId, familyCode, personId }
}

async function caller(): Promise<{ userId: string } | GuardFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Not authenticated' }
  return { userId: user.id }
}

/**
 * Require the UNRESTRICTED grant for an action on a resource.
 *
 * Use for family-wide records — configuration, other people's rows, anything with no
 * coherent "mine". Scope 'own' is refused here on purpose: see canAny.
 */
export async function requireScope(
  resource: string,
  action: PermissionAction,
): Promise<GuardResult> {
  const who = await caller()
  if ('ok' in who) return who
  if (!(await canAny(who.userId, resource, action))) {
    return { ok: false, message: 'Not authorized' }
  }
  return resolve(who.userId)
}

/** `requireScope(resource, 'edit')` — by far the common case. */
export function requireEdit(resource: string): Promise<GuardResult> {
  return requireScope(resource, 'edit')
}

/** `requireScope(resource, 'delete')` for tables that grant delete separately. */
export function requireDelete(resource: string): Promise<GuardResult> {
  return requireScope(resource, 'delete')
}

/**
 * Require a grant over ONE row, honouring own-vs-any.
 *
 * For records a member legitimately owns — their own announcement, their own photo.
 * `ownerPersonId` is the people.id on the row (author_id, uploader_id, …); pass what
 * the row actually holds, read from the database, never from the client.
 */
export async function requireOwn(
  resource: string,
  action: PermissionAction,
  ownerPersonId: string | null | undefined,
): Promise<GuardResult> {
  const who = await caller()
  if ('ok' in who) return who
  if (!(await canOn(who.userId, resource, action, ownerPersonId))) {
    return { ok: false, message: 'Not authorized' }
  }
  return resolve(who.userId)
}

/**
 * Require a VIEW grant, for reads that run on the service role.
 *
 * Reading needs its own guard because the write guards are the wrong shape for it.
 * `requireScope(resource, 'view')` goes through canAny and so refuses scope 'own',
 * which is a legitimate way to hold view — and `requireMember()` demands nothing at
 * all. Neither fits a query that bypasses RLS to read a family's data.
 *
 * This uses `can()`, so 'own' passes: the caller may see *something* here, and the
 * query itself is then responsible for narrowing to what. Since the service role
 * ignores RLS, callers must still family-scope every query with `g.familyCode` and
 * validate any client-supplied id with `belongsToFamily` — this answers "may they
 * read this kind of thing at all", not "may they read this row".
 *
 * Several resources may be passed for data reachable from more than one screen
 * (event blueprint items appear under both Event Templates and Event Management);
 * holding view on any one of them is enough.
 */
export async function requireRead(...resources: string[]): Promise<GuardResult> {
  const who = await caller()
  if ('ok' in who) return who
  const granted = await Promise.all(resources.map(r => can(who.userId, r, 'view')))
  if (!granted.some(Boolean)) return { ok: false, message: 'Not authorized' }
  return resolve(who.userId)
}

/**
 * Authenticated caller, no permission demanded — for SELF-SERVICE writes only.
 *
 * Sending a chat message, submitting an RSVP, casting a vote, updating your own
 * profile: things every member may do by definition. These have no edit grant to
 * check (create/edit default to 'none', so demanding one would lock the whole family
 * out of chat), but they still need the family code, and they still owe the caller a
 * check that the row they are touching is genuinely theirs. This returns the identity
 * so that check can be made — it does not make it for you.
 */
export async function requireMember(): Promise<GuardResult> {
  const who = await caller()
  if ('ok' in who) return who
  return resolve(who.userId)
}
