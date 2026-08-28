/**
 * The `/accounting/dues-and-donations` rail's vocabulary — the two pane ids and the sentence
 * under each.
 *
 * ── WHY THIS IS A MODULE OF ITS OWN AND NOT A CONST IN THE SHELL ────────────────────
 * The same reason `lib/announcement-panes.ts` is, and that one was a BUG rather than an
 * untidiness: a Server Component importing a runtime value from a `'use client'` module gets a
 * client REFERENCE, not the value, so the page's `(PANES as readonly string[]).includes(…)`
 * throws `.includes is not a function` and the whole route renders its error boundary. The
 * page validates `?pane=` and the shell draws the rail, so both sides need this — which means
 * it has to be pure. No React, no icons, no `server-only`. The ICONS live in the shell,
 * because a lucide import is a client concern.
 *
 * ── TWO PANES, ONE KEY, AND THAT IS THE UNUSUAL PART ────────────────────────────────
 * Most panes in this product carry their own permission resource — `/admin/members` spans
 * four, `/community/announcements` three. These two do not: `accounting/dues` and
 * `accounting/donations` were merged into `accounting/dues-and-donations` by
 * `20260820000009`, on AGENTS.md's own test for when two keys were really one job ("If a
 * family could never sensibly hold one and not the other…").
 *
 * So the page resolves ONE grant and the rail is a plain two-item switch with no per-pane
 * gating — which is why there is no `paneResource` map here and why adding one would be a
 * mistake rather than an improvement. If a third pane ever arrives that a family might
 * withhold on its own, it needs a key of its own and this module needs the map; until then,
 * inventing one would be a control nothing consults.
 */

/** In rail order. Dues first: what you OWE is the more urgent of the two. */
export const MONEY_PANES = ['dues', 'donations'] as const

export type MoneyPane = typeof MONEY_PANES[number]

/** A `?pane=` that arrived from a URL, checked. */
export function isMoneyPane(value: unknown): value is MoneyPane {
  return typeof value === 'string' && (MONEY_PANES as readonly string[]).includes(value)
}

/** Landing pane when `?pane=` is absent or unreadable. */
export const DEFAULT_MONEY_PANE: MoneyPane = 'dues'

/** Parse a `?pane=`, falling back to the default. Use this for URL input. */
export function resolveMoneyPane(raw: string | string[] | undefined | null): MoneyPane {
  const value = Array.isArray(raw) ? raw[0] : raw
  return isMoneyPane(value) ? value : DEFAULT_MONEY_PANE
}

export const MONEY_PANE_LABEL: Record<MoneyPane, string> = {
  dues: 'Dues',
  donations: 'Donations',
}

/*
 * ── `MONEY_PANE_LEDE` WAS HERE AND WAS DELETED ON 2026-08-25 ──────────────────────
 * A sentence under the rail per pane, carried over from the `blurb`s the two separate
 * `FEATURES` entries held before the merge. Keeping them was the right instinct about not
 * losing copy and the wrong place to put it: a `blurb` is written to describe a screen to
 * somebody who is NOT on it — that is what it does in the rail and on the marketing surfaces
 * — and the same words printed at the top of the screen itself tell a reader what they are
 * already looking at.
 *
 * Both panes answer their own question in their first row: the dues pane opens on the
 * schedules with their next due dates, the donations pane on the drives with their progress
 * bars. Part of the app-wide sweep of these — see `components/admin/family-settings.ts` for
 * the argument in full, and the rule that a line of prose above a pane has to carry a fact
 * the screen cannot show.
 */
