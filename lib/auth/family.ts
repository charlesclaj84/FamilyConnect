import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Family membership for the authenticated caller.
 *
 * An email may belong to more than one family: `people` holds one row per
 * (user, family), and which one is "current" comes from user_family_settings.
 * The resolution order below mirrors public.auth_family_code() exactly, so the
 * app and RLS always agree on which family the user is acting in:
 *
 *     active selection  →  login default  →  oldest membership
 *
 * Candidates are always the caller's OWN people rows, so a stale or bogus
 * active/default value can never point at a family they are not a member of —
 * it simply falls through to the next candidate.
 *
 * Do NOT read family_code from `user.user_metadata`: it is editable by end users
 * (supabase.auth.updateUser({ data })), so a member could rewrite it to point at
 * another family. People rows are written with the service-role client, and the
 * active/default selection can only be changed through the membership-checking
 * RPCs (see app/actions/family.ts).
 */

/**
 * Where a membership stands. Mirrors people.membership_status and its CHECK
 * constraint (20260806000011, extended by 20260807000000).
 *
 * Everything that gates on this tests POSITIVELY for 'approved' — never
 * `!== 'pending'` — so an unknown or absent value denies rather than admits. That
 * is what let 'disabled' be added as a fourth value rather than a second column:
 * every gate in the app and every policy in the database denies it already,
 * without a sweep and without a branch.
 */
export type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'disabled'

export const isApproved = (status: MembershipStatus | null | undefined): boolean =>
  status === 'approved'

/**
 * Where the FAMILY stands, as opposed to where the membership does. Mirrors
 * families.status and its CHECK constraint (20260817000006).
 *
 * A removed family is DISABLED, never deleted: no row is destroyed anywhere, and the only
 * route back is `staff_set_family_status()` from the GENORRA staff console. The member
 * product deliberately has no restore — a family that can un-remove itself has not been
 * removed.
 *
 * `isActiveFamily` tests POSITIVELY, for the reason `isApproved` above does and that
 * migration's header states at length: never `!== 'removed'`, never `removed_at IS NULL`.
 * That discipline is what let 'disabled' join `membership_status` without a sweep, and it
 * is what will make a third family status denied everywhere on arrival rather than
 * admitted by whichever gate was written first.
 */
export type FamilyStatus = 'active' | 'removed'

export const isActiveFamily = (status: FamilyStatus | null | undefined): boolean =>
  status === 'active'

/**
 * What the rail may offer somebody whose family has been removed.
 *
 * ── IT IS NAVIGATION, NOT A GATE, AND THE DIFFERENCE MATTERS ────────────────────────
 * `app/(protected)/layout.tsx` narrows `viewableResources()` to this list when the family
 * being viewed is not active. That stops the shell advertising twenty destinations into a
 * family that has been switched off; it does NOT stop somebody typing one of those
 * addresses, because every page still gates on `requireView`, which knows nothing about
 * `families.status`. AGENTS.md §5 is emphatic that hiding a control is not protecting the
 * data behind it, and this does not pretend otherwise — the honest statement of what has
 * happened is the notice screen on the dashboard.
 *
 * That is a deliberate boundary rather than an oversight: removal withholds a FAMILY's
 * doors, not its members' access to their own records, exactly as a tier downgrade
 * withholds screens and never rows. Nothing is deleted, and a restore has to put every
 * member back exactly where they were.
 *
 * ── WHY IT IS NOT `PENDING_RESOURCES` ───────────────────────────────────────────────
 * It is the same four keys today and it answers a different question, so it is a different
 * constant. It also cannot be that one: `PENDING_RESOURCES` lives in
 * `lib/auth/permissions.ts`, which imports from THIS file, and importing it back would be
 * a cycle. If the two lists ever diverge, this is where the removal half is decided.
 */
export const REMOVED_FAMILY_RESOURCES: readonly string[] = [
  'dashboard',
  'personal-info',
  'my-families',
  'help',
]

export interface FamilyMembership {
  familyCode: string
  familyName: string
  /** The caller's people row id *in that family*. */
  personId: string
  /** True for the family the caller is currently acting in. */
  isActive: boolean
  /** True for the family that opens on login. */
  isDefault: boolean
  /**
   * Whether an administrator has admitted them to this family. A pending
   * membership still resolves here — it has to, or the pending member could not
   * see their own application — but it confers nothing: auth_person_id() gates on
   * the same column, so the database denies every resource regardless.
   */
  status: MembershipStatus
  /**
   * Whether the FAMILY itself is still available (20260817000006).
   *
   * A second, independent axis from `status` above, and both are needed: an approved
   * member of a removed family and a pending member of an active one are different
   * situations with different screens, and neither column can stand in for the other.
   *
   * 'active' when nothing could answer — see `loadFamilyStatuses`.
   */
  familyStatus: FamilyStatus
}

