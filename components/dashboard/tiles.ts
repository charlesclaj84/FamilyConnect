import {
  UsersRound, HandCoins, UserPlus, MessageCircle, ClipboardCheck, CalendarDays,
  type LucideIcon,
} from 'lucide-react'

/**
 * What every tile and quick action on the Dashboard points at, and which grant decides
 * whether the caller sees it.
 *
 * WHY THERE IS A TABLE AT ALL, AND WHY IT IS NOT A MIGRATION. AGENTS.md's "one rail
 * item, one permission resource" rule binds each item on a rail to a row in
 * `permission_resources` — `LEDGER_RESOURCE` (Transactions) and `SECTION_RESOURCE`
 * (Accounting) are the worked examples, and this is the third. (There was a fourth,
 * `PANE_RESOURCE`, until 20260815000000 turned My Summary's three panes into three
 * screens — a rail item with a route of its own needs no table, because the key is the
 * route without its leading slash.) What is deliberately different here: **no `dashboard/*` resource keys are
 * registered, and none should be.**
 *
 * A rail item is a JOB the page divides into, so it earns its own switch. A dashboard
 * tile is a POINTER at a job that already has one. Registering `dashboard/members`
 * beside `members` would give an administrator two switches for one thing, which can
 * disagree — and it would quietly reverse `20260806000006`, which removed the
 * `dashboard` row on the grounds that a member's landing screen is not something a
 * family administers. The empty `personal` heading in `components/admin/
 * resource-groups.ts` is the trace of that decision, and it is "not a gap to fill".
 *
 * So a tile borrows the grant of its destination. Restrict Member Directory and the
 * Family Members tile goes with it — one switch, both surfaces, no second place to look.
 *
 * READ THIS BEFORE ADDING A TILE. `TILE_RESOURCE` is only half the gate. The other half
 * is that the PAGE must not fetch the number when the grant is absent — AGENTS.md §5,
 * "gate the fetch, not the button". A tile hidden over a value already in the RSC
 * payload has published that value. `app/(protected)/dashboard/page.tsx` resolves every
 * entry here BEFORE its `Promise.all` and passes `Promise.resolve(null)` in place of any
 * query it is not entitled to run.
 */

/**
 * The metric tiles.
 *
 * THERE IS NO "MY BALANCE" TILE, and it is worth saying why here because it is the
 * obvious fourth one and it was drafted before being removed. What a member owes is
 * already `DuesBalanceKpi`, which the Dashboard and My Summary both render unchanged —
 * its header says so, and says that any difference between the two "is a prop with a
 * reason written next to it, or it does not happen". A tile summing
 * `remainingBalanceCents` would have been a THIRD rendering of that fact and a wrong
 * one: the real figure headlines REQUIRED money, excludes opted-out schedules via
 * `isOutstanding`, and keeps optional dues on a separate quieter line. A single number
 * cannot say that, and a member reading "$250" here and "$50 required" on My Summary
 * would be right to trust neither.
 *
 * `gatherings` IS THE KIT'S SECOND TILE, ADDED 2026-08-19. `AtAGlance.svg` draws four inset
 * cards and the second is an olive calendar chip over `3` / "Upcoming Events" / "View
 * calendar" — so this was never a fourth tile somebody invented, it was a specified one the
 * repo had not built. It counts UPCOMING, non-cancelled gatherings and it leads to
 * `/calendar`, which is the caption the kit itself writes under the figure.
 *
 * ── `dues` LEFT THIS LIST ON 2026-08-19 AND BECAME A WIDGET ────────────────────────
 * "Dues Collected" was the family's collected total, as a metric tile. It is
 * `FamilyDuesCollectedCard` now, in the narrow column beside the tree — and the swap is the
 * point rather than a move: At a Glance is what is true of the READER (what they owe, what
 * their family is asking them to give to, what is coming up), and the family's collected
 * total is a fact about the ORGANISATION that a treasurer reads, not a prompt. It is also the
 * one tile whose figure grew without bound, so a five-figure sum was setting the row's
 * column width for everybody.
 *
 * Its GRANT did not change and neither did its destination: the card keys on the same two
 * ledger keys and still leads to the dues ledger. Nothing about who may see the number moved.
 */
export type TileId = 'members' | 'approvals' | 'gatherings'

/**
 * Resource keys, ANY of which grants the tile.
 *
 * `DUES_COLLECTED_RESOURCE` below is the same shape for the widget that used to be the `dues`
 * tile — it is here rather than in the component for the reason this whole table is: the page
 * looks a grant up before it decides whether to run the query.
 */
