import type { T } from '@/lib/i18n/t'

/**
 * The `/community/announcements` rail's vocabulary — the pane ids, their order, and the sentence under
 * each one.
 *
 * ── WHY THIS IS A MODULE OF ITS OWN AND NOT A CONST IN THE SHELL ────────────────────
 * It was a const in the shell, and that was a BUG rather than an untidiness. A Server
 * Component that imports a value from a `'use client'` module does not get the value: the
 * bundler replaces the import with a client REFERENCE, so the page's
 * `(ANNOUNCEMENT_PANES as readonly string[]).includes(...)` threw
 *
 *     TypeError: ….ANNOUNCEMENT_PANES.includes is not a function
 *
 * on every load of `/community/announcements`, and the whole page rendered the error boundary. Type-only
 * imports across that boundary are erased and so are fine; a runtime VALUE never is.
 *
 * The same rule is already written down elsewhere in this tree for the same reason —
 * `components/admin/account-sections.ts` says it in its first paragraph, and `lib/help/
 * content.ts` is pure so three surfaces can read one chapter. This file is that shape: no
 * React, no icons, no `server-only`, nothing that would drag a boundary into either side's
 * module graph. The ICONS stay in the shell, because a lucide import is a client concern.
 *
 * ── THREE PANES, THREE KEYS ─────────────────────────────────────────────────────────
 *   general    the notice board                    `announcements`
 *   updates    the archive of everything sent      `updates`
 *   birthdays  who is next, inside the horizon     `announcements/birthdays`
 *
 * One rail item, one permission resource (AGENTS.md). `updates` was a route of its own until
 * 2026-08-19 and still is one — `/community/updates` redirects here — which is why it keeps its own key
 * rather than becoming a sub-key of `announcements`: the key is the route without its leading
 * slash, and the route still exists.
 */

/** In rail order. The PAGE validates `?pane=` against this, and the shell draws it. */
export const ANNOUNCEMENT_PANES = ['general', 'updates', 'birthdays'] as const

export type AnnouncementPane = typeof ANNOUNCEMENT_PANES[number]

/** A `?pane=` that arrived from a URL, checked. */
export function isAnnouncementPane(value: unknown): value is AnnouncementPane {
  return typeof value === 'string' && (ANNOUNCEMENT_PANES as readonly string[]).includes(value)
}

/**
 * The sentence under the rail, per pane — or `null` where the pane needs none.
 *
 * ── MOST OF THESE WENT ON 2026-08-25, AND THE SURVIVORS SAY WHY ────────────────────
 * The app-wide sweep of pane ledes is argued in `components/admin/family-settings.ts`, and
 * the rule it leaves is that a line of prose above a pane earns its place only when it states
 * a fact the screen cannot show. Two here do and one did not:
 *
 *   general      KEPT. Where a pinned post ends up — the top of every relative's Recent
 *                Updates, until each of them dismisses it — happens on somebody ELSE'S
 *                screen. Nothing on this pane can show it, and it is the difference between
 *                pinning something and posting it.
 *   updates      REMOVED. "Everything the family has announced… newest first, searchable" is
 *                a description of a searchable list, printed above a searchable list.
 *   birthdays    KEPT, REWRITTEN. It used to spend its second sentence saying that nothing is
 *                sent automatically. The horizon is the more useful fact and the one a reader
 *                will otherwise get wrong: a relative whose birthday is in four months is
 *                absent from this list, and without the window that reads as a missing person
 *                rather than as a list that has not reached them yet.
 *
 * The birthday horizon is interpolated from `BIRTHDAY_HORIZON_DAYS` for the reason that
 * constant exists: it is stated in the arithmetic, in the pane's empty state and in the manual
 * chapter, and a hand-typed "60" in any of them is a sentence that eventually disagrees with
 * the list underneath it.
 *
 * NULL RATHER THAN AN EMPTY STRING, so the shell renders no element at all. An empty `<p>`
 * still occupies its margin, which is the gap the sweep was removing.
 */
export function paneLede(
  t: T,
  pane: AnnouncementPane,
  birthdayHorizonDays: number,
): string | null {
  switch (pane) {
    case 'general':
      return t('ann.lede.general')
    case 'updates':
      return null
    case 'birthdays':
      // THE HORIZON IS STILL INTERPOLATED, and it is now interpolated by `t` rather than by a
      // template literal — for the reason the paragraph above gives: the number is stated in
      // the arithmetic, in the empty state and in the manual, and a hand-typed "60" in any of
      // them eventually disagrees with the list underneath it. A translation carries `{days}`
      // twice and `i18n:check` reports it if either goes missing.
      return t('ann.lede.birthdays', { days: birthdayHorizonDays })
  }
}
