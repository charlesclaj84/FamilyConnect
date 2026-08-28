'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/auth/staff'
import { normalizeTier, type FamilyTier } from '@/lib/tiers'
import { callerI18n } from '@/lib/i18n/server'

/**
 * Every family on the platform, for the GENORRA staff console.
 *
 * ── §3 IS INVERTED HERE, AND A REVIEWER'S REFLEX WILL BE THAT THIS IS A BUG ─────────
 * AGENTS.md §3 says every service-role query must re-apply by hand what RLS would have
 * done — `.eq('family_code', familyCode)` on every read, write and delete. **There is no
 * such filter anywhere in this file, deliberately.** Reading across every family IS the
 * feature: a console that showed one family would be the product the customer already
 * has. So the obligation §3 states is discharged differently, and by exactly one thing:
 *
 *     `requireStaff()` runs FIRST in every exported function here, before any read.
 *
 * That is the whole isolation boundary. It is `notFound()` on failure, so a member who
 * posts to one of these URLs — and they are URLs; every export of a `'use server'` file
 * gets one (AGENTS.md §2) — gets a 404 rather than a page of other families' names. The
 * gate is not a page-level convenience: the page in front of these actions is not in the
 * request path when somebody calls them directly.
 *
 * The corollary is that adding an export to this file is adding an unauthenticated
 * cross-family read unless the first line of it is `requireStaff()`. There is no policy
 * underneath any of this — the service role has none — and no family scoping to catch a
 * missing gate. Nothing else will notice.
 *
 * ── NO `permission_resources` ROW, AND THERE MUST NOT BE ONE ────────────────────────
 * A reader looking for the §6 registration will not find one, here or on the pages.
 * `lib/auth/staff.ts` sets out why at length: staffness is not something a family
 * administers, it is orthogonal to a model whose every answer is already family-scoped,
 * and a row in that table would print a "GENORRA Staff" switch on every customer's
 * settings screen — giving away the existence of a console that 404s precisely so it
 * does not advertise itself.
 *
 * ── REMOVAL IS NOT HERE. RESTORE IS ────────────────────────────────────────────────
 * The only write in this file puts a family back to `'active'`. Removing one lives in
 * the member-facing product, behind an emailed confirmation code, because that is where
 * the decision belongs and because the code is what makes it deliberate. A staff console
 * that could remove a family with one click would hold the same authority with none of
 * the ceremony, and the first accidental use of it would be indistinguishable from the
 * thing this console exists to undo. If staff ever genuinely need to remove one,
 * `staff_set_family_status` already accepts `'removed'` — that is a decision to make
 * explicitly, with its own confirmation, not a parameter to widen here.
 */

/** Mirrors `families_status_check` in 20260817000006. */
export type FamilyStatus = 'active' | 'removed'

export interface StaffFamilyRow {
  familyCode: string
  familyName: string
  tier: FamilyTier
  status: FamilyStatus
  /**
   * Approved memberships — the same figure the family's own Settings screen prints.
   *
   * Deliberately `getFamilySettings`'s definition rather than a new one: two screens
   * answering "how big is this family" must not be able to disagree, and a support
   * engineer reading a number here is going to be asked about the number the customer
   * can see. That definition counts `membership_status = 'approved'` and does NOT
   * exclude rows with no `user_id`, so a recorded grandmother is in the family (AGENTS.md
   * §4b) — which is what the Member Directory shows too.
   */
  memberCount: number
  createdAt: string | null
  /** When it was removed. Null for an active family; cleared again on restore. */
  removedAt: string | null
}

export interface StaffFamilyPage {
  rows: StaffFamilyRow[]
  /** Total matching the filter, across all pages. */
  total: number
  /** True when the underlying read was refused — see the note in `listStaffFamilies`. */
  failed: boolean
}

export interface StaffFamilyCounts {
  total: number
  active: number
  removed: number
}

export type StaffFamilyActionResult =
  | { success: true; familyCode: string; status: FamilyStatus }
  | { success: false; message: string }

interface FamilyRow {
  family_code: string
  family_name: string
  tier: string | null
  status: string | null
  created_at: string | null
  removed_at: string | null
}

/**
 * Strip anything that could break out of a PostgREST `or()` expression.
 *
 * Lifted from `searchMembers` in app/actions/admin/permissions.ts, and it is not
 * decoration: the filter below is assembled as a STRING (`family_name.ilike.%q%`), so a
 * comma or a closing paren in `q` changes which conditions PostgREST parses rather than
 * what it searches for. Allowing letters, digits, spaces and a short punctuation set is
 * enough for a family name and a family code, and leaves nothing to escape.
 */