interface PersonRow {
  id: string
  family_code: string
  created_at: string
  membership_status: MembershipStatus | null
}

/**
 * All of the caller's memberships, resolved and ordered by display name.
 *
 * Memoized per request: family_code is consulted by most server actions, and
 * without this the settings lookup would repeat dozens of times per render.
 */
export const getMyFamilies = cache(async (userId: string): Promise<FamilyMembership[]> => {
  if (!userId) return []
  const admin = createAdminClient()

  const { data: rows, error } = await admin
    .from('people')
    .select('id, family_code, created_at, membership_status')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  // The error is READ, not discarded (AGENTS.md §8), because the two outcomes are
  // indistinguishable in `data` and mean opposite things: `[]` is "this account belongs
  // to no family", a legitimate answer that every caller handles by denying, while a
  // refused query means the resolver has no idea and is denying out of ignorance.
  //
  // This is not hypothetical. Shipping the membership_status select against a database
  // that had not yet had 20260806000011 applied returned PostgREST 42703 — "column does
  // not exist" — which killed the WHOLE query, not just that column. Every caller then
  // saw an account with no memberships: requireViewOrPending() called notFound(), and
  // every page in the app answered 404 with nothing anywhere saying why. It took a
  // direct query against the database to find. Failing closed was correct; failing
  // closed *silently* cost an hour.
  if (error) {
    console.error(
      `[auth] getMyFamilies could not resolve memberships for ${userId}: ${error.message}. ` +
      'Every page will deny access until this is fixed. If this is "column ... does not ' +
      'exist", the app is running against a database that is behind supabase/migrations ' +
      '— check `npx supabase migration list --linked`.',
    )
    return []
  }

  const people = (rows ?? []) as PersonRow[]
  if (people.length === 0) return []

  const codes = [...new Set(people.map(p => p.family_code).filter(Boolean))]

  // user_family_settings and families are both optional: the first does not exist
  // until 20260617000000 is applied, and a family may have no display row. Either
  // way we fall back to the oldest membership / the raw code, so the app keeps
  // working before the migration is applied.
  //
  // THE STATUSES ARE A SEPARATE QUERY, AND THAT IS THE POINT OF IT. Adding `status` to
  // `loadFamilyNames`'s select would be one round trip fewer and would reintroduce Phase
  // 3's incident in miniature: PostgREST answers 42703 for a column that is not there and
  // kills the WHOLE query, so a database behind on 20260817000006 would lose every
  // family's NAME along with its status — every family in the switcher reduced to its raw
  // code, silently, because that function discards its error. Two queries fail
  // independently, which is what makes the fallback below survivable.
  const [settings, names, statuses] = await Promise.all([
    loadSettings(userId),
    loadFamilyNames(codes),
    loadFamilyStatuses(codes),
  ])

  const activeCode = resolveActiveCode(people, settings)

  return people
    .map(p => ({
      familyCode: p.family_code,
      familyName: names.get(p.family_code) ?? p.family_code,
      personId: p.id,
      isActive: p.family_code === activeCode,
      isDefault: p.family_code === settings?.default_family_code,
      // NOT NULL since 20260806000011, so the coalesce is unreachable in practice and
      // is here only so a NULL cannot become `undefined` downstream. It is deliberately
      // NOT a compatibility shim for a database without the column: selecting a column
      // that does not exist fails the entire query rather than returning undefined for
      // that field, which is what the error branch above exists to report. An earlier
      // version of this comment claimed otherwise and was wrong.
      status: (p.membership_status ?? 'approved') as MembershipStatus,
      familyStatus: statuses.get(p.family_code) ?? 'active',
    }))
    .sort((a, b) => a.familyName.localeCompare(b.familyName))
})

interface FamilySettings {
  active_family_code: string | null
  default_family_code: string | null
}

/** Null when the table is absent (pre-migration) or the user has no row yet. */
async function loadSettings(userId: string): Promise<FamilySettings | null> {
  const admin = createAdminClient()
  try {
    const { data } = await admin
      .from('user_family_settings')
      .select('active_family_code, default_family_code')
      .eq('user_id', userId)
      .maybeSingle()
    return (data as FamilySettings | null) ?? null
  } catch {
    return null
  }
}

