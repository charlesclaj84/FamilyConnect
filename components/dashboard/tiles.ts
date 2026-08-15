import {
  UsersRound, HandCoins, UserPlus, MessageCircle, ClipboardCheck,
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
 */
export type TileId = 'members' | 'dues' | 'approvals'

/** Resource keys, ANY of which grants the tile. */
export const TILE_RESOURCE: Record<TileId, readonly string[]> = {
  members: ['members'],
  // Either ledger will do, mirroring the SELECT policy on dues_payments exactly.
  // `20260808000001` records why neither is `dues`: that key no longer exists, and a
  // member's OWN history behind My Summary must never depend on a ledger grant.
  dues: ['transactions/dues-payments', 'transactions/donation-payments'],
  approvals: ['admin/approvals'],
}

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
  members:   { label: 'Family Members',   href: '/members',                           linkLabel: 'View directory', accent: 'primary', icon: UsersRound },
  dues:      { label: 'Dues Collected',   href: '/transactions?ledger=dues-payments', linkLabel: 'View payments',  accent: 'legacy',  icon: HandCoins },
  approvals: { label: 'Pending Approval', href: '/admin/users?tab=approvals',         linkLabel: 'Review queue',   accent: 'warm',    icon: ClipboardCheck },
}

/** A tile with its value resolved, which is all the component ever sees. */
export interface ResolvedTile {
  id: TileId
  value: string
}

// ── Quick actions ────────────────────────────────────────────────────────────────────

/**
 * The Golden Master draws six. Three of them — Create Event, Add Photos, Upload Document
 * — point at features still `status: 'future'` in `lib/features.ts`, so they are not
 * here. That is omission, not oversight: a control that leads to `/coming-soon` is a
 * dead affordance, and the sidebar already refuses to render one. When Events, Photos or
 * Documents ship, add the entry and it appears for whoever holds the grant.
 */
export type QuickActionId = 'add-member' | 'record-payment' | 'send-message'

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
