'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffOwner, type StaffRole } from '@/lib/auth/staff'
import { listAccounts } from '@/lib/auth/account-state'
import { callerI18n } from '@/lib/i18n/server'
import type { T } from '@/lib/i18n/t'

/**
 * Who has staff access, and the four operations that change it.
 *
 * ── THIS FILE REVERSES A RULE AGENTS.md STATED, AND THAT IS THE POINT OF IT ─────────
 * AGENTS.md said: *"Access is granted BY HAND, with SQL. There is no UI for it and there must
 * not be one until there is a reason — a screen that grants cross-family access is a screen
 * worth attacking."* The reason arrived. Granting by hand means a `psql` session against
 * production, which is the one thing "How migrations reach the hosted project" forbids for
 * everything else in this repo and for two incidents' worth of reasons — so the honest options
 * were a screen or a permanent exception, and the exception was the part nobody was auditing.
 *
 * Every other bullet in that section is UNCHANGED, and none of them was weakened to make room
 * for this: `genorra_staff` still has RLS enabled with ZERO policies, every page under
 * `app/(staff)` still 404s rather than refusing, and there is still no `permission_resources`
 * row and there must not be one. What changed is one sentence about SQL — and
 * `supabase/scripts/grant_staff.sql` is still how the FIRST owner exists on a database where
 * nobody can yet open this screen, which is the bootstrap this file cannot perform for itself.
 *
 * ── §3 IS INVERTED HERE, EXACTLY AS IT IS IN `families.ts` ──────────────────────────
 * There is no `.eq('family_code', …)` anywhere in this file and there is nothing for one to
 * mean: `genorra_staff` has no family column, because staffness is the property of having no
 * family scope at all. A reviewer's reflex — a missing family conjunct is a bug — is the wrong
 * reflex on this table. What stands in its place is one line, and it is the FIRST line of every
 * exported function here:
 *
 *     `requireStaffOwner()`
 *
 * That is the whole boundary. It is `notFound()` on failure (see `lib/auth/staff.ts`), so a
 * customer — or a `support` staffer — who POSTs to one of these URLs, and they are URLs because
 * every export of a `'use server'` file gets one (AGENTS.md §2), gets a 404 rather than the list
 * of people who can read every family on the platform. The page in front of these actions is not
 * in the request path when somebody calls them directly.
 *
 * THE COROLLARY IS SHARPER HERE THAN IN THE READ-ONLY STAFF MODULES. Adding an export to this
 * file without `requireStaffOwner()` on its first line is adding an unauthenticated endpoint
 * that grants cross-family access. There is no policy underneath any of it — the service role
 * has none — no family scoping to catch a missing gate, and nothing else in the stack will
 * notice.
 *
 * ── WHY `owner`, AND WHY ON ALL FOUR INCLUDING THE READ ────────────────────────────
 * `20260817000005`'s own column comment defines the vocabulary and draws the line exactly here:
 * `owner` is *"the above, plus granting staff access"*. Everything else this console does is
 * "look at a customer's data"; this is "decide who may", which is a different kind of authority
 * and the only one that compounds.
 *
 * THE READ IS GATED TOO, and that is not symmetry for its own sake. The list of accounts that
 * can read every family in the product is precisely the target list: it names who to phish, and
 * it tells a `support` staffer which colleague to ask for a favour. So `listStaffTeam()` is
 * `owner` as well, and it answers `[]` rather than a message.
 *
 * ── WHAT THIS FILE DELIBERATELY CANNOT DO ─────────────────────────────────────────
 *   * **It cannot write a row for an id.** A grant takes an EMAIL and resolves it against
 *     GoTrue. `20260806000015`'s rule about never taking an identity as a parameter is the same
 *     argument, one step along: there the parameter was the identity ACTING, here it would be
 *     the identity being GRANTED, and a uuid nobody has to be able to spell is the friendlier
 *     thing to forge.
 *   * **It cannot touch the caller's own row.** See `refuseSelf`.
 *   * **It cannot leave the console with no owner.** See `ownerCount`, and the race it does not
 *     close, which is stated rather than papered over.
 *   * **It cannot change an address, delete an account, or read anything about a family.** Those
 *     belong to GoTrue and to `families.ts`. A module that hands out authority should not also
 *     be able to exercise it.
 *
 * ── NO NOTIFICATION, NO EMAIL, DELIBERATELY ───────────────────────────────────────
 * Nothing here writes a `notifications` row or sends mail, and both absences are decisions. A
 * `notifications` row hangs off a family-scoped `people` row (AGENTS.md, "Telling somebody about
 * something in ANOTHER family"), and a staff member need not be a member of any family at all —
 * so there is no row for one to hang off, and inventing one would put a GENORRA employee's
 * internal access into a customer's family as a side effect. Mail would be a second thing to get
 * right on the highest-privilege screen in the product, for a message the granter is almost
 * certainly already sending by hand. If either is ever wanted it is a deliberate addition with
 * its own argument, not an omission to tidy up.
 */

