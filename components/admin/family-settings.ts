/**
 * The vocabulary of Family Settings, in a plain module because a `'use server'` file
 * may only export async functions — so the resource key the action gates on and the
 * page guards on cannot live beside either of them.
 *
 * Same arrangement, and the same reason, as LEDGER_RESOURCE in
 * components/transactions/ledgers.ts: one table binding the surface to the permission
 * key, so the page, the action and the RLS policy cannot drift into disagreeing about
 * which grant decides this screen.
 */

/**
 * The one resource key governing the page, its fetch and its one write.
 *
 * Registered by 20260812000000 with actions view + edit only. There is no `create`
 * because families are created from /my-families by any member, and no `delete`
 * because deleting a family is not built — nothing has a foreign key to `families`,
 * so a DELETE would remove one row and orphan the other 34 tables' worth.
 */
export const FAMILY_RESOURCE = 'admin/settings'

/**
 * The separate grant that admits removing the family, declaring the single action
 * `delete` (20260817000006 §4).
 *
 * NOT a third action on `admin/family`, and the reason is worth keeping beside the key
 * rather than only in the migration: 20260812000000 deliberately narrowed that resource to
 * view + edit, DELETEs any create/delete grant for it, and asserts none exists. Folding
 * removal in there would put this code in conflict with an applied assertion — and, more
 * to the point, would make the grant to RENAME a family the grant to END it.
 *
 * There is no `view`. Removal has no screen of its own: the control lives at the bottom of
 * /admin/family, which has its own view grant, so a view switch here would be a control
 * nothing reads.
 */
export const REMOVE_FAMILY_RESOURCE = 'admin/settings/remove'

/** Matches the limit create_family() applies, so a family cannot be renamed to
 *  something it could not have been created as. */
export const MAX_FAMILY_NAME = 100

/**
 * ── THE RAIL'S VOCABULARY: TWO PANES, ONE KEY ──────────────────────────────────────
 * Settings is a `MainRail` of two panes — the plan, and the family itself. It was two
 * stacked panels on one screen until 2026-08-22, and the panels were two headings over one
 * scroll before that; a rail is what the other multi-pane screens in the product use, and
 * what this one is now asked to look like.
 *
 * ── WHY THIS LIVES HERE AND NOT IN THE SHELL ───────────────────────────────────────
 * `lib/money-panes.ts` states the argument in full and it applies unchanged: the PAGE
 * validates `?pane=` and the `'use client'` shell draws the rail, so both sides need these
 * values — and a Server Component importing a runtime value from a client module gets a
 * client REFERENCE rather than the value, so `(PANES as readonly string[]).includes(…)`
 * throws `.includes is not a function` and the whole route renders its error boundary. This
 * module is already the pure one for this screen (it is where FAMILY_RESOURCE lives, for the
 * same class of reason), so the vocabulary goes here rather than in a new file. No React and
 * no icons: a lucide import is a client concern and stays in the shell.
 *
 * ── ONE KEY GOVERNS BOTH, WHICH IS THE UNUSUAL PART ────────────────────────────────
 * AGENTS.md's default is one rail item per `permission_resources` row — `/admin/members`
 * spans four keys, `/community/announcements` three. These two panes span ONE,
 * `admin/settings`, exactly as `/accounting/dues-and-donations` does: a caller who is on this
 * screen may see both halves by definition, so there is no `paneResource` map here and adding
 * one would be a control nothing consults. The one grant that IS separate —
 * `admin/settings/remove` — gates a control inside the Family pane rather than a pane of its
 * own, and is resolved on the server as `FamilySettings.canRemove`.
 *
 * If a third pane ever arrives that a family might sensibly withhold on its own, it needs a
 * key, a migration and a map here. Until then the rail is a plain two-item switch.
 */
export const SETTINGS_PANES = ['plan', 'family'] as const

export type SettingsPane = typeof SETTINGS_PANES[number]

/** A `?pane=` that arrived from a URL, checked. */
export function isSettingsPane(value: unknown): value is SettingsPane {
  return typeof value === 'string' && (SETTINGS_PANES as readonly string[]).includes(value)
}

/**
 * Landing pane when `?pane=` is absent or unreadable.
 *
 * THE PLAN, and it has led this screen since 2026-08-13 for a reason that survived the
 * rewrite into a rail: the name and the code are set once and then left alone, while the plan
 * is what decides which pages the family has at all — so it is what somebody opening Settings
 * is most often here to see or to change.
 */
export const DEFAULT_SETTINGS_PANE: SettingsPane = 'plan'

/** Parse a `?pane=`, falling back to the default. Use this for URL input. */
export function resolveSettingsPane(raw: string | string[] | undefined | null): SettingsPane {
  const value = Array.isArray(raw) ? raw[0] : raw
  return isSettingsPane(value) ? value : DEFAULT_SETTINGS_PANE
}

export const SETTINGS_PANE_LABEL: Record<SettingsPane, string> = {
  plan: 'Plan',
  family: 'Family',
}

/**
 * The sentence under the rail, per pane.
 *
 * These were the two panel ledes, kept word for word. A panel header could carry its lede
 * beside its heading; a rail item is one word, so the sentence moves under the rail — which
 * is what `/accounting/dues-and-donations` does with the same problem.
 */
export const SETTINGS_PANE_LEDE: Record<SettingsPane, string> = {
  plan: 'Which subscription this family is on, and what moving between them does.',
  family: 'What this family is called, the code relatives join it with, and switching it off. '
    + 'Nothing here is ever deleted.',
}
