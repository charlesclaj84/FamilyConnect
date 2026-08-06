import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyActiveMembership } from '@/lib/auth/family'
import { FEATURES, getFeature } from '@/lib/features'

/**
 * Authorization for the authenticated caller in their active family.
 *
 * This mirrors public.auth_permission() in 20260618000000 exactly — the database
 * enforces the same rules through RLS, and the two must never disagree. If you
 * change the precedence here, change it there in the same commit.
 *
 * PRECEDENCE
 *   1. Group layer. If ANY group the caller belongs to states a scope for
 *      (resource, action), the groups decide and the individual override is
 *      ignored. Across several groups the most permissive wins: any > own > none.
 *   2. The caller's own person_permissions row, if present.
 *   3. Default. For 'view', the family's page visibility ('everyone' => any,
 *      'restricted' => none). For create/edit/delete, none — it fails closed.
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
  /** Resolved scope keyed `${resource}:${action}`. Absent means fall to default. */
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
}

const key = (resource: string, action: PermissionAction) => `${resource}:${action}`

const MOST_PERMISSIVE = (a: PermissionScope, b: PermissionScope): PermissionScope => {
  if (a === 'any' || b === 'any') return 'any'
  if (a === 'own' || b === 'own') return 'own'
  return 'none'
}

/**
 * Turn a route into a resource key. Resource keys are the feature registry's
 * hrefs without the leading slash, so `/admin/events/9/checkin` resolves to
 * `admin/events` via the registry's longest-prefix match.
 */
export function resourceKeyFor(pathname: string): string {
  const feature = getFeature(pathname.startsWith('/') ? pathname : `/${pathname}`)
  if (feature) return feature.href.replace(/^\//, '')
  return pathname.replace(/^\//, '')
}

const EMPTY: PermissionSet = {
  personId: '', familyCode: '', resolved: new Map(), restricted: new Set(),
  legacy: false, legacyIsAdmin: false,
}

/**
 * Load and resolve everything the caller can do, once per request.
 *
 * Deliberately one batch rather than a query per check: a page render asks about
 * many resources, and the sidebar asks about all of them.
 */
export const getMyPermissionSet = cache(async (userId: string): Promise<PermissionSet> => {
  if (!userId) return EMPTY

  const { familyCode, personId } = await getMyActiveMembership(userId)
  if (!familyCode || !personId) return EMPTY

  const admin = createAdminClient()

  const memberships = await admin
    .from('user_group_members')
    .select('group_id, user_groups!inner(id, family_code)')
    .eq('person_id', personId)

  // The tables only exist once 20260618000000 has run. Until then fall back to
  // the legacy is_admin flag so the app is usable in both states.
  if (memberships.error) {
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

  const groupIds = (memberships.data ?? [])
    .filter(m => (m.user_groups as unknown as { family_code: string } | null)?.family_code === familyCode)
    .map(m => m.group_id as string)

  const [groupPerms, personPerms, visibility] = await Promise.all([
    groupIds.length
      ? admin.from('group_permissions').select('resource_key, action, scope').in('group_id', groupIds)
      : Promise.resolve({ data: [] as GroupPermRow[] }),
    admin.from('person_permissions').select('resource_key, action, scope').eq('person_id', personId),
    admin.from('resource_visibility').select('resource_key, visibility').eq('family_code', familyCode),
  ])

  // Group layer first — it wins outright wherever it states anything.
  const fromGroups = new Map<string, PermissionScope>()
  for (const row of (groupPerms.data ?? []) as GroupPermRow[]) {
    const k = key(row.resource_key, row.action)
    const prev = fromGroups.get(k)
    fromGroups.set(k, prev ? MOST_PERMISSIVE(prev, row.scope) : row.scope)
  }

  const resolved = new Map(fromGroups)
  for (const row of (personPerms.data ?? []) as GroupPermRow[]) {
    const k = key(row.resource_key, row.action)
    if (!fromGroups.has(k)) resolved.set(k, row.scope)
  }

  const restricted = new Set(
    ((visibility.data ?? []) as { resource_key: string; visibility: string }[])
      .filter(r => r.visibility === 'restricted')
      .map(r => r.resource_key),
  )

  return { personId, familyCode, resolved, restricted, legacy: false, legacyIsAdmin: false }
})

interface GroupPermRow {
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

  // Pre-migration fallback, reproducing exactly what this replaces: admins do
  // everything; everyone else can view the member-facing pages and touch only
  // their own records. Admin pages stay admin-only — without this the newly-live
  // admin/users and admin/groups pages would be open to every member during the
  // window between deploying this code and applying 20260618000000.
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
  if (!(await can(userId, resource, 'view'))) notFound()
}

/**
 * Every resource key the caller may view — for the sidebar, which needs the whole
 * answer at once. Computed over the full feature catalog rather than only the
 * rows that exist, so a resource with no explicit grant still picks up the
 * family's default visibility.
 */
export async function viewableResources(userId: string): Promise<Set<string>> {
  const perms = await getMyPermissionSet(userId)
  const out = new Set<string>()
  for (const feature of FEATURES) {
    const resource = feature.href.replace(/^\//, '')
    if (resolveScope(perms, resource, 'view') !== 'none') out.add(resource)
  }
  return out
}
