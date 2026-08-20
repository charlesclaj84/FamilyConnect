import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can, canAny, requireFamilyActive, requireTier } from '@/lib/auth/permissions'
import { tierAllows } from '@/lib/auth/tier'
import {
  getGatherings, getMyGatheringTasks, getSchedulableTemplates, type MyTaskRow,
} from '@/app/actions/gatherings'
import { gatheringTiming } from '@/lib/gatherings'
import { todayLocal } from '@/lib/date-utils'
import { PageShell } from '@/components/layout/PageShell'
import { GatheringsShell } from '@/components/gatherings/GatheringsShell'
import type { GatheringRow } from '@/components/gatherings/GatheringsClient'
import {
  GATHERING_PANES, isGatheringPane, type GatheringPane,
} from '@/lib/gathering-panes'

export const metadata = { title: 'Gatherings' }

interface Props {
  searchParams: Promise<{ pane?: string | string[] }>
}

/**
 * `/gatherings` — everything the family is planning, and the caller's own share of it.
 *
 * ── TWO PANES SINCE 2026-08-19, AND TWO KEYS ────────────────────────────────────────
 * Gatherings on `gatherings`, My Tasks on `gatherings/my-tasks`. They were two routes and two
 * rail items; `/gatherings/my-tasks` still exists and redirects here, which is what keeps its
 * key honest (AGENTS.md: the resource key is the route without its leading slash) and what
 * keeps `viewableResources()` able to find it at all, since that walks `FEATURES` by href.
 *
 * ── WHY `requireView` IS DECOMPOSED HERE INSTEAD OF CALLED ──────────────────────────
 * Either key can be a legitimate and sufficient reason to be on this screen, and
 * `requireView('gatherings')` would 404 a member whose family has restricted the family-wide
 * list while still handing them tasks — which is not a hypothetical arrangement, it is the
 * ordinary one for a member who is not an organizer.
 *
 * WHAT IS NOT DROPPED IN THE PROCESS, and this is the half Members & Access left out:
 * `requireView` is three checks, not one — `requireFamilyActive`, then `requireTier`, then the
 * permission test — and only the third is being widened here. Both of the others are called
 * explicitly above the grants, in the same order, so a removed family still lands on the
 * notice that explains it and a tier boundary still redirects to `/upgrade`. Copying the
 * union-of-grants shape without those two lines is how this goes wrong later.
 *
 * `requireFamilyActive` is called on `'gatherings'` rather than once per key, which is exact
 * rather than a shortcut: it consults `REMOVED_FAMILY_RESOURCES` and neither key is on it, so
 * the two would answer identically.
 *
 * `requireTier` IS ALSO CALLED ON `'gatherings'` AND IS NO LONGER THE WHOLE TIER STORY. It was
 * until 2026-08-19, when both entries said `tier: 'free'` and the longest-prefix match could
 * not change the answer. `/gatherings/my-tasks` is `tier: 'standard'` now, so the guard above
 * checks the FREE half — the right thing for a page whose own key is Free, since a Free family
 * must still reach its gatherings — and the My Tasks pane ands `tierAllows()` in for itself
 * below. Both are needed and neither substitutes for the other.
 *
 * ── THE ORDER OF THIS FUNCTION IS ITS SECURITY MODEL ────────────────────────────────
 * Guards, then GRANTS, then fetches — and the fetch pass passes `Promise.resolve([])` in place
 * of any query the caller is not entitled to run. `getSchedulableTemplates` reads the template
 * library on the ADMIN client (a template keys on `admin/gathering-templates:view`, which a
 * member holding only `gatherings:create` will not have), so calling it for somebody who
 * cannot schedule would publish the family's template names into the RSC payload of a screen
 * with no Schedule button on it. Props are serialized whether a component renders them or not
 * — AGENTS.md §5, and the reason this is two passes rather than one.
 *
 * BOTH PANES ARE FETCHED UP FRONT for a caller entitled to them, because switching panes is a
 * `replaceState` rather than a navigation (see the shell). A pane fetched only when active
 * would render empty the moment somebody clicked across to it.
 *
 * ── `canAny`, NOT `can`, FOR `gatherings:create` ────────────────────────────────────
 * Because that is exactly what `scheduleGathering` and `getSchedulableTemplates` demand:
 * `requireScope(resource, action)` resolves through `canAny`, so scope `'own'` does not
 * authorize a create. Resolving it any other way here would offer a dialog whose action then
 * answers "Not authorized" — the failure "gate the fetch, not the button" exists to prevent,
 * running in the other direction.
 *
 * `gatherings/my-tasks:view` is `can`, not `canAny`, and the asymmetry is the point: `'own'` is
 * *exactly* what that pane shows, so scope 'own' is a complete reason to open it.
 * `getMyGatheringTasks` then gates itself with `requireMember()` rather than with this key —
 * answering a task somebody handed you is self-service, the same class as an RSVP or a chat
 * message, and gating the ROWS on a view grant would let a family switch off a member's own
 * to-do list. The key hides the SCREEN; membership decides the rows.
 *
 * ── THE CLOCK IS READ HERE, AND ONLY HERE ───────────────────────────────────────────
 * `getGatherings` deliberately does NOT split its own list: `gatheringTiming` takes `today` as
 * a parameter for the reason every date helper in this codebase does, and an action that split
 * the list would bake one server's idea of today into a cached payload. So the split happens in
 * the page — a server component, where reading the clock is neither a hydration risk nor a
 * `react-hooks/purity` violation. Doing it inside a client component instead would run
 * `todayLocal()` once during SSR and again in the browser, and a family spread across
 * timezones would hydrate one gathering into the wrong half. The same string is handed to the
 * tasks pane, which marks an overdue task by comparing against it.
 */
