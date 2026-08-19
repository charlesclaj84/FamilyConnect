import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can, canAny, requireFamilyActive } from '@/lib/auth/permissions'
import { tierAllows } from '@/lib/auth/tier'
import {
  getTemplates, getResources, getTemplatePolicy, canManageAccess, getMyEffectivePermissions,
  type AccessRights,
} from '@/app/actions/admin/permissions'
import { getApplicants } from '@/app/actions/admin/approvals'
import { getChapters, getRegions, getScopeUsage } from '@/app/actions/admin/chapters'
import { getInvitations } from '@/app/actions/invitations'
import {
  AdminAccessClient, type AccessTab, type ApprovalsData, type OrganizationData,
} from '@/components/admin/AdminAccessClient'
import { PageShell } from '@/components/layout/PageShell'

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
 * requireAccessAdmin(TEMPLATE_RESOURCE, 'view'), searchMembers() runs it on 'admin/users',
 * getApplicants() runs requireRead('admin/approvals'), and every read and write in
 * app/actions/admin/chapters.ts runs requireScope('admin/chapters', …).
 *
 * ── THE ORGANIZATION PANE IS THE ONE WITH A TIER GATE, AND IT IS NOT OPTIONAL ────────
 * This is the part of the move that is not a two-line change, and it is the part a later
 * reader is most likely to simplify away.
 *
 * `requireView` derives the plan from the RESOURCE KEY, through `requiredTier()`. This
 * page's key is `admin/users`, which is `tier: 'free'` — so the guard at the top of a page
 * cannot possibly know that one of its panes is `tier: 'plus'`, and a pane resolved with
 * `can()` alone consults no tier at all. Without the explicit check below, moving
 * `/admin/chapters` in here would hand every FREE family full region-and-chapter CRUD that
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
 * arriving through the `/admin/chapters` redirect, or from a bookmark. Before the move that
 * route ran `requireView('admin/chapters')` and they got `/upgrade`; a bare `notFound()`
 * would replace a truthful answer with "that page does not exist". So the redirect is
 * preserved for exactly that caller, and only once we know they genuinely hold the grant —
 * telling somebody with no admin grant at all that this family needs Plus would be both a
 * disclosure about the family's billing and a worse answer than the 404 a restricted screen
 * owes.
 */
export default async function AdminAccessPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
  await requireFamilyActive(user.id, 'admin/users')

  // `tierAllows` is in the same round trip because `getMyFamilyTier` is `cache()`d per
  // request — `getResources()` below asks the same question again for the grid's own
  // filter, and both resolve to one query.
  const [canViewAccess, canViewApprovals, canViewTemplates, canViewChapters, chaptersInPlan] =
    await Promise.all([
      can(user.id, 'admin/users', 'view'),
      can(user.id, 'admin/approvals', 'view'),
      can(user.id, 'admin/users/templates', 'view'),
      can(user.id, 'admin/chapters', 'view'),
      tierAllows(user.id, 'admin/chapters'),
    ])

  const canViewOrganization = canViewChapters && chaptersInPlan

  // No pane at all. The 404 requireView() would have given, and for the same reason — a
  // restricted page should not advertise that it exists — with the one exception the doc
  // comment argues for: somebody who holds Organization and nothing else, on a family whose
  // plan does not include it, is owed the upgrade screen their old route gave them.
  if (!canViewAccess && !canViewApprovals && !canViewTemplates && !canViewOrganization) {
    if (canViewChapters) redirect('/upgrade?from=%2Fadmin%2Fchapters')
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
  const canInvite = rights.members.create || await canAny(user.id, 'admin/approvals', 'edit')

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
  let organizationData: OrganizationData | null = null
  if (canViewOrganization && tab === 'organization') {
    const [regions, chapters, usage, mayCreate, mayEdit, mayDelete] = await Promise.all([
      getRegions(),
      getChapters(),
      getScopeUsage(),
      canAny(user.id, 'admin/chapters', 'create'),
      canAny(user.id, 'admin/chapters', 'edit'),
      canAny(user.id, 'admin/chapters', 'delete'),
    ])
    organizationData = { regions, chapters, usage, mayCreate, mayEdit, mayDelete }
  }

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Members</h1>
        {/* Broadened when Organization arrived: the sentence about templates was the whole
            of this page when three of its four panes were about permissions, and it now
            describes only three of them. Both halves are stated because both are what an
            administrator comes here to change. */}
        <p className="text-muted-foreground">
          Who is in the family and how it is organized. Every member is on one permission
          template, and that template is what they can do.
        </p>
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
        canViewApprovals={canViewApprovals}
        canViewAccess={canViewAccess}
        canViewTemplates={canViewTemplates}
        canViewOrganization={canViewOrganization}
        canInvite={canInvite}
      />
    </PageShell>
  )
}
