import { notFound, redirect } from 'next/navigation'
import { can, canAny, requireFamilyActive } from '@/lib/auth/permissions'
import { tierAllows } from '@/lib/auth/tier'
import {
  getTemplates, getResources, getTemplatePolicy, canManageAccess, getMyEffectivePermissions,
  type AccessRights,
} from '@/app/actions/admin/permissions'
import { getApplicants } from '@/app/actions/admin/approvals'
import {
  getChapters, getRegions, getScopeUsage,
  getBoardPositions, getBoardPositionHolders, getAssignableMembers,
  getBoardPositionScopeOptions,
} from '@/app/actions/admin/chapters'
import { getInvitations } from '@/app/actions/invitations'
import {
  AdminAccessClient, type AccessTab, type ApprovalsData, type OrganizationData,
  type MemberBoardData,
} from '@/components/admin/AdminAccessClient'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'

// "Members", not "Members & Access" — see the note on the FEATURES entry in
// lib/features.ts. The route and the resource key both stay `admin/users`.
export const metadata = { title: 'Members' }

interface Props {
  searchParams: Promise<{ tab?: string; template?: string }>
}

/** The shape handed down when neither half of the page was fetched. */
const NO_RIGHTS: AccessRights = { view: false, create: false, edit: false, remove: false }

/**
 * Members & Access — the roster, the join queue, the permission grids, and (since
 * 2026-08-19) the family's Organization.
 *
 * FOUR RESOURCE KEYS GATE THIS ONE PAGE — one per pane — and none implies another.
 *
 *   `admin/users`            the Members tab: the roster, and re-templating someone
 *   `admin/approvals`        the Pending Approval tab: the join queue
 *   `admin/users/templates`  the Permission Templates tab: the grids themselves
 *   `admin/chapters`         the Organization tab: the family's regions and chapters
 *
 * The page opens for ANY of them, which is what keeps each move onto this screen from
 * being a quiet tightening: reviewing applicants needed only the approvals grant before
 * the queue moved here, editing grids needed only the Groups & Permissions grant before
 * that screen was merged in, and Regions & Chapters needed only `admin/chapters` before it
 * became a pane. Requiring the page's key on top of a pane's would be a permission change
 * smuggled in as a navigation change.
 *
 * Each tab then fetches only under its own grant (AGENTS.md §5 — props are serialized into
 * the RSC payload and reach the browser whether a component renders them or not, so hiding
 * a tab over data already fetched publishes that data). The actions behind all four
 * re-check independently: getResources() and getTemplatePolicy() run
 * requireAccessAdmin(TEMPLATE_RESOURCE, 'view'), searchMembers() runs it on 'admin/members',
 * getApplicants() runs requireRead('admin/members/approvals'), and every read and write in
 * app/actions/admin/chapters.ts runs requireScope('admin/members/organization', …).
 *
 * ── TWO PANES CARRY A TIER GATE, AND NEITHER IS OPTIONAL ─────────────────────────────
 * This said "the Organization pane is the one" until 2026-08-19, when Standard was inserted
 * and Permission Templates became `tier: 'standard'`. Organization is still `tier: 'plus'`.
 * The argument below is written about Organization and applies to BOTH unchanged — which is
 * the point of stating it once: this is the part of a pane move that is not a two-line
 * change, and the part a later reader is most likely to simplify away.
 *
 * `requireView` derives the plan from the RESOURCE KEY, through `requiredTier()`. This
 * page's key is `admin/users`, which is `tier: 'free'` — so the guard at the top of a page
 * cannot possibly know that one of its panes is `tier: 'plus'`, and a pane resolved with
 * `can()` alone consults no tier at all. Without the explicit check below, moving
 * `/admin/members/organization` in here would hand every FREE family full region-and-chapter CRUD that
 * /pricing sells on the Plus card ("Split a large family into chapters with their own
 * leadership") — unsold, and with nothing anywhere saying so.
 *
 * WORSE THAN UNSOLD: USED WHILE INVISIBLE. `getResources()` tier-filters the permission
 * grid and `viewableResources()` tier-filters the rail, both by the same `requiredTier()`
 * call — so on a Free family the `admin/chapters` row is absent from Permission Templates
 * and the key is absent from the nav answer. An administrator could therefore be creating
 * regions on a screen whose grant they cannot see, cannot restrict and cannot revoke.
 *
 * So `canViewOrganization` is `can() AND tierAllows()`, which is exactly what
 * `viewableResources()` computes for the same key, and the fetch is skipped entirely rather
 * than fetched and hidden — the pane is ABSENT, not empty. It withholds the SCREEN and
 * never the rows: no policy consults `families.tier` and none may start to, so a family
 * that lapses to Free keeps every region and chapter it ever created and finds them exactly
 * as they were on the day it upgrades again.
 *
 * ── WHY THE TIER FAILURE IS NOT A REDIRECT, EXCEPT IN ONE CASE ───────────────────────
 * `requireTier` redirects to `/upgrade`, and doing that here would be wrong for almost
 * everybody: an administrator on a Free family who opens the Members tab must not be thrown
 * onto a sales screen because a pane they were not looking at is above their plan. Absence
 * is the right answer for a pane.
 *
 * The exception is the caller for whom `admin/chapters` is their ONLY reason to be here —
 * arriving through the `/admin/members/organization` redirect, or from a bookmark. Before the move that
 * route ran `requireView('admin/members/organization')` and they got `/upgrade`; a bare `notFound()`
 * would replace a truthful answer with "that page does not exist". So the redirect is
 * preserved for exactly that caller, and only once we know they genuinely hold the grant —
 * telling somebody with no admin grant at all that this family needs Plus would be both a
 * disclosure about the family's billing and a worse answer than the 404 a restricted screen
 * owes.
 */