/** The uniform mutation result, matching every other action module in the product. */
export interface StaffAccessResult {
  success: boolean
  message?: string
}

export interface StaffTeamRow {
  userId: string
  /**
   * From `auth.users`, resolved through the admin API rather than joined.
   *
   * `genorra_staff` HAS NO EMAIL COLUMN AND MUST NOT GAIN ONE: an address is GoTrue's fact, and
   * a copy here would be wrong the first time somebody changed theirs — silently, on the one
   * screen whose entire job is to say who has access. Same reasoning as `lib/age-utils.ts`
   * refusing a stored `is_minor`, and as `region_name` being walked rather than stored.
   *
   * `''` means the lookup did not answer. The row is still listed, because a grant that exists
   * and cannot be named is the most important row on this screen rather than one to hide.
   */
  email: string
  role: StaffRole
  /** Why they have it, in words. The table is an audit record and a bare uuid is not one. */
  note: string | null
  grantedAt: string
  /**
   * The address of whoever granted it, or null.
   *
   * NULL IS THREE DIFFERENT FACTS AND THE SCREEN MUST NOT CLAIM TO KNOW WHICH: nobody was
   * recorded (a row written by `grant_staff.sql` before this screen existed), the granter's
   * account has since been deleted — `granted_by` is deliberately NOT a foreign key, so the uuid
   * dangles rather than erasing the trail — or the lookup failed. All three are honestly "not
   * known from here", and a caption promising more than that would be the first thing an
   * investigation believed.
   */
  grantedByEmail: string | null
  /**
   * The acting owner's own row. Rules 4 and 5 both key on it, and the screen renders that row's
   * controls disabled WITH THE REASON rather than letting somebody discover it by trying.
   */
  isSelf: boolean
}

/**
 * The one sentence every authorization refusal in this file gives, whatever was actually wrong.
 *
 * A `support` staffer POSTing to `setStaffRole` must not be told "owners only": that hands them
 * the existence of the screen, the fact that access is granted from inside the product rather
 * than from SQL, and the name of a role above their own to be talked into. `requireStaffOwner`
 * 404s the PAGE for precisely this reason; an action reached directly still has to answer
 * something, and the something is the flat sentence every other unauthorized action in the
 * product gives.
 *
 * In practice the guard throws before any of these are reached, because `notFound()` is a thrown
 * navigation signal rather than a return value. They are here for the case that stops being true
 * — a guard rewritten to return a result, which is the shape `lib/auth/guard.ts` uses one layer
 * over — so that the refusal is already written and is already the uninformative one.
 *
 * The refusals that ARE specific — no such account, an empty note, your own row, the last owner
 * — are reachable only by somebody who has already passed the owner gate, and every one of them
 * is something that owner needs in order to get their job done.
 */
const NOT_AUTHORIZED = 'Not authorized'

/** A role that arrived from a caller, checked at RUNTIME. */
function isStaffRole(value: unknown): value is StaffRole {
  return value === 'support' || value === 'engineer' || value === 'owner'
}

/**
 * How the list is ordered: the people who can grant, first, then by address.
 *
 * NOT `ORDER BY role` IN SQL, which sorts the vocabulary alphabetically — engineer, owner,
 * support — and files the least privileged row between the other two. The order that means
 * something is the escalation order, and it lives here beside the vocabulary rather than as a
 * `CASE` buried in a query.
 */
const ROLE_RANK: Record<StaffRole, number> = { owner: 0, engineer: 1, support: 2 }

