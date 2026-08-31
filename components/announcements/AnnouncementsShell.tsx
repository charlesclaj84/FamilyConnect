'use client'

import { useState } from 'react'
import { Cake, Inbox, Megaphone } from 'lucide-react'
import { MainRail, type MainRailItem } from '@/components/layout/MainRail'
import { AnnouncementBoard } from '@/components/announcements/AnnouncementBoard'
import { BirthdaysPane } from '@/components/announcements/BirthdaysPane'
import { UpdatesArchiveClient } from '@/components/updates/UpdatesArchiveClient'
import { BIRTHDAY_HORIZON_DAYS, type UpcomingBirthday } from '@/lib/birthdays'
import type { BirthdayPromptPage } from '@/app/actions/birthdays'
import { paneLede, type AnnouncementPane } from '@/lib/announcement-panes'
import type { Announcement, Chapter } from '@/app/actions/announcements'
import type { UpdatesArchive } from '@/app/actions/updates'
import type { PermissionScope } from '@/lib/auth/permissions'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * THE `/community/announcements` RAIL — the notice board, the archive of everything sent, and whose
 * birthday is next.
 *
 * ── WHY THESE THREE ARE ONE SCREEN ──────────────────────────────────────────────────
 * They are one question in three tenses: what the family is being told NOW (the board), what
 * it has been told and had sent to it (the archive), and what it should be told SOON (a
 * birthday). A birthday is not an announcement — it has no row, no author and nothing to pin —
 * but it is the commonest reason anybody writes one, so it belongs a click from the composer
 * rather than behind a route of its own. The archive was `/community/updates`, a destination of its own
 * in the rail, and read as a THIRD place the family's news lived; that route still exists and
 * redirects here, so every link anybody has shared still lands on the same list.
 *
 * ── ONE RAIL ITEM, ONE PERMISSION RESOURCE ──────────────────────────────────────────
 * `announcements` for the board, `updates` for the archive, `announcements/birthdays` for the
 * pane. The items are built from what the caller may actually see, so a visible tab always
 * leads somewhere they can go — the shape `AdminAccessClient` established for its tabs. The
 * rail is rendered even when only one item survives: it names the pane, which is what makes a
 * single-pane screen read as one part of something rather than as the whole of it.
 *
 * THE GRANTS ARE NOT ENFORCED HERE and nothing about this component is load-bearing for
 * authorization. The page resolves all three keys server-side and — the half that matters —
 * SKIPS THE FETCH for whichever pane the caller may not open, so nothing reaches the browser
 * in the RSC payload for somebody who cannot see it (AGENTS.md §5). What arrives here is
 * already the answer; these booleans only decide which tabs to draw over it.
 *
 * ── THE PANE VOCABULARY LIVES IN `lib/announcement-panes.ts`, NOT HERE ──────────────
 * It used to be a `const` exported from this file, and the page imported it to validate
 * `?pane=`. A Server Component importing a runtime value out of a `'use client'` module gets a
 * client REFERENCE rather than the value, so that `.includes()` threw and the whole page
 * rendered the error boundary. Type-only imports across the boundary are erased and are fine;
 * a value never is. Keep ids, order and ledes in the pure module.
 *
 * ── `href` ON EVERY ITEM, AND A `replaceState` RATHER THAN A NAVIGATION ─────────────
 * Supplying `href` renders a real `<a>`, so cmd-click, middle-click and copy-link-address
 * work and a pane is bookmarkable; a plain left click is intercepted, because a real
 * navigation refetches the RSC payload and remounts the pane — which on the General side
 * would discard a half-typed announcement and every optimistic row the board is holding.
 * `replaceState` rather than `pushState` so Back leaves the page instead of walking the
 * panes, and the query string is rebuilt from the live one so switching never drops another
 * parameter. Both are `MainRail`'s documented contract.
 *
 * THE ARCHIVE IS THE ONE PANE THAT DOES NAVIGATE, and only from inside itself. Searching and
 * "show older" are `?q=` and `?pages=` resolved on the SERVER, because the merge of two tables
 * in date order is the feature and a second implementation in the browser would be free to
 * disagree with `lib/updates-archive.ts`. So the pane is handed the base href to build those
 * links on, which is this page and its `?pane=updates` rather than the old `/community/updates`.
 *
 * ── NO `useServerState`, AND NO KEY ON THE PANE ──────────────────────────────────────
 * The only state here is which pane is open, which is the genuinely UI-local kind AGENTS.md
 * exempts — nothing is seeded from a family-scoped prop and nothing is written back. Every
 * prop is passed straight down; `AnnouncementBoard` already keeps its own list on
 * `useServerState`, `UpdatesArchiveClient` holds only its search box the same way, and
 * `BirthdaysPane` holds nothing but a search string. A family switch remounts all of it
 * through `<main key={familyCode}>` in the protected layout.
 */

