import { notFound, redirect } from 'next/navigation'
import { can, canAny, requireFamilyActive, requireTier } from '@/lib/auth/permissions'
import { tierAllows } from '@/lib/auth/tier'
import {
  getAdminGatherings, getGatheringReviewQueue, getGatheringFundOptions,
} from '@/app/actions/admin/gatherings'
import { getGatheringTemplates } from '@/app/actions/admin/gathering-templates'
import { getSchedulableTemplates } from '@/app/actions/gatherings'
import { AdminGatheringsClient } from '@/components/admin/AdminGatheringsClient'
import {
  ADMIN_GATHERING_PANES, isAdminGatheringPane, type AdminGatheringPane,
} from '@/lib/gathering-panes'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('doc./admin/gatherings.title')
}

/**
 * THE ORGANIZER CONSOLE — three panes, two grants.
 *
 * **Gatherings** is the list: what the family is running, when, on which fund, how much of
 * that fund it claims, and how much of the work has come back. **Review queue** is every
 * submitted task in the family waiting for a ruling, which is the half of the loop an
 * organizer would otherwise have to go looking for one gathering at a time. **Templates** is
 * the library a gathering is built FROM — a route of its own (`/admin/gatherings/templates`)
 * until 2026-08-19, and still one: that page redirects here, which is what keeps its resource
 * key honest and keeps `viewableResources()` able to find it, since that walks `FEATURES` by
 * href.
 *
 * ── TWO KEYS, AND THE PAGE OPENS FOR EITHER ────────────────────────────────────────
 * `admin/gatherings` governs the first two panes — that key IS the console, and there is no
 * sub-key dividing the list from the queue — while `admin/gathering-templates` governs the
 * third. A family that lets somebody author checklists without letting them commit the family
 * to a gathering is an ordinary arrangement, which is exactly why the two keys did not merge
 * when the screens did. So this decomposes `requireView` rather than calling it, the way
 * `/community/announcements` and `/gatherings` do, and 404s a caller holding neither.
 *
 * WHAT IS NOT DROPPED IN THE PROCESS: `requireView` is three checks, not one —
 * `requireFamilyActive`, then `requireTier`, then the permission test — and only the third is
 * being widened. The other two are called explicitly, in the same order, on
 * `'admin/gatherings'`; neither key is in `REMOVED_FAMILY_RESOURCES`.
 *
 * WHICH KEY `requireTier` RESOLVES STOPPED MATTERING ON 2026-08-23, and the history is worth
 * keeping because the machinery below outlived its reason. Both entries were `tier: 'free'`
 * until Standard was inserted (2026-08-19), which made `admin/gathering-templates` Standard
 * and left this page straddling two tiers — so `requireTier` had to resolve the console's key,
 * or a Free organizer would be redirected to `/upgrade` over a pane they never asked for, and
 * the library pane anded `tierAllows()` in for itself.
 *
 * `admin/gatherings` IS STANDARD NOW TOO. Both keys are on one rung, so `requireTier` gives
 * the same answer whichever it resolves and the pane-level `tierAllows()` can no longer
 * withhold anything `requireTier` did not already withhold.
 *
 * IT IS KEPT ANYWAY, which is the Dues & Donations precedent rather than laziness: that rail
 * merged its two keys under one caption, was split back a day later, and kept its two-key
 * machinery through both because the machinery costs nothing and the boundary has demonstrably
 * moved before. This one has moved twice in four days. Deleting the conjunct now would mean
 * re-deriving it the next time the library and the console are priced apart.
 *
 * ── §5, WHICH IS WHY THE GRANTS ARE ALL RESOLVED BEFORE ANYTHING IS FETCHED ────────
 * Gate the FETCH and not the tab. Each pane's queries are skipped entirely for a caller who
 * may not open it — props are serialized into the RSC payload whether a component renders them
 * or not — and the two console panes share a grant, so they are fetched together.
 *
 * What the queue's own EDIT grant decides is whether the Approve and Send-back controls render
 * at all; that is resolved below and re-checked by `reviewGatheringTask`, because a member who
 * may READ what is waiting is not necessarily the person who rules on it.
 *
 * ── THE MONEY IS A SEPARATE GRANT, AND IT IS RESOLVED BEFORE ANYTHING IS ASKED FOR ──
 * `gatherings/budget:view` is a non-admin key that starts RESTRICTED. `getAdminGatherings`
 * resolves it itself and returns `budget: null` per row when it is not held — the columns are
 * never selected rather than selected and dropped. It is resolved a second time here for the
 * same reason, so the fund picker's balances are a fetch that did not happen:
 * `getGatheringFundOptions` gates on it too and would answer `[]`, and skipping the call keeps
 * the two answers from being able to disagree.
 *
 * ── TWO SOURCES FOR THE TEMPLATE PICKER, AND WHY IT IS A UNION ─────────────────────
 * The New-gathering dialog must offer exactly what `createGathering` will accept, which is any
 * non-archived template of the family's. Neither read answers precisely that:
 * `getSchedulableTemplates()` gates on `gatherings:create` (and widens to `'admin'` templates
 * for a holder of `admin/gatherings:create`), while `getGatheringTemplates()` gates on the
 * library's own key and narrows to the caller's own drafts at scope `'own'`. Each self-gates
 * and answers `[]` otherwise, so the union is the widest set this caller is demonstrably
 * entitled to see the NAMES of — and the action re-derives the real rule anyway. An organizer
 * who holds neither read gets a dialog that says so instead of an empty picker.
 *
 * `getGatheringTemplates()` IS NOW ALSO THE TEMPLATES PANE'S OWN DATA, read once and used
 * twice. It is called when EITHER the library pane is open to this caller or they may create a
 * gathering, which is the union of the two reasons this page has to ask for it.
 *
 * BOTH TEMPLATE READS ARE ALSO TIER-GATED SINCE 2026-08-19, including the one behind the
 * create dialog's picker, and that half is easy to leave out. `getSchedulableTemplates()`
 * gates on `gatherings:create` and knows nothing about the plan, so a family that lapsed to
 * Free would be offered its old templates in the picker and could instantiate a whole tree of
 * tasks from one — which is the paid capability, arriving through the screen that was supposed
 * to withhold it. The dialog on Free therefore offers no templates at all, and schedules a
 * gathering with none: a date, a place and the details, which is what Free sells.
 *
 * `scheduleGathering` itself is deliberately NOT tier-checked, per the rule in AGENTS.md about
 * paid pages and their actions — a family that downgrades must not find an endpoint refusing
 * to talk about its own history. What that means here is honest rather than uncomfortable: the
 * tier withholds the SCREEN, so a caller who knows a template id can still POST one. The
 * permission model is what stops somebody who should not, and it is unchanged.
 */