/**
 * Notes are capped, and the cap is a SCREEN decision rather than a data one.
 *
 * The column is TEXT and the database has no opinion, so this refuses nothing the schema
 * refuses and nothing a migration would have to be changed to allow. What it protects is the
 * list: the note is an audit sentence read by a person, in a table beside three other columns,
 * and a pasted stack trace in it makes every other row on the screen harder to read. 500
 * characters is several sentences of "why this person has access", which is what the column is
 * for.
 */
const NOTE_MAX = 500

/** The service-role client, as this file's helpers pass it around. */
type AdminClient = ReturnType<typeof createAdminClient>

/**
 * The email addresses behind a set of `auth.users` ids.
 *
 * ONE `getUserById` PER ID, in parallel, and that is the right shape AT THIS SIZE: the staff
 * team is single digits, and the alternative — `listAccounts()` with no filter — pages the whole
 * project into this process to answer a question about four rows. It is the reverse of the trade
 * `lib/auth/account-state.ts` makes for its own by-address lookup, and for the reverse reason:
 * there the wanted set was one address out of every account in the project, here it is every id
 * in a tiny set. If the staff team ever reaches the size where this is wrong, the fix is a
 * filtered page rather than a join, because the address still is not ours to store.
 *
 * A FAILURE IS A MISSING ENTRY, NEVER A THROWN REQUEST. One unresolvable id must not take the
 * whole screen down — a dangling `granted_by` is an EXPECTED state of this table, since that
 * column is deliberately not a foreign key. The map simply has no entry, and the row reads as
 * "not known from here".
 */
async function emailsFor(
  admin: AdminClient,
  userIds: readonly (string | null)[],
): Promise<ReadonlyMap<string, string>> {
  const wanted = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  if (wanted.length === 0) return new Map()

  const found = new Map<string, string>()

  await Promise.all(wanted.map(async id => {
    try {
      const { data, error } = await admin.auth.admin.getUserById(id)
      if (error || !data.user?.email) return
      found.set(id, data.user.email.trim())
    } catch {
      // Swallowed on purpose, and the only swallow in this file: the whole consequence is one
      // blank cell on a list, and every id handed in came off a row this screen has already
      // decided the caller may see.
    }
  }))

  return found
}

/**
 * An address resolved to a single `auth.users` id, or a reason there is not one.
 *
 * ── THREE OUTCOMES, AND COLLAPSING TWO OF THEM IS THE BUG THIS SHAPE PREVENTS ──────
 * "No account" and "could not ask" are different facts leading to different actions: the first
 * means the person has to register before anything can be granted to them, the second means try
 * again in a minute. `lib/auth/account-state.ts` draws exactly this distinction for its own
 * lookups and says why — reading a failed lookup as "no account" would tell an owner their new
 * colleague has never signed up whenever GoTrue is having a bad minute, and the advice that
 * follows from that is wrong in a way they cannot check.
 *
 * ── `filter` IS A SUBSTRING MATCH, SO THE COMPARISON IS WHAT RESOLVES THE IDENTITY ─
 * GoTrue's admin list filters by substring, so `filter=a@b.com` also answers `xa@b.com.au`.
 * Writing a staff grant for whichever address happened to come back first would be the worst
 * possible version of this function, so the exact, normalized comparison below is the actual
 * resolution and the filter is only there to keep it to one request. That is the same trap
 * `accountStateForEmail` names in its own header, on the same endpoint.
 *
 * ── AND A FULL PAGE WITH NO EXACT MATCH IS "COULD NOT ASK", NOT "NO ACCOUNT" ───────
 * A hundred addresses all containing the one typed is far-fetched. The failure if it ever
 * happened is the single thing this screen exists to avoid: an owner told that a real colleague
 * has no account, and sent back to `psql` to prove otherwise. Two lines to close.
 */
type EmailLookup =
  | { ok: true; userId: string; email: string }
  | { ok: false; message: string }