interface Props {
  /** Resolved on the server from `?pane=`, so the first paint is already the right pane. */
  initialPane: AnnouncementPane
  /** `announcements:view`. False means the board was not fetched at all, not merely hidden. */
  mayViewBoard: boolean
  /** `updates:view`. Same standing: false means the archive was never read. */
  mayViewUpdates: boolean
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

  // ── The Updates pane ──────────────────────────────────────────────────────────────
  /** One page of the merged archive, or null when it was not fetched. */
  archive: UpdatesArchive | null

  // ── The Birthdays pane ────────────────────────────────────────────────────────────
  /** Already sorted, soonest first, by `lib/birthdays.ts`. Empty when not fetched. */
  birthdays: UpcomingBirthday[]
  /**
   * The two-week composer prompt, or null when it was not fetched.
   *
   * A SECOND PROP rather than folded into `birthdays`, because the two are gated on
   * different grants: the list needs `community/announcements/birthdays:view` and the
   * prompt needs `community/announcements:view` plus `:create` for the composer. A caller
   * can hold either without the other, and merging them would mean resolving one grant and
   * rendering on the strength of the other.
   */
  birthdayPrompts: BirthdayPromptPage | null
  /** The reader's language, resolved by the page. See lib/i18n/catalogues.ts. */
  locale: string
}

export function AnnouncementsShell({
  initialPane, mayViewBoard, mayViewUpdates, mayViewBirthdays,
  initialAnnouncements, chapters, canPost, canPin, deleteScope, myPersonId,
  archive, birthdays, birthdayPrompts, locale,
}: Props) {
  const t = useT()
  const [pane, setPane] = useState<AnnouncementPane>(initialPane)

  function selectPane(next: AnnouncementPane) {
    setPane(next)
    // Rebuilt from the live search string so switching never drops another param, and
    // `replaceState` so Back leaves the page instead of walking the panes.
    const params = new URLSearchParams(window.location.search)
    params.set('pane', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }

  const items: MainRailItem<AnnouncementPane>[] = [
    ...(mayViewBoard ? [{
      id: 'general' as const,
      label: t('ann.pane.general'),
      icon: Megaphone,
      href: '/community/announcements?pane=general',
    }] : []),
    ...(mayViewUpdates ? [{
      id: 'updates' as const,
      label: t('ann.pane.updates'),
      icon: Inbox,
      href: '/community/announcements?pane=updates',
    }] : []),
    ...(mayViewBirthdays ? [{
      id: 'birthdays' as const,
      label: t('ann.pane.birthdays'),
      icon: Cake,
      href: '/community/announcements?pane=birthdays',
    }] : []),
  ]

  const lede = paneLede(t, pane, BIRTHDAY_HORIZON_DAYS)

  return (
    <div className="space-y-5">
      {/* No `action` slot. The board's composer is not a "New…" trigger — it is a form that
          belongs inside the pane it posts to, and lifting it onto the rail would put it above
          the other two panes where it means nothing. */}
      <MainRail
        label={t('ann.rail')}
        items={items}
        active={pane}
        onSelect={selectPane}
      />

      {/* NOT EVERY PANE HAS ONE. `paneLede` answers null for Updates, whose lede described a
          searchable list to somebody looking at a searchable list; rendering an empty `<p>`
          would leave its margin behind, which is the gap the 2026-08-25 sweep removed. */}
      {lede && <p className="text-muted-foreground">{lede}</p>}

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

      {pane === 'updates' && mayViewUpdates && archive && (
        // `basePath` and `keepParams` so the archive's own `?q=` and `?pages=` links come back
        // to THIS pane. Without them it would navigate to `/community/updates`, which redirects here —
        // one extra hop, and a Back button that walks through redirects.
        <UpdatesArchiveClient
          archive={archive}
          basePath="/community/announcements"
          keepParams={{ pane: 'updates' }}
        locale={locale}
        />
      )}

      {pane === 'birthdays' && mayViewBirthdays && (
        <BirthdaysPane birthdays={birthdays} prompts={birthdayPrompts} />
      )}
    </div>
  )
}