export const TILE_RESOURCE: Record<TileId, readonly string[]> = {
  members: ['members'],
  approvals: ['admin/approvals'],
  // `calendar`, NOT `gatherings`, and the difference is the whole rule this file states: a
  // tile borrows the grant of ITS DESTINATION, and this one's destination is the month
  // calendar. Gating it on `gatherings:view` would offer a member a way through to a screen
  // their family has switched off for them, which is the dead affordance the sidebar already
  // refuses to render.
  //
  // The FIGURE is gathering data, so the page's fetch is narrowed a second time by the read
  // it uses — `getGatherings()` gates itself on `gatherings:view` and answers `[]` without
  // it. That is the right way round: a caller holding the calendar and not gatherings counts
  // zero and the tile is omitted, which is "nothing to show" rather than a leak.
  gatherings: ['calendar'],
}

/**
 * The two keys that grant the family's collected-dues figure — either will do, mirroring the
 * SELECT policy on `dues_payments` exactly.
 *
 * `20260808000001` records why neither is `dues`: that key no longer exists, and a member's
 * OWN history behind Summary must never depend on a ledger grant. This was `TILE_RESOURCE.dues`
 * until the tile became `FamilyDuesCollectedCard`; the keys are unchanged, so no family's
 * answer to "may I see this" moved with the pixels.
 */
export const DUES_COLLECTED_RESOURCE = [
  'transactions/dues-payments', 'transactions/donation-payments',
] as const

export interface TileMeta {
  label: string
  href: string
  /** The small link under the value — the Golden Master's "View all" / "View payments". */
  linkLabel: string
  /**
   * Which brand surface the icon chip takes. Names a ROLE, never a hue: each of these
   * has a checked `on-` partner in both themes, and the pairs must not be crossed.
   */
  accent: 'primary' | 'legacy' | 'affirm' | 'warm'
  icon: LucideIcon
}

/**
 * Captions come from the screen the tile leads to, not from the database's label for the
 * resource — the same rule the permission grid follows. "Family Members" leads to Member
 * Directory; "Dues Collected" leads to the Transactions dues ledger.
 */
export const TILE_META: Record<TileId, TileMeta> = {
  members:    { label: 'Family Members',       href: '/members',                           linkLabel: 'View directory', accent: 'primary', icon: UsersRound },
  approvals:  { label: 'Pending Approval',     href: '/admin/users?tab=approvals',         linkLabel: 'Review queue',   accent: 'warm',    icon: ClipboardCheck },
  // `affirm` is Growth olive, which is the kit's own `#62642F` chip for this tile, and the
  // captions are the kit's too — "View calendar" under the count, because the figure is a
  // count of gatherings and the way through is the calendar that shows them beside events.
  gatherings: { label: 'Upcoming Gatherings',  href: '/calendar',                          linkLabel: 'View calendar',  accent: 'affirm',  icon: CalendarDays },
}

/** A tile with its value resolved, which is all the component ever sees. */
export interface ResolvedTile {
  id: TileId
  value: string
}

// ── Quick actions ────────────────────────────────────────────────────────────────────

/**
 * The Golden Master draws six. Two of the ones it draws — Add Photos, Upload Document — are
 * still not here, and the reason changed on 2026-08-20 without changing the answer. Both
 * pointed at features that were `status: 'future'` in `lib/features.ts`, and a control leading
 * to `/coming-soon` is a dead affordance the sidebar already refuses to render. `/photos` and
 * `/documents` are LIVE now, in the rail's Review section, which is the opposite claim: live
 * but not yet walked by anybody. A Quick Action is the most confident thing on the Dashboard —
 * "this is the job to do next" — so it is the last place to point at a screen under review,
 * not the first. Add either button when its screen leaves Review. Its "Create Event" is gone
 * for a different reason again: the Events product is retired (2026-08-19) and there is no
 * such screen to point at.
 *
 * `my-gathering-tasks` IS THE ONE ENTRY HERE THAT IS CONDITIONAL ON THE CALLER'S OWN WORK
 * rather than on a grant, and it is the only one of its kind on this row. Every other button
 * offers a job somebody MAY do; this one appears when there is something waiting on them —
 * `getMyGatheringTaskCount()` above zero — and disappears when there is not.
 *
 * That is deliberate and it is the opposite of what the rail does with the same fact: the
 * Gatherings row in the sidebar is unconditional, because a member who has just been handed a
 * task must be able to find it, and a row that is sometimes there is worse than a row that is
 * sometimes empty. Quick Actions is not a destination list — it is "what should I do now" —
 * and a permanent button reading "My Tasks" over an empty page is the dead affordance this
 * card already refuses to draw for a missing grant.
 */
export type QuickActionId =
  | 'add-member' | 'record-payment' | 'send-message' | 'my-gathering-tasks'

export interface QuickActionMeta {
  label: string
  href: string
  accent: 'primary' | 'legacy' | 'affirm' | 'warm'
  icon: LucideIcon
}