async function resolveAccount(
  rawEmail: unknown,
  /** The acting owner's language. See `refuseSelf` below for the same argument. */
  t: T,
): Promise<EmailLookup> {
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
  if (!email) return { ok: false, message: t('act.enterEmailAddressAccountGrant') }

  // 100 is `listAccounts`' own clamp, and asking for the largest page is what makes the
  // full-page branch below rare rather than routine.
  const page = await listAccounts({ filter: email, perPage: 100 })
  if (!page) {
    return { ok: false, message: t('act.couldNotReachAccountService') }
  }

  const match = page.accounts.find(a => a.email.trim().toLowerCase() === email)
  if (match) return { ok: true, userId: match.userId, email: match.email }

  if (page.hasMore) {
    return {
      ok: false,
      message: t('act.couldNotResolveAddressUnambiguously'),
    }
  }
  return {
    ok: false,
    message: `No account uses ${email}. They have to register before they can be granted access.`,
  }
}

/**
 * RULE 4. Nobody changes or revokes their own row.
 *
 * NOT A COURTESY, AND NOT "ARE YOU SURE?". It is the one rule that makes a mis-click
 * recoverable: an owner who demotes or revokes themselves has, in that instant, lost the ability
 * to undo it, and the only route back is the `psql` session this whole screen exists to retire.
 * Every other refusal in this file leaves the caller able to try something else.
 *
 * It is also why `ownerCount` below can look like dead code and is not — see the note there.
 */
function refuseSelf(
  actingUserId: string,
  targetUserId: string,
  /** The acting owner's language. A parameter rather than a resolve, because the caller
      has already resolved one from `requireStaffOwner()` and a second read of the same
      row for the same answer is a second expression of one rule. */
  t: T,
): StaffAccessResult | null {
  if (actingUserId !== targetUserId) return null
  return {
    success: false,
    message: t('act.youCannotChangeYourOwn'),
  }
}

/**
 * How many owners there are right now, or `-1` for "could not be read".
 *
 * EVERY CALLER TREATS `-1` AS A REFUSAL rather than as zero or as plenty. A number this function
 * cannot vouch for must never be the basis for removing the last person who can grant access —
 * and `count` from PostgREST is `null` on a refused query, which would read as zero and refuse
 * the write, or as "no owners" and allow it, depending on which way the comparison was written.
 * One sentinel, checked once, in both callers.
 *
 * ── RULE 5, AND WHY IT LOOKS UNREACHABLE ──────────────────────────────────────────
 * Read the rules together and rule 5 cannot fire sequentially: the caller is an owner (rule 1)
 * and the target is not the caller (rule 4), so if the target is an owner then there are at
 * LEAST two, and demoting or revoking one leaves at least one standing. Somebody auditing this
 * for dead code is right about the arithmetic and wrong about why it is here. Two reasons, and
 * the first is the one the spec named:
 *
 *   * **THE RACE.** Owners A and B, two browser tabs, at the same moment: A revokes B while B
 *     revokes A. Both counts read 2, both writes land, the console has no owner and no screen
 *     can repair it. A count followed by a write in a separate statement DOES NOT CLOSE THIS,
 *     and pretending otherwise is worse than the gap. The stronger form is one SQL statement
 *     under `FOR UPDATE`, exactly as `consume_family_action_challenge` does for the five-branch
 *     read-modify-write it replaced — a `staff_set_role(p_user_id, p_role)` that counted and
 *     wrote while holding the row locks. That is the right change the day two owners are ever
 *     plausibly clicking at once; today the team is small enough that the window is theoretical,
 *     and the honest thing is to say so here rather than to leave the count looking like a
 *     guarantee.
 *   * **RULE 4 IS ONE LINE AND MAY NOT SURVIVE.** "Let an owner step down" is a reasonable
 *     future request, and the moment `refuseSelf` is relaxed for it, rule 5 becomes the only
 *     thing standing between a tidy-up and a locked console. Deleting it now on the grounds that
 *     rule 4 makes it redundant removes the guard and leaves the reason for the guard.
 */
async function ownerCount(admin: AdminClient): Promise<number> {
  const { count, error } = await admin
    .from('genorra_staff')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'owner')

  if (error) {
    console.error(`[staff/access] could not count owners: ${error.message}`)
    return -1
  }
  return count ?? -1
}

/** The row shape the one read below returns, declared rather than inferred. */
interface StaffDbRow {
  user_id: string
  role: string | null
  note: string | null
  granted_by: string | null
  granted_at: string
}

