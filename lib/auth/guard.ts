import { getMyFamilyCode, getMyPersonId, isApprovedMember } from '@/lib/auth/family'
import { can, canAny, canOn, type PermissionAction } from '@/lib/auth/permissions'
import { callerI18n } from '@/lib/i18n/server'
import type { T } from '@/lib/i18n/t'
import { currentUser } from '@/lib/auth/current-user'

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
  /**
   * The caller's language, bound. Every refusal an action composes reads this.
   *
   * ── IT COSTS NOTHING, WHICH IS WHY IT IS HERE RATHER THAN AT 700 CALL SITES ───────
   * The alternative was `const { t } = await callerI18n(g.userId)` on the line after every
   * guard — about a hundred actions, each adding a third read of `people` for the same
   * user in the same request. `resolve()` already awaits two, so the locale joins the same
   * `Promise.all` and the round trip is absorbed rather than added.
   *
   * And it removes the failure mode that shape invites: a line every action must also
   * remember is a line three actions will not have, which is the argument
   * `requireView` makes for folding `requireTier` in. A missing `t` here is a type error.
   *
   * ── DO NOT USE IT TO DECIDE ANYTHING ─────────────────────────────────────────────
   * A language is a display fact. Nothing about what a caller may do may branch on it,
   * exactly as nothing may branch on `families.tier` in a policy.
   */
  t: T
  /**
   * The caller's `Intl` tag, for a date or a figure inside a message. NOT the same string
   * as their locale — see `lib/i18n/locales.ts`.
   */
  intl: string
}

export interface GuardFail {
  ok: false
  /**
   * What to show the caller, IN THEIR LANGUAGE.
   *
   * ── RESOLVED IN THE FAILURE BRANCH, NEVER ABOVE IT ────────────────────────────────
   * Every branch below reaches for `callerI18n` only once it has decided to refuse, which
   * is what makes this free: the success path — every guarded action that actually runs —
   * makes no extra call at all. Resolving `t` at the top of `caller()` would put a
   * `people.locale` read in front of every server action in the product to translate a
   * sentence almost none of them ever return.
   *
   * `resolveLocale` is `cache()`d per request, so an action that refuses and then reads it
   * again for its own message pays once.
   */
  message: string
}

export type GuardResult = GuardOk | GuardFail

/**
 * "Not authorized", in the caller's language.
 *
 * A function rather than four inline lookups because four call sites returning one sentence
 * is how two of them come to say slightly different things — the same argument
 * `lib/notifications.ts` makes about five copies of one message, and
 * `lib/chapter-propagation.ts` about one rule with two implementations.
 *
 * ── AND IT IS DELIBERATELY VAGUE, IN EVERY LANGUAGE ──────────────────────────────────
 * It says nothing about WHICH grant is missing, or that the resource exists. A refusal that
 * names the permission it wanted is a map of the product's permission model handed to
 * somebody who has just been told they may not see it. Translating it must not make it more
 * helpful.
 */
async function notAuthorized(userId: string): Promise<string> {
  const { t } = await callerI18n(userId)
  return t('guard.notAuthorized')
}

async function resolve(userId: string): Promise<GuardOk> {
  // THREE READS IN PARALLEL, not two and then one. See `GuardOk.t`: the locale read is the
  // cheapest of the three and would otherwise be a serial fourth round trip written out at
  // every call site.
  const [familyCode, personId, i18n] = await Promise.all([
    getMyFamilyCode(userId),
    getMyPersonId(userId),
    callerI18n(userId),
  ])
  return { ok: true, userId, familyCode, personId, t: i18n.t, intl: i18n.intl }
}

