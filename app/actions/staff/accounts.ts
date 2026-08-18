'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/auth/staff'
import { accountStateForEmail, listAccounts, type AccountState } from '@/lib/auth/account-state'
import type { MembershipStatus } from '@/lib/auth/family'
import type { FamilyStatus } from '@/app/actions/staff/families'

/**
 * Every account that can sign in, and the families it belongs to — the screen support
 * opens when somebody says "I cannot get in".
 *
 * ── §3 IS INVERTED HERE TOO ────────────────────────────────────────────────────────
 * Not one `.eq('family_code', …)` in the file, deliberately, for the reason set out at
 * length in `app/actions/staff/families.ts`: reading across every family is the feature,
 * and `requireStaff()` — first line of every export, before any read — is the entire
 * isolation boundary. There is no policy underneath the service role to catch a missing
 * gate, and no family scoping to notice one. An export added here without that first
 * line is an endpoint that hands any signed-in member the address of every account on
 * the platform.
 *
 * ── WHERE THE LIST COMES FROM, AND WHY IT IS NOT `people` ──────────────────────────
 * There were two ways to build this and the choice is not obvious, so it is written down.
 *
 * **Rejected: list from `people`.** It is one query, it needs no external service, and it
 * already holds `user_id`, `primary_email` and the memberships. It also cannot answer the
 * question the screen exists for:
 *
 *   * A `people` row proves somebody was RECORDED, not that an account exists. Rows with
 *     `user_id IS NULL` are the ordinary case on a large tree — a grandmother with no
 *     address, a great-uncle who died in 1998 (AGENTS.md §4b) — so a list built from that
 *     table is mostly not accounts.
 *   * The account with NO `people` row anywhere is invisible to it, and that is precisely
 *     the "cannot sign in" case: a registration whose profile seed failed has an
 *     `auth.users` row and belongs to nothing. A support list that omits exactly the
 *     broken accounts is worse than no list.
 *   * Confirmation state and last sign-in are not in that table at all, and those are the
 *     first two things to check.
 *   * Grouping several memberships into one account is not expressible in PostgREST, so
 *     it would mean reading the platform's memberships into memory and grouping there —
 *     which trips `max_rows = 1000` (supabase/config.toml) and silently truncates.
 *
 * **Chosen: page GoTrue's admin users endpoint** (`listAccounts` in
 * `lib/auth/account-state.ts`, which already owns the mechanics for the single-address
 * form and states why it must never be exported from a `'use server'` file). It is the
 * authoritative list, it carries confirmation state and last sign-in, and it pages
 * server-side — so this console never reads a platform into memory to render 25 rows.
 * Memberships are then ONE `people` read, `.in('user_id', …)`-scoped to the ids on the
 * page, which is bounded by the page size however large the platform gets.
 *
 * `accountStateForEmail` is still used, and not redundantly: `lookupStaffAccount` below
 * answers about ONE address, including the case the list cannot express — an address with
 * no account at all, which in a table is indistinguishable from a filter that matched
 * nothing. Its header names the precondition for calling it (a caller that has already
 * gated itself), and `requireStaff()` is that.
 *
 * ── NO EMBEDS, ON PURPOSE ──────────────────────────────────────────────────────────
 * `people` and `families` are read as two queries and joined in this file rather than
 * with `families(...)` on the select. AGENTS.md §8 is the reason: a table that gains a
 * second foreign-key path starts answering PGRST201, which supabase-js reports as `[]`
 * with no error — and `families` gained exactly that in 20260817000006 (`removed_by`
 * joins `people`, beside `bloodline_anchor_id`). Two narrow queries cannot be broken by a
 * junction table somebody adds next year.
 */

export interface StaffMembership {
  personId: string
  familyCode: string
  familyName: string
  /** Whether that family is still open for business. A removed one is why they cannot in. */
  familyStatus: FamilyStatus
  membershipStatus: MembershipStatus
  /** The person's name in that family. Blank rather than "Unknown" when unset. */
  name: string
}

export interface StaffAccountRow {
  userId: string
  email: string
  createdAt: string | null
  /** Null means the address has never been confirmed — the first thing to check. */
  confirmedAt: string | null
  /** Null means nobody has ever signed in with it. */
  lastSignInAt: string | null
  /** Empty for an account that belongs to no family. That is a finding, not a blank. */
  memberships: StaffMembership[]
}

export interface StaffAccountPage {
  rows: StaffAccountRow[]
  /** 1-based, as GoTrue numbers pages. */
  page: number
  hasMore: boolean
  /**
   * The account list could not be read — GoTrue refused, timed out, or the service key
   * is missing. DISTINCT FROM an empty page, which is a claim about the platform.
   */
  failed: boolean
}