/**
 * Everybody who can open the staff console.
 *
 * `owner` ONLY, INCLUDING THIS READ — see the header. `[]` on refusal rather than a message,
 * because this returns a list and a list has an empty form; a caller that got here without the
 * grant is being told nothing at all, which is the answer.
 *
 * An unrecognised `role` is DROPPED rather than defaulted. The CHECK constraint confines the
 * column to three values, so a fourth can only mean the database's constraint has been changed
 * without this file hearing about it — and in that case listing the row under a role this code
 * does not enforce would be the screen stating something it cannot back. `staffGrant` in
 * `lib/auth/staff.ts` makes the same choice for the same reason and denies rather than casting.
 * It is logged, because a dropped row on this screen is somebody with access who is not on the
 * list, which is the worst thing this list can be quietly wrong about.
 */
export async function listStaffTeam(): Promise<StaffTeamRow[]> {
  const staff = await requireStaffOwner()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('genorra_staff')
    .select('user_id, role, note, granted_by, granted_at')

  // §8. `data` alone cannot tell a refused query from an empty table, and an empty staff list is
  // a state that cannot honestly exist — the caller is standing on a row of it. So a refusal
  // here is always a fault, never an absence, and the log is how anybody finds out.
  if (error) {
    console.error(`[staff/access] staff list read failed: ${error.message}`)
    return []
  }

  const rows = (data ?? []) as unknown as StaffDbRow[]
  const usable = rows.filter(r => {
    if (isStaffRole(r.role)) return true
    console.error(
      `[staff/access] genorra_staff row ${r.user_id} holds role ${String(r.role)}, which is not `
      + 'one of support/engineer/owner — it is being left off the list. The CHECK constraint in '
      + '20260817000005 should have made this impossible.',
    )
    return false
  })

  const emails = await emailsFor(admin, [
    ...usable.map(r => r.user_id),
    ...usable.map(r => r.granted_by),
  ])

  return usable
    .map(r => ({
      userId: r.user_id,
      email: emails.get(r.user_id) ?? '',
      role: r.role as StaffRole,
      note: r.note ?? null,
      grantedAt: r.granted_at,
      grantedByEmail: r.granted_by ? emails.get(r.granted_by) ?? null : null,
      isSelf: r.user_id === staff.userId,
    }))
    // Owners first, then by address, then by id — a total order, so two renders of the same
    // team cannot disagree and a React key cannot move under a row. The id is the last resort
    // for two rows whose addresses both failed to resolve, which would otherwise tie at `''`.
    .sort((a, b) =>
      ROLE_RANK[a.role] - ROLE_RANK[b.role]
      || a.email.localeCompare(b.email, 'en')
      || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0))
}

/**
 * Give an account staff access.
 *
 * ── IT TAKES AN EMAIL, AND THAT IS RULE 2 ─────────────────────────────────────────
 * Never a `user_id`. A uuid parameter on this endpoint would be a request to write a
 * `genorra_staff` row for an id nobody had to be able to name, and the whole of what the
 * database would check is that it exists in `auth.users` — which every customer's id does. The
 * address is resolved against GoTrue and compared exactly (`resolveAccount`), so what is written
 * is an account somebody typed the address of.
 *
 * The foreign key would refuse an id that is not an account, with a 23503 that reads as a bug.
 * That refusal is kept as the backstop and is not the mechanism; the mechanism is that no id
 * reaches this function at all.
 *
 * ── THE NOTE IS REQUIRED, AND THAT IS RULE 3 ──────────────────────────────────────
 * `20260817000005`'s column comment says why in its own words: *"The table is an audit record
 * and a bare uuid is not one."* A grant with no reason is a row that in a year's time nobody can
 * either justify or safely remove, which is how a staff list grows and never shrinks. The
 * database defaults it to NULL and cannot demand it — a column comment is not a constraint — so
 * this is the only place it can be demanded, and a `NOT NULL` added later would refuse every row
 * `grant_staff.sql` has already written.
 *
 * ── A NEW GRANT DEFAULTS TO NOTHING; THE CALLER MUST SAY ──────────────────────────
 * `role` is a required parameter rather than defaulted to `'support'` here, even though the
 * COLUMN defaults to `'support'`. The column's default is the safe answer for SQL and for a
 * replay; on a form it would be a control somebody could leave alone without noticing, on the
 * one screen where the value decides whether the newcomer can grant access to anybody else. The
 * screen asks, and the runtime check below is what makes the answer real — the type annotation
 * is erased and this is a public HTTP endpoint.
 */