export default async function AdminGatheringsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { user } = await currentUser()
  if (!user) redirect('/login')
  const { t } = await callerI18n(user.id)

  // `requireView`, taken apart — see the essay above. Both must stay above the grants.
  await requireFamilyActive(user.id, 'admin/gatherings')
  await requireTier(user.id, 'admin/gatherings')

  // Grants first, always — the order of this function is its security model, and every fetch
  // below is chosen from these answers rather than filtered afterwards.
  const [mayViewConsole, templatesGranted, templatesInPlan] = await Promise.all([
    can(user.id, 'admin/gatherings', 'view'),
    can(user.id, 'admin/gatherings/templates', 'view'),
    tierAllows(user.id, 'admin/gatherings/templates'),
  ])

  // ── THE LIBRARY IS STANDARD; THE CONSOLE IS FREE ────────────────────────────────────
  // Added 2026-08-19 with the Standard plan, and it is the whole reason this page's two keys
  // could not stay interchangeable. Free sells "the gathering on a shared calendar" — a date,
  // a place and the details, which is the Gatherings pane and the Review queue beside it.
  // Standard sells PLANNING, which is this library: the checklists a gathering is built from.
  //
  // `requireTier` above resolves `admin/gatherings`, and a pane resolved with `can()` alone
  // consults no tier at all — so the grant is anded with `tierAllows()`, exactly as
  // `/admin/members` does for Organization and Permission Templates, and the pane is ABSENT
  // rather than empty with every one of its fetches skipped (§5).
  //
  // BOTH KEYS ARE STANDARD SINCE 2026-08-23, so this conjunct now agrees with `requireTier`
  // in every case and withholds nothing on its own. See the header for why it stays.
  //
  // NOT ONE TEMPLATE IS DELETED OR HIDDEN FROM THE DATABASE. A family that lapses to Free
  // keeps every template it ever authored and finds them where they were when it upgrades
  // again — and every gathering already built from one keeps its tasks, because a task is a
  // COPY of its step rather than a reference to it.
  const mayViewTemplates = templatesGranted && templatesInPlan
  if (!mayViewConsole && !mayViewTemplates) {
    // Somebody whose only reason to be here is the library, on a family whose plan does not
    // include it, is owed the upgrade screen their old route gave them — `/admin/gathering-
    // templates` redirects here, so `notFound()` would deny a screen that exists. Only once
    // the grant is known to be held, for the reason `/admin/members` states: telling somebody
    // with no grant at all that the family needs an upgrade discloses its billing.
    if (templatesGranted) redirect('/upgrade?from=%2Fadmin%2Fgathering-templates')
    notFound()
  }

  const [mayCreate, mayEdit, mayDelete, mayManageBudget] = mayViewConsole
    ? await Promise.all([
      canAny(user.id, 'admin/gatherings', 'create'),
      canAny(user.id, 'admin/gatherings', 'edit'),
      canAny(user.id, 'admin/gatherings', 'delete'),
      canAny(user.id, 'gatherings/budget', 'view'),
    ])
    : [false, false, false, false]

  // The library's own three, and all three are `canAny`: a template's `who_may_schedule`
  // decides whether an ordinary member may commit the family to a whole gathering, and a
  // step's suggested budget decides what money gets proposed. Neither is something somebody's
  // authorship of a draft should authorize. Every action re-checks.
  const [mayCreateTemplates, mayEditTemplates, mayDeleteTemplates] = mayViewTemplates
    ? await Promise.all([
      canAny(user.id, 'admin/gatherings/templates', 'create'),
      canAny(user.id, 'admin/gatherings/templates', 'edit'),
      canAny(user.id, 'admin/gatherings/templates', 'delete'),
    ])
    : [false, false, false]

  const [gatherings, queue, funds, libraryTemplates, schedulableTemplates] = await Promise.all([
    mayViewConsole ? getAdminGatherings() : [],
    mayViewConsole ? getGatheringReviewQueue() : [],
    mayViewConsole && mayManageBudget ? getGatheringFundOptions() : [],
    // Read once, used twice — the Templates pane renders it, and the New-gathering dialog's
    // picker takes the names out of it. The action self-gates, so a caller with neither reason
    // to ask gets `[]` from it either way; this line is what keeps the request from being made
    // at all.
    mayViewTemplates || (mayCreate && templatesInPlan) ? getGatheringTemplates() : [],
    mayCreate && templatesInPlan ? getSchedulableTemplates() : [],
  ])

  // The union, keyed by id and carrying only what the picker prints. The library read comes
  // with every step of every template attached; none of that belongs in the dialog's payload.
  const templateOptions = new Map<string, { id: string; name: string; description: string | null }>()
  for (const t of libraryTemplates) {
    if (t.isArchived) continue   // archiving means "do not start anything new from this"
    templateOptions.set(t.id, { id: t.id, name: t.name, description: t.description })
  }
  for (const t of schedulableTemplates) {
    templateOptions.set(t.id, { id: t.id, name: t.name, description: t.description })
  }

  // Resolved on the server so the first paint already shows the right pane and the client's
  // initial state matches the server HTML exactly — which is what keeps this free of a
  // hydration mismatch. A `?pane=` that is not one of the three, or names one this caller
  // cannot open, falls back to a pane they can see, in the rail's own order.
  //
  // `isAdminGatheringPane` comes from a PURE module rather than from the client component: a
  // Server Component importing a runtime value out of a `'use client'` file gets a client
  // reference instead of the value, which is what threw `.includes is not a function` on
  // `/community/announcements` and rendered its error boundary.
  const requested = (await searchParams).pane
  const paneAllowed = (id: AdminGatheringPane) =>
    id === 'templates' ? mayViewTemplates : mayViewConsole
  const asked = Array.isArray(requested) ? requested[0] : requested
  const initialPane: AdminGatheringPane = isAdminGatheringPane(asked) && paneAllowed(asked)
    ? asked
    // Non-null: the `notFound()` above guarantees at least one of the three is open.
    : ADMIN_GATHERING_PANES.find(paneAllowed)!

  return (
    <PageShell className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t('page./admin/gatherings.title')}</h1>
      </div>
      <AdminGatheringsClient
        initialPane={initialPane}
        initialGatherings={gatherings}
        initialQueue={queue}
        templates={[...templateOptions.values()].sort((a, b) => a.name.localeCompare(b.name))}
        funds={funds}
        mayCreate={mayCreate}
        mayEdit={mayEdit}
        mayDelete={mayDelete}
        mayManageBudget={mayManageBudget}
        mayAuthorTemplates={mayViewTemplates}
        mayViewConsole={mayViewConsole}
        mayViewTemplates={mayViewTemplates}
        libraryTemplates={mayViewTemplates ? libraryTemplates : []}
        mayCreateTemplates={mayCreateTemplates}
        mayEditTemplates={mayEditTemplates}
        mayDeleteTemplates={mayDeleteTemplates}
      />
    </PageShell>
  )
}
