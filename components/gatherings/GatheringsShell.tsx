'use client'

import { useState } from 'react'
import { ClipboardCheck, PartyPopper } from 'lucide-react'
import { MainRail, type MainRailItem } from '@/components/layout/MainRail'
import { GatheringsClient, type GatheringRow } from '@/components/gatherings/GatheringsClient'
import { MyTasksClient } from '@/components/gatherings/MyTasksClient'
import { GATHERING_PANE_LEDE, type GatheringPane } from '@/lib/gathering-panes'
import type { MyTaskRow } from '@/app/actions/gatherings'

/**
 * THE `/gatherings` RAIL — the family's gatherings, and the caller's own share of them.
 *
 * ── WHY THESE TWO ARE ONE SCREEN ────────────────────────────────────────────────────
 * They were two rail items and two routes until 2026-08-19, sitting next to each other under
 * one heading and answering the same question at two scales: what is the family doing, and
 * what is being asked of me. A member arriving at "Gatherings" and finding no mention of the
 * three jobs they are holding had to notice a second row in the rail to learn about them.
 *
 * ── ONE RAIL ITEM, ONE PERMISSION RESOURCE ──────────────────────────────────────────
 * `gatherings` for the list, `gatherings/my-tasks` for the tasks — the same two keys as
 * before, unmoved, because both are still routes (`/gatherings/my-tasks` redirects here). The
 * items are built from what the caller may actually see, so a visible tab always leads
 * somewhere they can go; the rail is drawn even when only one survives, because it NAMES the
 * pane, which is what makes a single-pane screen read as one part of something.
 *
 * THE GRANTS ARE NOT ENFORCED HERE and nothing about this component is load-bearing for
 * authorization. The page resolves both keys server-side and SKIPS THE FETCH for whichever
 * pane the caller may not open (AGENTS.md §5), so nothing reaches the browser in the RSC
 * payload for somebody who cannot see it. These booleans only decide which tabs to draw.
 *
 * ── NO `action` SLOT ────────────────────────────────────────────────────────────────
 * "Schedule a gathering" stays inside `GatheringsClient`, which owns the dialog it opens and
 * the three outcomes that dialog has to render (see its header — a `success: true` carrying a
 * message must NOT navigate away). Lifting the trigger onto the rail would put it above the
 * My Tasks pane, where it means nothing, and would split a button from the state it drives.
 * `AnnouncementsShell` declines the slot for the same reason.
 *
 * ── `href` ON BOTH ITEMS, AND A `replaceState` RATHER THAN A NAVIGATION ─────────────
 * Supplying `href` renders a real `<a>`, so cmd-click, middle-click and copy-link-address
 * work and a pane is bookmarkable; a plain left click is intercepted, because a real
 * navigation refetches the RSC payload and remounts the pane — which on the My Tasks side
 * would discard a half-typed answer and every draft the cards are holding. `replaceState`
 * rather than `pushState` so Back leaves the page instead of walking the two panes, and the
 * query string is rebuilt from the live one so switching never drops another parameter.
 *
 * Switching panes DOES unmount the inactive one, so a half-typed answer is lost by a round
 * trip to Gatherings and back. That is the house behaviour on every rail in the tree and is
 * left alone deliberately: the alternative keeps a hidden pane mounted in the DOM, which buys
 * one edge case and costs a screen full of focusable controls nobody can see.
 */

interface Props {
  /** Resolved on the server from `?pane=`, so the first paint is already the right pane. */
  initialPane: GatheringPane
  /** `gatherings:view`. False means the list was not fetched at all, not merely hidden. */
  mayViewGatherings: boolean
  /** `gatherings/my-tasks:view`. Same standing: false means the tasks were never read. */
  mayViewMyTasks: boolean

  // ── The Gatherings pane ───────────────────────────────────────────────────────────
  upcoming: GatheringRow[]
  past: GatheringRow[]
  /** `gatherings:create` at scope `'any'` — what `scheduleGathering` itself demands. */
  mayCreate: boolean
  /** Only the templates this caller may schedule FROM. Empty unless `mayCreate`. */
  templates: { id: string; name: string; description: string | null }[]
  /** Whether the "no templates" sentence may link to the library. */
  mayAuthorTemplates: boolean

  // ── The My Tasks pane ─────────────────────────────────────────────────────────────
  tasks: MyTaskRow[]
  /** `todayLocal()` from the page — never read in a component. */
  today: string
}

export function GatheringsShell({
  initialPane, mayViewGatherings, mayViewMyTasks,
  upcoming, past, mayCreate, templates, mayAuthorTemplates,
  tasks, today,
}: Props) {
  const [pane, setPane] = useState<GatheringPane>(initialPane)

  function selectPane(next: GatheringPane) {
    setPane(next)
    // Rebuilt from the live search string so switching never drops another param, and
    // `replaceState` so Back leaves the page instead of walking the two panes.
    const params = new URLSearchParams(window.location.search)
    params.set('pane', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }

  // The count rides on the tab, because "am I holding anything?" is the question this pane
  // exists to answer and a member should not have to open it to find out. Only what is
  // genuinely waiting on them is counted — an approved task is finished, and a number that
  // never goes down is not a prompt.
  const waiting = tasks.filter(t => t.status === 'open' || t.status === 'denied').length

  const items: MainRailItem<GatheringPane>[] = [
    ...(mayViewGatherings ? [{
      id: 'gatherings' as const,
      label: 'Gatherings',
      icon: PartyPopper,
      href: '/gatherings',
    }] : []),
    ...(mayViewMyTasks ? [{
      id: 'my-tasks' as const,
      label: waiting > 0 ? `My Tasks (${waiting})` : 'My Tasks',
      icon: ClipboardCheck,
      href: '/gatherings?pane=my-tasks',
    }] : []),
  ]

  return (
    <div className="space-y-5">
      <MainRail
        label="Gathering areas"
        items={items}
        active={pane}
        onSelect={selectPane}
      />

      <p className="text-muted-foreground">{GATHERING_PANE_LEDE[pane]}</p>

      {/* Both conjuncts are kept: the page falls back to a pane the caller can see, so the
          second should never decide anything — which is exactly why it is written down. A
          stale `?pane=` plus a grant removed mid-session must not render a pane over `[]` and
          call it empty. */}
      {pane === 'gatherings' && mayViewGatherings && (
        <GatheringsClient
          upcoming={upcoming}
          past={past}
          mayCreate={mayCreate}
          templates={templates}
          mayAuthorTemplates={mayAuthorTemplates}
        />
      )}

      {pane === 'my-tasks' && mayViewMyTasks && (
        <MyTasksClient initialTasks={tasks} today={today} />
      )}
    </div>
  )
}
