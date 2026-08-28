import type { T } from '@/lib/i18n/t'

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
 * ── THE RAIL'S VOCABULARY: THREE PANES, ONE KEY ────────────────────────────────────
 * Settings is a `MainRail` of three panes — what the family has paid, the plan, and the
 * family itself. It was two stacked panels on one screen until 2026-08-22, and the panels
 * were two headings over one scroll before that; a rail is what the other multi-pane screens
 * in the product use, and what this one is now asked to look like.
 *
 * ── BILLING BECAME A PANE ON 2026-08-25, AND THE SPLIT IS THE POINT ────────────────
 * It was a second band underneath `PlanPanel` inside the Plan pane, which put a CATALOGUE and
 * a LEDGER on one scroll and then made the plan rows point downwards at the buttons that
 * actually did the buying ("Set up in Billing, below"). Two things came out of separating
 * them, and the second is what the split is for:
 *
 *   * The buy button moved ONTO the plan row it buys. A row that names a plan, states its
 *     price and then refers you somewhere else on the same screen is a control describing
 *     another control; the row is where somebody has already decided, so the row is where the
 *     button belongs.
 *   * Billing is now what it always was underneath — the RECORD. What has been paid, until
 *     when, what renews it, what happened, and every receipt. Nothing on it starts a
 *     purchase, which is why the payment history could stop being a `<details>` somebody had
 *     to discover and become the pane's own list.
 *
 * The two are still ONE KEY, and that is unchanged: `admin/settings` gates all three panes,
 * exactly as it gated the two. AGENTS.md's test is whether a family could sensibly hold one
 * and withhold the other, and choosing a plan, paying for it and reading the receipts are one
 * job done by one person. Splitting Billing onto its own key would be a migration, a
 * per-family backfill and a switch an administrator has to find before the pane they were
 * already looking at works.
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
 * ── ONE KEY GOVERNS ALL THREE, WHICH IS THE UNUSUAL PART ───────────────────────────
 * AGENTS.md's default is one rail item per `permission_resources` row — `/admin/members`
 * spans four keys, `/community/announcements` three. These three panes span ONE,
 * `admin/settings`, exactly as `/accounting/dues-and-donations` does: a caller who is on this
 * screen may see every band by definition, so there is no `paneResource` map here and adding
 * one would be a control nothing consults. The one grant that IS separate —
 * `admin/settings/remove` — gates a control inside the Family pane rather than a pane of its
 * own, and is resolved on the server as `FamilySettings.canRemove`.
 *
 * If a fourth pane ever arrives that a family might sensibly withhold on its own, it needs a
 * key, a migration and a map here.
 *
 * ── THE ORDER IS THE RECORD, THE CATALOGUE, THE FAMILY ─────────────────────────────
 * Billing leads because it is the pane that answers a question with a date in it — *what are
 * we paying and until when* — and Plan is the one you open when you have decided to change
 * something. The LANDING pane is still Plan, for the reason `DEFAULT_SETTINGS_PANE` gives, so
 * the rail's first item is deliberately not its default; a bookmark on `/admin/settings` opens
 * exactly where it always has.
 */
export const SETTINGS_PANES = ['billing', 'plan', 'family'] as const

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

/**
 * One pane's caption, in the reader's language — `set.pane.<id>`.
 *
 * A FUNCTION TAKING `t`, so this module stays plain: the `T` import is type-only and
 * erased, and the `'use server'` file that reads the vocabulary still imports it without
 * dragging a client boundary in. The IDS are `?pane=` and are the contract.
 */
export function settingsPaneLabel(t: T, pane: SettingsPane): string {
  return t(`set.pane.${pane}`)
}

/*
 * ── `SETTINGS_PANE_LEDE` WAS HERE AND WAS DELETED ON 2026-08-25 ────────────────────
 * A sentence under the rail, one per pane, saying what the pane was: "Which subscription this
 * family is on…" underneath a tab captioned **Plan**. It restated its own caption, cost a line
 * above the fold on every pane, and was the first thing a reader had to skip on every visit to
 * reach what they came for — which is the definition of furniture.
 *
 * It went as part of a sweep of the same shape across the signed-in app, and the sweep was
 * catching up rather than innovating: the newer screens had already stopped shipping one.
 * Dashboard, Gallery, Distributions, Bylaws, Meeting Minutes, Transactions and Announcements
 * all lead with a heading and then the content.
 *
 * **DO NOT REINTRODUCE ONE AS A DESCRIPTION.** A line of prose above a pane earns its place
 * only when it carries a fact the screen cannot show — and then it belongs beside the control
 * it is about, or in the help chapter, where somebody looking for it a second time can find
 * it. Billing is the worked example: the real content of its lede was that GENORRA's charges
 * appear in none of the family's own books, which is a genuine trap — so it is stated in
 * `family-settings#billing` and in 20260823000004's header, rather than in a sentence every
 * administrator reads once and scrolls past forever.
 */
