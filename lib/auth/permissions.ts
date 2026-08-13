import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getViewingMembership, isApproved, type FamilyMembership } from '@/lib/auth/family'
import { FEATURES, TAB_RESOURCES, requiredTier } from '@/lib/features'
import { getMyFamilyTier } from '@/lib/auth/tier'
import { tierMeets } from '@/lib/tiers'

/**
 * Authorization for the authenticated caller in their active family.
 *
 * This mirrors public.auth_permission() in 20260807000000 exactly — the database
 * enforces the same rules through RLS, and the two must never disagree. If you
 * change the resolution here, change it there in the same commit.
 *
 * RESOLUTION
 *   1. The caller's ONE permission template, if it states a scope for
 *      (resource, action). A person is assigned at most one template and it is the
 *      whole of their access.
 *   2. Default. For 'view', the family's page visibility ('everyone' => any,
 *      'restricted' => none). For create/edit/delete, none — it fails closed.
 *
 * There is no second layer to reconcile. 20260807000000 replaced group membership
 * (N groups, unioned, beating a per-person override grid) with a single template,
 * and materialized every template's grid so step 1 answers nearly everything —
 * step 2 survives for a person with no template and for a resource registered by a
 * migration later than the templates that exist.
 *
 * Scope: 'none' denied · 'own' only rows the caller owns · 'any' all rows in the
 * family. 'create' treats own and any alike.
 */

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete'
export type PermissionScope = 'none' | 'own' | 'any'

export const PERMISSION_ACTIONS: readonly PermissionAction[] = ['view', 'create', 'edit', 'delete']

export interface PermissionSet {
  /** people.id in the active family, or '' when the caller has no membership. */
  personId: string
  familyCode: string
  /**
   * The caller's template, flattened to `${resource}:${action}` -> scope. Absent
   * means fall to default — rare since 20260807000000 materialized every grid.
   */
  resolved: Map<string, PermissionScope>
  /** Resources the family has switched to 'restricted'. */
  restricted: Set<string>
  /**
   * True when the permission tables are not present yet (migration not applied).
   * Callers get legacy behaviour derived from people.is_admin so the app keeps
   * working either side of the migration.
   */
  legacy: boolean
  /** Only meaningful when `legacy` is true. */
  legacyIsAdmin: boolean
  /**
   * True when an administrator has admitted the caller to this family and has not
   * since switched them off.
   *
   * False for pending, rejected and disabled, all of which resolveScope() then denies
   * outright. This mirrors the `AND p.membership_status = 'approved'` conjunct that
   * 20260806000011 added to public.auth_person_id(): there, a non-approved caller
   * resolves to no person and auth_permission() returns 'none' for everything. The
   * database is still the enforcement — this keeps the TypeScript twin from
   * disagreeing with it and rendering affordances the policies will refuse.
   */
  approved: boolean
}

const key = (resource: string, action: PermissionAction) => `${resource}:${action}`

const EMPTY: PermissionSet = {
  personId: '', familyCode: '', resolved: new Map(), restricted: new Set(),
  legacy: false, legacyIsAdmin: false, approved: false,
}

/**
 * Load and resolve everything the caller can do, once per request.
 *
 * Deliberately one batch rather than a query per check: a page render asks about
 * many resources, and the sidebar asks about all of them.
 */