export const QUICK_ACTION_META: Record<QuickActionId, QuickActionMeta> = {
  // `href` IS NOT NAVIGATED TO for this one, since 2026-08-13 — Add Member opens
  // InviteMemberDialog in place rather than sending the member to Members to look for the
  // button themselves. It is kept because it is still the true answer to "where does this
  // job live", which is what the row menu and the permission grid both reflect, and
  // because dropping it would make this the one entry with a different shape.
  'add-member':     { label: 'Add Member',     href: '/admin/users',                       accent: 'primary', icon: UserPlus },
  'record-payment': { label: 'Record Payment', href: '/transactions?ledger=dues-payments', accent: 'affirm',  icon: HandCoins },
  'send-message':   { label: 'Send Message',   href: '/chat',                              accent: 'warm',    icon: MessageCircle },
  // The pane, not the old route: `/gatherings/my-tasks` redirects to it, and a Quick Action
  // that goes through a redirect is a Back button that walks through one.
  'my-gathering-tasks': { label: 'My Tasks', href: '/gatherings?pane=my-tasks', accent: 'legacy', icon: ClipboardCheck },
}

/**
 * The grant each button needs — and note these are not all `view`.
 *
 * A button captioned with a verb is a promise that pressing it does the thing. Gating
 * "Add Member" on `admin/users:view` would show it to somebody who can read the roster
 * and not change it, which is a worse outcome than not offering it: they press it, and
 * the page they land on has no control. So the check matches the verb.
 *
 * `record-payment` is `create`, and the PAGE it opens re-checks with `canAny` rather than
 * `can` — a disbursement paying the caller themselves is the abuse case that helper
 * exists for (`app/actions/dues.ts`). This entry gates the affordance; it is not the
 * gate, and nothing here is trusted by the action behind it.
 *
 * `send-message` is `view`, deliberately. Sending a message is self-service — every
 * member may do it by definition, and `create` defaults to scope `'none'`, so demanding
 * a create grant would hide the button from the whole family. The real question the
 * button asks is "may this member reach Chat at all".
 */
export const QUICK_ACTION_GRANT: Record<QuickActionId, { resource: string; action: 'view' | 'create' }> = {
  'add-member':     { resource: 'admin/users',                 action: 'create' },
  'record-payment': { resource: 'transactions/dues-payments',  action: 'create' },
  'send-message':   { resource: 'chat',                        action: 'view' },
  // `view`, and on the pane's own key. Answering a task you were handed is self-service —
  // `create` and `edit` both default to scope 'none' (AGENTS.md §2), so demanding either would
  // hide the button from every member the tasks are actually for. The real question is whether
  // this member may reach the screen at all, which is exactly what `view` on that key answers.
  'my-gathering-tasks': { resource: 'gatherings/my-tasks',     action: 'view' },
}

/**
 * The route whose feature status decides whether the item ships at all, for anything
 * whose destination is not its own resource key. Checked with `isFeatureLive()` on top
 * of the grant — two independent narrowings, exactly as the sidebar does it.
 */
export const ROUTE_FOR_GRANT: Record<string, string> = {
  'members': '/members',
  'transactions/dues-payments': '/transactions',
  'transactions/donation-payments': '/transactions',
  'admin/approvals': '/admin/approvals',
  'admin/users': '/admin/users',
  'chat': '/chat',
  // `/gatherings` and NOT `/gatherings/my-tasks`, even though the key is the longer one:
  // `isFeatureLive` asks the registry whether the SCREEN has shipped, and the screen is the
  // pane. Both entries carry the same status today, so this cannot change the answer — it is
  // written the way it is so that it stays right if the two ever diverge.
  'gatherings/my-tasks': '/gatherings',
  // The key and the route happen to coincide here, as they do for `members` and `chat`
  // above. Listed anyway, because the page looks every tile's route up THROUGH this table —
  // `isFeatureLive(ROUTE_FOR_GRANT[TILE_RESOURCE.gatherings[0]])` — and an absent entry is
  // `isFeatureLive(undefined)`, which is a silently unresolved feature rather than an error.
  'calendar': '/calendar',
}

/**
 * Tailwind pairs for an accent chip, resolved here so no component restates them.
 *
 * Each entry is a SURFACE and its guaranteed partner. Never mix across rows —
 * `text-brand-on-affirm` on `bg-brand-primary` is an unchecked combination in both
 * themes and there is no reason to expect it to pass.
 */
export const ACCENT_CHIP: Record<TileMeta['accent'], string> = {
  primary: 'bg-brand-primary text-brand-on-primary',
  legacy:  'bg-brand-legacy text-brand-on-legacy',
  affirm:  'bg-brand-affirm text-brand-on-affirm',
  warm:    'bg-brand-warm text-brand-on-warm',
}
