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
 * The sentence under the rail, per pane.
 *
 * The birthday horizon is interpolated from `BIRTHDAY_HORIZON_DAYS` for the reason that
 * constant exists: it is stated in the arithmetic, in the pane's empty state and in the manual
 * chapter, and a hand-typed "60" in any of them is a sentence that eventually disagrees with
 * the list underneath it.
 */
export function paneLede(pane: AnnouncementPane, birthdayHorizonDays: number): string {
  switch (pane) {
    case 'general':
      return 'News from across your family. Pinned posts ride at the top of everyone’s Recent '
        + 'Updates until each person dismisses them.'
    case 'updates':
      return 'Everything the family has announced and everything that has been sent to you, '
        + 'newest first — searchable, however far back it goes.'
    case 'birthdays':
      return `Every relative with a birthday in the next ${birthdayHorizonDays} days, soonest `
        + 'first. Nothing is sent automatically — this is the list, and posting the greeting is '
        + 'still somebody’s job.'
  }
}