export const getMyPermissionSet = cache(async (userId: string): Promise<PermissionSet> => {
  if (!userId) return EMPTY

  const membership = await getViewingMembership(userId)
  const familyCode = membership?.familyCode ?? ''
  const personId = membership?.personId ?? ''
  if (!familyCode || !personId) return EMPTY

  // A non-approved membership is resolved no further. Loading its template would be
  // wasted work — resolveScope() denies every resource below on the `approved` flag —
  // and it would also be misleading: the default-template trigger assigns General the
  // moment a user-linked row is inserted, so an applicant genuinely holds a template.
  // What they do not hold is a membership it can act through. Since 20260807000000
  // that also covers a DISABLED member: isApproved() tests positively for 'approved',
  // so switching someone off denies them here without a second branch.
  const approved = isApproved(membership?.status)
  if (!approved) return { ...EMPTY, personId, familyCode }

  const admin = createAdminClient()

  // The template id, and the family it belongs to. The join is not decoration:
  // permission_template_id is a bare uuid, and a row carrying another family's
  // template must resolve to nothing rather than to that family's grants. The SQL
  // resolver applies the same conjunct.
  const assignment = await admin
    .from('people')
    .select('permission_template_id, permission_templates(id, family_code)')
    .eq('id', personId)
    .maybeSingle()

  // The column and the tables only exist once 20260807000000 has run. Until then fall
  // back to the legacy is_admin flag so the app is usable in both states.
  if (assignment.error) {
    const { data: person } = await admin
      .from('people').select('is_admin').eq('id', personId).maybeSingle()
    return {
      ...EMPTY,
      personId,
      familyCode,
      legacy: true,
      legacyIsAdmin: (person as { is_admin?: boolean } | null)?.is_admin === true,
    }
  }

  const template = (Array.isArray(assignment.data?.permission_templates)
    ? assignment.data?.permission_templates[0]
    : assignment.data?.permission_templates) as { id: string; family_code: string } | null | undefined
  const templateId = template?.family_code === familyCode ? template.id : ''

  const [templatePerms, visibility] = await Promise.all([
    templateId
      ? admin.from('template_permissions').select('resource_key, action, scope').eq('template_id', templateId)
      : Promise.resolve({ data: [] as TemplatePermRow[] }),
    admin.from('resource_visibility').select('resource_key, visibility').eq('family_code', familyCode),
  ])

  const resolved = new Map<string, PermissionScope>()
  for (const row of (templatePerms.data ?? []) as TemplatePermRow[]) {
    resolved.set(key(row.resource_key, row.action), row.scope)
  }

  const restricted = new Set(
    ((visibility.data ?? []) as { resource_key: string; visibility: string }[])
      .filter(r => r.visibility === 'restricted')
      .map(r => r.resource_key),
  )

  return { personId, familyCode, resolved, restricted, legacy: false, legacyIsAdmin: false, approved }
})

interface TemplatePermRow {
  resource_key: string
  action: PermissionAction
  scope: PermissionScope
}

/** Resolve one (resource, action) for the caller. */
export function resolveScope(
  perms: PermissionSet,
  resource: string,
  action: PermissionAction,
): PermissionScope {
  if (!perms.personId) return 'none'

  // ABOVE the legacy branch on purpose. That branch hands scope 'any' to a legacy
  // administrator and view 'any' to every member, so a pending applicant in a
  // family whose database predates 20260618000000 would come out of it with more
  // access than an approved member of a current one. Approval is not a permission
  // and cannot be overridden by one — nothing below this line can grant it back.
  if (!perms.approved) return 'none'

  // Pre-migration fallback, reproducing exactly what this replaces: admins do
  // everything; everyone else can view the member-facing pages and touch only
  // their own records. Admin pages stay admin-only — without this the Members &
  // Access page would be open to every member during the window between deploying
  // this code and applying the permission migrations.
  if (perms.legacy) {
    if (perms.legacyIsAdmin) return 'any'
    if (resource.startsWith('admin/')) return 'none'
    return action === 'view' ? 'any' : 'own'
  }

  const explicit = perms.resolved.get(key(resource, action))
  if (explicit) return explicit

  if (action === 'view') return perms.restricted.has(resource) ? 'none' : 'any'
  return 'none'
}

export async function scopeFor(
  userId: string,
  resource: string,
  action: PermissionAction,
): Promise<PermissionScope> {
  return resolveScope(await getMyPermissionSet(userId), resource, action)
}

/** Any access at all — use for page gating and create checks. */
export async function can(
  userId: string,
  resource: string,
  action: PermissionAction,
): Promise<boolean> {
  return (await scopeFor(userId, resource, action)) !== 'none'
}