export interface StaffAccountLookup {
  /** The address as it was asked about, trimmed and lower-cased. */
  email: string
  /** `null` when GoTrue could not be reached — NOT the same as "no account". */
  state: AccountState | null
  /**
   * Every `people` row carrying this address, whether or not it is attached to an
   * account. An unattached one is an invitation that was never taken up.
   */
  memberships: StaffMembership[]
  /** True when the person rows could not be read. */
  membershipsFailed: boolean
}

interface PersonRow {
  id: string
  user_id: string | null
  family_code: string
  first_name: string | null
  last_name: string | null
  membership_status: string | null
  primary_email: string | null
}

interface FamilyRow {
  family_code: string
  family_name: string | null
  status: string | null
}

/** See the note in app/actions/staff/families.ts — unknown reads as 'removed'. */
function readFamilyStatus(value: unknown): FamilyStatus {
  return value === 'active' ? 'active' : 'removed'
}

/**
 * The database's text into the union every gate in the app tests.
 *
 * Unknown denies, per AGENTS.md §6b: everything that reads this column tests POSITIVELY
 * for 'approved', which is what let 'disabled' be added without a sweep. A value this
 * build has not been told about lands on 'rejected' here, so the console renders it as
 * "not a member" rather than as a blank cell that reads like a healthy row.
 */
function readMembershipStatus(value: unknown): MembershipStatus {
  return value === 'approved' || value === 'pending' || value === 'disabled' || value === 'rejected'
    ? value
    : 'rejected'
}

/**
 * The `people` rows for a set of accounts, resolved into memberships with family names.
 *
 * Shared by the list and the lookup, because the two would otherwise hold two copies of
 * the same join and could disagree about how a removed family or an unnamed person
 * renders — on the one screen whose whole job is telling somebody what is true.
 */
async function resolveMemberships(
  people: PersonRow[],
): Promise<{ memberships: Map<string, StaffMembership[]>; failed: boolean }> {
  const byKey = new Map<string, StaffMembership[]>()
  if (people.length === 0) return { memberships: byKey, failed: false }

  const codes = [...new Set(people.map(p => p.family_code).filter(Boolean))]
  const { data, error } = await createAdminClient()
    .from('families')
    .select('family_code, family_name, status')
    .in('family_code', codes)

  // §8 again: a refused families read would silently render every membership as belonging
  // to a removed family, which is the exact wrong answer on a screen somebody is using to
  // decide whether to restore one.
  if (error) {
    console.error(`[staff/accounts] could not resolve family names: ${error.message}`)
    return { memberships: byKey, failed: true }
  }

  const families = new Map(
    ((data ?? []) as FamilyRow[]).map(f => [f.family_code, f]),
  )

  for (const p of people) {
    // Keyed by user_id where there is one and by the person row otherwise, so the lookup
    // can report an INVITED person who never attached an account — a row with no user_id
    // is a real answer to "why can they not sign in", and dropping it would hide it.
    const key = p.user_id ?? `person:${p.id}`
    const family = families.get(p.family_code)
    const list = byKey.get(key) ?? []
    list.push({
      personId: p.id,
      familyCode: p.family_code,
      familyName: family?.family_name || p.family_code,
      // A `people` row whose family has no `families` row predates that table. Reading it
      // as 'removed' would be a false accusation, so an absent row is treated as active —
      // this is the one place the positive test is relaxed, and only because the fact
      // being read is missing rather than unrecognised.
      familyStatus: family ? readFamilyStatus(family.status) : 'active',
      membershipStatus: readMembershipStatus(p.membership_status),
      name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim(),
    })
    byKey.set(key, list)
  }

  return { memberships: byKey, failed: false }
}

/**
 * One page of accounts, newest first, optionally filtered by address.
 *
 * The filter is GoTrue's own `?filter=`, a SUBSTRING match on the address — right for a
 * search box, and deliberately not used as an identity check anywhere (see
 * `lib/auth/account-state.ts`, which compares addresses itself for that reason).
 */