export async function grantStaffAccess(input: {
  email: string
  role: StaffRole
  note: string
}): Promise<StaffAccessResult> {
  const staff = await requireStaffOwner()
  const { t } = await callerI18n(staff.userId)
  if (staff.role !== 'owner') return { success: false, message: NOT_AUTHORIZED }

  if (!isStaffRole(input?.role)) {
    return { success: false, message: t('act.chooseWhatKindAccessGrant') }
  }

  const note = (input?.note ?? '').trim()
  if (!note) {
    return {
      success: false,
      message: t('act.sayWhyPersonNeedsStaff'),
    }
  }
  if (note.length > NOTE_MAX) {
    return { success: false, message: `Keep the reason under ${NOTE_MAX} characters` }
  }

  const account = await resolveAccount(input?.email, t)
  if (!account.ok) return { success: false, message: account.message }

  // RULE 4 REACHES THE GRANT TOO, and the reason is not the obvious one: an owner cannot use a
  // grant to reset their own role, which is a way round `setStaffRole`'s self-refusal if the
  // insert below were an upsert. It is not an upsert (see the duplicate branch), so this is the
  // narrower case of granting to the address you are signed in as — refused with the same
  // sentence, so the two controls cannot be made to disagree.
  const self = refuseSelf(staff.userId, account.userId, t)
  if (self) return self

  const admin = createAdminClient()

  // An INSERT, NEVER AN UPSERT. `user_id` is the primary key, so an upsert would silently
  // overwrite an existing member's role and their note — turning "grant access to Jo" into a
  // demotion or a promotion of somebody who already has it, with the reason for the original
  // grant destroyed. Refusing and pointing at the role control is the answer; `setStaffRole` is
  // the deliberate way to change one.
  const { error } = await admin.from('genorra_staff').insert({
    user_id: account.userId,
    role: input.role,
    note,
    // The acting owner, from the verified session and never from a parameter. `granted_by` is an
    // `auth.users` id and deliberately not a foreign key — see the column comment: it has to
    // survive both this person and the grantee leaving.
    granted_by: staff.userId,
  })

  if (error) {
    // 23505 on the primary key. "Already has staff access" is what actually happened, and a
    // constraint name is not a sentence for a person.
    if (error.code === '23505') {
      return {
        success: false,
        message: `${account.email} already has staff access. Change their access on their row instead.`,
      }
    }
    console.error(`[staff/access] grant failed for ${account.userId}: ${error.message}`)
    return { success: false, message: t('act.couldNotGrantAccessJust') }
  }

  revalidatePath('/staff/access')
  return { success: true }
}

/**
 * Change what kind of access somebody has.
 *
 * ── THIS ONE TAKES A `userId`, AND THAT IS NOT A CONTRADICTION OF RULE 2 ───────────
 * Rule 2 is about IDENTIFYING AN ACCOUNT TO GRANT — the case where the id would be the only
 * thing standing between an attacker and a row for an account they cannot name. Here the id
 * names a row that ALREADY EXISTS in `genorra_staff`, which the caller has just been shown, and
 * an id that names no such row changes nothing: the update's own predicate is the check. Same
 * distinction `redeem_family_invitation` draws about `p_user_id`, and the same one every
 * `belongsToFamily` call in the member product makes — an id from a caller is fine once
 * something re-derives what it is allowed to mean.
 */
