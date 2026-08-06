import type { ResourceSummary } from '@/app/actions/admin/permissions'
import type { PermissionAction, PermissionScope } from '@/lib/auth/permissions'

/**
 * The shared vocabulary of the two permission grids.
 *
 * Groups & Permissions (AdminGroupsClient) and User Access (AdminUserAccessClient)
 * render the SAME catalog. Every constant below used to be copy-pasted verbatim into
 * both files, which is fine until one of them gains a level the other does not — at
 * which point the two screens quietly disagree about what a family's permissions are.
 * Adding the sub-section level is exactly that kind of change, so it lives here.
 */

export const ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete']

// 'create' has no own/any distinction — you cannot own a record you are about to
// make — so it offers a plain allow/deny.
export const SCOPES_FOR: Record<PermissionAction, PermissionScope[]> = {
  view:   ['none', 'own', 'any'],
  create: ['none', 'any'],
  edit:   ['none', 'own', 'any'],
  delete: ['none', 'own', 'any'],
}

export const SCOPE_LABEL: Record<PermissionScope, string> = { none: '—', own: 'Own', any: 'All' }

export const SCOPE_STYLE: Record<PermissionScope, string> = {
  none: 'bg-muted text-muted-foreground',
  own:  'bg-amber-100 text-amber-800',
  any:  'bg-green-100 text-green-800',
}

// Presentation order for the category list; anything unlisted falls to the end.
export const CATEGORY_ORDER = ['general', 'personal', 'community', 'events', 'accounting', 'resources', 'admin']

export const CATEGORY_LABEL: Record<string, string> = {
  general: 'General', personal: 'Personal', community: 'Community', events: 'Events',
  accounting: 'Accounting', resources: 'Resources', admin: 'Administration',
}

/**
 * Which scope buttons to render for one cell.
 *
 * Two narrowings, both of which prevent a control that cannot do anything:
 *   * an action the resource does not declare renders NO buttons at all
 *   * 'own' is dropped where the resource has no coherent owner. Fund Disbursements
 *     is the case that forces this: its own_expr is 'false' in permission_table_map
 *     and the action uses canAny(), because the disbursement paying the caller IS the
 *     abuse case. Offering "Own" there would light up amber and grant nothing.
 */
export function scopesFor(resource: ResourceSummary, action: PermissionAction): PermissionScope[] {
  if (!resource.actions.includes(action)) return []
  const scopes = SCOPES_FOR[action]
  if (resource.key.startsWith('transactions/')) {
    return scopes.filter(s => s !== 'own')
  }
  return scopes
}

export interface ResourceRow {
  resource: ResourceSummary
  /** Sub-section heading to emit immediately BEFORE this row, or null. */
  header: string | null
  /** True for any row inside a sub-section, so it can be indented. */
  nested: boolean
}

export interface ResourceBlock {
  category: string
  label: string
  rows: ResourceRow[]
}

/**
 * Category -> ordered rows, with sub-section headings interleaved.
 *
 * Ordered by sort_order rather than alphabetically, because a sub-section only reads
 * correctly when it sits directly beneath the row it belongs to. Alphabetical ordering
 * would scatter Dues Payments, Donation Payments and Fund Contributions among the
 * top-level Accounting rows and the grouping would be meaningless.
 */
export function groupResources(resources: ResourceSummary[]): ResourceBlock[] {
  const byCategory = new Map<string, ResourceSummary[]>()
  for (const r of resources) {
    byCategory.set(r.category, [...(byCategory.get(r.category) ?? []), r])
  }

  return [...byCategory.entries()]
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a[0])
      const bi = CATEGORY_ORDER.indexOf(b[0])
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    .map(([category, list]) => {
      const ordered = [...list].sort((a, b) => a.sortOrder - b.sortOrder)
      let previous: string | null = null
      const rows: ResourceRow[] = ordered.map(resource => {
        const sub = resource.subsection ?? null
        const header = sub && sub !== previous ? sub : null
        previous = sub
        return { resource, header, nested: Boolean(sub) }
      })
      return { category, label: CATEGORY_LABEL[category] ?? category, rows }
    })
}
