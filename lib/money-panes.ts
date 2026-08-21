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

/**
 * The sentence under the rail, per pane.
 *
 * These are the two `blurb`s the separate `FEATURES` entries carried before the merge, kept
 * word for word — they were written for exactly this job (telling a member what the screen
 * answers) and the merged entry can only carry one of them. This is where the other one went.
 */
export const MONEY_PANE_LEDE: Record<MoneyPane, string> = {
  dues: 'Every schedule you are on, what each installment costs, and when the next one falls due.',
  donations: 'The drives your family is running, how far each has got, and what you have given.',
}
