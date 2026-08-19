'use client'

import { useState } from 'react'
import { Cake, Megaphone } from 'lucide-react'
import { MainRail, type MainRailItem } from '@/components/layout/MainRail'
import { AnnouncementBoard } from '@/components/announcements/AnnouncementBoard'
import { BirthdaysPane } from '@/components/announcements/BirthdaysPane'
import { BIRTHDAY_HORIZON_DAYS, type UpcomingBirthday } from '@/lib/birthdays'
import type { Announcement, Chapter } from '@/app/actions/announcements'
import type { PermissionScope } from '@/lib/auth/permissions'

/**
 * THE `/announcements` RAIL — the notice board, and whose birthday is next.
 *
 * ── WHY THESE TWO ARE ONE SCREEN ────────────────────────────────────────────────────
 * They answer one question in two tenses: what the family has been TOLD, and what the
 * family should be told SOON. A birthday is not an announcement — it has no row, no author
 * and nothing to pin — but it is the commonest reason anybody writes one, so it belongs a
 * click from the composer rather than behind a route of its own.
 *
 * ── ONE RAIL ITEM, ONE PERMISSION RESOURCE ──────────────────────────────────────────
 * `announcements` for the board, `announcements/birthdays` for the pane (registered by
 * 20260819000002 §B with `view` and nothing else, because nothing WRITES a birthday). The
 * items are built from what the caller may actually see, so a visible tab always leads
 * somewhere they can go — the shape `AdminAccessClient` established for its three tabs.
 * The rail is rendered even when only one item survives: it names the pane, which is what
 * makes a single-pane screen read as one half of something rather than as the whole of it.
 *
 * THE GRANTS ARE NOT ENFORCED HERE and nothing about this component is load-bearing for
 * authorization. The page resolves both keys server-side and — the half that matters —
 * SKIPS THE FETCH for whichever pane the caller may not open, so the roster never reaches
 * the browser in the RSC payload for somebody who cannot see it (AGENTS.md §5). What arrives
 * here is already the answer; these booleans only decide which tabs to draw over it.
 *
 * ── `href` ON BOTH ITEMS, AND A `replaceState` RATHER THAN A NAVIGATION ─────────────
 * Supplying `href` renders a real `<a>`, so cmd-click, middle-click and copy-link-address
 * work and a pane is bookmarkable; a plain left click is intercepted, because a real
 * navigation refetches the RSC payload and remounts the pane — which on the General side
 * would discard a half-typed announcement and every optimistic row the board is holding.
 * `replaceState` rather than `pushState` so Back leaves the page instead of walking the two
 * panes, and the query string is rebuilt from the live one so switching never drops another
 * parameter. Both are `MainRail`'s documented contract (AGENTS.md, "The main rail is a
 * standard component").
 *
 * Switching panes DOES unmount the inactive one, so the composer is reset by a round trip to
 * Birthdays and back. That is the house behaviour on every rail in the tree (Transactions,
 * Accounting, Members & Access) and is left alone deliberately: the alternative is keeping a
 * hidden pane mounted in the DOM, which buys one edge case and costs a screen full of
 * focusable controls nobody can see.
 *
 * ── THE LEDE MOVED OFF THE PAGE AND INTO HERE ───────────────────────────────────────
 * It had to. The sentence under the heading used to be about pinning, which is true of the
 * board and meaningless over a birthday list, and a lede that describes the wrong pane is
 * worse than none. The `h1` stays on the page, where a server component owns it; the
 * per-pane sentence is a plain string switched on the active pane, so it cannot drift out of
 * step with what is drawn below it.
 *
 * ── NO `useServerState`, AND NO KEY ON THE PANE ──────────────────────────────────────
 * The only state here is which pane is open, which is the genuinely UI-local kind AGENTS.md
 * exempts — nothing is seeded from a family-scoped prop and nothing is written back. Every
 * prop is passed straight down; `AnnouncementBoard` already keeps its own list on
 * `useServerState`, and `BirthdaysPane` holds nothing but a search string. A family switch
 * remounts all of it through `<main key={familyCode}>` in the protected layout.
 */

/** In rail order. Exported so the PAGE can validate `?pane=` against one list. */
export const ANNOUNCEMENT_PANES = ['general', 'birthdays'] as const