export async function setStaffRole(input: {
  userId: string
  role: StaffRole
}): Promise<StaffAccessResult> {
  const staff = await requireStaffOwner()
  const { t } = await callerI18n(staff.userId)
  if (staff.role !== 'owner') return { success: false, message: NOT_AUTHORIZED }

  if (!input?.userId) return { success: false, message: t('act.staffMemberNotFound') }
  if (!isStaffRole(input?.role)) {
    return { success: false, message: t('act.chooseWhatKindAccessGive') }
  }

  const self = refuseSelf(staff.userId, input.userId, t)
  if (self) return self

  const admin = createAdminClient()

  // The CURRENT role is read from the database rather than taken from the screen, because the
  // last-owner decision below depends on it and the screen's copy is as old as the last render.
  const { data: existing, error: readError } = await admin
    .from('genorra_staff')
    .select('user_id, role')
    .eq('user_id', input.userId)
    .maybeSingle()

  if (readError) {
    console.error(`[staff/access] role read failed for ${input.userId}: ${readError.message}`)
    return { success: false, message: t('act.couldNotReadStaffMember') }
  }
  if (!existing) return { success: false, message: t('act.staffMemberNotFound') }

  // RULE 5. Only asked when the change would actually take an owner away — see `ownerCount` for
  // why this cannot fire sequentially and why it stays anyway.
  const current = (existing as { role: string | null }).role
  if (current === 'owner' && input.role !== 'owner') {
    const owners = await ownerCount(admin)
    if (owners < 0) {
      return { success: false, message: t('act.couldNotCheckOwnerList') }
    }
    if (owners <= 1) {
      return {
        success: false,
        message: t('act.lastOwnerMakeSomebodyElse'),
      }
    }
  }

  const { error } = await admin
    .from('genorra_staff')
    .update({ role: input.role })
    .eq('user_id', input.userId)

  if (error) {
    console.error(`[staff/access] role update failed for ${input.userId}: ${error.message}`)
    return { success: false, message: t('act.couldNotChangeTheirAccess') }
  }

  revalidatePath('/staff/access')
  return { success: true }
}

/**
 * Take staff access away.
 *
 * ── IT DELETES THE ROW, AND THERE IS NO SOFT FORM OF THIS ─────────────────────────
 * `families.status` is a soft disable because a removed family's records have to survive
 * (AGENTS.md, "A family can be REMOVED, which destroys nothing"). A staff grant is the opposite
 * kind of row: it holds no records, it IS the access, and a "disabled" grant would be a row that
 * `is_genorra_staff()` would have to learn to ignore — one more expression between an attacker
 * and every family on the platform. Revocation should be the strongest thing this screen can do,
 * and a DELETE is the strongest thing there is.
 *
 * WHAT IS LOST WITH IT IS THE `note`, WHICH IS A REAL COST AND THE RIGHT TRADE. The audit record
 * of why somebody had access goes when the access does. A `genorra_staff_history` table is the
 * answer if that ever matters enough to maintain; a tombstone in the live table is not, because
 * the live table is the one every request consults.
 */
export async function revokeStaffAccess(input: {
  userId: string
}): Promise<StaffAccessResult> {
  const staff = await requireStaffOwner()
  const { t } = await callerI18n(staff.userId)
  if (staff.role !== 'owner') return { success: false, message: NOT_AUTHORIZED }

  if (!input?.userId) return { success: false, message: t('act.staffMemberNotFound') }

  const self = refuseSelf(staff.userId, input.userId, t)
  if (self) return self

  const admin = createAdminClient()

  const { data: existing, error: readError } = await admin
    .from('genorra_staff')
    .select('user_id, role')
    .eq('user_id', input.userId)
    .maybeSingle()

  if (readError) {
    console.error(`[staff/access] revoke read failed for ${input.userId}: ${readError.message}`)
    return { success: false, message: t('act.couldNotReadStaffMember') }
  }
  // Reported rather than answered "done". A delete that matched nothing is a screen that has
  // just told somebody access was removed when it was already gone — which is the same class of
  // lie as reporting success over a refused write, and on this screen it would leave an owner
  // believing they had closed something.
  if (!existing) return { success: false, message: t('act.staffMemberNotFound') }

  // RULE 5 again, and the same window. See `ownerCount`.
  if ((existing as { role: string | null }).role === 'owner') {
    const owners = await ownerCount(admin)
    if (owners < 0) {
      return { success: false, message: t('act.couldNotCheckOwnerList') }
    }
    if (owners <= 1) {
      return {
        success: false,
        message: t('act.lastOwnerMakeSomebodyElse'),
      }
    }
  }

  const { error } = await admin
    .from('genorra_staff')
    .delete()
    .eq('user_id', input.userId)

  if (error) {
    console.error(`[staff/access] revoke failed for ${input.userId}: ${error.message}`)
    return { success: false, message: t('act.couldNotRemoveTheirAccess') }
  }

  revalidatePath('/staff/access')
  return { success: true }
}
