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
// `journal` ADDED 2026-08-21 with `20260821000005`, and it is its own category rather than
// a `community` key so the grid's heading matches the rail's — "an administrator matching a
// switch to the thing it switches off should not have to translate". A new NON-admin
// category changes no resolution anywhere: the only load `permission_resources.category`
// bears in SQL is `auth_permission()`'s `category = 'admin'` test, and that migration
// re-asserts 20260817000004's invariant in both directions.
//
// THE CATEGORY VALUE IS STILL `journal` WHILE THE SCREEN IS CALLED **Journals**, and that is
// the `events` decision below applied a second time rather than an oversight: the KEY moved
// to `journals` in `20260822000000` because AGENTS.md forces it to follow the route, and a
// category is not a key. Only the caption below changed.
//
// It sits after `community` because that is where the rail puts it — participation in the
// family, one step past the roster and the notice board.
export const CATEGORY_ORDER = ['general', 'personal', 'community', 'journal', 'events', 'accounting', 'resources', 'admin']

// `events` PRINTS "Gatherings", since 2026-08-19, and the KEY is deliberately left alone.
//
// AGENTS.md: captions come from the screen, not from the database's label for the resource —
// "an administrator matching a switch to the thing it switches off should not have to
// translate". The rail heading is Gatherings, so this one is too. The Events product that gave
// the category its name is retired and every key still filed under it is a Gatherings one.
//
// Renaming the category VALUE would be a migration over `permission_resources.category` — and
// worse, `auth_permission()` reads that column to decide whether an unregistered-visibility key
// fails closed (`category = 'admin'`), so it is load-bearing in SQL and not merely a grouping.
// A caption is one line here; a category is a column three resolvers agree about.
export const CATEGORY_LABEL: Record<string, string> = {
  general: 'General', personal: 'Personal', community: 'Community', journal: 'Journals',
  events: 'Gatherings',
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
 *
 *     `gatherings/budget` is the sixth, and it is the `dues-projections` case again rather than
 *     the `admin/family` one. It gates the money band on a gathering — what the family budgeted,
 *     which fund it draws on, that fund's balance, and whether the two are in the red — which is
 *     a family-wide roll-up with no own version of it. A member's own answer to "what am I
 *     responsible for" is [My Gathering Tasks], on its own key. So `getGatheringDetail` resolves
 *     it with canAny, `permission_table_map` gives it no row at all (it gates a SCREEN BAND, not a
 *     table, and 20260819000000 asserts that absence), and an 'own' set here would read as a
 *     denial at the server while lighting the cell up as a grant.
 *
 *     Note the sibling key `gatherings` is deliberately NOT here: a gathering has a `created_by`,
 *     that column is its `own_expr` in `permission_table_map`, and the composed SELECT policy
 *     honours it — so all three scopes are real for that one.
 *
 *     `admin/gatherings` is the seventh, and it is the strongest case on this list rather than
 *     the weakest. It has NO `permission_table_map` row at all — every Gatherings table maps to
 *     `gatherings` or `admin/gathering-templates` (20260819000000 §5c) — so there is no
 *     `own_expr` anywhere for a composed policy to honour, and no policy in the database
 *     evaluates this key. And every one of its four actions is resolved with `canAny`:
 *     `app/actions/admin/gatherings.ts` uses `requireScope(…, 'view')` deliberately in place of
 *     `requireRead` (its own comment says why — there is no coherent "own" version of the
 *     organizer console), then `requireScope(…, 'create')`, `requireEdit` and `requireDelete`,
 *     all three of which are `requireScope` and therefore `canAny`, which refuses `'own'`. So an
 *     administrator setting Own on any of those cells has granted nothing and been shown a lit
 *     switch.
 *
 *     Its sibling `admin/gathering-templates` is deliberately NOT here, and the difference is
 *     one row: `permission_table_map` gives `gathering_templates` a real `own_expr`
 *     (`created_by = public.auth_person_id()`) and `perm:gathering_templates:select` honours it,
 *     so an Own VIEW grant genuinely narrows a user-client read there. That is the same mixed
 *     shape `admin/events` already has — real for view, `canAny` for the writes — and this list
 *     is per-KEY rather than per-action, so the pair is not an oversight in either direction.
 *
 *     `announcements/birthdays` is the eighth, and it is the ONE entry on this list where an
 *     Own grant is indistinguishable from All rather than from a denial — the `dues-projections`
 *     direction, taken all the way. The key gates ONE THING: whether `getUpcomingBirthdays()`
 *     reads the roster at all (AGENTS.md §5 — the names reach the browser in the RSC payload
 *     whether the pane renders them or not). That gate is `requireRead`, which is `can()`, and
 *     `can()` passes for `'own'` — so Own and All both open the pane and nothing anywhere reads
 *     the scope of this key to tell them apart.
 *
 *     Which rows come back is a DIFFERENT key's answer: the roster is read on the user client,
 *     so the composed SELECT policy on `people` decides it, and that policy is keyed on
 *     `members`. 20260819000002 §B writes no `permission_table_map` row for this key and asserts
 *     the absence, so there is no `own_expr` for it anywhere and no policy in the database
 *     evaluates it. In a family whose `members` grant is itself Own, the pane an administrator
 *     lit up with Own is the reader's own birthday and nothing else — and they would read that
 *     as the pane being empty rather than as the switch they moved. Own is dropped so the grid
 *     offers the one distinction that exists here, which is on or off.
 *
 *     `admin/boardpositions` is the ninth, added when that screen went live (2026-08-19), and
 *     it is the entry where dropping Own gives something up on purpose. Two of the three
 *     tables this key governs have `own_expr = 'false'` in `permission_table_map`, so Own on
 *     create/edit/delete is a switch the composed policies read as a denial — and every action
 *     behind the screen is `requireScope`, which is `canAny` and refuses 'own' outright,
 *     because a board position is family-wide configuration and nobody owns one.
 *
 *     The third table is `user_roles`, whose `own_expr` IS real (`user_id = auth.uid()`), so an
 *     Own VIEW grant here would genuinely narrow a raw read of the assignment rows to the
 *     caller's own — the `admin/gatherings` shape. It is dropped anyway, and the reason is that
 *     nothing in the product asks that question any more: the screen is administrator-facing
 *     and reads on the service role, `getMyRoles` is self-scoped and needs no grant, and since
 *     2026-08-19 the Directory's board-title column reads on the service role too, so a member
 *     seeing who holds what no longer depends on this key at all. An Own view grant would
 *     therefore open the same screen All does while narrowing one PostgREST read nothing in the
 *     app makes. This list is per-KEY rather than per-action, so the choice was between three
 *     meaningless write switches and one meaningful read distinction with no consumer.
 *
 *     `updates` is the tenth, and it is the `announcements/birthdays` case again: an Own grant
 *     is indistinguishable from All rather than from a denial. The key gates ONE thing —
 *     whether `/community/updates` opens — and 20260819000005 writes it no `permission_table_map` row
 *     and asserts the absence, so no policy in the database evaluates it and there is no
 *     `own_expr` for it anywhere.
 *
 *     Which ROWS the archive shows is two other answers, and neither is this key's: the
 *     announcement half is read on the user client under the `announcements` policy, and the
 *     notification half is the caller's own mail under a base policy that has no permission
 *     factor at all (20260805000007 deleted that resource because a factor over a
 *     per-recipient table was a tautology). So Own here would open the same screen All does.
 *
 *     `family-tree` is the eleventh, registered by 20260819000008 after nine days as a
 *     family-wide canvas on an unregistered key. Both of its actions refuse Own, for two
 *     different reasons that happen to agree:
 *
 *       view    `requireView` and `requireRead` are `can()`-based, and `can()` passes for
 *               'own' — so Own and All both open the canvas. Which PEOPLE it draws is not
 *               this key's answer either: `getFamilyTree` reads on the service role (a
 *               half-visible tree draws edges pointing at nothing), so nothing anywhere
 *               narrows the canvas by scope. Own would be indistinguishable from All — the
 *               `announcements/birthdays` case.
 *       edit    `requireTreeEditor()` in app/actions/family-tree.ts is `canAny`, and so is
 *               the page's `canEdit`, deliberately and identically. There is no own version
 *               of a tree edit: `editPersonRecord` refuses any row that HAS a `user_id`, so
 *               the rows this grant governs are exactly the ones nobody owns, and an edge is
 *               a fact about two people. Own would read as a denial at the server while
 *               lighting the cell up as a grant — the `admin/gatherings` case.
 *
 *     And no policy in the database evaluates this key at all: 20260819000008 writes no
 *     `permission_table_map` row and asserts the absence in both directions, because a row
 *     there would compose an `auth_permission('community/family-tree', …)` factor onto
 *     `relationship_types` — whose `own_expr` is 'false' — and a fresh database would then
 *     carry policies hosted has not got. That migration's header has the whole argument.
 */
const NO_OWNER_KEYS: readonly string[] = [
  'admin/settings', 'admin/settings/remove', 'reporting/dues-projections', 'admin/members/organization',
  'gatherings/budget', 'admin/gatherings', 'community/announcements/birthdays',
  'admin/members/board-positions', 'community/updates', 'community/family-tree',
  // TWO MORE ON 2026-08-20, and both are family-wide READINGS with no personal version.
  // `membership-report` counts the whole family, and a member's own answer to "where am I"
  // is their profile. `family-finances` is the P&L Summary — the family's statement, whose
  // own-scoped counterpart is /payment-history, an entirely different screen behind an
  // entirely different key. An 'own' grant on either would be a switch that reads as a
  // narrowing and grants the whole thing, which is what this list exists to prevent: both
  // actions resolve with `canAny`, so 'own' has never been a way to hold them.
  'reporting/membership', 'reporting/pl-summary',
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