/**
 * Resolve the caller, and DISTINGUISH "signed out" from "could not tell".
 *
 * ── WHY THE ERROR IS READ AND NOT DISCARDED ────────────────────────────────────────
 * This was `const { data: { user } } = await supabase.auth.getUser()` with no error branch,
 * which is AGENTS.md §8's failure in the one place it is least legible. `getUser()` is a
 * NETWORK CALL to GoTrue, and supabase-js RETURNS its failures rather than throwing — so a
 * timeout, a 5xx, an expired token that could not be refreshed and a genuinely signed-out
 * visitor all arrived here as `user === null` and all came back to the member as the same
 * four words: "Not authenticated".
 *
 * That is wrong in two directions at once. Somebody who IS signed in, whose session simply
 * could not be checked, is told they are not signed in — so the obvious remedy (sign in
 * again) is the one that will not help, and the real remedy (reload) is not suggested. And
 * nothing is logged, so the failure leaves no trace anywhere: it cannot be counted, correlated
 * with a GoTrue incident, or told apart from a member fumbling a session.
 *
 * The two messages are deliberately different sentences rather than one hedged one. A member
 * reading "Your session could not be verified" knows to retry; a member reading "You are
 * signed out" knows to sign in. One message covering both teaches them to ignore it.
 *
 * WHAT THIS DOES NOT DO is retry. A failed `getUser()` may be transient, and `confirmWrite`
 * retries for exactly that reason — but this runs BEFORE any write, so the caller can retry
 * the whole action safely and a retry buried in a guard would double every auth round trip on
 * the unhappy path to save one press on a rare one.
 */
async function caller(): Promise<{ userId: string } | GuardFail> {
  // REQUEST-CACHED. Every guarded action reaches GoTrue through here, and so does the page
  // that rendered the form, and so does the layout above it — `currentUser()` is what makes
  // those one round trip instead of three, and what makes them agree about the caller even
  // when a token rotates mid-request. Its header carries the measurements.
  //
  // The error still arrives distinct from a null user, which is what the two branches below
  // are for — and it is now cached WITH the answer, so a request that could not verify the
  // session fails the same way everywhere in it rather than half-succeeding.
  const { user, error } = await currentUser()

  if (error) {
    // Logged, not swallowed: this is the branch that used to be indistinguishable from a
    // signed-out caller, and the whole point of separating it is that it leaves a record.
    console.error(`[guard] could not verify the session: ${error}`)
    // THE ONE PLACE `callerI18n(null)` IS RIGHT IN A GUARD, and both of these branches are
    // it: there is no user to have a stored preference, so the language comes from the
    // address bar and then the browser's own request. See lib/auth/locale.ts.
    const { t } = await callerI18n(null)
    return { ok: false, message: t('guard.sessionUnverified') }
  }

  if (!user) {
    const { t } = await callerI18n(null)
    return { ok: false, message: t('guard.signedOut') }
  }
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
    return { ok: false, message: await notAuthorized(who.userId) }
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
    return { ok: false, message: await notAuthorized(who.userId) }
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
  if (!granted.some(Boolean)) {
    return { ok: false, message: await notAuthorized(who.userId) }
  }
  return resolve(who.userId)
}

/**
 * Authenticated, APPROVED member; no permission demanded — for SELF-SERVICE writes.
 *
 * Sending a chat message, submitting an RSVP, casting a vote, updating your own
 * profile: things every member may do by definition. These have no edit grant to
 * check (create/edit default to 'none', so demanding one would lock the whole family
 * out of chat), but they still need the family code, and they still owe the caller a
 * check that the row they are touching is genuinely theirs. This returns the identity
 * so that check can be made — it does not make it for you.
 *
 * "No permission needed" never meant "no membership needed". Since Phase 3 a person
 * row can exist without its owner having been admitted, and every one of these
 * actions is defined as something a MEMBER may do. The approval test below is
 * therefore one line covering all of them at once — chat, RSVP, votes, nominations,
 * profile edits — rather than a check each of them could be written without.
 *
 * The database refuses these writes independently: 20260806000011 gates
 * auth_person_id() on membership_status, which collapses every own/self expression a
 * pending caller could match. This exists so the caller is TOLD, instead of watching
 * a policy silently match zero rows and being shown "saved" — the failure mode
 * already recorded in TODO for members without a grant.
 */
export async function requireMember(): Promise<GuardResult> {
  const who = await caller()
  if ('ok' in who) return who
  if (!(await isApprovedMember(who.userId))) {
    const { t } = await callerI18n(who.userId)
    return { ok: false, message: t('guard.awaitingApproval') }
  }
  return resolve(who.userId)
}