function safeQuery(query: string): string {
  return query.trim().replace(/[^\p{L}\p{N}\s@._'-]/gu, '').slice(0, 60)
}

/** The database's text into this module's union, denying anything unrecognised. */
function readStatus(value: unknown): FamilyStatus {
  // POSITIVE TEST, per the discipline 20260817000006 is built on: an unknown value
  // resolves to 'removed' rather than 'active', so a status added to the CHECK later —
  // 'suspended', say — reads here as "not open for business" until somebody deliberately
  // teaches this function about it. The database's own default is 'active' and NOT NULL,
  // so the only way to reach this branch is a value this build has not been told about.
  return value === 'active' ? 'active' : 'removed'
}

/**
 * One page of families, filtered by code or name.
 *
 * Paged and filtered in the DATABASE rather than in the browser. The console is aimed at
 * a platform, not at one customer — the same argument AGENTS.md makes about building
 * every member list for a hundred-member family, one level up — and shipping every
 * family to the client to filter there would also silently truncate: PostgREST is
 * configured with `max_rows = 1000` (supabase/config.toml), so an unpaged select stops at
 * a thousand rows with no error and no marker.
 */
export async function listStaffFamilies(opts: {
  query?: string
  offset?: number
  limit?: number
} = {}): Promise<StaffFamilyPage> {
  // FIRST. Before any read — see the header, and AGENTS.md §5: props are serialized into
  // the RSC payload whether a component renders them or not, so fetching and then hiding
  // has already published.
  await requireStaff()

  const admin = createAdminClient()
  const limit = Math.min(100, Math.max(1, Math.floor(opts.limit ?? 25)))
  const offset = Math.max(0, Math.floor(opts.offset ?? 0))
  const q = safeQuery(opts.query ?? '')

  let builder = admin
    .from('families')
    // ONE literal, not a concatenation: supabase-js parses the select at the type level
    // and a joined string collapses to `string`, which takes the row cast down with it.
    // See the same note in `searchMembers`.
    .select('family_code, family_name, tier, status, created_at, removed_at', { count: 'exact' })

  if (q) {
    builder = builder.or(`family_code.ilike.%${q}%,family_name.ilike.%${q}%`)
  }

  const { data, count, error } = await builder
    // Removed families first, then by name. A staff console's reason to exist is the
    // exceptional row, and burying it in alphabetical order among the healthy ones makes
    // the one thing this screen can act on the hardest thing to find. `ascending: true`
    // on `status` puts 'removed' after 'active' alphabetically, hence the reversal.
    .order('status', { ascending: false })
    .order('family_name', { ascending: true })
    .range(offset, offset + limit - 1)

  // AGENTS.md §8: the error is read. `data` is null on a refusal exactly as it is for an
  // empty table, and the two mean opposite things — "there are no families" is a claim
  // about the platform, and rendering it over a refused query would have a support
  // engineer telling somebody their family does not exist. `failed` is what lets the
  // screen say "could not read" instead of "none".
  if (error) {
    console.error(`[staff/families] could not list families: ${error.message}`)
    return { rows: [], total: 0, failed: true }
  }

  const families = (data ?? []) as FamilyRow[]

  // ── MEMBER COUNTS: ONE HEAD REQUEST PER FAMILY ON THIS PAGE ────────────────────────
  // PostgREST has no GROUP BY, so there are exactly three ways to get a count per family
  // and this is the least bad of them:
  //
  //   * one `count: 'exact', head: true` per family — what this does. Bounded by the PAGE
  //     size (25), issued in parallel, and each returns a number rather than rows.
  //   * read every `people` row on the platform and count in memory — O(all memberships)
  //     per page load, and it hits `max_rows = 1000` and under-counts silently, which is
  //     the worst possible failure for a figure a support engineer will quote to a
  //     customer.
  //   * a database view or an RPC that does the aggregation server-side. That is the
  //     right answer at scale and is a migration, which this stage does not own.
  //
  // A failed count reads as 0. It is a figure on a support screen, not a gate, and one
  // family whose count could not be resolved must not take the whole page down with it.
  const counts = await Promise.all(
    families.map(f =>
      admin
        .from('people')
        .select('id', { count: 'exact', head: true })
        .eq('family_code', f.family_code)
        .eq('membership_status', 'approved'),
    ),
  )

  return {
    rows: families.map((f, i) => ({
      familyCode: f.family_code,
      // A family row always has a name (NOT NULL since 20260602000000). The fallback is
      // for the same reason `getFamilySettings` has one: an empty string would render as
      // a blank cell that reads like a failed load, and the code is always true.
      familyName: f.family_name || f.family_code,
      // `normalizeTier`, not a cast, so an unrecognised value answers Free rather than
      // printing whatever is in the column — the same normalization every tier gate in
      // the app goes through, so this screen cannot claim a plan `requireView` disagrees
      // with.
      tier: normalizeTier(f.tier),
      status: readStatus(f.status),
      memberCount: counts[i]?.count ?? 0,
      createdAt: f.created_at,
      removedAt: f.removed_at,
    })),
    total: count ?? 0,
    failed: false,
  }
}

/**
 * How many families there are, and how many of them are removed.
 *
 * Three `head: true` counts rather than one read of every row: `families` can pass a
 * thousand and `max_rows = 1000` would then make the index page quietly wrong, which is
 * the one thing a number on a dashboard must never be. Each of these is a `COUNT(*)` in
 * the database with no rows crossing the wire.
 */
export async function getStaffFamilyCounts(): Promise<StaffFamilyCounts> {
  await requireStaff()

  const admin = createAdminClient()
  const [total, active, removed] = await Promise.all([
    admin.from('families').select('family_code', { count: 'exact', head: true }),
    admin.from('families').select('family_code', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('families').select('family_code', { count: 'exact', head: true }).eq('status', 'removed'),
  ])

  // Logged rather than swallowed (§8). A zero from a refused count and a zero from an
  // empty platform are the same value and different facts, and the index page prints
  // whichever it is given.
  for (const [label, result] of [['total', total], ['active', active], ['removed', removed]] as const) {
    if (result.error) {
      console.error(`[staff/families] the ${label} family count was refused: ${result.error.message}`)
    }
  }

  return {
    total: total.count ?? 0,
    active: active.count ?? 0,
    removed: removed.count ?? 0,
  }
}

/**
 * Put a removed family back.
 *
 * ── IT GOES THROUGH THE RPC, NOT THROUGH AN UPDATE ─────────────────────────────────
 * `staff_set_family_status()` is SECURITY DEFINER and re-derives the actor itself, so
 * the staff test exists in the DATABASE as well as in this file. A direct
 * `.from('families').update({ status: 'active' })` on the service role would work — the
 * guard trigger only refuses the `authenticated` role — and would leave `requireStaff()`
 * as the only thing between a member and the restore. Two layers, and the second one
 * cannot be removed by editing TypeScript.
 *
 * `p_user_id` is the caller's own id from the verified session, never a parameter of
 * this action. The function honours it only for a `service_role` JWT claim — which is
 * what the admin client presents — and ignores it for everybody else, which is
 * `redeem_family_invitation`'s sanctioned shape (AGENTS.md §2b). So the id being passed
 * across is not a hole: an `authenticated` caller reaching the RPC directly cannot use
 * it, and they cannot reach the RPC at all, because it is granted to nobody but
 * `service_role`.
 *
 * `familyCode` DOES arrive from the client, and that is fine here in a way it would not
 * be in the member product: there is no family boundary for it to cross. §4's rule is
 * about an id from one family being written onto a row of another; a staff caller is
 * entitled to every family by definition, so the only question is whether the code names
 * a real one — which the function answers with 'No family with that code.'
 */
export async function restoreFamily(familyCode: string): Promise<StaffFamilyActionResult> {
  const staff = await requireStaff()
  const { t } = await callerI18n(staff.userId)

  // Upper-cased and trimmed here as well as inside the function. Not belt and braces: the
  // message below names the code back to the caller, and echoing whatever they typed
  // while the database matched something else would be confusing in exactly the moment
  // somebody is deciding whether the restore worked.
  const code = (familyCode ?? '').trim().toUpperCase()
  if (!code) return { success: false, message: t('act.enterFamilyCode2') }

  const { data, error } = await createAdminClient().rpc('staff_set_family_status', {
    p_family_code: code,
    p_status: 'active',
    p_user_id: staff.userId,
  })

  if (error) {
    console.error(`[staff/families] restore of ${code} was refused: ${error.message}`)
    return { success: false, message: t('act.couldNotRestoreFamilyPlease') }
  }

  // RETURNS TABLE, so supabase-js hands back an array even though the function emits one
  // row. Reading `data[0]` blindly would turn "the function returned nothing" into a
  // TypeError in a server action, which surfaces to the browser as an opaque failure.
  const row = (Array.isArray(data) ? data[0] : data) as
    { ok: boolean; family_code: string | null; status: string | null; message: string | null } | undefined

  if (!row) {
    return { success: false, message: t('act.restoreReturnedNoResultPlease') }
  }
  if (!row.ok) {
    // The function's own message, verbatim. It distinguishes 'Not authorized' from 'No
    // family with that code.' deliberately — the caller has already been proven to be
    // staff by then, so there is no enumeration oracle to protect, and a support engineer
    // needs to know which of the two happened.
    return { success: false, message: row.message ?? 'Could not restore that family.' }
  }

  // The console's own two screens: the list, and the index whose counts just moved.
  revalidatePath('/staff/families')
  revalidatePath('/staff')
  return { success: true, familyCode: code, status: readStatus(row.status) }
}