export default async function GatheringsPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // `requireView`, taken apart — see the essay above. Both must stay above the fetches.
  await requireFamilyActive(user.id, 'gatherings')
  await requireTier(user.id, 'gatherings')

  const [mayViewGatherings, myTasksGranted, myTasksInPlan] = await Promise.all([
    can(user.id, 'gatherings', 'view'),
    can(user.id, 'gatherings/my-tasks', 'view'),
    tierAllows(user.id, 'gatherings/my-tasks'),
  ])

  // ── MY TASKS IS STANDARD; THE GATHERING ITSELF IS FREE ──────────────────────────────
  // Added 2026-08-19. `requireTier` above resolves `getFeature('/gatherings')`, which is Free,
  // and this note used to say the two entries carried the same tier so the match could not
  // matter. It does now: the DUTIES are what Standard sells, and `/gatherings/my-tasks` has
  // its own registry row saying so. A pane resolved with `can()` alone consults no tier, so
  // without this line a Free family would be handed the assigned-work half of the feature —
  // the same hole `/admin/members` had to close by hand for Organization, and the reason that
  // page's essay is worth reading before touching this one.
  //
  // The pane is ABSENT rather than empty, and the fetch below is skipped with it (§5). No task
  // row is withheld from anybody: a Free family that had tasks keeps every one of them, and
  // `submitGatheringTask` is deliberately NOT tier-checked, so a member who is mid-answer when
  // a family lapses is never told their own work is unauthorized.
  const mayViewMyTasks = myTasksGranted && myTasksInPlan
  if (!mayViewGatherings && !mayViewMyTasks) {
    // The one caller owed the upgrade screen rather than a 404: somebody whose ONLY reason to
    // be here is their own task list, on a family whose plan does not include it. Before the
    // tier existed they got this page; `/gatherings/my-tasks` redirects here, so a bare
    // `notFound()` would answer "that does not exist" about a screen that does. Only once the
    // grant is known to be held — telling somebody with no grant at all that the family needs
    // an upgrade is a disclosure about its billing and a worse answer than the 404 a
    // restricted screen owes.
    if (myTasksGranted) redirect('/upgrade?from=%2Fgatherings%2Fmy-tasks')
    notFound()
  }

  // The two create-side grants, resolved only for a caller who is being shown the list they
  // belong to. Neither is meaningful on the tasks pane.
  const [mayCreate, templatesGranted, templatesInPlan] = mayViewGatherings
    ? await Promise.all([
      canAny(user.id, 'gatherings', 'create'),
      // Only to decide whether the "no templates yet" sentence may LINK to the library. `can`,
      // not `canAny`, because the library pane resolves through `can` — a link offered on any
      // other basis is a link to a 404.
      can(user.id, 'admin/gatherings/templates', 'view'),
      tierAllows(user.id, 'admin/gatherings/templates'),
    ])
    : [false, false, false]

  // THE PLAN AS WELL AS THE GRANT, since the library became `tier: 'standard'` on 2026-08-19.
  // It decides one link, and the grant alone would make that link a redirect to `/upgrade` —
  // offering somebody a way to fix an empty fieldset that lands them on a sales screen is worse
  // than not offering it, because the sentence beside it says what to do and the door is shut.
  const mayAuthorTemplates = templatesGranted && templatesInPlan

  const [gatherings, templates, tasks] = await Promise.all([
    mayViewGatherings ? getGatherings() : Promise.resolve([]),
    // AND THE PICKER IS TIER-GATED TOO, which is the half that is easy to miss:
    // `getSchedulableTemplates` gates on `gatherings:create` and knows nothing about the plan,
    // so a family that lapsed to Free would be offered its old templates and could instantiate
    // a whole tree of tasks from one — the paid capability, arriving through the screen meant
    // to withhold it. On Free the dialog offers none and schedules a date, which is what Free
    // sells. `scheduleGathering` is deliberately NOT tier-checked (AGENTS.md); this is the
    // screen half, and the screen half is all a tier may ever be.
    mayCreate && templatesInPlan ? getSchedulableTemplates() : Promise.resolve([]),
    mayViewMyTasks ? getMyGatheringTasks() : Promise.resolve([] as MyTaskRow[]),
  ])

  const today = todayLocal()
  const rows: GatheringRow[] = gatherings.map(gathering => ({
    ...gathering,
    // `'today'` is every day of a multi-day span, not only the first — the second day of a
    // three-day reunion is not "past", which is the whole reason `ends_on` exists.
    happeningNow: gatheringTiming(gathering.startsOn, gathering.endsOn, today) === 'today',
  }))
  const upcoming = rows.filter(r => gatheringTiming(r.startsOn, r.endsOn, today) !== 'past')
  // Newest first: a past list read soonest-first puts the family's oldest reunion at the top
  // and the one they just held at the bottom, which is the wrong end of a list nobody scrolls.
  const past = rows
    .filter(r => gatheringTiming(r.startsOn, r.endsOn, today) === 'past')
    .reverse()

  // Resolved on the SERVER so the first paint already shows the right pane and the client's
  // initial state matches the server HTML exactly, which is what keeps this free of a
  // hydration mismatch. A `?pane=` that is not one of the two, or names one this caller cannot
  // open, falls back to a pane they can see, in the rail's own order.
  const params = await searchParams
  const requested = Array.isArray(params.pane) ? params.pane[0] : params.pane
  const allowed: Record<GatheringPane, boolean> = {
    gatherings: mayViewGatherings,
    'my-tasks': mayViewMyTasks,
  }
  const initialPane: GatheringPane = isGatheringPane(requested) && allowed[requested]
    ? requested
    // Non-null: the `notFound()` above guarantees at least one of the two is true.
    : GATHERING_PANES.find(p => allowed[p])!

  return (
    <PageShell className="space-y-6">
      {/* The heading only. The sentence under it is per-pane and lives in the shell — one
          describes the family's plans and the other the reader's own to-do list, and a lede
          describing the wrong one is worse than none. */}
      <h1 className="text-3xl font-bold">Gatherings</h1>

      <GatheringsShell
        initialPane={initialPane}
        mayViewGatherings={mayViewGatherings}
        mayViewMyTasks={mayViewMyTasks}
        upcoming={upcoming}
        past={past}
        mayCreate={mayCreate}
        templates={templates}
        mayAuthorTemplates={mayAuthorTemplates}
        tasks={tasks}
        today={today}
      />
    </PageShell>
  )
}