async function loadFamilyNames(codes: string[]): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map()
  const admin = createAdminClient()
  try {
    const { data } = await admin
      .from('families')
      .select('family_code, family_name')
      .in('family_code', codes)
    const rows = (data ?? []) as { family_code: string; family_name: string }[]
    return new Map(rows.map(f => [f.family_code, f.family_name]))
  } catch {
    return new Map()
  }
}

/**
 * Which of these families are still available, keyed by code.
 *
 * ── AN ABSENT ANSWER MEANS 'active', AND THAT IS CORRECT RATHER THAN CONVENIENT ─────
 * Three things land in that branch and all three genuinely describe an active family:
 * a code with no `families` row (a family predating that table, which `familyName`
 * already falls back for), a query PostgREST refused, and a database that has not had
 * 20260817000006 applied.
 *
 * The last is the one worth stating. A database without the column has never removed a
 * family — there was nothing to remove one with — so 'active' is the true answer there,
 * not a lenient one. And the alternative fails catastrophically in the other direction:
 * defaulting to 'removed' would put every member of every family in the estate in front
 * of the notice screen the moment a migration lagged a deploy.
 *
 * The error is READ rather than discarded (AGENTS.md §8) because a whole estate quietly
 * reading as active looks exactly like a whole estate that has never removed anything.
 *
 * NARROWED, NOT CAST. `families_status_check` already confines the column to two values,
 * so an unrecognised one can only come from a database whose constraint has moved without
 * this file hearing about it — and the safe direction there is the one every other gate
 * in this codebase takes: treat what you do not recognise as the state you cannot act on.
 * A third status therefore reads as NOT active, which is what AGENTS.md §6b asks for.
 */
async function loadFamilyStatuses(codes: string[]): Promise<Map<string, FamilyStatus>> {
  if (codes.length === 0) return new Map()

  const { data, error } = await createAdminClient()
    .from('families')
    .select('family_code, status')
    .in('family_code', codes)

  if (error) {
    console.error(
      `[auth] could not read families.status for ${codes.join(', ')}: ${error.message}. ` +
      'Every family will be treated as available until this is fixed. If this is ' +
      '"column ... does not exist", the app is running against a database that is behind ' +
      'supabase/migrations — 20260817000006 adds it.',
    )
    return new Map()
  }

  const rows = (data ?? []) as { family_code: string; status: string | null }[]
  return new Map(rows.map(f => [f.family_code, f.status === 'active' ? 'active' : 'removed']))
}

/**
 * One family's status, by code, for callers that have no membership list in hand.
 *
 * `registerUser` is the reason it exists: the family-code path there runs with NO SESSION
 * at all, so there is nothing to resolve memberships from and `getMyFamilies` cannot
 * answer. It is the same shape as `getFamilyTier` beside it — admin client, hand-applied
 * scoping to the one code, error read and logged, and a fallback that keeps the product
 * working against a database that is behind.
 *
 * IT DOES NOT CHECK WHOSE FAMILY THIS IS, and cannot: it is handed a string. Callers that
 * take a code from a client owe the same thing they always owe one — proof that the caller
 * is entitled to it, or (as in registration) a flow where the code is a public join key
 * and the answer discloses nothing a stranger could not already get.
 */
export async function getFamilyStatus(familyCode: string): Promise<FamilyStatus> {
  if (!familyCode) return 'active'
  const statuses = await loadFamilyStatuses([familyCode])
  return statuses.get(familyCode) ?? 'active'
}

/** active → default → oldest, considering only real memberships. */
function resolveActiveCode(people: PersonRow[], settings: FamilySettings | null): string {
  const has = (code: string | null | undefined) =>
    Boolean(code) && people.some(p => p.family_code === code)

  if (has(settings?.active_family_code)) return settings!.active_family_code!
  if (has(settings?.default_family_code)) return settings!.default_family_code!
  return people[0]?.family_code ?? ''
}

/**
 * The family the caller is currently acting in. Returns '' when they have no
 * people row yet (e.g. a registration whose profile-seed step failed); callers
 * should treat '' as "no family / deny".
 */
export async function getMyFamilyCode(userId: string): Promise<string> {
  const families = await getMyFamilies(userId)
  return families.find(f => f.isActive)?.familyCode ?? families[0]?.familyCode ?? ''
}