/**
 * True ONLY for the unrestricted scope.
 *
 * `can()` answers "may they touch this at all", which is true for scope 'own' — and
 * for most records that is right, because RLS or the action then narrows the write to
 * rows they own. But some records have no coherent "own" version, and treating 'own'
 * as permission there inverts the intent of the grant:
 *
 *   * A fund, a milestone, a dues schedule, a routing table — family-wide
 *     configuration. There is no personal copy to own.
 *   * A disbursement. The row a member would "own" is one paying money to
 *     themselves, so honouring 'own' would let a restricted grant authorize exactly
 *     the payout it was meant to prevent.
 *
 * Use this for those. Use `can()` or `canOn()` where 'own' genuinely means something.
 */
export async function canAny(
  userId: string,
  resource: string,
  action: PermissionAction,
): Promise<boolean> {
  return (await scopeFor(userId, resource, action)) === 'any'
}

/**
 * Row-level check honouring own-vs-any. `ownerPersonId` is the people.id that
 * owns the record (author_id, recorded_by, person_id, …).
 */
export async function canOn(
  userId: string,
  resource: string,
  action: PermissionAction,
  ownerPersonId: string | null | undefined,
): Promise<boolean> {
  const perms = await getMyPermissionSet(userId)
  const scope = resolveScope(perms, resource, action)
  if (scope === 'any') return true
  if (scope === 'own') return Boolean(ownerPersonId) && ownerPersonId === perms.personId
  return false
}

/**
 * Page guard. Renders the 404 for a page the caller may not view, rather than a
 * "denied" screen — a restricted page should not advertise that it exists.
 *
 * Call this at the top of every protected page. RLS enforces the same rules on
 * the data underneath, so this is the friendly layer, not the only one.
 */
export async function requireView(userId: string, resource: string): Promise<void> {
  await requireTier(userId, resource)
  if (!(await can(userId, resource, 'view'))) notFound()
}

/**
 * Refuse a page the family's PLAN does not include, and say so.
 *
 * ── WHY IT LIVES INSIDE `requireView` ───────────────────────────────────────────────
 * Because §1's preamble is already the thing every page calls, and a second line every
 * page must also remember is a line three pages will not have. The same argument
 * `lib/auth/guard.ts` makes for wrapping the write preamble: repeating a check by hand
 * across twenty pages is how two of them end up without it. Folding it in here means a
 * page written next year is tier-gated without its author knowing this exists.
 *
 * ── WHY IT REDIRECTS RATHER THAN 404s ───────────────────────────────────────────────
 * `requireView` answers a permission question with `notFound()`, and that is right there:
 * a page an administrator has restricted should not advertise that it exists, because
 * confirming it would leak how the family is organized. A TIER is the opposite kind of
 * fact. It is published on `/pricing`, identical for every customer, and the whole point
 * of the boundary is that the family should be told what is on the other side of it — a
 * 404 here would hide the product from the person deciding whether to buy it.
 *
 * So it goes to `/upgrade`, which names the feature and the plan. `from` carries the
 * ROUTE rather than the key so that screen can look the feature up the same way every
 * other surface does, and so a sub-key resolves to the page a member was actually
 * reaching for.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────────────
 * NOT a security boundary, and nothing downstream may treat it as one. It withholds
 * SCREENS, not rows: family isolation is RLS and per-member authority is the permission
 * model, both of which are enforced in the database and neither of which knows what a
 * tier is. A family that lapses to Free keeps every record it ever entered — it simply
 * cannot open the pages that read them — which is the only behaviour that makes
 * downgrading survivable.
 *
 * Consequently the server ACTIONS behind a paid page are deliberately not tier-checked.
 * They are permission-checked, which is what protects the data; adding a tier test to
 * each would be a second gate over the same rows enforcing a commercial fact, and the
 * first time a family downgraded it would start returning "Not authorized" for their own
 * history. If a paid ACTION should refuse rather than a paid PAGE, that is a decision to
 * make explicitly at that action, not a rule to generalize from here.
 */
export async function requireTier(userId: string, resource: string): Promise<void> {
  const route = `/${resource}`
  const need = requiredTier(route)
  if (!tierMeets(await getMyFamilyTier(userId), need)) {
    redirect(`/upgrade?from=${encodeURIComponent(route)}`)
  }
}

