import {
  UsersRound, HandCoins, UserPlus, MessageCircle, ClipboardCheck, CalendarDays, Vote,
  type LucideIcon,
} from 'lucide-react'
import type { T } from '@/lib/i18n/t'

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
 * `/gatherings/calendar`, which is the caption the kit itself writes under the figure.
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
  members: ['community/directory'],
  approvals: ['admin/members/approvals'],
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
  gatherings: ['gatherings/calendar'],
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
  'reporting/transactions/dues-payments', 'reporting/transactions/donation-payments',
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
/**
 * ── A FUNCTION, NOT A `Record`, SINCE THE CAPTIONS ARE TRANSLATED ─────────────────
 * The same conversion `lib/marketing-nav.ts` and `components/marketing/pillars.ts` took: a
 * module-level literal cannot call `t`, and the IDS are the contract rather than the words.
 * `TILE_RESOURCE` above stays a `Record`, because a permission key is not copy.
 */
export function tileMeta(t: T): Record<TileId, TileMeta> {
  return {
    members:    { label: t('dash.familyMembers'),       href: '/community/directory',                           linkLabel: t('dash.viewDirectory'), accent: 'primary', icon: UsersRound },
    approvals:  { label: t('dash.pendingApproval'),     href: '/admin/members?tab=approvals',         linkLabel: t('dash.reviewQueue'),   accent: 'warm',    icon: ClipboardCheck },
    // `affirm` is Growth olive, which is the kit's own `#62642F` chip for this tile, and the
    // captions are the kit's too — "View calendar" under the count, because the figure is a
    // count of gatherings and the way through is the calendar that shows them beside events.
    gatherings: { label: t('dash.upcomingGatherings'),  href: '/gatherings/calendar',                          linkLabel: t('dash.viewCalendar'),  accent: 'affirm',  icon: CalendarDays },
    }
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
 * to `/coming-soon` is a dead affordance the sidebar already refuses to render. `/community/gallery`
 * and `/library/documents` are LIVE now — reviewed and rehomed on 2026-08-22 — which is the opposite claim: live
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
  | 'add-member' | 'record-payment' | 'send-message' | 'my-gathering-tasks' | 'election'

/**
 * A quick action with whatever about it could not be stated in the table below.
 *
 * THE SHAPE `ResolvedTile` ALREADY HAS, for the same reason: a tile's VALUE is a number the
 * page had to fetch, and an election's caption and destination are two things the page had to
 * resolve. Everything else still comes from `QUICK_ACTION_META`, so this is an override and
 * not a second table — an entry with neither field is exactly what the other four are.
 */
export interface ResolvedQuickAction {
  id: QuickActionId
  /** Overrides `QUICK_ACTION_META[id].label`. */
  label?: string
  /** Overrides `QUICK_ACTION_META[id].href`. */
  href?: string
}

export interface QuickActionMeta {
  label: string
  href: string
  accent: 'primary' | 'legacy' | 'affirm' | 'warm'
  icon: LucideIcon
}

export function quickActionMeta(t: T): Record<QuickActionId, QuickActionMeta> {
  return {
    // `href` IS NOT NAVIGATED TO for this one, since 2026-08-13 — Add Member opens
    // InviteMemberDialog in place rather than sending the member to Members to look for the
    // button themselves. It is kept because it is still the true answer to "where does this
    // job live", which is what the row menu and the permission grid both reflect, and
    // because dropping it would make this the one entry with a different shape.
    'add-member':     { label: t('dash.addMember'),     href: '/admin/members',                       accent: 'primary', icon: UserPlus },
    'record-payment': { label: t('dash.recordPayment'), href: '/reporting/transactions?ledger=dues-payments', accent: 'affirm',  icon: HandCoins },
    'send-message':   { label: t('dash.sendMessage'),   href: '/community/chat',                              accent: 'warm',    icon: MessageCircle },
    // The pane, not the old route: `/gatherings/my-tasks` redirects to it, and a Quick Action
    // that goes through a redirect is a Back button that walks through one.
    'my-gathering-tasks': { label: t('dash.myTasks'), href: '/gatherings?pane=my-tasks', accent: 'legacy', icon: ClipboardCheck },
    // ── THE ONLY ENTRY WHOSE LABEL AND HREF ARE BOTH PLACEHOLDERS ──────────────────────
    // Added 2026-08-21. The page overrides both through `ResolvedQuickAction`, because an
    // election's caption is what there is to DO in it — "Nominate" or "Vote" — and its
    // destination is one particular ballot. What is written here is the fallback and the
    // ACCENT, which is not dynamic.
    //
    // The values are not arbitrary even so: they are what the button would say if the override
    // were ever dropped, so the failure mode is a correct link with a vaguer caption rather
    // than a broken one. That is the `ROUTE_OVERRIDE` lesson — an entry resolving to
    // `undefined` took the whole Dashboard down once.
    'election': { label: 'Elections', href: '/community/elections', accent: 'primary', icon: Vote },
  }
}

/**
 * What an election open for business asks the reader to do.
 *
 * Captions live in this file rather than in the action that resolves the phase, for the reason
 * `TILE_META`'s header gives: a caption comes from the SCREEN, and this table is where the
 * Dashboard's captions are decided. The phase itself is derived server-side by
 * `lib/election-phase.ts` and is never recomputed in a component.
 *
 * THE TWO PHASES NOT LISTED ARE THE POINT. `scheduled` and `between` are elections a member
 * can SEE and cannot ACT in, and Quick Actions is "what should I do now" rather than a
 * destination list — the same argument `my-gathering-tasks` is written on. A chip reading
 * "Vote" eleven days before the poll opens is a button that does nothing.
 */
/**
 * What there is to DO in an election that is open — the Quick Action's caption.
 *
 * A FUNCTION OF `t` since 2026-08-29, for the reason every other registry in this file is
 * one: a module-level literal cannot call `t`, and the PHASE is the contract while the verb
 * is copy. It was the last English map on this screen, and the Dashboard is the screen every
 * member lands on.
 */
export function electionActionLabel(t: T, phase: 'nominations' | 'voting'): string {
  return t(`dash.election.${phase}`)
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
  'add-member':     { resource: 'admin/members',                 action: 'create' },
  'record-payment': { resource: 'reporting/transactions/dues-payments',  action: 'create' },
  'send-message':   { resource: 'community/chat',              action: 'view' },
  // `view`, and on the pane's own key. Answering a task you were handed is self-service —
  // `create` and `edit` both default to scope 'none' (AGENTS.md §2), so demanding either would
  // hide the button from every member the tasks are actually for. The real question is whether
  // this member may reach the screen at all, which is exactly what `view` on that key answers.
  'my-gathering-tasks': { resource: 'gatherings/my-tasks',     action: 'view' },
  // `view`, and the same argument as `send-message` verbatim: nominating and voting are
  // self-service — every member of the election's area may do both by definition — and
  // `create` defaults to scope 'none' (AGENTS.md §2), so demanding one would hide the button
  // from the whole family. The real question is whether this member may reach the screen.
  //
  // WHAT BOUNDS IT IS NOT A GRANT. The election's LEVEL decides who may take part, and
  // `getMyActionableElection` resolves that through `getElectionsForMember` — so a member of
  // no chapter is never offered a chapter's ballot, whatever this key says.
  'election':        { resource: 'community/elections',        action: 'view' },
}

/**
 * The route whose feature status decides whether the item ships at all, for anything
 * whose destination is not its own resource key. Checked with `isFeatureLive()` on top
 * of the grant — two independent narrowings, exactly as the sidebar does it.
 */
//
// ── EVERY KEY OF THIS TABLE IS A PERMISSION KEY, WHICH IS WHY IT BROKE ─────────────────
// 20260820000004 moved 42 keys, and the code sweep that went with it replaced a bare key only
// inside a permission CALL — because `'members'`, `'chat'` and `'calendar'` are also a tab id,
// a chat room type and a tile id, and a blind replace would have corrupted all three. An
// OBJECT KEY is neither shape, so the three entries here kept their old spelling while
// `TILE_RESOURCE` above moved to the new one.
//
// THE FAILURE WAS NOT A WRONG LINK, IT WAS A WHITE SCREEN. The page resolves a tile's route
// as `ROUTE_FOR_GRANT[TILE_RESOURCE.members[0]]`, which became `undefined`, and
// `isFeatureLive(undefined)` reaches `covers()` in lib/features.ts — `pathname.startsWith(...)`
// on undefined is a TypeError, thrown during the server render of the Dashboard. The comment
// on the `calendar` entry below already warned that an absent entry resolves to
// `isFeatureLive(undefined)`; it called that "a silently unresolved feature rather than an
// error", and that was the one thing about it that was wrong.
//
// A KEYED-BY-KEY TABLE IS THE SHAPE TO CHECK FIRST after any key move: `LEDGER_RESOURCE`,
// `SECTION_RESOURCE` and `TILE_RESOURCE` all hold keys as VALUES, which the sweep did reach.
// This was the only table in the tree that held them as KEYS — and rather than fix the three
// entries and leave the shape, it is DERIVED now. `routeForGrant(key)` answers `'/' + key`,
// which is what a resource key means, and only the genuine exceptions are written down. A key
// with no entry cannot occur, so the next key move cannot reproduce this.
/**
 * The route whose feature status governs a grant, for anything whose destination is not
 * simply its own key.
 *
 * DERIVED, NOT LISTED, since the Dashboard broke on this table. Only the exceptions are
 * written down; every other key resolves to `'/' + key`, which is what a resource key MEANS
 * (AGENTS.md §1). A key with no entry is therefore impossible rather than `undefined`.
 */
const ROUTE_OVERRIDE: Record<string, string> = {
  // `/reporting/transactions` and not the sub-key's own path: neither ledger is a route, and
  // `isFeatureLive` asks the registry whether a SCREEN has shipped. The screen is the ledger
  // page they are both panes of.
  'reporting/transactions/dues-payments': '/reporting/transactions',
  'reporting/transactions/donation-payments': '/reporting/transactions',
  // `/gatherings` and NOT `/gatherings/my-tasks`, even though the key is the longer one, for
  // the same reason: the screen is the pane's page. Both entries carry the same status today,
  // so this cannot change the answer — it is written the way it is so that it stays right if
  // the two ever diverge.
  'gatherings/my-tasks': '/gatherings',
}

export function routeForGrant(key: string): string {
  return ROUTE_OVERRIDE[key] ?? `/${key}`
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