export default async function AdminAccessPage({ searchParams }: Props) {
  const { user } = await currentUser()
  if (!user) redirect('/login')
  const { t } = await callerI18n(user.id)

  // A REMOVED FAMILY GETS THE NOTICE, NOT THIS SCREEN — and this page went without the line
  // for as long as it has decomposed `requireView`. `requireView` is THREE checks folded into
  // one call (`requireFamilyActive`, then `requireTier`, then the permission test), and taking
  // it apart to widen the third silently dropped the first: an administrator of a family that
  // had been removed could still open Members & Access and work it. The tier half survived
  // because it had to be named explicitly for `admin/chapters` (see `chaptersInPlan` below);
  // the removal half had nothing pulling it into view.
  //
  // It is deliberately keyed on `admin/users` rather than on whichever tab is being asked for.
  // `REMOVED_FAMILY_RESOURCES` is the exemption list and none of the four keys here is on it —
  // a removed family's regions, templates and approvals queue are exactly the things there is
  // no point administering — so the four would answer identically and one call says so once.
  // First, above every read, because §5's obligation is not to fetch what may not be shown.
  //
  // /announcements is the version of this done right (it calls `requireFamilyActive` and
  // `requireTier` explicitly above its union of grants, in that order, and argues for both).
  // Any page that decomposes `requireView` owes all three; two of three is the failure mode.
  await requireFamilyActive(user.id, 'admin/members')

  // `tierAllows` is in the same round trip because `getMyFamilyTier` is `cache()`d per
  // request — `getResources()` below asks the same question again for the grid's own
  // filter, and both resolve to one query.
  const [
    canViewAccess, canViewApprovals, templatesGranted, canViewChapters, boardGranted,
    templatesInPlan, chaptersInPlan, boardInPlan,
  ] = await Promise.all([
    can(user.id, 'admin/members', 'view'),
    can(user.id, 'admin/members/approvals', 'view'),
    can(user.id, 'admin/members/templates', 'view'),
    can(user.id, 'admin/members/organization', 'view'),
    // `canAny` AND NOT `can`, unlike the four above, and it is the one piece of the Board
    // Positions move that is not a copy. Every read behind that half of the pane is
    // `requireScope` — which resolves through `canAny` — and `family_roles`' composed policy
    // tests `auth_permission(…) = 'any'` with an `own_expr` of the literal 'false'. So scope
    // 'own' is not a way to hold this key at all, and `can()` here would render the pane over
    // lists that answer `[]` for a reason nothing on screen could explain. The old
    // `/admin/members/board-positions` page made exactly this check on top of its `requireView`; it
    // moved with the pane rather than being dropped.
    canAny(user.id, 'admin/members/board-positions', 'view'),
    tierAllows(user.id, 'admin/members/templates'),
    tierAllows(user.id, 'admin/members/organization'),
    tierAllows(user.id, 'admin/members/board-positions'),
  ])

  // TWO OF THE FOUR PANES ARE ABOVE FREE NOW, and the second one arrived on 2026-08-19 with
  // the Standard plan: Permission Templates is `tier: 'standard'` and Organization is
  // `tier: 'plus'`. `lib/features.ts` carries a registry row for `/admin/members/templates`
  // whose ONLY job is to say so — without it the sub-key inherits `/admin/members` and is Free,
  // which is what `lib/auth/tier.ts` documents as the default for a tab.
  //
  // The shape is exactly the Organization one and the essay above argues it in full: `can()
  // AND tierAllows()`, which is what `viewableResources()` computes for the same key, so the
  // rail and the page cannot disagree; the fetch is SKIPPED rather than fetched and hidden
  // (§5); and the pane is ABSENT rather than empty. `requireTier` at the top of the page
  // cannot do this job for either of them — it derives the plan from `admin/users`, which is
  // Free, so a pane resolved with `can()` alone consults no tier at all.
  //
  // WHAT IT WITHHOLDS IS THE EDITOR AND NOT THE MODEL. A Free family keeps every template it
  // ever built and every grant on it, and `auth_permission()` goes on reading whichever
  // template each member is on. A permission model that switched off with the plan would hand
  // a downgraded family MORE access than it paid for, which is the one direction a tier gate
  // must never fail in.
  const canViewTemplates = templatesGranted && templatesInPlan

  // ── ORGANIZATION IS TWO HALVES UNDER TWO KEYS, SINCE 2026-08-20 ───────────────────
  // The geography (regions and chapters, `admin/chapters`) and the offices (board positions,
  // `admin/boardpositions`) — two jobs a family delegates separately, so two keys, and the
  // pane appears for EITHER. AGENTS.md's rule about a pane spanning two keys is the authority
  // and Accounting's Dues & Donations item is the precedent: keep the keys separate, render
  // only what the caller holds, and fetch only that.
  //
  // The tier travels with each key independently — both are `tier: 'plus'` today, so on a Free
  // family the whole pane is absent, but nothing here assumes they agree.
  const canViewGeography = canViewChapters && chaptersInPlan
  const canViewBoard = boardGranted && boardInPlan
  const canViewOrganization = canViewGeography || canViewBoard

  // No pane at all. The 404 requireView() would have given, and for the same reason — a
  // restricted page should not advertise that it exists — with the one exception the doc
  // comment argues for: somebody who holds Organization and nothing else, on a family whose
  // plan does not include it, is owed the upgrade screen their old route gave them.
  if (!canViewAccess && !canViewApprovals && !canViewTemplates && !canViewOrganization) {
    // TEMPLATES IS OFFERED FIRST when a caller holds both withheld grants, because it is the
    // cheaper rung: Standard opens the Permission Templates pane, and being sent to the
    // Premium-side answer for a family that needs one upgrade less is a worse sale and a
    // worse answer. A caller holding only one of the two gets that one either way.
    if (templatesGranted) redirect('/upgrade?from=%2Fadmin%2Fusers%2Ftemplates')
    if (canViewChapters) redirect('/upgrade?from=%2Fadmin%2Fchapters')
    // The third of the same shape, added with the Board Positions move: somebody whose only
    // grant is the board roster, on a family whose plan does not include it, is owed the
    // upgrade screen their old route gave them rather than a 404 about a page that exists.
    if (boardGranted) redirect('/upgrade?from=%2Fadmin%2Fboardpositions')
    notFound()
  }

  const params = await searchParams
  const requested: AccessTab =
    params.tab === 'templates' ? 'templates'
      : params.tab === 'approvals' ? 'approvals'
        : params.tab === 'organization' ? 'organization'
          : 'members'

  // Landing on a tab this caller cannot see — a stale link, a grant removed since, or
  // a single-grant caller arriving at the bare URL — falls back to one they can, in
  // the rail's own order so the landing tab is the leftmost one available.
  const allowed: Record<AccessTab, boolean> = {
    members: canViewAccess,
    approvals: canViewApprovals,
    templates: canViewTemplates,
    organization: canViewOrganization,
  }
  const tab: AccessTab = allowed[requested]
    ? requested
    : (['members', 'approvals', 'templates', 'organization'] as AccessTab[]).find(t => allowed[t])!

  // The member list is searched and paged in the database by the client on demand — a
  // family can run past 500 people — so this page loads only the template catalog.
  //
  // getTemplates() is fetched for EITHER key: the Members tab's row menu is a list of
  // templates to put someone on, so the roster half needs their names as much as the
  // grid half does. getResources() is the templates half alone — the resource catalog
  // is only the grid's columns.
  const [templates, rights, effective] = canViewAccess || canViewTemplates
    ? await Promise.all([getTemplates(), canManageAccess(), getMyEffectivePermissions()])
    : [[], { members: NO_RIGHTS, templates: NO_RIGHTS }, { legacy: false }]

  const resources = canViewTemplates ? await getResources() : []

  // WHO MAY INVITE FROM THIS SCREEN, resolved once for a button that now sits on the rail
  // and so is visible from every tab. The union of the two grants that can mean it:
  //
  //   admin/users:create        adding somebody to the roster — the same grant the
  //                             dashboard's Add Member quick action checks.
  //   admin/approvals:edit=any  deciding who gets in, which is what pre-approval IS. This
  //                             half is why the union exists: an approvals administrator
  //                             with no roster grant would otherwise lose the button when
  //                             it moved out of the Pending Approval pane.
  //
  // `canAny` on the approvals half rather than `can`, matching `getApplicants().canDecide`
  // exactly — and matching what create_family_invitation() actually tests before it
  // honours pre-approval. Neither of these IS the gate: the RPC re-derives both.
  const canInvite = rights.members.create || await canAny(user.id, 'admin/members/approvals', 'edit')

  const selectedTemplateId = templates.some(t => t.id === params.template)
    ? params.template!
    : templates[0]?.id ?? null

  // Only fetched for the tab that shows it, and only under the grant that governs it.
  const policy = canViewTemplates && tab === 'templates' && selectedTemplateId
    ? await getTemplatePolicy(selectedTemplateId)
    : {}

  // Fetched only for a caller who may view the queue AND is looking at it. Whether the
  // TAB appears is `canViewApprovals` alone, passed separately — otherwise it would
  // vanish whenever another tab was open.
  let approvalsData: ApprovalsData | null = null
  if (canViewApprovals && tab === 'approvals') {
    const [{ pending, decided, canDecide }, invitations] = await Promise.all([
      getApplicants(),
      getInvitations(),
    ])
    approvalsData = { pending, decided, canDecide, invitations }
  }

  // ── The Organization pane ─────────────────────────────────────────────────────
  //
  // Same shape as the queue above: fetched only for a caller who may view it AND is
  // looking at it, with the tab's presence passed separately as `canViewOrganization`.
  //
  // THE THREE WRITE GRANTS ARE `canAny` AND NOT `can`, which is what /admin/chapters did
  // and is not a stylistic choice: a region is family-wide configuration with nobody to
  // own it, `admin/chapters` is on `NO_OWNER_KEYS`, and every write in
  // app/actions/admin/chapters.ts uses `requireScope`. `can()` is true for scope 'own',
  // so it would offer a Delete button to somebody every action then refuses.
  //
  // `getScopeUsage()` is fetched rather than hidden because it is what lets the pane SAY
  // something — "14 members, 1 dues schedule" is the reason a Delete button is disabled,
  // and a disabled control with no reason beside it reads as a bug.
  //
  // TWO HALVES SINCE 2026-08-20, EACH GATED ON ITS OWN KEY. The geography reads only for a
  // caller who holds `admin/chapters` and the board roster only for one who holds
  // `admin/boardpositions` — so a caller with one of the two gets one half and is sent nothing
  // at all about the other. That is §5 rather than tidiness: the board roster carries the
  // family's ROSTER (`getAssignableMembers` returns names for the assignment dialog), which is
  // PII, and props reach the browser whether a component renders them or not.
  //
  // THE ROSTER AND THE SCOPE OPTIONS RIDE ON `mayEditBoard`, not on the view grant, which is
  // what the old `/admin/members/board-positions` page did and is worth keeping: they exist ONLY to fill
  // the assignment dialog, so a view-only caller has no use for them and no business receiving
  // them.
  let organizationData: OrganizationData | null = null
  if (canViewOrganization && tab === 'organization') {
    const [mayEditBoard] = await Promise.all([
      canViewBoard ? canAny(user.id, 'admin/members/board-positions', 'edit') : Promise.resolve(false),
    ])
    const [
      regions, chapters, usage, mayCreate, mayEdit, mayDelete,
      positions, holders, boardMembers, scopeOptions, mayCreateBoard, mayDeleteBoard,
    ] = await Promise.all([
      canViewGeography ? getRegions() : Promise.resolve([]),
      canViewGeography ? getChapters() : Promise.resolve([]),
      canViewGeography ? getScopeUsage() : Promise.resolve({ regions: {}, chapters: {} }),
      canViewGeography ? canAny(user.id, 'admin/members/organization', 'create') : Promise.resolve(false),
      canViewGeography ? canAny(user.id, 'admin/members/organization', 'edit') : Promise.resolve(false),
      canViewGeography ? canAny(user.id, 'admin/members/organization', 'delete') : Promise.resolve(false),
      canViewBoard ? getBoardPositions() : Promise.resolve([]),
      canViewBoard ? getBoardPositionHolders() : Promise.resolve([]),
      mayEditBoard ? getAssignableMembers() : Promise.resolve([]),
      mayEditBoard
        ? getBoardPositionScopeOptions()
        : Promise.resolve({ regions: [], chapters: [] }),
      canViewBoard ? canAny(user.id, 'admin/members/board-positions', 'create') : Promise.resolve(false),
      canViewBoard ? canAny(user.id, 'admin/members/board-positions', 'delete') : Promise.resolve(false),
    ])
    organizationData = {
      showGeography: canViewGeography,
      regions, chapters, usage, mayCreate, mayEdit, mayDelete,
      showBoard: canViewBoard,
      positions, holders,
      boardMembers,
      boardRegions: scopeOptions.regions,
      boardChapters: scopeOptions.chapters,
      mayCreateBoard, mayEditBoard, mayDeleteBoard,
    }
  }

  // ── Board positions, for the MEMBERS pane ──────────────────────────────────────
  //
  // Assigning a position moved off the Organization pane and onto the member's own row on
  // 2026-08-20, so the roster needs the family's offices and every assignment in it. Same
  // shape as the two panes above — fetched only for a caller who may see it AND is looking at
  // the tab that shows it, so a board roster is not published to somebody reading Templates.
  //
  // THE TWO HALVES ARE GATED DIFFERENTLY, and it matters. `positions` and `holders` ride on
  // `admin/members/board-positions:view`; the regions and chapters ride on `:edit`, because
  // they exist only to fill the assignment picker and a view-only caller has no use for them
  // (§5). `canViewBoard` already ands the grant with the tier, which is what keeps a Free
  // family from getting a Position column for a Plus feature.
  //
  // `getBoardPositionScopeOptions()` rather than `getRegions()`/`getChapters()`, deliberately:
  // it is the narrow projection that exists for this picker (id and name only), and it is
  // gated on the board key rather than on `admin/chapters` — so a caller who may assign
  // positions but may not redraw the family's geography still gets the list they need to pick
  // from. Using the geography reads here would tie one grant to the other.
  let boardData: MemberBoardData | null = null
  if (canViewBoard && tab === 'members') {
    const mayAssign = await canAny(user.id, 'admin/members/board-positions', 'edit')
    const [positions, holders, scopeOptions] = await Promise.all([
      getBoardPositions(),
      getBoardPositionHolders(),
      mayAssign
        ? getBoardPositionScopeOptions()
        : Promise.resolve({ regions: [], chapters: [] }),
    ])
    boardData = {
      positions,
      holders,
      regions: scopeOptions.regions,
      chapters: scopeOptions.chapters,
      mayAssign,
    }
  }

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('page./admin/members.title')}</h1>
      </div>

      <AdminAccessClient
        templates={templates}
        resources={resources}
        tab={tab}
        selectedTemplateId={selectedTemplateId}
        policy={policy}
        memberRights={rights.members}
        templateRights={rights.templates}
        legacy={effective.legacy}
        approvals={approvalsData}
        organization={organizationData}
        board={boardData}
        canViewApprovals={canViewApprovals}
        canViewAccess={canViewAccess}
        canViewTemplates={canViewTemplates}
        canViewOrganization={canViewOrganization}
        canInvite={canInvite}
      />
    </PageShell>
  )
}