/**
 * Page guard for the three surfaces a PENDING member is allowed to reach:
 * the dashboard, My Profile and My Families.
 *
 * Returns the membership so the page can branch, rather than deciding for it —
 * `{ pending: true }` means "render the awaiting-approval screen and fetch nothing
 * else". Which is the load-bearing half: props are serialized into the RSC payload
 * and reach the browser whether a component renders them or not, so the early
 * return has to happen ABOVE the page's data fetching, not around its JSX.
 *
 * A caller with no membership at all still gets the 404 that requireView() would
 * have given them — they are not awaiting anything.
 */
export async function requireViewOrPending(
  userId: string,
  resource: string,
): Promise<{ pending: false } | { pending: true; membership: FamilyMembership }> {
  const membership = await getViewingMembership(userId)
  if (!membership) notFound()
  if (!isApproved(membership.status)) return { pending: true, membership }
  // AFTER the pending branch, deliberately. All three resources this guard serves are
  // Free (`PENDING_RESOURCES`), so the check can never fire today — but if one ever
  // stopped being, an applicant would be bounced to an upgrade screen for a family they
  // have not been admitted to, which is both confusing and a disclosure about somebody
  // else's billing. Answering "you are awaiting approval" first is correct in every
  // ordering of those two facts.
  await requireTier(userId, resource)
  if (!(await can(userId, resource, 'view'))) notFound()
  return { pending: false }
}

/**
 * The pages a member may reach while their membership is not approved.
 *
 * Exactly the three `requireViewOrPending()` admits, and that is the whole rule: this
 * is the SIDEBAR'S copy of a decision the page guards already make, so a key here that
 * the guard would refuse is a nav link to a 404. Change one, change the other.
 *
 * My Children and Family Tree sit under the same Personal heading and are deliberately
 * NOT here. Both read `people` rows that belong to the FAMILY — the tree is everyone's
 * relationships, and a child is a family record with dues and tags of its own — and
 * auth_person_id() is NULL for a non-approved caller (20260806000011), so every policy
 * behind them matches nothing. They gate with requireView(), which 404s. Listing them
 * would offer a pending member two dead links to prove it.
 */
export const PENDING_RESOURCES: readonly string[] = [
  'dashboard',
  'personal-info',
  'my-families',
]

/**
 * Every resource key the caller may view — for the sidebar, which needs the whole
 * answer at once. Computed over the full feature catalog rather than only the
 * rows that exist, so a resource with no explicit grant still picks up the
 * family's default visibility.
 *
 * TAB_RESOURCES is walked alongside it: a key gating a tab inside a live page has no
 * FEATURES entry to be found under, and one of them — `admin/users/templates` — can be
 * a caller's only reason to reach Members & Access. See the note on that constant.
 */
export async function viewableResources(userId: string): Promise<Set<string>> {
  const perms = await getMyPermissionSet(userId)

  // A membership awaiting a decision resolves to 'none' on every resource, which is
  // right for authorization and left the sidebar completely EMPTY — no Dashboard, no My
  // Profile, no My Families, nothing to click at all. The pages themselves admit a
  // pending caller, so the nav has to as well or the awaiting-approval screen is a room
  // with no doors. Note this is presentation only: requireViewOrPending() is what
  // actually lets those three render, and RLS is what protects the data underneath.
  //
  // `personId` is what distinguishes "not admitted yet" from "belongs to no family at
  // all"; the latter keeps the empty set, because there is nothing they are waiting on.
  if (perms.personId && !perms.approved) return new Set(PENDING_RESOURCES)

  // TWO NARROWINGS, and the tier one is the reason this function is no longer purely a
  // permission question. A rail item for a page the family's plan does not include would
  // be a link to the upgrade screen, dressed as a destination — the same objection
  // `buildNavGroups` already answers for a gated route by DROPPING the item rather than
  // badging it. A family sees the product they bought; what they did not buy is on
  // `/pricing`, where it can be sold properly.
  const tier = await getMyFamilyTier(userId)

  const out = new Set<string>()
  const keys = [...FEATURES.map(f => f.href.replace(/^\//, '')), ...TAB_RESOURCES]
  for (const resource of keys) {
    if (!tierMeets(tier, requiredTier(`/${resource}`))) continue
    if (resolveScope(perms, resource, 'view') !== 'none') out.add(resource)
  }
  return out
}
