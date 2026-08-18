import type { ResourceSummary } from '@/app/actions/admin/permissions'
import { PERMISSION_ACTIONS, type PermissionAction, type PermissionScope } from '@/lib/auth/permissions'

/**
 * The vocabulary of the permission grid: how the resource catalog is ordered,
 * grouped and labelled, and which scope buttons a given cell may offer.
 *
 * Extracted when there were TWO grids — Groups & Permissions and User Access — which
 * had every constant below copy-pasted into both, and would have quietly disagreed
 * about a family's permissions the moment one of them gained a level the other did
 * not. 20260807000000 merged those screens into one, so the duplication is gone; this
 * stays a module because the grid is long enough without its lookup tables, and
 * because `scopesFor` is a rule about the model rather than about the markup.
 */

// DERIVED, not restated. The four actions are the permission model's, and this module's
// own header explains what happens when a constant like this gets a second copy: the two
// disagree about a family's permissions the moment one gains a level the other did not.
// That is not hypothetical here — this list existed four times (twice inline in
// app/actions/admin/permissions.ts) while `PERMISSION_ACTIONS`, declared beside the
// `PermissionAction` type it enumerates, had no consumer at all.
export const ACTIONS: PermissionAction[] = [...PERMISSION_ACTIONS]

// 'create' has no own/any distinction — you cannot own a record you are about to
// make — so it offers a plain allow/deny.
export const SCOPES_FOR: Record<PermissionAction, PermissionScope[]> = {
  view:   ['none', 'own', 'any'],
  create: ['none', 'any'],
  edit:   ['none', 'own', 'any'],
  delete: ['none', 'own', 'any'],
}

export const SCOPE_LABEL: Record<PermissionScope, string> = { none: '—', own: 'Own', any: 'All' }

// Own and All must be told apart at a glance on the one screen where picking the wrong
// row hands somebody authority they should not have. Gold against olive is a bigger
// separation than the two pale washes this replaced — different lightness AND different
// hue, so it survives a bad monitor and a colour-blind reader, neither of which could
// separate a pastel amber from a pastel green.
export const SCOPE_STYLE: Record<PermissionScope, string> = {
  none: 'bg-muted text-muted-foreground',
  own:  'bg-brand-legacy text-brand-on-legacy',
  any:  'bg-brand-affirm text-brand-on-affirm',
}

// Presentation order for the category list; anything unlisted falls to the end.
//
// `general` and `personal` are EMPTY and are meant to be. 20260806000006 deleted the
// Dashboard and the four Personal resources — a member's own things are not something a
// family administers — and the 2026-08-08 rail audit reconsidered that and kept it.
// Registering Dashboard in particular would let a family 404 somebody's own post-login
// destination, and a new template starts as a complete grid of denials. The two entries
// stay so the order is stated once and holds if a general-category resource ever
// appears; they are not a gap to fill with those five.
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
 *   * 'own' is dropped where the resource has no coherent owner. Disbursements is the
 *     case that forces this: `transactions/fund-disbursements` has own_expr 'false' in
 *     permission_table_map and the action uses canAny(), because the disbursement
 *     paying the caller IS the abuse case. Offering "Own" there would light the cell up
 *     as a grant and grant nothing.
 *
 *     `admin/family` is the second: there is one family row and nobody owns it, so
 *     renameFamily() uses canAny() and the policy 20260812000000 puts on `families`
 *     tests `auth_permission(...) = 'any'` rather than auth_can(). Both halves have to
 *     agree with this list — an 'own' set here would be a switch the database and the
 *     action both read as a denial, which is worse than a switch wired to nothing.
 *
 *     `dues-projections` is the third, and the one where offering 'own' would GRANT
 *     rather than deny. It is a family-wide roll-up — every member's standing, by name —
 *     and there is no own version of it: the member's own answer is /dues, on its own
 *     key. `getDuesProjection()` therefore uses canAny(), so an 'own' set here would
 *     read as a denial and the cell would light up as a grant that hands back nothing.
 *     Dropping the button is what keeps the grid honest about that.
 *
 *     `admin/family/remove` is the fourth, and it inherits its parent's reason exactly:
 *     there is one family row and nobody owns it, so `removeFamily()` gates with
 *     requireDelete — which is requireScope(…, 'delete') and therefore canAny(). An 'own'
 *     set here would read as a denial at the server while lighting the cell up as a grant.
 *     20260817000006 §4 asks for this line by name.
 *
 *     `admin/chapters` is the fifth, and it was already true before the key was reachable:
 *     `permission_table_map` gives both `regions` and `chapters` `own_expr = 'false'`, so
 *     the composed policies read an 'own' grant as `… = 'own' AND false` — a denial. Every
 *     write in `app/actions/admin/chapters.ts` uses `requireScope`, which is canAny, for the
 *     same reason: a region belongs to the family and nobody owns one.
 */
const NO_OWNER_KEYS: readonly string[] = [
  'admin/family', 'admin/family/remove', 'dues-projections', 'admin/chapters',
]

export function scopesFor(resource: ResourceSummary, action: PermissionAction): PermissionScope[] {
  if (!resource.actions.includes(action)) return []
  const scopes = SCOPES_FOR[action]
  if (resource.key.startsWith('transactions/') || NO_OWNER_KEYS.includes(resource.key)) {
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
 * correctly when it sits directly beneath the row it belongs to, IN THE ORDER ITS RAIL
 * USES. Alphabetical ordering would scatter the four Transactions ledgers among the
 * top-level Accounting rows and the grouping would be meaningless — and since every
 * sub-section row is now named for the rail item it governs, two of them under
 * different parents legitimately share a caption ("Dues" appears under both
 * Accounting > Transactions and Administration > Accounting). The heading above them
 * is what tells those apart, so the heading has to stay attached to its own block.
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