/**
 * The caller's people row id in the family they are currently acting in.
 *
 * Use this instead of `.eq('user_id', id).maybeSingle()`: with more than one
 * membership that query matches several rows and `maybeSingle()` errors, and
 * picking an arbitrary row would attribute writes to the wrong family.
 */
export async function getMyPersonId(userId: string): Promise<string> {
  const families = await getMyFamilies(userId)
  return families.find(f => f.isActive)?.personId ?? families[0]?.personId ?? ''
}

/** The active family's code and person id together, for callers that need both. */
export async function getMyActiveMembership(
  userId: string,
): Promise<{ familyCode: string; personId: string }> {
  const families = await getMyFamilies(userId)
  const active = families.find(f => f.isActive) ?? families[0]
  return { familyCode: active?.familyCode ?? '', personId: active?.personId ?? '' }
}

/**
 * The membership the caller is currently viewing, whatever its state.
 *
 * The one resolver that deliberately answers for a NON-approved membership, so the
 * pending screens can tell three cases apart that all look like "no access":
 *
 *   no membership at all  → not a member of anything; send them to login/register
 *   pending / rejected    → render the awaiting-approval screen, fetch nothing else
 *   approved              → the normal path
 *
 * Returns null when the caller has no people row in any family. Reads through the
 * service-role client (getMyFamilies), which is required rather than convenient: a
 * rejected row is outside the `people` SELECT policy's reach, so the user's own
 * client cannot see it to report on it.
 */
export async function getViewingMembership(
  userId: string,
): Promise<FamilyMembership | null> {
  const families = await getMyFamilies(userId)
  return families.find(f => f.isActive) ?? families[0] ?? null
}

/** True when the caller is an admitted member of the family they are viewing. */
export async function isApprovedMember(userId: string): Promise<boolean> {
  return isApproved((await getViewingMembership(userId))?.status)
}

/**
 * The caller's own name in one particular family, for a message that has to say who
 * they are.
 *
 * ITS ONE JOB IS THE APPROVALS NOTIFICATIONS, and it exists as a shared helper rather
 * than three copies because its three callers are all in the same awkward position:
 * `joinFamilyByCode`, `redeemInvitation` and `appealMembershipDecision` each need to name
 * the applicant to the administrators, and each is running as somebody who is PENDING in
 * the family being named. `auth_person_id()` is NULL for them there (20260806000011), so
 * their own client resolves nothing at all — not even their own row, through a policy
 * that does admit it, because the policy's own conjunct has already collapsed.
 *
 * Hence the service role, and hence §3's obligation discharged the only way it can be:
 * scoped by `user_id` AND `family_code` together, so the query can return the caller's
 * own row in that one family and nothing else. No id crosses in from a client.
 *
 * Empty string on anything unexpected, which every caller reads as "no name" and falls
 * back to the email address. A notification that says "Someone" is worse than one that
 * says "Ada Okonkwo"; neither is worth failing a join over.
 */
export async function getMyNameInFamily(userId: string, familyCode: string): Promise<string> {
  if (!userId || !familyCode) return ''
  const { data } = await createAdminClient()
    .from('people')
    .select('first_name, last_name')
    .eq('user_id', userId)
    .eq('family_code', familyCode)
    .maybeSingle()
  const row = data as { first_name: string | null; last_name: string | null } | null
  return `${row?.first_name ?? ''} ${row?.last_name ?? ''}`.trim()
}

/**
 * True when `id` names a row of `table` that lives in `familyCode`.
 *
 * For the one case RLS structurally cannot cover: an id that arrives from the
 * client and is then written ONTO a row of the caller's own family. A partner's
 * people.id, a dues schedule id, a child's people.id. The inserted row is
 * legitimately the caller's, so its family_code satisfies every policy — while
 * the id it carries points into somebody else's family. The policy examines the
 * row, not the rows the row references, so nothing in the database objects.
 *
 * That makes this an action's responsibility, not RLS's, even on the user
 * client. tests/rls covers each caller.
 *
 * Deliberately the service-role client: the answer must not depend on whether
 * the caller happens to hold view permission on the referenced table, or a
 * family that restricts its Member Directory would break its own family tree.
 */
export async function belongsToFamily(
  table: string,
  id: string | null | undefined,
  familyCode: string,
): Promise<boolean> {
  if (!id || !familyCode) return false
  const { data } = await createAdminClient()
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('family_code', familyCode)
    .maybeSingle()
  return Boolean(data)
}