export type AnnouncementPane = typeof ANNOUNCEMENT_PANES[number]

/**
 * The sentence under the rail, per pane.
 *
 * The horizon is interpolated from `BIRTHDAY_HORIZON_DAYS` for the reason that constant
 * exists: it is stated in the arithmetic, in the pane's empty state and in the manual
 * chapter, and a hand-typed "60" in any of them is a sentence that eventually disagrees with
 * the list underneath it.
 */
const PANE_LEDE: Record<AnnouncementPane, string> = {
  general:
    'News from across your family. Pinned posts ride at the top of everyone’s Recent '
    + 'Updates until each person dismisses them.',
  birthdays:
    `Every relative with a birthday in the next ${BIRTHDAY_HORIZON_DAYS} days, soonest first. `
    + 'Nothing is sent automatically — this is the list, and posting the greeting is still '
    + 'somebody’s job.',
}

interface Props {
  /** Resolved on the server from `?pane=`, so the first paint is already the right pane. */
  initialPane: AnnouncementPane
  /** `announcements:view`. False means the board was not fetched at all, not merely hidden. */
  mayViewBoard: boolean
  /** `announcements/birthdays:view`. Same standing: false means the roster was never read. */
  mayViewBirthdays: boolean

  // ── The General pane, straight through to the board ────────────────────────────────
  initialAnnouncements: Announcement[]
  chapters: Chapter[]
  /** May post at all. A family can switch this off for ordinary members. */
  canPost: boolean
  /** May pin family-wide — `announcements:edit` at scope 'any'. */
  canPin: boolean
  /** 'none', 'own' (their own posts) or 'any'. */
  deleteScope: PermissionScope
  /** The caller's people.id in this family, for the 'own' case. */
  myPersonId: string

  // ── The Birthdays pane ────────────────────────────────────────────────────────────
  /** Already sorted, soonest first, by `lib/birthdays.ts`. Empty when not fetched. */
  birthdays: UpcomingBirthday[]
}

export function AnnouncementsShell({
  initialPane, mayViewBoard, mayViewBirthdays,
  initialAnnouncements, chapters, canPost, canPin, deleteScope, myPersonId,
  birthdays,
}: Props) {
  const [pane, setPane] = useState<AnnouncementPane>(initialPane)

  function selectPane(next: AnnouncementPane) {
    setPane(next)
    // Rebuilt from the live search string so switching never drops another param, and
    // `replaceState` so Back leaves the page instead of walking the two panes.
    const params = new URLSearchParams(window.location.search)
    params.set('pane', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }

  const items: MainRailItem<AnnouncementPane>[] = [
    ...(mayViewBoard ? [{
      id: 'general' as const,
      label: 'General',
      icon: Megaphone,
      href: '/announcements?pane=general',
    }] : []),
    ...(mayViewBirthdays ? [{
      id: 'birthdays' as const,
      label: 'Birthdays',
      icon: Cake,
      href: '/announcements?pane=birthdays',
    }] : []),
  ]

  return (
    <div className="space-y-5">
      {/* No `action` slot. The board's composer is not a "New…" trigger — it is a form that
          belongs inside the pane it posts to, and lifting it onto the rail would put it above
          the Birthdays pane where it means nothing. */}
      <MainRail
        label="Announcement areas"
        items={items}
        active={pane}
        onSelect={selectPane}
      />

      <p className="text-muted-foreground">{PANE_LEDE[pane]}</p>

      {/* The active pane, and only ever the pane the caller may open. Both conjuncts are
          kept: the page falls back to a pane the caller can see, so the second half should
          never decide anything — which is exactly why it is written down. A stale `?pane=`
          plus a grant removed mid-session must not render a pane over `[]` and call it
          empty. */}
      {pane === 'general' && mayViewBoard && (
        <AnnouncementBoard
          initialAnnouncements={initialAnnouncements}
          chapters={chapters}
          canPost={canPost}
          canPin={canPin}
          deleteScope={deleteScope}
          myPersonId={myPersonId}
        />
      )}

      {pane === 'birthdays' && mayViewBirthdays && (
        <BirthdaysPane birthdays={birthdays} />
      )}
    </div>
  )
}