export async function listStaffAccounts(opts: {
  page?: number
  query?: string
} = {}): Promise<StaffAccountPage> {
  // FIRST, before any read. See the header.
  await requireStaff()

  const page = Math.max(1, Math.floor(opts.page ?? 1))
  // 25 to match `MEMBER_PAGE_SIZE`, which is what the shared pager controls are built
  // around. Not imported: `lib/pagination.ts` names it for MEMBERS, and a page of
  // accounts on a staff console is a different list that happens to want the same size —
  // borrowing the constant would make a later change to one silently change the other.
  const perPage = 25
  const listed = await listAccounts({ page, perPage, filter: opts.query })

  // `null` is "the lookup failed", which the module above draws as a distinct answer on
  // purpose. Rendering an empty table over it would tell a support engineer the platform
  // has no accounts at the exact moment auth is having a bad minute.
  if (!listed) {
    console.error('[staff/accounts] GoTrue would not list accounts (page ' + page + ')')
    return { rows: [], page, hasMore: false, failed: true }
  }

  const ids = listed.accounts.map(a => a.userId)
  let people: PersonRow[] = []
  if (ids.length > 0) {
    const { data, error } = await createAdminClient()
      .from('people')
      .select('id, user_id, family_code, first_name, last_name, membership_status, primary_email')
      .in('user_id', ids)
    if (error) {
      // The accounts are still worth showing without their memberships — the confirmation
      // state alone answers most tickets — so this degrades rather than failing the page.
      // Logged so the gap is explicable rather than mysterious.
      console.error(`[staff/accounts] could not read memberships for this page: ${error.message}`)
    }
    people = (data ?? []) as PersonRow[]
  }

  const { memberships } = await resolveMemberships(people)

  return {
    rows: listed.accounts.map(a => ({
      userId: a.userId,
      email: a.email,
      createdAt: a.createdAt,
      confirmedAt: a.confirmedAt,
      lastSignInAt: a.lastSignInAt,
      memberships: (memberships.get(a.userId) ?? []).sort((x, y) =>
        x.familyName.localeCompare(y.familyName),
      ),
    })),
    page,
    hasMore: listed.hasMore,
    failed: false,
  }
}

/**
 * Everything the platform knows about ONE address — the ticket answer.
 *
 * This is the half the table cannot do. A table shows what matched; it cannot say "there
 * is no account with that address", because an empty result also means "the filter
 * matched nothing" and — after a network failure — "we could not ask". The three are
 * different sentences to a support engineer and `accountStateForEmail` distinguishes
 * them: `null` is the failure, `{ exists: false }` is the definite no.
 *
 * It also reaches rows the account list cannot: a `people` row carrying this address with
 * NO `user_id` is an invitation nobody took up, which looks to the person holding it
 * exactly like being unable to sign in.
 */
export async function lookupStaffAccount(email: string): Promise<StaffAccountLookup> {
  await requireStaff()

  const wanted = (email ?? '').trim().toLowerCase()
  if (!wanted) {
    return { email: '', state: null, memberships: [], membershipsFailed: false }
  }

  const admin = createAdminClient()
  const [state, personResult] = await Promise.all([
    accountStateForEmail(wanted),
    // `ilike` with no wildcards is a case-insensitive equality — except that `%` and `_`
    // in the argument WOULD be wildcards, and an address may legitimately contain either.
    // So the pattern is used to narrow and the exact comparison is done below, which is
    // the same shape `accountStateForEmail` uses against GoTrue's substring filter.
    admin
      .from('people')
      .select('id, user_id, family_code, first_name, last_name, membership_status, primary_email')
      .ilike('primary_email', wanted)
      .limit(50),
  ])

  if (personResult.error) {
    console.error(`[staff/accounts] person lookup failed for an address: ${personResult.error.message}`)
    return { email: wanted, state, memberships: [], membershipsFailed: true }
  }

  const people = ((personResult.data ?? []) as PersonRow[]).filter(
    p => (p.primary_email ?? '').trim().toLowerCase() === wanted,
  )
  const { memberships, failed } = await resolveMemberships(people)

  return {
    email: wanted,
    state,
    // Flattened: the map is keyed by account (or by person row, for an unattached one)
    // and a single address can legitimately produce both kinds of key.
    memberships: [...memberships.values()].flat().sort((x, y) =>
      x.familyName.localeCompare(y.familyName),
    ),
    membershipsFailed: failed,
  }
}

/**
 * How many memberships exist across the platform, for the console's index page.
 *
 * IT IS NOT A COUNT OF ACCOUNTS, and the label on screen says so. There is no honest way
 * to get that number cheaply: counting DISTINCT `user_id` is not expressible in
 * PostgREST, and GoTrue's admin list does not hand back a dependable total (see
 * `listAccounts`). Printing a memberships figure and calling it accounts would be a
 * number a support engineer quotes to somebody; printing what is actually counted is
 * worth more than printing the number that was asked for.
 */
export async function getStaffMembershipCount(): Promise<number> {
  await requireStaff()

  const { count, error } = await createAdminClient()
    .from('people')
    .select('id', { count: 'exact', head: true })
    // Rows with no user_id are recorded people rather than accounts — a grandmother on
    // the tree is in the family and cannot sign in, so counting her here would inflate a
    // figure whose whole subject is signing in (AGENTS.md §4b).
    .not('user_id', 'is', null)

  if (error) {
    console.error(`[staff/accounts] the membership count was refused: ${error.message}`)
    return 0
  }
  return count ?? 0
}
