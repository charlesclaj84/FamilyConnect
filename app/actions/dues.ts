'use server'

import { revalidatePath } from 'next/cache'
import { confirmWrite } from '@/lib/confirmed-write'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode, getMyPersonId, belongsToFamily } from '@/lib/auth/family'
import { can, canAny } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { moneyAttachedTo, moneyAttachedMessage } from '@/lib/money-attached'
import {
  annualTotalCents,
  ageShareOfPeriod,
  duesEligibility,
  duesScope,
  duesScopeMatch,
  proratedAnnualCents,
  duesPlanMath,
  currentPeriodStart,
  defaultCadence,
  type AgeShare,
  type DuesScope,
  type PayCadence,
  type DuesScheduleLike,
  type ScheduleKind,
} from '@/lib/dues-utils'
import {
  projectDues, invitedPersonIds, type DuesProjection, type OpenInvitation,
} from '@/lib/dues-projection'
import {
  bloodlineIds, isLinkKind, relationFor, type LinkKind, type TreeLink,
} from '@/lib/family-tree'
import { routePaidPayment } from '@/lib/dues-routing'
import { embedOne, type PersonNameRow } from '@/lib/supabase/embed'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'
import type { T } from '@/lib/i18n/t'

/**
 * A dues schedule or a donation drive — see `kind`.
 *
 * Three fields are kind-specific, and the create/update actions keep them that way
 * rather than trusting a caller:
 *
 *   dues     — amount_cents + frequency say what is owed and how often.
 *              goal_cents is null.
 *   donation — goal_cents is the target being advised. amount_cents is 0 and
 *              frequency is 'one-time' because a drive does not recur: its
 *              start_date/end_date are its whole timing story.
 */
export interface DuesSchedule {
  id: string
  label: string
  amount_cents: number
  frequency: string
  due_month: number | null
  due_day: number | null
  active: boolean
  start_date: string | null
  end_date: string | null
  description: string | null
  kind: ScheduleKind
  goal_cents: number | null
  /**
   * DUES ONLY: the age at which a member becomes responsible for this due
   * (20260814000000). Null means everybody owes it whatever their age, which is what
   * every schedule meant before the column existed.
   *
   * The year a member reaches it is prorated by month — see `ageShareOfPeriod`. Nothing
   * is stored per member: the answer is derived from `people.date_of_birth` at read time,
   * because a stored answer about somebody's age is wrong the morning they have a
   * birthday. That is the whole reason `is_minor` was dropped (20260813000006).
   *
   * Always null for a donation, held there by a CHECK: nobody owes a gift, so there is no
   * age at which they start.
   */
  start_age: number | null
  /**
   * DUES ONLY: only members in the family's bloodline owe this (20260817000002).
   *
   * Derived at read time from `person_relationships.link_kind` and
   * `families.bloodline_anchor_id`, never stored per member — blood is a property of the
   * LINK (§4c), so a flag on the person would have to be wrong about one of a step-child's
   * two parents. Correcting a relationship, or moving the bloodline anchor, therefore
   * changes who owes this; that is the intended behaviour rather than a wart.
   *
   * A FAMILY WITH NO BLOODLINE ANCHOR BILLS NOBODY FOR IT. See `duesEligibility` for why
   * that direction and not the other.
   *
   * Always false for a donation, held by a CHECK: nobody owes a gift.
   */
  bloodline_only: boolean
  /**
   * DUES ONLY: which part of the family owes this (20260817000008).
   *
   *   national   everybody who would otherwise owe it. The default, and what every
   *              schedule meant before the column existed.
   *   regional   only members whose CHAPTER'S REGION is `region_id`.
   *   chapter    only members in `chapter_id`.
   *
   * NATIONAL IS THE ABSENCE OF A REGION rather than a row, so it exists on every plan and
   * needs no seeding — and a member with no chapter is under it, which means a regional or
   * chapter due does not apply to them at all. A member's region is DERIVED through
   * `people.chapter_id -> chapters.region_id`; there is no `people.region_id` and none may
   * be added.
   *
   * Always 'national' for a donation, held by a CHECK: nobody owes a gift, so there is no
   * part of the family that owes it. A drive concerning one chapter is a visibility
   * question and belongs on `donation_beneficiaries`.
   */
  scope: DuesScope
  /** Set exactly when `scope` is 'regional'. Held by a CHECK. */
  region_id: string | null
  /** Set exactly when `scope` is 'chapter'. Held by a CHECK. */
  chapter_id: string | null
  /**
   * TRUE: every member owes this and cannot decline it.
   * FALSE: optional — a member may opt out (see DuesSummary.optedOut).
   *
   * Always false for a donation, held there by a CHECK (20260807000003): a gift nobody
   * may decline is not a gift.
   */
  required: boolean
  /**
   * DONATIONS ONLY: the people this drive is FOR — and therefore the people who cannot
   * see it, administrators included.
   *
   * A family collecting for one of its own needs the drive hidden from them, and no
   * grant-shaped answer can do that: an administrator holds scope 'any' everywhere and
   * edits the grid on Members & Access, so the people most likely to be given a gift
   * are exactly the ones a permission could not hide it from. 20260811000000 makes it
   * a set of RESTRICTIVE policies instead, which AND with every grant rather than
   * OR-ing another way in.
   *
   * ALWAYS EMPTY IN A BENEFICIARY'S OWN READ, because the schedule row does not come
   * back for them at all. Nothing here is what does the hiding — the database is —
   * and a caller holding this array is by definition not on it.
   */
  beneficiary_person_ids: string[]
}

export interface DuesPayment {
  id: string
  person_id: string
  person_name: string | null
  schedule_id: string | null
  schedule_label: string | null
  /** Whether this paid for dues or a donation. Null only for legacy schedule-less rows. */
  schedule_kind: ScheduleKind | null
  amount_cents: number
  status: string
  payment_date: string
  payment_method: string | null
  /** Cheque number or confirmation code the money arrived on. Null on waived rows. */
  payment_reference: string | null
  notes: string | null
  created_at: string
  /**
   * Who entered it. Null only where the recorder's `people` row has since been deleted
   * — recorded_by is ON DELETE SET NULL, and 20260807000002 requires it on insert.
   */
  recorded_by_name: string | null
  /** Set when THIS row is a reversal of another payment. */
  reverses_id: string | null
  /** Set when another row reverses THIS one — so the ledger can say so. */
  reversed_by_id: string | null
}

/**
 * Whether a schedule has been transacted against — which is what decides how much of
 * it is still editable (20260807000001).
 *
 * Two flags rather than one because the two kinds are at stake at different moments. A
 * DUE is used the instant any row references it, waived and pending included: each was
 * posted against these terms and each is read back through them, so repricing it
 * restates history. A DONATION is only at stake once real money arrived — an unfunded
 * drive is still just a plan, and its dates are still a plan's dates.
 */
export interface ScheduleUsage {
  /** Any payment row references this schedule, whatever its status. */
  used: boolean
  /** A settled payment references it: money genuinely arrived. */
  funded: boolean
}

export interface DuesSummary {
  schedule: DuesSchedule
  cadence: PayCadence
  hasExplicitPlan: boolean
  /**
   * What THIS member owes for the period — the schedule's annual total, scaled by the
   * age rule where one applies.
   *
   * NOT ALWAYS THE SCHEDULE'S FIGURE, since 20260814000000. A member reaching the
   * schedule's `start_age` part-way through the period owes the months after their
   * birthday month and no more, so this is five twelfths of the annual total in the year
   * they turn eighteen and the whole of it every year after. `ageProration` below carries
   * the workings so a screen can say why the number is not the one on the schedule.
   */
  annualTotalCents: number
  /**
   * The age rule's effect on this member, or null when it has none.
   *
   * Null covers three different situations that all mean the same thing to a caller: the
   * schedule has no `start_age`, the member has no recorded birthday (fully liable, see
   * `ageShareOfPeriod`), or they reached the age before this period opened. A consumer
   * that wants to explain a reduced figure only ever needs the non-null case.
   */
  ageProration: {
    /** `dues_schedules.start_age` — the age this due starts at. */
    startAge: number
    /** Months of the period they are liable for, 0–12. */
    monthsOwed: number
    /** The date they reach the age, `YYYY-MM-DD`. */
    responsibleFrom: string
    /** What a full period costs, so a screen can say what changes next year. */
    fullAnnualCents: number
  } | null
  /**
   * They are below the schedule's `start_age` for the whole of this period.
   *
   * A SEPARATE FIELD FROM `paid`, and the distinction is the point: both leave a
   * remaining balance of zero, and only one of them means the member settled something.
   * A screen that treated this as paid would tell a twelve-year-old they were all caught
   * up on a due they have never owed.
   */
  ageExempt: boolean
  /** The steady-state installment — what every one AFTER a catch-up costs. */
  installmentCents: number
  /**
   * What the NEXT installment actually has to be.
   *
   * Equal to `installmentCents` for a member who is level, larger when the calendar has
   * asked for installments that were never paid — see `duesPlanMath`, which is where the
   * whole rule lives. Already clamped to the remaining balance, so a consumer must NOT
   * clamp it again: a second answer to "how much" is how the two used to disagree.
   */
  nextInstallmentCents: number
  /** The one after the catch-up, so a screen can say what being level costs. */
  followingInstallmentDate: string | null
  followingInstallmentCents: number
  /** The oldest installment whose money never arrived. Null when the member is level. */
  overdueSinceDate: string | null
  /** How many installments the calendar has passed this period. */
  periodsElapsed: number
  /** Expected by now, less what has been settled. Never negative. */
  arrearsCents: number
  /** False when there is a catch-up in `nextInstallmentCents`. */
  onSchedule: boolean
  amountPaidThisPeriodCents: number
  amountPaidTotalCents: number
  /**
   * Forgiven against this period, in cents.
   *
   * SETTLES THE DUE WITHOUT BEING MONEY, which is the whole reason it is its own field
   * rather than folded into the paid figures beside it. Waiving is the family deciding
   * this member does not have to find it, so it reduces `remainingBalanceCents` exactly
   * as a payment does; but nothing arrived, so it must never reach a paid total, a fund
   * balance, or the family's collected figure. `recordPayment` keeps it out of the
   * routing waterfall for the same reason.
   */
  amountWaivedThisPeriodCents: number
  remainingBalanceCents: number
  nextInstallmentDate: string | null
  paid: boolean
  lastPayment: DuesPayment | null
  /** Mirrors schedule.required, lifted so consumers do not have to reach through. */
  required: boolean
  /** This member has declined this optional due. Always false for a required one. */
  optedOut: boolean
}

/**
 * One donation drive: how far the FAMILY has got toward its goal, plus this member's
 * own share of it.
 *
 * Deliberately NOT a DuesSummary: that shape is built out of obligation —
 * `remainingBalanceCents`, `nextInstallmentDate`, `paid` — and none of those mean
 * anything for a gift.
 *
 * PRIVACY: `raisedCents` is a single number for the whole family. Nothing in this
 * shape can be attributed to another member — no per-person rows, no names, no giver
 * count, no dates that would let one gift be pinned to one person. The only
 * individual figure here is the reader's own.
 */
export interface DonationSummary {
  schedule: DuesSchedule
  /** The advised target, or null if the family did not set one. Not a cap. */
  goalCents: number | null
  /** Everything the family has given to this drive, added together. */
  raisedCents: number
  /** The reader's own share of that total. Their own data, nobody else's. */
  myGivenCents: number
  /**
   * Progress toward the goal as a percentage. NOT clamped: a drive that raised twice
   * its goal reports 200, and the bar is drawn to match.
   */
  progressPercent: number
  goalMet: boolean
  /** end_date is in the past: the drive is over, so the bar is history not an ask. */
  closed: boolean
}

// ── P&L (Family Finances) ledger shape ──────────────────────────────────────

export interface PnLRoutingFund {
  fundId: string
  fundName: string
  contributedCents: number
  bySource: { label: string; cents: number }[]
}

export interface PnLFundBalance {
  fundId: string
  fundName: string
  contributedCents: number
  disbursedCents: number
  balanceCents: number
}

/**
 * ── `PnLEvent` AND `expensedCents` ARE GONE (2026-08-19) ────────────────────────────
 * The statement had a whole EVENT LEDGER — per-event budget lines against what was really
 * spent, and a `backingFundName` read off `funds.event_id`. `20260819000006` drops
 * `event_expenses`, `event_budget_items`, `events` and that column, so there is no such
 * spend and no such earmark to report.
 *
 * `expensedCents` went from `PnLFundBalance` for the same reason and is not replaced by a
 * zero: a column of `$0.00` on every fund is a figure a treasurer has to ask about, and the
 * answer would be "that used to mean something".
 */
export interface PnLData {
  totalIncomeCents: number        // paid dues + donations (both are dues_payments)
  /**
   * Money contributed straight to a fund, rather than collected as dues and routed there.
   *
   * ── IT EXCLUDED `'reversal'` FROM 2026-08-20, AND THAT WAS A DOUBLE COUNT ──────────
   * A reversal writes TWO rows: a negative `dues_payments` row, which `totalIncomeCents`
   * above already subtracts, and a mirroring negative `fund_contributions` row carrying
   * `source = 'reversal'`, which un-routes the money from the fund it landed in. The filter
   * here was `source !== 'dues_routing'`, so the second row fell through and the reversal
   * came off `totalCollectedCents` TWICE — a reversed $500 payment made the family's
   * lifetime income read $1,000 lower than it is.
   *
   * The rule the filter is really expressing is "money that did not arrive as a dues
   * payment", because anything that did is counted on the income line. A reversal is a dues
   * payment's shadow and belongs on that side of the split with it.
   */
  totalContributionsCents: number // manual + member fund contributions
  totalCollectedCents: number     // dues + contributions
  /**
   * Collected and not yet allocated to any fund — income less what routing actually moved.
   *
   * ADDED 2026-08-20. Every other figure on this statement is either what came in or what
   * went out, and this is the one that says where the money is SITTING: a family whose
   * routing rules do not cover a schedule collects dues that reach no fund, and until
   * somebody looks at this line nothing on any screen says so. It is not an error and is not
   * rendered as one — an unallocated balance is an ordinary state on the day a payment lands.
   *
   * NEGATIVE IS POSSIBLE AND IS NOT NONSENSE: an administrator may contribute to a fund
   * directly, so more can have been routed into funds than dues ever brought in. The screen
   * says "over-allocated" rather than hiding the sign.
   */
  unroutedIncomeCents: number
  /**
   * MONEY THAT LEFT A FUND — `fund_disbursements`, and nothing else.
   *
   * It was event spend (`event_expenses`) and nothing else until 2026-08-19, which meant a
   * family that had paid a disbursement and never run an event read "Total Expenses $0.00"
   * over money that had demonstrably gone. Disbursements are the only outgoing this product
   * records now, so this is both the honest figure and the complete one.
   */
  totalExpenseCents: number
  netCents: number
  payments: DuesPayment[]
  routing: PnLRoutingFund[]
  funds: PnLFundBalance[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Which Accounting section governs a schedule, by kind.
 *
 * Both kinds are dues_schedules rows, but they are two sections of the Accounting
 * admin page and two separate grants (20260806000007): maintaining what members owe
 * and running a donation drive are different jobs. The kind is always resolved from
 * the row — or, on create, from the same validated value the row is built with —
 * never from a caller's claim about which permission to check.
 */
const SCHEDULE_RESOURCE: Record<ScheduleKind, string> = {
  dues: 'admin/accounting/dues',
  donation: 'admin/accounting/donations',
}

/**
 * Revalidate every screen a member reads their own money on.
 *
 * NOT EXPORTED, and it must not be. Everything exported from a `'use server'` file gets
 * a URL (AGENTS.md, on `lib/email`), and a cache-busting endpoint anyone signed in may
 * POST is not a thing this file should publish. A local helper is fine — only exports
 * become endpoints.
 *
 * ONE CALL REPLACING ONE LINE, at all eight sites that used to say
 * `revalidatePath('/accounting/summary')`. Until 20260815000000 that single path held the
 * whole of a member's own accounting, as three panes behind a rail; the panes are three
 * screens now, so the same eight events have four pages to invalidate instead of one.
 * Written as a list rather than resolved per call site deliberately: the alternative is
 * eight judgements about which of four screens a given write touches, made again every
 * time somebody adds a ninth, and the failure mode of getting one wrong is a member
 * looking at a figure that changed a minute ago.
 */
function revalidateMemberMoney() {
  revalidatePath('/accounting/summary')
  // ONE PATH SINCE 2026-08-20, where there were two: the two screens merged into
  // `/accounting/dues-and-donations` and both panes are rendered by that one route.
  revalidatePath('/accounting/dues-and-donations')
  revalidatePath('/reporting/payment-history')
}

/**
 * Normalize a dues_schedules row's `kind`.
 *
 * Anything that is not exactly 'donation' is dues — which covers the column being
 * absent (a database that has not run 20260805000002 yet) as well as NULL. Reads
 * therefore never lose a schedule to an unapplied migration; the worst case is that
 * donations do not exist yet, which is true.
 */
function mapSchedule(
  s: DuesSchedule & {
    kind?: string | null
    required?: boolean | null
    start_age?: number | null
    bloodline_only?: boolean | null
    scope?: string | null
    region_id?: string | null
    chapter_id?: string | null
    donation_beneficiaries?: { person_id: string }[] | null
  },
): DuesSchedule {
  const kind: ScheduleKind = s.kind === 'donation' ? 'donation' : 'dues'
  // The embed is pulled OUT of the spread rather than left to ride along: this object is
  // serialized into the RSC payload, and shipping the raw join rows beside the flattened
  // ids would put the same fact on the wire twice in two shapes.
  const { donation_beneficiaries, ...rest } = s
  return {
    ...rest,
    kind,
    goal_cents: s.goal_cents ?? null,
    // Absent whenever the caller did not ask for the embed — the insert's `.select('*')`
    // is the normal case — so it defaults to empty rather than undefined. A missing
    // embed must never read as "no beneficiaries" anywhere that DECIDES something; it
    // does not, because the deciding is done by the policies, not by this array.
    beneficiary_person_ids: (donation_beneficiaries ?? []).map(b => b.person_id),
    // A donation is never required. Defaulted rather than trusted so a database that has
    // not run 20260807000003 yet reads as "required dues, optional donations", which is
    // what every row in it means.
    required: kind === 'donation' ? false : (s.required ?? true),
    // Null for a donation and for any database that has not run 20260814000000 — both of
    // which mean "no age rule", which is exactly what null means everywhere that reads it.
    start_age: kind === 'donation' ? null : (s.start_age ?? null),
    // False for a donation and for a database that has not run 20260817000002 — both of
    // which mean "everybody who owes it, owes it", the behaviour before the column.
    bloodline_only: kind === 'donation' ? false : Boolean(s.bloodline_only),
    // 'national' for a donation and for a database that has not run 20260817000008 — both
    // of which mean "the whole family", the behaviour before the column. `duesScope`
    // normalizes anything unrecognized to the same answer; see its header for why failing
    // toward billing MORE people is right here and wrong for the bloodline.
    scope: kind === 'donation' ? 'national' : duesScope(s),
    region_id: kind === 'donation' ? null : (s.region_id ?? null),
    chapter_id: kind === 'donation' ? null : (s.chapter_id ?? null),
  }
}

/**
 * Force the kind's invariants onto a write, whatever the caller sent.
 *
 * A donation with an amount would start showing up as an obligation; a dues schedule
 * with a goal would render a progress bar against a bill. Both are one stale client
 * away, so the shape is settled here rather than trusted. Returns only the keys it
 * owns, so it can be spread over a partial update.
 */
function kindInvariants(kind: ScheduleKind, goalCents: number | null | undefined) {
  return kind === 'donation'
    // `required: false` and `start_age: null` are forced here as well as CHECKed in the
    // database, so a stale form cannot post a donation nobody may decline — or one that
    // starts at an age nobody owes it from — and get a constraint violation instead of a
    // sensible row.
    //
    // `scope` joins them for the same reason and one of its own: nobody owes a gift, so
    // there is no part of the family that owes it, and a scoped drive would be a control
    // that changes nothing. Both target ids are nulled with it, because the invariant from
    // 20260817000008 refuses 'national' carrying either.
    ? {
        amount_cents: 0, frequency: 'one-time', goal_cents: goalCents ?? null,
        required: false, start_age: null, bloodline_only: false,
        scope: 'national' as DuesScope, region_id: null, chapter_id: null,
      }
    : { goal_cents: null }
}

/**
 * `scope`, `region_id` and `chapter_id` as they are safe to write — and never one without
 * the other two.
 *
 * ── WHY THE THREE MOVE TOGETHER ─────────────────────────────────────────────────────
 * The CHECK from 20260817000008 is over all three at once: national means both ids NULL,
 * regional means a region and no chapter, chapter means a chapter and no region. So a write
 * that sets `scope` and leaves an id behind is refused by the database with a constraint
 * violation — which is the right outcome and a terrible message. Returning the whole triple
 * from one place is what stops any call site being able to send half of it.
 *
 * ── AN UNRECOGNIZED OR UNTARGETED SCOPE IS NATIONAL ────────────────────────────────
 * Both write actions are `'use server'` exports with URLs of their own, so the form is not
 * in their request path and `scope: 'chapter'` with no `chapter_id` can arrive — from a
 * stale client, or from a request somebody wrote by hand. The honest reading of "chapter,
 * but which chapter is not stated" is that no part of the family was named, and the only
 * schedule that names no part of the family is a national one.
 *
 * FAILING TO NATIONAL BILLS MORE PEOPLE, NOT FEWER, and that is deliberate here — see
 * `duesScope`. It restores what the schedule meant before anybody typed a scope into it,
 * and it is visible: the row says National on the Accounting list and on every projection.
 * Failing the other way would silently un-bill a chapter.
 *
 * IT DOES NOT CHECK THE FAMILY. That is §4 and it is the caller's job, because the answer
 * needs a database round trip — `belongsToFamily`, at both call sites, before the id is
 * written onto a row whose own `family_code` satisfies every policy.
 */
function normalizeScope(input: {
  scope?: string | null
  region_id?: string | null
  chapter_id?: string | null
}): { scope: DuesScope; region_id: string | null; chapter_id: string | null } {
  const scope = duesScope({ amount_cents: 0, frequency: 'annual', ...input })
  if (scope === 'regional' && input.region_id) {
    return { scope, region_id: input.region_id, chapter_id: null }
  }
  if (scope === 'chapter' && input.chapter_id) {
    return { scope, region_id: null, chapter_id: input.chapter_id }
  }
  return { scope: 'national', region_id: null, chapter_id: null }
}

/**
 * `dues_schedules.start_age`, as it is safe to write.
 *
 * Both write actions spread client-supplied columns onto the row, and both are `'use
 * server'` exports with URLs of their own — so the number input in the Accounting form is
 * not in their request path and `start_age: -3` or `'eighteen'` can arrive. The CHECK
 * added by 20260814000000 would refuse those, with a constraint violation for a message;
 * this turns them into the one thing they can honestly mean, which is no rule at all.
 *
 * 0 SURVIVES and is not the same as null: "from birth" is a real answer a family might
 * give, and `?? null` on a falsy check would silently turn it into "everybody, always" —
 * which happens to produce the same bill and for a completely different reason.
 */
function normalizeStartAge(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Math.round(Number(value))
  if (!Number.isFinite(n) || n < 0 || n > 120) return null
  return n
}

/**
 * The columns and embeds `mapPayment` reads. Declared because the row it maps is whatever
 * the untyped client handed back — see lib/supabase/embed.ts for why that is `any` and what
 * naming the shape buys.
 */
type DuesPaymentRow = {
  id: string
  person_id: string
  people: unknown
  schedule_id: string | null
  dues_schedules: unknown
  amount_cents: number
  status: string
  payment_date: string
  payment_method: string
  payment_reference?: string | null
  notes: string | null
  created_at: string
  recorder: unknown
  reverses_id?: string | null
}

/**
 * Takes `unknown` rather than `DuesPaymentRow` because its two callers hand it rows
 * TypeScript has no useful type for, and both were previously absorbed by `p: any`:
 * `getAllDuesPayments` gets a `GenericStringError` union, which is supabase-js reporting
 * that it could not resolve the constraint-qualified select at the type level, and
 * `computeDonationTotals` gets `Record<string, unknown>` from its empty-array fallback.
 *
 * One cast, at the top, from `unknown` — not `as unknown as` at each call site. The shape
 * is asserted from the `.select()` string a few lines above each query, which is the only
 * place that truth exists while the client is untyped. Same bargain as lib/supabase/embed.ts.
 */
function mapPayment(row: unknown): DuesPayment {
  const p = row as DuesPaymentRow
  const schedule = embedOne<{ label: string; kind?: string | null }>(p.dues_schedules)
  const recorder = embedOne<PersonNameRow>(p.recorder)
  const person = embedOne<PersonNameRow>(p.people)
  return {
    id: p.id,
    person_id: p.person_id,
    person_name: person ? `${person.first_name} ${person.last_name}` : null,
    schedule_id: p.schedule_id,
    schedule_label: schedule?.label ?? null,
    schedule_kind: schedule ? (schedule.kind === 'donation' ? 'donation' : 'dues') : null,
    amount_cents: p.amount_cents,
    status: p.status,
    payment_date: p.payment_date,
    payment_method: p.payment_method,
    payment_reference: p.payment_reference ?? null,
    notes: p.notes,
    created_at: p.created_at,
    recorded_by_name: recorder ? `${recorder.first_name} ${recorder.last_name}`.trim() : null,
    reverses_id: p.reverses_id ?? null,
    reversed_by_id: null,
  }
}

/**
 * Which of this family's schedules have ledger rows against them.
 *
 * THE ADMIN CLIENT IS REQUIRED, and so is the family scoping beside it. dues_payments
 * RLS shows a member only their OWN rows, so through the user's client a treasurer
 * looking at a schedule everyone else has paid would see "never used" and be offered an
 * edit the database is about to refuse. The service role bypasses RLS entirely, which
 * is exactly why `.eq('family_code', familyCode)` has to be here by hand — the ids are
 * this family's, but nothing else would keep the aggregate to it.
 *
 * Only booleans come back. Who paid, when and how much stays inside this function.
 */
async function loadScheduleUsage(
  admin: AdminClient,
  familyCode: string,
): Promise<Record<string, ScheduleUsage>> {
  const { data } = await admin
    .from('dues_payments')
    .select('schedule_id, status')
    .eq('family_code', familyCode)
    .not('schedule_id', 'is', null)

  const usage: Record<string, ScheduleUsage> = {}
  for (const row of data ?? []) {
    const id = row.schedule_id as string
    const entry = usage[id] ?? { used: false, funded: false }
    entry.used = true
    if (row.status === 'paid') entry.funded = true
    usage[id] = entry
  }
  return usage
}

// ── The fund-routing waterfall moved to lib/dues-routing.ts on 2026-08-23 ────────────
//
// `getActiveFundsForRouting` and `routePaidPayment` used to live here. They have a second
// caller now — the Stripe Connect webhook, which posts a dues payment a card actually paid
// and owes the family the same split into the same funds — and everything exported from a
// `'use server'` file gets a URL, so they could not simply be exported from here. That
// module's header carries the whole argument.

// ── Schedule actions (unchanged) ─────────────────────────────────────────────

/**
 * Every active schedule, dues AND donations. The Accounting admin page shows both
 * (on separate pages) and records payments against both, so it wants the lot;
 * callers that care about one kind filter on `kind`.
 */
export async function getDuesSchedules(): Promise<DuesSchedule[]> {
  const supabase = await createClient()
  // THE USER CLIENT IS DOING THE HIDING HERE. A drive the caller is a beneficiary of is
  // refused by the restrictive policy from 20260811000000 and simply does not come back
  // — there is no filter in this function to forget, and none should be added. The
  // embed is the beneficiary list for every drive that DID come back, which the
  // Accounting editor needs to render its "this drive is for" field.
  //
  // Only one foreign key joins donation_beneficiaries to dues_schedules, so a bare embed
  // is unambiguous here — unlike the two-path embeds AGENTS.md §8 warns about.
  const { data } = await supabase
    .from('dues_schedules')
    .select('*, donation_beneficiaries(person_id)')
    .eq('active', true)
    .order('label')
  return (data ?? []).map(mapSchedule)
}

/**
 * Replace a drive's beneficiary set.
 *
 * SERVICE ROLE, so AGENTS.md §3 applies twice over: `.eq('family_code', familyCode)` on
 * the delete, and every incoming person id verified against this family BEFORE it is
 * written. That second one is §4 — the row being inserted carries the caller's own
 * family_code and satisfies every policy, while the `person_id` it points at could be
 * anybody's. `upsertSpouse` and three others shipped exactly that bug.
 *
 * Delete-then-insert rather than a diff: the row is (schedule, person) and nothing else,
 * so there is no such thing as editing one. That is also why the table has no UPDATE
 * policy.
 *
 * Returns a message on refusal so the caller can surface it rather than half-saving.
 */
async function syncDonationBeneficiaries(
  admin: ReturnType<typeof createAdminClient>,
  scheduleId: string,
  familyCode: string,
  personIds: string[],
  /** The caller's language, for the one refusal below. `t` last, so a call site gains an
      argument rather than being re-ordered. */
  t: T,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // Deduplicated because the UNIQUE constraint would otherwise reject the whole insert
  // over a double-click, and empties dropped so a stray '' cannot reach the FK.
  const ids = [...new Set(personIds.filter(Boolean))]

  for (const personId of ids) {
    if (!(await belongsToFamily('people', personId, familyCode))) {
      return { ok: false, message: t('act.oneThosePeopleNotFamily2') }
    }
  }

  const { error: delError } = await admin
    .from('donation_beneficiaries')
    .delete()
    .eq('schedule_id', scheduleId)
    .eq('family_code', familyCode)
  if (delError) return { ok: false, message: delError.message }

  if (ids.length === 0) return { ok: true }

  const { error: insError } = await admin
    .from('donation_beneficiaries')
    .insert(ids.map(person_id => ({
      schedule_id: scheduleId,
      person_id,
      family_code: familyCode,
    })))
  // The guard trigger from 20260811000000 is what refuses a dues schedule, a
  // cross-family person or a mismatched family_code. Reaching it means the checks above
  // were bypassed or wrong, so the message is deliberately the raw one.
  if (insError) return { ok: false, message: insError.message }
  return { ok: true }
}

/**
 * The drives this caller is a beneficiary of, and so must not be shown.
 *
 * FOR SERVICE-ROLE READS ONLY. Anything going through `createClient()` is already
 * handled by the restrictive policies from 20260811000000 and must not filter twice —
 * a second filter there would be dead code that looks load-bearing. This exists because
 * `createAdminClient()` bypasses RLS entirely, so the admin-client reads have to re-apply
 * by hand what the policies would have done (AGENTS.md §3).
 *
 * An empty set for a caller with no person row: they are pending or not in this family,
 * and both are refused upstream rather than here.
 */
async function myHiddenDonationScheduleIds(
  admin: ReturnType<typeof createAdminClient>,
  familyCode: string,
  personId: string | null,
): Promise<Set<string>> {
  if (!personId) return new Set()
  const { data } = await admin
    .from('donation_beneficiaries')
    .select('schedule_id')
    .eq('family_code', familyCode)
    .eq('person_id', personId)
  return new Set((data ?? []).map(r => r.schedule_id as string))
}

/**
 * Which schedules have been transacted against, keyed by schedule id.
 *
 * Its own action rather than a field on DuesSchedule: the row shape is read on four
 * pages and this costs a second query, which only the Accounting editor needs. A
 * schedule missing from the map has no payments — the caller reads it as all-false.
 *
 * Gated on the same two grants that gate the schedules themselves, and for the same
 * reason: this is derived from the schedule list, and a server action is reachable on
 * its own whatever page renders it. Someone with neither grant gets nothing back.
 */
export async function getScheduleUsage(): Promise<Record<string, ScheduleUsage>> {
  const { user } = await currentUser()
  if (!user) return {}
  const [mayDues, mayDonations] = await Promise.all([
    can(user.id, 'admin/accounting/dues', 'view'),
    can(user.id, 'admin/accounting/donations', 'view'),
  ])
  if (!mayDues && !mayDonations) return {}
  const familyCode = await getMyFamilyCode(user.id)
  return loadScheduleUsage(createAdminClient(), familyCode)
}

/**
 * Returns the inserted row, not just a success flag: the admin page keeps its
 * schedule list in client state, so it needs the real row (with its real id) to
 * show the new schedule without waiting for — or depending on — a refetch.
 */
export async function createDuesSchedule(
  input: Omit<DuesSchedule, 'id' | 'active'>
): Promise<{ success: boolean; schedule?: DuesSchedule; message?: string }> {
  const supabase = await createClient()
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }
  const familyCode = await getMyFamilyCode(user.id)
  // Never taken on trust: an unrecognized kind would be a schedule nobody owes and
  // nobody can donate to, invisible on both pages.
  const kind: ScheduleKind = input.kind === 'donation' ? 'donation' : 'dues'

  // Dues and Donations are separate sections of Accounting and separate grants, so
  // the kind decides which one is demanded — resolved above from the input, never
  // trusted as a permission claim, because the invariants below are forced onto the
  // row from the same value. Someone who may open a donation drive is not thereby
  // able to change what members owe.
  if (!(await canAny(user.id, SCHEDULE_RESOURCE[kind], 'create'))) {
    return { success: false, message: t('act.notAuthorized') }
  }
  if (kind === 'donation' && !input.goal_cents) {
    return { success: false, message: t('act.donationNeedsGoalWorkToward') }
  }
  if (kind === 'dues' && !input.amount_cents) {
    return { success: false, message: t('act.duesNeedAmount') }
  }

  // Pulled out of the spread: it is a join table, not a column, and spreading it onto
  // the insert would be a PostgREST error rather than a no-op. Dues never carry one —
  // a bill nobody can see is a bill that silently never gets paid, which is why the
  // guard trigger refuses the row as well as this line ignoring it.
  const { beneficiary_person_ids, ...columns } = input
  const beneficiaryIds = kind === 'donation' ? (beneficiary_person_ids ?? []) : []

  // ── §4: THE SCOPE'S TARGET IS AN ID FROM THE CLIENT ─────────────────────────────
  // This insert runs on the USER client, so RLS is underneath it — and RLS checks the ROW,
  // never the ids the row references. The row carries the caller's own family_code and so
  // satisfies every policy on `dues_schedules` while `region_id` points into another
  // family, which is the exact shape §4 is about. Until 20260817000008 this action had no
  // foreign id to supply, which is why cases.mjs listed it as having no cross-family case
  // to construct; it has two now, and one case each.
  const scoped = normalizeScope(input)
  if (kind === 'dues' && scoped.region_id
      && !(await belongsToFamily('regions', scoped.region_id, familyCode ?? ''))) {
    return { success: false, message: t('act.regionNotFound') }
  }
  if (kind === 'dues' && scoped.chapter_id
      && !(await belongsToFamily('chapters', scoped.chapter_id, familyCode ?? ''))) {
    return { success: false, message: t('act.chapterNotFound') }
  }

  const { data, error } = await supabase
    .from('dues_schedules')
    .insert({
      ...columns,
      kind,
      // Before kindInvariants, which pins all of these to a donation's values and must win.
      start_age: normalizeStartAge(input.start_age),
      bloodline_only: Boolean(input.bloodline_only),
      ...scoped,
      ...kindInvariants(kind, input.goal_cents),
      family_code: familyCode,
      active: true,
    })
    .select('*')
    .single()
  if (error) return { success: false, message: error.message }

  // AFTER the insert, because the beneficiary rows point at the schedule that did not
  // exist until now. A failure here leaves a VISIBLE drive rather than a half-hidden
  // one, which is the right way round to fail: the treasurer is told, and nobody has
  // been shown something they should not see. Reported rather than swallowed for
  // exactly that reason — silence here would be a drive the beneficiary can read.
  if (beneficiaryIds.length > 0) {
    const synced = await syncDonationBeneficiaries(
      createAdminClient(), data.id as string, familyCode ?? '', beneficiaryIds, t,
    )
    if (!synced.ok) {
      return {
        success: false,
        message: t('dues.driveVisibleToEveryone', { reason: synced.message }),
      }
    }
  }

  revalidateMemberMoney()
  revalidatePath('/admin/accounting')
  return { success: true, schedule: mapSchedule({ ...data, donation_beneficiaries: beneficiaryIds.map(person_id => ({ person_id })) }) }
}

export async function updateDuesSchedule(
  id: string,
  input: Partial<Omit<DuesSchedule, 'id'>>
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }
  const familyCode = await getMyFamilyCode(user.id)

  // The row's own kind decides which fields are legal, so it is read rather than
  // taken from the caller — `kind` itself is not editable here. Without this an edit
  // posted from a stale form could give a donation an amount, and a donation with an
  // amount is a bill.
  //
  // Both statements are scoped to the caller's family: `admin` is the service-role
  // client and bypasses RLS, so an id is otherwise enough to edit another family's
  // schedule. The UI only ever sends ids it read from this family, but the action is
  // reachable on its own.
  const { data: existing } = await admin
    .from('dues_schedules')
    .select('kind, goal_cents, start_date, end_date, amount_cents, frequency, start_age, bloodline_only, scope, region_id, chapter_id')
    .eq('id', id).eq('family_code', familyCode).maybeSingle()
  if (!existing) return { success: false, message: t('act.scheduleNotFound') }
  const kind: ScheduleKind = existing.kind === 'donation' ? 'donation' : 'dues'

  // Gated on the ROW's kind, deliberately after it is read: this is family-wide
  // configuration with no personal copy to own, hence canAny. Checking before the read
  // would mean guessing the section from the caller's payload.
  if (!(await canAny(user.id, SCHEDULE_RESOURCE[kind], 'edit'))) {
    return { success: false, message: t('act.notAuthorized') }
  }
  const goalCents = input.goal_cents === undefined ? existing.goal_cents : input.goal_cents
  if (kind === 'donation' && !goalCents) {
    return { success: false, message: t('act.donationNeedsGoalWorkToward') }
  }

  // ── Terms that stop being editable once the ledger has been posted against ──
  //
  // The trigger from 20260807000001 is what MAKES these rules true: this action writes
  // through the service-role client, so it is the only guard, and "the only guard" is
  // precisely what that migration exists not to rely on. Repeated here so a treasurer
  // gets a sentence rather than a raised database exception, and because the form is
  // built from the same facts via getScheduleUsage() — three statements of one rule,
  // deliberately, with the database as the one that decides.
  //
  // `undefined` means "not sent", which is not the same as "cleared to null": a partial
  // update that omits a field must not read as a change to it.
  const moved = <T>(sent: T | undefined, stored: T) =>
    sent !== undefined && (sent ?? null) !== (stored ?? null)
  const movingStart = moved(input.start_date, existing.start_date)
  const movingEnd = moved(input.end_date, existing.end_date)

  if (kind === 'dues' && movingEnd && input.end_date) {
    // Floor is yesterday, not today, and the day of slack is timezone skew rather than
    // laziness — see 20260807000001's header. `min` on the date input is what holds the
    // honest case to the browser's local today; this refuses a date that is past by
    // more than any offset could explain.
    const floor = new Date()
    floor.setUTCDate(floor.getUTCDate() - 1)
    if (input.end_date < floor.toISOString().slice(0, 10)) {
      return { success: false, message: t('act.endDateCannotPast') }
    }
  }

  // Only looked up when something frozen is actually moving, so the ordinary edit —
  // a renamed due, a new end date — never touches the payments table.
  //
  // `start_age` is one of them, and it belongs here rather than being freely editable:
  // moving it restates what every member owed for the periods already posted against —
  // lowering it from 21 to 18 makes three years of nineteen-year-olds retrospectively in
  // arrears on a due nobody billed them for. Same argument as the amount.
  // The scope's three columns are read as ONE fact: `normalizeScope` cannot be applied to a
  // patch that does not mention it, so `undefined` means "not sent" here as everywhere else,
  // and the triple is only re-derived when the caller actually sent a scope.
  const scoped = input.scope === undefined ? null : normalizeScope(input)
  const movingScope = scoped !== null && (
    scoped.scope !== (existing.scope ?? 'national')
    || (scoped.region_id ?? null) !== (existing.region_id ?? null)
    || (scoped.chapter_id ?? null) !== (existing.chapter_id ?? null)
  )

  const movingTerms = movingStart
    || moved(input.amount_cents, existing.amount_cents)
    || moved(input.frequency, existing.frequency)
    || moved(input.start_age, existing.start_age)
    || moved(input.bloodline_only, existing.bloodline_only)
    // WHO OWES IT AT ALL is the strongest member of this set. Moving a due from National to
    // one chapter does not restate what a member owed for a period already billed — it
    // restates WHETHER THEY OWED IT, so last March's payment by a member of another chapter
    // becomes a payment against a due that was never theirs. 20260817000008 puts it in the
    // trigger's frozen set as well, which is the layer that decides.
    || movingScope
  if (movingTerms) {
    const usage = (await loadScheduleUsage(admin, familyCode))[id]
    if (kind === 'dues' && usage?.used) {
      return {
        success: false,
        message: t('act.paymentsBeenRecordedAgainstDue'),
      }
    }
    if (kind === 'donation' && usage?.funded && movingStart) {
      return {
        success: false,
        message: t('act.donationReceivedFundsSoIts'),
      }
    }
  }

  // §4 again, and this one is sharper than the create: this statement runs on the ADMIN
  // client, so there is no policy underneath it at all — the two `family_code` conjuncts and
  // these two checks are the whole of the defence.
  if (kind === 'dues' && scoped?.region_id
      && !(await belongsToFamily('regions', scoped.region_id, familyCode ?? ''))) {
    return { success: false, message: t('act.regionNotFound') }
  }
  if (kind === 'dues' && scoped?.chapter_id
      && !(await belongsToFamily('chapters', scoped.chapter_id, familyCode ?? ''))) {
    return { success: false, message: t('act.chapterNotFound') }
  }

  // Same reason as on create: a join table cannot ride along in the column spread.
  // `undefined` means "not sent" and leaves the set alone; an explicit [] clears it,
  // which is how a drive stops being hidden from anyone.
  //
  const { beneficiary_person_ids, ...columns } = input
  // AND THE THREE SCOPE COLUMNS COME OUT TOO, for a different reason: they are ONE fact and
  // `normalizeScope` owns it, so a raw `region_id` in the patch must never reach the row on
  // its own — an id with no `scope` beside it is a row the CHECK from 20260817000008
  // refuses, and one with a stale scope is a bill sent to the wrong half of the family.
  //
  // `delete` rather than three more names in the destructure above: every one of them would
  // be an unused binding, which is a lint warning, and `void scope` to silence it reads as
  // if the value mattered.
  delete columns.scope
  delete columns.region_id
  delete columns.chapter_id

  const { error } = await admin
    .from('dues_schedules')
    .update({
      ...columns,
      kind,
      // Only when the caller actually sent a scope — `null` means the patch did not mention
      // it, and writing the triple anyway would reset a chapter due to National on any edit
      // that omitted the field.
      ...(scoped ?? {}),
      // Only when it was SENT. `undefined` means "not in this patch" everywhere else in
      // this action, and normalizing an absent key would write null over a rule the form
      // never showed — which is how a partial update silently clears a column.
      ...(input.start_age !== undefined ? { start_age: normalizeStartAge(input.start_age) } : {}),
      ...(input.bloodline_only !== undefined ? { bloodline_only: Boolean(input.bloodline_only) } : {}),
      ...kindInvariants(kind, goalCents),
    })
    .eq('id', id)
    .eq('family_code', familyCode)
  if (error) return { success: false, message: error.message }

  if (kind === 'donation' && beneficiary_person_ids !== undefined) {
    const synced = await syncDonationBeneficiaries(
      admin, id, familyCode ?? '', beneficiary_person_ids, t,
    )
    if (!synced.ok) return { success: false, message: synced.message }
  }

  revalidateMemberMoney()
  revalidatePath('/admin/accounting')
  revalidatePath('/accounting/transactions')
  return { success: true }
}

export async function deleteDuesSchedule(id: string): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }
  const familyCode = await getMyFamilyCode(user.id)

  // Family-scoped for the same reason as the update above: the service-role client
  // does not apply RLS, so the id alone must not be enough. The row is read first so
  // its kind can choose the grant — deleting a schedule takes every member's
  // obligation with it, so it needs the unrestricted one.
  const { data: existing } = await admin
    .from('dues_schedules').select('kind, label').eq('id', id).eq('family_code', familyCode).maybeSingle()
  if (!existing) return { success: false, message: t('act.scheduleNotFound') }
  const kind: ScheduleKind = existing.kind === 'donation' ? 'donation' : 'dues'
  if (!(await canAny(user.id, SCHEDULE_RESOURCE[kind], 'delete'))) {
    return { success: false, message: t('act.notAuthorized') }
  }

  // MONEY FIRST, and this was missing until 2026-08-17 — a schedule with payments recorded
  // against it could be deleted, and the delete succeeded.
  //
  // What that did is worse than allowing it: `dues_payments.schedule_id` is
  // ON DELETE SET NULL, so the payments SURVIVED with their schedule nulled. The money
  // stayed in every total and nothing anywhere said what it had been collected for — and
  // it is irreversible, because the append-only trigger on that table permits exactly one
  // delete path (the cascade from a parent already gone) and no update at all, so the
  // attribution cannot be put back.
  //
  // The check is ABOVE the grant check being irrelevant: it comes after, because a caller
  // with no grant should be told they are not authorized rather than being told about the
  // family's finances. See lib/money-attached.ts for why this is not a RESTRICT constraint.
  const attached = await moneyAttachedTo('dues_schedule', id, familyCode)
  if (attached.any) {
    return {
      success: false,
      message: moneyAttachedMessage(
        existing.label ? `“${existing.label}”` : kind === 'donation' ? 'This donation drive' : 'This due',
        attached,
      ),
    }
  }

  const { error } = await admin.from('dues_schedules').delete().eq('id', id).eq('family_code', familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/accounting')
  revalidateMemberMoney()
  return { success: true }
}

// ── Member dues summary + pay plans ──────────────────────────────────────────

export async function getMyDuesSummary(): Promise<DuesSummary[]> {
  const supabase = await createClient()
  const { user } = await currentUser()
  if (!user) return []

  // Dues are owed per family, so this must be the active family's person row.
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return []
  const myPerson = { id: myPersonId }
  // Needed only to resolve the bloodline further down, and read here so the whole of that
  // resolution takes its family from the caller's own membership rather than from a row.
  const familyCode = await getMyFamilyCode(user.id)

  const [schedulesResult, paymentsResult, plansResult, meResult] = await Promise.all([
    supabase.from('dues_schedules').select('*').eq('active', true).order('label'),
    supabase.from('dues_payments').select('*').eq('person_id', myPerson.id).order('payment_date', { ascending: false }),
    supabase.from('dues_member_plans').select('schedule_id, cadence, opted_out').eq('person_id', myPerson.id),
    // THEIR BIRTHDAY, for the age rule. Their own row on their own client, so RLS is the
    // whole of the authorization — the `people` SELECT policy admits a member's own row,
    // and this asks for one column of it.
    //
    // `getMyPersonId` has already resolved the ACTIVE family's row, so this is scoped by
    // id rather than by user_id: a member of two families has a row in each, and reading
    // by user_id alone would match two and fail.
    //
    // `chapter_id` rides along for the SCOPE rule (20260817000008): which part of the
    // family a due is addressed to is decided against this one column, and null means the
    // member is under National — see `duesScopeMatch`.
    supabase.from('people').select('date_of_birth, chapter_id').eq('id', myPerson.id).maybeSingle(),
  ])

  // Null when not recorded, which `ageShareOfPeriod` reads as FULLY LIABLE on purpose —
  // see its header, and `computeIsMinor`, which makes the same call for the same reason.
  const me = meResult.data as { date_of_birth: string | null; chapter_id: string | null } | null
  const myDateOfBirth = me?.date_of_birth ?? null
  const myChapterId = me?.chapter_id ?? null

  // Dues only. A donation is optional, so it must never reach a remaining balance, a
  // next-installment date or the dashboard's "you owe" card — every one of which is
  // computed from this list. Filtered here rather than in the query so a database
  // that has not run 20260805000002 yet still returns the member's real dues.
  const schedules: DuesSchedule[] = (schedulesResult.data ?? [])
    .map(mapSchedule)
    .filter(s => s.kind === 'dues')
  const payments: DuesPayment[] = (paymentsResult.data ?? [])
    .map(p => ({ ...p, person_name: null, schedule_label: null, schedule_kind: null }))
  const planBySchedule = new Map<string, PayCadence>(
    (plansResult.data ?? []).map(p => [p.schedule_id, p.cadence as PayCadence]),
  )
  // Which of the OPTIONAL dues this member has declined. `?? false` rather than a
  // required column read, so a database that has not run 20260807000003 reports nobody
  // opted out — which is true of it.
  const optedOutSchedules = new Set<string>(
    (plansResult.data ?? []).filter(p => p.opted_out).map(p => p.schedule_id as string),
  )

  // Hoisted out of the map so every schedule is measured against ONE day — the same thing
  // getDonationProgress does below. A `new Date()` per row would be harmless today and
  // wrong the moment a render straddles midnight.
  const today = new Date().toISOString().slice(0, 10)

  // ── DUES THE BLOODLINE ALONE OWES ─────────────────────────────────────────────────
  // Resolved only when some active schedule actually restricts to it, so this costs one
  // boolean for every family that does not use the flag — which today is all of them. See
  // `familyBloodline`: working it out means reading the whole roster and every relationship,
  // and this runs on a screen every member opens.
  //
  // A SCHEDULE THEY ARE NOT ELIGIBLE FOR IS DROPPED, not returned with a zero. That is a
  // deliberate difference from the age rule, which keeps its row as "Not yet due" with the
  // date it starts — that row is useful because the due is coming. A due restricted to the
  // bloodline is never coming for somebody who married in, so a row explaining their
  // exclusion would be a permanent line on their own screen about how they joined the
  // family. AGENTS.md made exactly this call about the tree's cards, where the step/adopted
  // pills were removed because a word about how somebody joined, printed on their face,
  // reads as a correction attached to a person. The Dues screen lists what you owe; this is
  // not yours, so it is not there.
  //
  // 'bloodline-unknown' drops the row too, for everybody. The family has not said which
  // line it descends from, so nobody owes it — and the place that failure is reported is
  // the Accounting form, which refuses the flag without an anchor, and Dues Projections,
  // which names it on the schedule's row.
  const admin = createAdminClient()
  const bloodline = await familyBloodline(
    admin, familyCode ?? '', schedules.some(s => s.bloodline_only),
  )

  // ── DUES THIS PART OF THE FAMILY OWES ────────────────────────────────────────────
  // Resolved only when some active schedule is scoped REGIONALLY — a chapter-scoped due
  // needs no map. See `familyChapterRegions`.
  //
  // A SCHEDULE ADDRESSED SOMEWHERE ELSE IS DROPPED, not returned with a zero, exactly as a
  // bloodline-only due is for somebody who married in — and the reasoning carries over
  // whole: the Dues screen lists what YOU owe, and the Texas chapter's hall is not a debt a
  // Georgia member is failing to pay. It differs from the age rule for the same reason that
  // one keeps its row: an age-limited due is coming, and this one is not addressed to them
  // at all.
  //
  // A MEMBER IN NO CHAPTER SEES NATIONAL DUES ONLY, which is the state every family starts
  // in and every member starts in. Dues Projections is where a treasurer sees that a scoped
  // due is billing nobody; nothing here can say it, because from one member's screen there
  // is nothing to say.
  const chapterRegions = await familyChapterRegions(
    admin, familyCode ?? '', schedules.some(s => s.scope === 'regional'),
  )

  return schedules.filter(schedule => duesEligibility({
    bloodlineOnly: schedule.bloodline_only,
    bloodline,
    personId: myPerson.id,
  }) === 'owed' && duesScopeMatch({
    schedule,
    memberChapterId: myChapterId,
    chapterRegions,
  }) === 'owed').map(schedule => {
    const explicit = planBySchedule.get(schedule.id)
    const cadence = explicit ?? defaultCadence(schedule.frequency)
    // A required due cannot be opted out of, and the check is HERE as well as in the
    // trigger: a row that predates 20260807000003's guard, or one whose schedule was
    // made required after the member opted out, must read as owed rather than declined.
    const optedOut = !schedule.required && optedOutSchedules.has(schedule.id)

    const scheduleRows = payments.filter(p => p.schedule_id === schedule.id)
    const schedulePaid = scheduleRows.filter(p => p.status === 'paid')
    const periodStart = currentPeriodStart(schedule)

    // ── THE AGE RULE ────────────────────────────────────────────────────────────────
    // Computed BEFORE the annual total, because it is what the annual total is scaled by.
    // A member who reaches the schedule's start_age in July owes the months after July —
    // five twelfths of a $120 due is $50 — and the whole of it every year after. It is
    // derived from a birthday and a period on every read, never stored, for the reason
    // 20260813000006 dropped `is_minor`: an answer about somebody's age is wrong from the
    // morning they have a birthday.
    //
    // This is the ONE figure the rule touches. It flows into the remaining balance and
    // into the ladder `duesPlanMath` builds — and it deliberately does not reach the
    // ledger, the family's collected total, or any payment already recorded. Nothing is
    // refunded and no row is withheld; what changes is what this member is asked for.
    const ageShare: AgeShare = ageShareOfPeriod({
      startAge: schedule.start_age,
      dateOfBirth: myDateOfBirth,
      periodStart,
    })
    const fullAnnual = annualTotalCents(schedule)
    const annual = proratedAnnualCents(fullAnnual, ageShare)
    const paidThisPeriod = schedulePaid.filter(p => p.payment_date >= periodStart)
    // A WAIVED DUE IS SETTLED, so it comes off the balance alongside the money. Waiving
    // is the family forgiving the obligation — recordPayment refuses a method and a
    // reference on one precisely because nothing arrived — and an obligation nobody is
    // asking for any more is not a balance. Leaving it out was why waiving $50 changed
    // the ledger and left the member still owing $50.
    //
    // Same period window as a payment, and for the same reason: last year's forgiveness
    // does not settle this year's due. And the two are summed but never merged — see
    // amountWaivedThisPeriodCents on DuesSummary; only one of them is money.
    const waivedThisPeriod = scheduleRows.filter(
      p => p.status === 'waived' && p.payment_date >= periodStart,
    )
    const amountPaidThisPeriodCents = paidThisPeriod.reduce((s, p) => s + p.amount_cents, 0)
    const amountWaivedThisPeriodCents = waivedThisPeriod.reduce((s, p) => s + p.amount_cents, 0)
    const amountPaidTotalCents = schedulePaid.reduce((s, p) => s + p.amount_cents, 0)
    // Zeroed for a declined due: they owe nothing on it, and every total on the
    // dashboard and My Summary is built by summing this field.
    const remainingBalanceCents = optedOut
      ? 0
      : Math.max(0, annual - amountPaidThisPeriodCents - amountWaivedThisPeriodCents)
    const paid = remainingBalanceCents <= 0

    // ── The payment plan: what is next, when, and how far behind ──
    //
    // MONEY IN, NOT A ROW COUNT. This used to pass `paidThisPeriod.length +
    // waivedThisPeriod.length` — how many LINES were in the ledger — which made two $1
    // payments worth twice one $500 payment, and pushed the next date FORWARD every time
    // a payment was reversed (a reversal is a `paid` row with a negative amount, so it
    // counted as another installment while the money went the other way). The sum beside
    // it was always right; the count was the thing that was not.
    //
    // Waived is summed WITH paid, for the reason the balance already does it: waiving is
    // the family forgiving the obligation, so an installment they forgave is one the
    // member is not being asked for again. The two are added here and nowhere else — only
    // one of them is money, which is why they stay separate fields on the way out.
    const plan = duesPlanMath({
      schedule,
      cadence,
      periodStart,
      today,
      settledCents: amountPaidThisPeriodCents + amountWaivedThisPeriodCents,
      // The member's own figure, not the schedule's. Passed in rather than taught to
      // duesPlanMath so that one function stays the single place an installment is
      // decided and the client can reproduce this exact answer from the summary — see
      // the parameter's note there.
      annualCents: annual,
    })

    // Nothing is coming due on something already settled, declined, or not yet owed — the
    // same suppression this has always applied, kept outside duesPlanMath so the
    // arithmetic stays a property of the schedule rather than of this member's choices.
    const quiet = paid || optedOut || ageShare.exempt

    return {
      schedule,
      cadence,
      hasExplicitPlan: !!explicit,
      annualTotalCents: annual,
      // Only where the rule actually bit. Null for everybody else, so a consumer never
      // has to work out whether "12 of 12 months" means something — see the field.
      ageProration: ageShare.responsibleFrom && ageShare.monthsOwed < 12
        ? {
            startAge: schedule.start_age as number,
            monthsOwed: ageShare.monthsOwed,
            responsibleFrom: ageShare.responsibleFrom,
            fullAnnualCents: fullAnnual,
          }
        : null,
      ageExempt: ageShare.exempt,
      installmentCents: plan.installmentCents,
      nextInstallmentCents: quiet ? 0 : plan.nextInstallmentCents,
      followingInstallmentDate: quiet ? null : plan.followingInstallmentDate,
      followingInstallmentCents: quiet ? 0 : plan.followingInstallmentCents,
      overdueSinceDate: quiet ? null : plan.overdueSinceDate,
      periodsElapsed: plan.periodsElapsed,
      arrearsCents: quiet ? 0 : plan.arrearsCents,
      onSchedule: quiet ? true : plan.onSchedule,
      amountPaidThisPeriodCents,
      amountPaidTotalCents,
      amountWaivedThisPeriodCents,
      remainingBalanceCents,
      nextInstallmentDate: quiet ? null : plan.nextInstallmentDate,
      paid,
      lastPayment: payments.find(p => p.schedule_id === schedule.id) ?? null,
      required: schedule.required,
      optedOut,
    }
  })
}

/**
 * The FAMILY's progress against each active donation drive, plus the reader's share.
 *
 * Same schedules table and same payments table as dues; none of the obligation maths.
 * There is no period to bucket by either — a drive runs from start_date to end_date
 * once, so "raised" is simply everything anyone has put in.
 *
 * WHY THE ADMIN CLIENT: dues_payments RLS shows a member only their own rows, so a
 * family-wide total is unreachable through the user's client. The service-role client
 * bypasses RLS entirely, which means the family scoping RLS would have done has to be
 * done HERE, explicitly — hence `.eq('family_code', familyCode)` on the payments read.
 *
 * WHAT COMES BACK: totals. The rows are summed inside this function and only the sums
 * cross the boundary, so a member sees how far the family has got without seeing who
 * gave what. `person_id` is selected solely to split the reader's own share back out
 * and never leaves here.
 *
 * Returns [] for a family with no donations configured, which is what lets the
 * My Summary section disappear entirely rather than sit there empty.
 */
export async function getDonationProgress(): Promise<DonationSummary[]> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { user } = await currentUser()
  if (!user) return []

  const familyCode = await getMyFamilyCode(user.id)
  const myPersonId = await getMyPersonId(user.id)

  const { data: scheduleRows } = await supabase
    .from('dues_schedules').select('*').eq('active', true).order('label')
  const donations = (scheduleRows ?? []).map(mapSchedule).filter(s => s.kind === 'donation')
  if (donations.length === 0) return []

  // 'waived' has no meaning for a gift, so only real money counts toward a goal.
  const { data: paymentRows } = await admin
    .from('dues_payments')
    .select('schedule_id, person_id, amount_cents')
    .eq('family_code', familyCode)
    .eq('status', 'paid')
    .in('schedule_id', donations.map(d => d.id))

  const raisedBySchedule = new Map<string, number>()
  const mineBySchedule = new Map<string, number>()
  for (const p of paymentRows ?? []) {
    if (!p.schedule_id) continue
    raisedBySchedule.set(p.schedule_id, (raisedBySchedule.get(p.schedule_id) ?? 0) + p.amount_cents)
    if (myPersonId && p.person_id === myPersonId) {
      mineBySchedule.set(p.schedule_id, (mineBySchedule.get(p.schedule_id) ?? 0) + p.amount_cents)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return donations.map(schedule => {
    const raisedCents = raisedBySchedule.get(schedule.id) ?? 0
    const goalCents = schedule.goal_cents
    return {
      schedule,
      goalCents,
      raisedCents,
      myGivenCents: mineBySchedule.get(schedule.id) ?? 0,
      // Unclamped on purpose: a drive that doubled its goal reports 200, and the bar
      // is drawn past the goal mark to match. Capping it here would hide the best
      // thing that can happen to a fundraiser.
      progressPercent: goalCents && goalCents > 0 ? Math.round((raisedCents / goalCents) * 100) : 0,
      goalMet: goalCents != null && goalCents > 0 && raisedCents >= goalCents,
      closed: schedule.end_date != null && schedule.end_date < today,
    }
  })
}

export async function setMyDuesPlan(
  scheduleId: string,
  cadence: PayCadence,
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }
  const familyCode = await getMyFamilyCode(user.id)
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return { success: false, message: t('act.profileNotFound') }
  const myPerson = { id: myPersonId }

  // scheduleId comes from the client. The plan row below is stamped with the
  // caller's OWN family_code, so RLS is satisfied no matter which family the
  // schedule belongs to — this check is the only thing stopping a member of one
  // family enrolling against another family's schedule.
  if (!(await belongsToFamily('dues_schedules', scheduleId, familyCode))) {
    return { success: false, message: t('act.scheduleNotFound') }
  }

  const { error } = await supabase
    .from('dues_member_plans')
    .upsert(
      { person_id: myPerson.id, schedule_id: scheduleId, cadence, family_code: familyCode, created_by: myPerson.id },
      { onConflict: 'person_id,schedule_id' },
    )
  if (error) return { success: false, message: error.message }
  revalidateMemberMoney()
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Drop the caller's chosen cadence for one schedule, reverting to the default.
 *
 * Self-service under requireMember() semantics: choosing monthly versus annual is a
 * display preference, not an adjustment to a due. It changes no ledger row and no
 * annual obligation — only the installment size and next-due date shown back to the
 * member — so it needs no grant. It still owes the two checks a self-service action
 * always owes: the row is genuinely the caller's, and the id from the client belongs
 * to their family.
 *
 * The family check was missing entirely. `person_id` scoped the delete to the caller,
 * so nothing could be destroyed cross-family, but a scheduleId from another family
 * would silently match nothing and report success — and the moment this action grows
 * an upsert it becomes a real hole. Checked here rather than trusted.
 */
/**
 * Decline an OPTIONAL due, or take it back on.
 *
 * Self-service under requireMember() semantics, like setMyDuesPlan beside it: `create`
 * and `edit` default to scope 'none', so demanding a grant would mean no member could
 * ever exercise a choice the family has explicitly offered them. It still owes the two
 * checks every self-service action owes, and both are here:
 *
 *   * the row is genuinely the caller's — person_id is their own, never a parameter;
 *   * the id from the client belongs to their family — belongsToFamily, because the
 *     upsert below stamps the caller's OWN family_code, which satisfies RLS whichever
 *     family the schedule actually lives in (AGENTS.md §4).
 *
 * And one more that is specific to this action: a REQUIRED due cannot be declined. The
 * database refuses it too (dues_member_plans_optout_allowed), which is the layer that
 * actually holds — this check exists so the member is told why rather than watching a
 * raised exception. Read from the schedule ROW, never taken from the caller.
 */
export async function setMyDuesOptOut(
  scheduleId: string,
  optedOut: boolean,
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }
  const familyCode = await getMyFamilyCode(user.id)
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return { success: false, message: t('act.profileNotFound') }

  if (!(await belongsToFamily('dues_schedules', scheduleId, familyCode))) {
    return { success: false, message: t('act.scheduleNotFound') }
  }

  // Family-scoped on the admin client for the same reason every other read of a
  // client-supplied id is: the service role applies no RLS. belongsToFamily above has
  // already established the family; this reads what the row SAYS.
  const admin = createAdminClient()
  const { data: schedule } = await admin
    .from('dues_schedules').select('kind, required, label')
    .eq('id', scheduleId).eq('family_code', familyCode).maybeSingle()
  if (!schedule) return { success: false, message: t('act.scheduleNotFound') }
  if (schedule.kind === 'donation') {
    // Nothing to decline: nobody owes a donation in the first place.
    return { success: false, message: t('act.donationsAlreadyOptionalThereNothing') }
  }
  if (optedOut && schedule.required !== false) {
    return {
      success: false,
      message: t('dues.requiredCannotOptOut', { schedule: schedule.label }),
    }
  }

  const { error } = await supabase
    .from('dues_member_plans')
    .upsert(
      {
        person_id: myPersonId,
        schedule_id: scheduleId,
        opted_out: optedOut,
        family_code: familyCode,
        created_by: myPersonId,
      },
      { onConflict: 'person_id,schedule_id' },
    )
  if (error) return { success: false, message: error.message }
  revalidateMemberMoney()
  revalidatePath('/dashboard')
  return { success: true }
}

export async function clearMyDuesPlan(scheduleId: string): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }
  const familyCode = await getMyFamilyCode(user.id)
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return { success: false, message: t('act.profileNotFound') }
  const myPerson = { id: myPersonId }

  if (!(await belongsToFamily('dues_schedules', scheduleId, familyCode))) {
    return { success: false, message: t('act.scheduleNotFound') }
  }

  // The four policies on this table are all `family_code = auth_family_code() AND
  // person_id = auth_person_id()`, so a member deleting their OWN enrolment is admitted and
  // there is no grant to withhold — which is exactly why this one is worth confirming. A
  // zero-row delete here means the plan was already gone, or the schedule id belongs to a
  // row that is not theirs, and neither is an error PostgREST reports
  // (lib/confirmed-write.ts). Reporting success over it left the member looking at an
  // enrolment they had just been told was cleared.
  const outcome = await confirmWrite(() =>
    supabase
      .from('dues_member_plans')
      .delete()
      .eq('person_id', myPerson.id)
      .eq('family_code', familyCode)
      .eq('schedule_id', scheduleId)
      .select('id'))
  if (!outcome.ok) return { success: false, message: outcome.message }

  revalidateMemberMoney()
  revalidatePath('/dashboard')
  return { success: true }
}

// ── Payments ─────────────────────────────────────────────────────────────────

export async function getAllDuesPayments(): Promise<DuesPayment[]> {
  const supabase = await createClient()
  // Three embeds, and the two into `people` are BOTH constraint-qualified: dues_payments
  // has two foreign keys there (person_id, recorded_by), so a bare `people(...)` is
  // PGRST201 and PostgREST refuses the whole query — which reads as an empty ledger
  // rather than an error (AGENTS.md §8). `recorder:` aliases the second so they do not
  // collide on one key.
  const { data } = await supabase
    .from('dues_payments')
    .select(
      '*, people!dues_payments_person_id_fkey(first_name, last_name)'
      + ', recorder:people!dues_payments_recorded_by_fkey(first_name, last_name)'
      + ', dues_schedules(label, kind)',
    )
    .order('payment_date', { ascending: false })

  const rows = (data ?? []).map(mapPayment)
  // Back-link each original to the reversal that cancels it, so the ledger can mark
  // it rather than silently showing two rows that happen to sum to zero.
  const reversedBy = new Map(rows.filter(r => r.reverses_id).map(r => [r.reverses_id as string, r.id]))
  return rows.map(r => ({ ...r, reversed_by_id: reversedBy.get(r.id) ?? null }))
}

/**
 * What the family has actually collected, in cents — the Dashboard's "Dues Collected"
 * tile and nothing else.
 *
 * RETURNS `null` FOR ANYONE WITHOUT A LEDGER GRANT, and that is the whole point of the
 * function rather than an edge case. `dues_payments`'s SELECT policy opens with
 * `person_id = auth_person_id()` — the clause that makes My Summary work regardless of
 * every grant beneath it — so a plain sum through the user client returns a member their
 * OWN payments when they hold nothing. Rendering that under the caption "Dues Collected"
 * would tell a member their $50 was the family's entire year. So the grant is checked
 * first and the query is not run at all without it.
 *
 * `canAny`, not `can`. A family-wide total has no coherent "own" version — the row a
 * member would own is precisely the misreading above — which is the case AGENTS.md names
 * for this helper. It also matches the policy, which tests `= 'any'` on both ledger keys
 * for the same reason `components/admin/resource-groups.ts` drops the 'own' button for
 * every `transactions/` key.
 *
 * EITHER ledger admits it, mirroring the policy exactly. dues_payments holds dues and
 * donations together, split by `dues_schedules.kind`, and the policy cannot separate them
 * — see 20260808000001, which explains why at length. So this total is dues AND donations
 * collected, and the tile says "Dues Collected" because that is the caption on the screen
 * it links to; if the two are ever split, they split here and in the policy together.
 *
 * THE USER CLIENT, DELIBERATELY, not the admin one. RLS already does the family isolation
 * and the grant check, so reaching past it would mean re-implementing both by hand for no
 * gain (AGENTS.md §3). There is no `.eq('family_code', …)` here because there must not be
 * one: `auth_family_code()` in the policy is the authority, and a second copy in the query
 * is a second thing to get wrong.
 *
 * `status = 'paid'` only. 'waived' settles an obligation without money arriving, and
 * 'pending' has not arrived yet. Reversals need no special handling: the ledger is
 * append-only and `reversePayment` writes `-original.amount_cents`, so they net out in the
 * sum for free.
 */
export async function getFamilyDuesCollected(): Promise<number | null> {
  const supabase = await createClient()
  const { user } = await currentUser()
  if (!user) return null

  const entitled =
    (await canAny(user.id, 'accounting/transactions/dues-payments', 'view'))
    || (await canAny(user.id, 'accounting/transactions/donation-payments', 'view'))
  if (!entitled) return null

  // `error` is read rather than discarded. `const { data }` alone turns a refused query
  // into `[]`, and `[]` sums to 0 — so a broken query would render "$0 collected" over a
  // year of payments, which is worse than rendering nothing (AGENTS.md §8).
  const { data, error } = await supabase
    .from('dues_payments')
    .select('amount_cents')
    .eq('status', 'paid')

  if (error) return null
  return (data ?? []).reduce((sum, row) => sum + (row.amount_cents ?? 0), 0)
}

/**
 * Who is in this family's bloodline, for the two readers that price dues.
 *
 * ── IT IS SKIPPED ENTIRELY WHEN NOTHING NEEDS IT ────────────────────────────────────
 * `needed` is false unless some active dues schedule actually carries `bloodline_only`, and
 * that guard is the reason this is affordable at all. Working the bloodline out means
 * reading the whole roster AND every relationship in the family — the two queries
 * `getFamilyTree` makes — and `getMyDuesSummary` runs on a screen every member opens. No
 * family uses this flag today, so today it costs one boolean.
 *
 * ── NULL IS "DO NOT KNOW", AND IS RETURNED FOR THREE DIFFERENT REASONS ──────────────
 * No anchor set and no founder row to fall back on; an anchor pointing at somebody outside
 * the roster; or a read that failed. All three mean the same thing to a caller and all
 * three must NOT be read as an empty set — `duesEligibility` is what enforces that, and it
 * bills nobody rather than everybody. A refused query is folded in deliberately: §8's rule
 * is that an empty result and a refusal are different things, and here the safe direction
 * for a failure is the one that under-bills.
 *
 * ── THE ADMIN CLIENT, FOR THE REASON `getFamilyTree` USES IT ────────────────────────
 * The `people` SELECT policy hides applicants from anybody without `admin/approvals`, and a
 * half-visible roster produces a half-walked tree — which here would silently drop members
 * OUT of the bloodline and stop billing them. `.eq('family_code', …)` on both reads, from
 * the caller's own membership (§3).
 *
 * DELIBERATELY NOT `getFamilyTree()` ITSELF, which gates on `family-tree:view` and returns
 * an EMPTY tree to anyone it refuses. An empty tree yields an empty bloodline, which is
 * exactly the value that must never be mistaken for a real one — a member without that
 * grant would stop owing their dues. This reads what it needs and takes its authorization
 * from the action that called it.
 */
async function familyBloodline(
  admin: ReturnType<typeof createAdminClient>,
  familyCode: string,
  needed: boolean,
): Promise<ReadonlySet<string> | null> {
  if (!needed) return null

  const [peopleRes, edgeRes, familyRes] = await Promise.all([
    admin.from('people').select('id, user_id').eq('family_code', familyCode),
    admin.from('person_relationships')
      .select('person_id, related_person_id, relationship_type_id, link_kind')
      .eq('family_code', familyCode),
    admin.from('families').select('created_by, bloodline_anchor_id')
      .eq('family_code', familyCode).maybeSingle(),
  ])

  if (peopleRes.error || edgeRes.error || familyRes.error) {
    console.error('[dues] could not resolve the bloodline for ' + familyCode + ': '
      + (peopleRes.error?.message ?? edgeRes.error?.message ?? familyRes.error?.message))
    return null
  }

  // The relationship vocabulary is global and unscoped by design — `relationship_types`
  // has no family_code and is the same twenty rows for everybody (20260602000003).
  const { data: types } = await admin.from('relationship_types').select('id, name')
  const nameById = new Map(
    ((types ?? []) as { id: string; name: string }[]).map(t => [t.id, t.name]),
  )

  const roster = (peopleRes.data ?? []) as { id: string; user_id: string | null }[]
  const people = roster.map(p => ({ id: p.id }))

  // BOTH DIRECTIONS, exactly as `getFamilyTree` normalizes them, because whether the
  // inverse row was ever written depends on whether anybody knew a gender at the time. A
  // one-directional walk here would drop half the parentage and under-bill accordingly.
  const edges: TreeLink[] = []
  for (const row of (edgeRes.data ?? []) as {
    person_id: string; related_person_id: string
    relationship_type_id: string; link_kind: string | null
  }[]) {
    const relation = relationFor(nameById.get(row.relationship_type_id) ?? '')
    if (!relation) continue
    const kind: LinkKind = isLinkKind(row.link_kind ?? '') ? (row.link_kind as LinkKind) : 'blood'
    edges.push({ from: row.person_id, to: row.related_person_id, relation, kind })
    edges.push({
      from: row.related_person_id, to: row.person_id,
      relation: relation === 'parent' ? 'child' : relation === 'child' ? 'parent' : relation,
      kind,
    })
  }

  // The family's stated line first, the founder only as a fallback — the same resolution
  // `getFamilyTree` performs, and it must stay the same: two answers to "whose line is
  // this" would mean the tree and the bill disagreeing about who is blood.
  const family = familyRes.data as
    { created_by: string | null; bloodline_anchor_id: string | null } | null
  const chosen = family?.bloodline_anchor_id
  const anchor = (chosen && roster.some(p => p.id === chosen))
    ? chosen
    : (family?.created_by
      ? roster.find(p => p.user_id === family.created_by)?.id ?? null
      : null)

  return bloodlineIds(people, edges, anchor)
}

/**
 * `chapters` as chapter id -> region id, which is what a member's REGION is derived from.
 *
 * ── SKIPPED ENTIRELY WHEN NOTHING NEEDS IT ──────────────────────────────────────────
 * `needed` is false unless some active schedule is scoped REGIONALLY. A chapter-scoped due
 * needs no map at all — `people.chapter_id` and the schedule's `chapter_id` are the whole
 * comparison — and a national one needs nothing. The same shape, and the same reason, as
 * `familyBloodline`: /dues is a screen every member opens, so a read it does not need must
 * not happen. For a family with no regions, which is every family today, this costs one
 * boolean.
 *
 * ── THE ADMIN CLIENT, AND WHY IT HAS TO BE ─────────────────────────────────────────
 * The composed SELECT policy on `chapters` demands `admin/chapters:view = 'any'`, an
 * administrator-only key, so through the user's client an ordinary member reads NO chapters
 * — and would then stop owing every regional due in the family. That is the same trap
 * `familyBloodline` documents about `getFamilyTree`: a half-visible read produces a
 * half-billed member. `.eq('family_code', …)` from the caller's own membership (§3).
 *
 * ── A FAILED READ UNDER-BILLS, DELIBERATELY ────────────────────────────────────────
 * An empty map makes every regional due read as out-of-scope for everybody, which bills
 * nobody. Same direction `duesEligibility` takes for an unknown bloodline and for the same
 * reason: over-billing quietly charges people the family deliberately excluded, while
 * under-billing is visible — Dues Projections reports the schedule as billing nobody, which
 * is `scopeEmpty` on its row.
 */
async function familyChapterRegions(
  admin: ReturnType<typeof createAdminClient>,
  familyCode: string,
  needed: boolean,
): Promise<ReadonlyMap<string, string | null>> {
  const empty = new Map<string, string | null>()
  if (!needed || !familyCode) return empty

  const { data, error } = await admin
    .from('chapters').select('id, region_id').eq('family_code', familyCode)
  if (error) {
    console.error(`[dues] could not resolve chapter regions for ${familyCode}: ${error.message}`)
    return empty
  }
  return new Map((data ?? []).map(c => [c.id as string, (c.region_id as string | null) ?? null]))
}

/**
 * What the regions and chapters a schedule is scoped to are CALLED — id -> name.
 *
 * A label, and nothing decides anything from it. Read only when some schedule is actually
 * scoped, and family-scoped by hand because the service role applies no RLS (§3). Both
 * tables in one map: uuids from two tables cannot collide, and the caller already knows
 * which kind it is asking about from the schedule's `scope`.
 *
 * A REFUSED READ LOSES A CAPTION AND NOTHING ELSE, which is why this one does not fail
 * toward anything — the figures beside it are computed from `familyChapterRegions`, and the
 * screen falls back to the bare words "region" and "chapter" rather than printing a uuid.
 */
async function familyPlaceNames(
  admin: ReturnType<typeof createAdminClient>,
  familyCode: string,
  needed: boolean,
): Promise<Record<string, string>> {
  if (!needed || !familyCode) return {}
  const [regionsRes, chaptersRes] = await Promise.all([
    admin.from('regions').select('id, name').eq('family_code', familyCode),
    admin.from('chapters').select('id, name').eq('family_code', familyCode),
  ])
  if (regionsRes.error || chaptersRes.error) {
    console.error('[dues] could not read region/chapter names for ' + familyCode + ': '
      + (regionsRes.error?.message ?? chaptersRes.error?.message))
    return {}
  }
  const out: Record<string, string> = {}
  for (const r of [...(regionsRes.data ?? []), ...(chaptersRes.data ?? [])]) {
    out[r.id as string] = r.name as string
  }
  return out
}

/**
 * A member as the projection screen names them. Same shape `SelectablePerson` uses, so
 * `disambiguatedName` works on it unchanged — two Martha Allens matter more on this screen
 * than on most, because chasing the wrong one for $120 is the mistake it would cause.
 */
export interface ProjectionPerson {
  id: string
  first_name: string
  last_name: string
  nick_name: string | null
  date_of_birth: string | null
}

export interface DuesProjectionResult {
  projection: DuesProjection
  /**
   * The roster the member rows are joined to by id — EVERY approved person in the family,
   * whether or not they have an account.
   *
   * It was accounts only until 2026-08-18. A projection is what the family is OWED and a
   * recorded relative owes it, so leaving them out reported a debt smaller than the real one;
   * `lib/dues-projection.ts`'s header carries the whole argument, including why the roster is
   * NOT gated on the bloodline. `primary_email` is read to resolve invitations and is
   * deliberately not on this shape — see the mapping at the end of `getDuesProjection`.
   */
  people: ProjectionPerson[]
  /**
   * Region and chapter NAMES, keyed by id, for the schedules that are scoped to one.
   *
   * One map rather than two: the ids are uuids from two tables that cannot collide, and the
   * screen's question is "what is this place called" without caring which kind it is — the
   * row already knows that from `scope`.
   *
   * EMPTY WHEN NOTHING IS SCOPED, so a family that has never used regions or chapters pays
   * nothing for the feature (§5: not fetching is what keeps it off the wire). A missing name
   * renders as the plain word "region" or "chapter"; a raw uuid is never shown to a reader.
   */
  placeNames: Record<string, string>
}

/**
 * What the family should collect in dues this year, what it has, and from whom.
 *
 * ── RETURNS `null` FOR ANYONE WITHOUT THE GRANT, and that is the function's shape rather
 * than an edge case — the same call `getFamilyDuesCollected` makes and for the same
 * reason. Every figure here is family-wide, so a caller who may not ask must get nothing
 * back to render rather than a zeroed skeleton that reads as "your family has collected
 * nothing".
 *
 * `canAny`, NOT `can`. `can()` is true for scope 'own', and there is no own version of a
 * family-wide projection — the member's own answer is /dues, computed by
 * getMyDuesSummary(). An own-scoped grant on this key would otherwise hand somebody every
 * member's balance by name. `dues-projections` is in `NO_OWNER_KEYS` so Members & Access
 * does not offer the switch either, and this is the half that enforces it.
 *
 * ── THE ADMIN CLIENT, AND WHY IT HAS TO BE ──────────────────────────────────────────
 * `dues_payments`'s SELECT policy opens with `person_id = auth_person_id()` — the clause
 * that makes /dues work for everybody regardless of every grant beneath it — so through
 * the user's client this projection would be one member's own row and would report their
 * $120 as the family's entire year. The service role sees past that, which is exactly why
 * §3's obligation is discharged by hand: `.eq('family_code', familyCode)` on all four
 * reads, from the caller's own membership and never from an argument. There is no
 * parameter on this function at all, so there is no client-supplied id to check.
 *
 * ── WHO IS COUNTED, AND WHY IT IS NO LONGER ACCOUNTS ONLY ───────────────────────────
 * Every approved person in the family — the Member Directory's own set — rather than only the
 * ones with an auth account. §4b's table says dues surfaces are accounts-only because "a
 * record cannot pay or be paid", and that is right about a PICKER and wrong here: this screen
 * is what the family is owed, and a grandmother on the tree who never finished registering
 * owes her dues. `lib/dues-projection.ts`'s header is where that reversal is argued out,
 * including why the roster is not gated on the bloodline.
 *
 * A FIFTH READ CAME WITH IT: the family's OPEN invitations, which is what separates somebody
 * the family has asked from somebody it has not. It rides in the same `Promise.all` and is not
 * made conditional on the roster containing an accountless row, because deciding that would
 * need the roster back first and cost a second round trip to save an indexed read on a table
 * with a handful of rows.
 *
 * ── WHAT CROSSES THE BOUNDARY ───────────────────────────────────────────────────────
 * Totals and one row per person. No payment rows, no dates, no methods, no references —
 * the ledger is `/accounting/transactions`, behind its own grants, and a projection does not need to
 * republish it. What it does publish is every member's standing by name, which is why the
 * resource is `restricted` by default rather than `everyone` (§6). Since the roster grew, that
 * now includes the names of people with no account; their names are already on the family tree
 * and in the Directory, and no ADDRESS crosses — `primary_email` is read for the invitation
 * join and dropped before the return.
 *
 * ── THE ARITHMETIC IS NOT HERE ──────────────────────────────────────────────────────
 * `projectDues` in lib/dues-projection.ts, pure and tested. This function decides who may
 * ask and reads four tables; every reduction that pulls a figure down — the age rule,
 * opting out, waivers, the period boundary — is checkable without a database because of
 * that split (§7b).
 */
export async function getDuesProjection(): Promise<DuesProjectionResult | null> {
  const { user } = await currentUser()
  if (!user) return null

  if (!(await canAny(user.id, 'reporting/dues-projections', 'view'))) return null

  const familyCode = await getMyFamilyCode(user.id)
  if (!familyCode) return null
  const admin = createAdminClient()

  // ONE CLOCK for the invitation window below, read once so two rows a microsecond apart
  // cannot be judged against two different "now"s.
  const now = new Date().toISOString()

  const [schedulesRes, peopleRes, paymentsRes, plansRes, invitesRes] = await Promise.all([
    admin.from('dues_schedules')
      .select('id, label, amount_cents, frequency, start_date, end_date, due_month, due_day, start_age, bloodline_only, scope, region_id, chapter_id, required, kind')
      .eq('family_code', familyCode).eq('active', true).order('label'),
    // APPROVED, AND THAT IS THE ONLY TEST — no `user_id` filter, which is the change of
    // 2026-08-18 and the reason the header has a section about §4b. This is the Member
    // Directory's own set, so the two counts can no longer disagree; an applicant is still
    // out, because they have not joined and nothing is owed by them yet.
    //
    // `user_id` is selected to DERIVE the three states rather than to filter on, and
    // `primary_email` to join the open invitations to the people they are about — see
    // `invitedPersonIds`. Neither reaches the browser.
    //
    // `chapter_id` rides along for the SCOPE rule, and it is selected unconditionally
    // rather than only when a scoped schedule exists: this query is the roster and cannot
    // be re-run cheaply, so deciding per request whether to include one column would buy
    // nothing and could get it wrong. Null means the member is under National.
    //
    // ── AND `sunset_date IS NULL`, SINCE 2026-08-20: A DEAD RELATIVE OWES NOTHING ────
    // `sunset_date` is the column that records somebody has died, and until this line a
    // deceased member stayed `membership_status = 'approved'` — correctly, nobody un-admits
    // them — and so went on appearing in every projection as a person who owes this year's
    // dues. An organizer's list of who to chase had the family's dead on it, and the figure
    // the board was given was overstated by their share.
    //
    // THE PRECEDENT IS BIRTHDAYS, and it is the same column doing the same job:
    // `getUpcomingBirthdays` in app/actions/announcements.ts is `.is('sunset_date', null)`
    // for the reason `lib/birthdays.ts` states — "a dead relative has no next birthday". A
    // dead relative has no next installment either.
    //
    // IT IS IN THE QUERY RATHER THAN IN `projectDues`, deliberately. That module is pure and
    // takes a ROSTER; it has no opinion about who belongs on one, and the §5 reason is the
    // decisive one — a member excluded here is not fetched, so no name and no birthday of
    // theirs reaches the browser on a screen that has no business listing them.
    //
    // WHAT THIS DELIBERATELY DOES NOT DO is remove them from the Transactions picker, so a
    // final payment from an estate can still be recorded against the person it was for. What
    // is being withheld is the OBLIGATION, not the ledger — the same distinction the tier
    // gates keep, and the reason a past payment of theirs still counts toward what the family
    // collected.
    admin.from('people')
      .select('id, first_name, last_name, nick_name, date_of_birth, chapter_id, user_id, primary_email')
      .eq('family_code', familyCode).eq('membership_status', 'approved')
      .is('sunset_date', null)
      .order('last_name').order('first_name'),
    admin.from('dues_payments')
      .select('person_id, schedule_id, amount_cents, status, payment_date')
      .eq('family_code', familyCode).not('schedule_id', 'is', null),
    admin.from('dues_member_plans')
      .select('person_id, schedule_id, opted_out')
      .eq('family_code', familyCode),
    // OPEN INVITATIONS: not accepted, not revoked, not expired. The same three conditions
    // `peek_family_invitation` applies, so the screen and the link agree about what an open
    // invitation is — an expired token cannot be redeemed, and reporting the family as having
    // asked would report work as done.
    //
    // NO EMBED. `family_invitations` has THREE foreign keys to `people` — `invited_by`,
    // `accepted_by` and `invited_person_id` — so a bare `people(...)` here is PGRST201, which
    // §8 says arrives as `[]` and would silently file every invited relative under "nobody has
    // asked them". Two plain columns and a join in TypeScript instead.
    admin.from('family_invitations')
      .select('email, invited_person_id')
      .eq('family_code', familyCode)
      .is('accepted_at', null).is('revoked_at', null).gt('expires_at', now),
  ])

  // §8: `data` alone cannot tell a refused query from an empty table, and here the two
  // deserve very different answers. An empty `dues_payments` really is "nobody has paid";
  // a REFUSED one is an outage wearing that sentence, and a treasurer reading "$0
  // collected" over a year of payments would take it to a board meeting.
  if (schedulesRes.error || peopleRes.error || paymentsRes.error || plansRes.error) {
    console.error('[dues-projection] could not read the projection for ' + familyCode + ': '
      + (schedulesRes.error?.message ?? peopleRes.error?.message
        ?? paymentsRes.error?.message ?? plansRes.error?.message))
    return null
  }

  type PersonRow = ProjectionPerson & {
    chapter_id: string | null; user_id: string | null; primary_email: string | null
  }
  const roster = (peopleRes.data ?? []) as PersonRow[]

  // §8 AGAIN, AND A DIFFERENT ANSWER FROM THE FOUR ABOVE. A refused invitations read costs
  // one LABEL and no money: every accountless person then reads 'Pending Invite', which says
  // "ask them" — recoverable, and visible. Failing the whole page instead would withhold four
  // correct figures because a fifth caption is unavailable, and failing toward 'Invited' would
  // report work as already done. Logged so the outage is not silent.
  if (invitesRes.error) {
    console.error('[dues-projection] could not read open invitations for ' + familyCode + ': '
      + invitesRes.error.message)
  }
  const invited = invitedPersonIds(
    roster.map(p => ({
      personId: p.id, hasAccount: Boolean(p.user_id), email: p.primary_email,
    })),
    ((invitesRes.data ?? []) as { email: string; invited_person_id: string | null }[])
      .map((r): OpenInvitation => ({ personId: r.invited_person_id, email: r.email })),
  )

  // DUES ONLY. A donation is offered, never owed, so a drive in this total would invent a
  // debt — and the beneficiary policies from 20260811000000 do not apply to the admin
  // client, so nothing else would keep it out.
  const schedules = (schedulesRes.data ?? [])
    .filter(s => s.kind !== 'donation')
    .map(s => ({
      id: s.id as string,
      label: s.label as string,
      required: s.required ?? true,
      amount_cents: s.amount_cents as number,
      frequency: s.frequency as string,
      start_date: s.start_date as string | null,
      end_date: s.end_date as string | null,
      due_month: s.due_month as number | null,
      due_day: s.due_day as number | null,
      start_age: s.start_age as number | null,
      bloodline_only: Boolean(s.bloodline_only),
      // `duesScope` takes a DuesScheduleLike and normalizes anything it does not recognize
      // to 'national' — which is what a database that has not run 20260817000008 answers.
      // The row from the untyped client satisfies that shape by having the columns; the
      // cast names it once rather than repeating `as string | null` per field.
      scope: duesScope(s as DuesScheduleLike),
      region_id: (s.region_id as string | null) ?? null,
      chapter_id: (s.chapter_id as string | null) ?? null,
    }))

  // Only when a schedule actually restricts to the bloodline — see `familyBloodline`.
  const bloodline = await familyBloodline(
    admin, familyCode, schedules.some(s => s.bloodline_only),
  )
  // And only when one is scoped REGIONALLY — see `familyChapterRegions`. A chapter-scoped
  // due is answered by `people.chapter_id` alone.
  const chapterRegions = await familyChapterRegions(
    admin, familyCode, schedules.some(s => s.scope === 'regional'),
  )

  const projection = projectDues({
    schedules,
    bloodline,
    chapterRegions,
    // THE WHOLE APPROVED ROSTER. `hasAccount` and `invitationOpen` are what `memberStatus`
    // derives Active / Invited / Pending Invite from; neither changes a figure.
    members: roster.map(p => ({
      personId: p.id,
      dateOfBirth: p.date_of_birth,
      chapterId: p.chapter_id,
      hasAccount: Boolean(p.user_id),
      invitationOpen: invited.has(p.id),
    })),
    payments: (paymentsRes.data ?? []).map(r => ({
      personId: r.person_id as string,
      scheduleId: r.schedule_id as string,
      amountCents: r.amount_cents as number,
      status: r.status as string,
      paymentDate: r.payment_date as string,
    })),
    plans: (plansRes.data ?? []).map(r => ({
      personId: r.person_id as string,
      scheduleId: r.schedule_id as string,
      optedOut: Boolean(r.opted_out),
    })),
  })

  // `user_id`, `chapter_id` AND `primary_email` are dropped rather than passed through: the
  // first two have already done their work inside `projectDues` (the status and the scope
  // rule), and the address was only ever read to join the open invitations. Only the four
  // columns the name helper needs cross the wire (§5) — a roster of email addresses is PII
  // this screen has no use for, and the RSC payload would carry it whether or not anything
  // rendered it.
  return {
    projection,
    people: roster.map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      nick_name: p.nick_name,
      date_of_birth: p.date_of_birth,
    })),
    placeNames: await familyPlaceNames(
      admin, familyCode, schedules.some(s => s.scope !== 'national'),
    ),
  }
}

/**
 * The regions and chapters a dues schedule can be scoped to.
 *
 * ── WHY IT IS NOT `getRegions()` AND `getChapters()` ───────────────────────────────
 * Those two are gated on `admin/chapters`, which is the grant to EDIT the family's
 * structure. This list is a field on the dues form, and the person who maintains what
 * members owe is not necessarily the person who draws the map — so it is gated on the
 * section that renders it, `admin/account/dues:view`, and on nothing else. Names of regions
 * and chapters are family structure rather than PII, and a treasurer setting up a regional
 * due has to be able to see which regions exist.
 *
 * ── IT OFFERS ONLY WHAT EXISTS ─────────────────────────────────────────────────────
 * Empty arrays for a family with no regions and no chapters — which is every Free family,
 * since `/admin/members/organization` is `tier: 'plus'` — and the form then offers National alone
 * rather than a disabled tease for something they cannot create from that screen. National
 * is not in either list because it is not a row: it is the absence of a region, and the
 * form's own default.
 */
export async function getDuesScopeOptions(): Promise<{
  regions: { id: string; name: string }[]
  chapters: { id: string; name: string; region_id: string | null }[]
}> {
  const { user } = await currentUser()
  if (!user) return { regions: [], chapters: [] }
  if (!(await can(user.id, 'admin/accounting/dues', 'view'))) return { regions: [], chapters: [] }

  const familyCode = await getMyFamilyCode(user.id)
  if (!familyCode) return { regions: [], chapters: [] }
  // The admin client, for the reason `familyChapterRegions` gives: the policy on both
  // tables demands `admin/chapters:view = 'any'`, so a treasurer without that key would see
  // an empty picker and no explanation. Family-scoped by hand (§3).
  const admin = createAdminClient()
  const [regionsRes, chaptersRes] = await Promise.all([
    admin.from('regions').select('id, name').eq('family_code', familyCode).order('name'),
    admin.from('chapters').select('id, name, region_id').eq('family_code', familyCode).order('name'),
  ])
  // §8: an empty picker and a refused query are the same shape and very different facts —
  // the first is a family with no chapters, the second is a treasurer told they have none.
  if (regionsRes.error || chaptersRes.error) {
    console.error('[dues] could not read scope options for ' + familyCode + ': '
      + (regionsRes.error?.message ?? chaptersRes.error?.message))
    return { regions: [], chapters: [] }
  }
  return {
    regions: (regionsRes.data ?? []) as { id: string; name: string }[],
    chapters: (chaptersRes.data ?? []) as { id: string; name: string; region_id: string | null }[],
  }
}

export async function getMyPaymentHistory(): Promise<DuesPayment[]> {
  const supabase = await createClient()
  const { user } = await currentUser()
  if (!user) return []

  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return []
  const myPerson = { id: myPersonId }

  // No recorder embed, deliberately. This is the member's own history behind My Summary,
  // and who keyed the payment in is treasurer bookkeeping the member has no use for.
  // Not fetching it is the point rather than not rendering it: props are serialized into
  // the RSC payload and reach the browser whether a component reads them or not
  // (AGENTS.md §5), so leaving the embed out is what actually keeps it off the page.
  // mapPayment then resolves recorded_by_name to null on its own.
  const { data } = await supabase
    .from('dues_payments')
    .select('*, dues_schedules(label, kind)')
    .eq('person_id', myPerson.id)
    .order('payment_date', { ascending: false })

  // Dues and donations both live here, tagged by schedule_kind so the member's
  // history can say which each row was.
  return (data ?? []).map(p => ({ ...mapPayment(p), person_name: null }))
}

/**
 * `schedule_id` is required. A payment with no schedule never shows up in
 * getMyDuesSummary (which buckets strictly by schedule_id) or in a member's
 * remaining balance, so recording one is silently useless — the admin sees it in
 * Payment History and the member's dues never move.
 *
 * THIS IS THE MANUAL-ENTRY ENDPOINT, and the validation below is scoped to that. It
 * demands a method and a reference for money it is told arrived, because this row is
 * the only record that the cheque or the handover ever existed — the same argument
 * `recordFundContribution` has always made, applied to the ledger that was missing it.
 *
 * It also refuses status 'pending'. Nothing manual is pending: a treasurer typing a
 * payment in is recording something that already happened, and the two honest outcomes
 * are that the money came ('paid') or that the family let it go ('waived'). 'pending'
 * remains a legal state in the TABLE and the pending -> paid settlement remains open in
 * 20260806000002's trigger, because that is the shape an online-payment webhook needs:
 * insert at checkout, settle on confirmation. That path will have its own entry point,
 * and it is not this one.
 */
export async function recordPayment(input: {
  person_id: string
  schedule_id: string
  amount_cents: number
  status: 'paid' | 'pending' | 'waived'
  payment_date: string
  payment_method: string | null
  payment_reference: string | null
  notes: string | null
}): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }
  const familyCode = await getMyFamilyCode(user.id)
  const { data: myPerson } = await supabase
    .from('people').select('id')
    .eq('user_id', user.id)
    .eq('family_code', familyCode)
    .maybeSingle()
  if (!myPerson) return { success: false, message: t('act.profileNotFound') }

  // Required, and re-scoped to this family here: the insert below runs on the admin
  // client, which bypasses RLS, so nothing else would stop a schedule id belonging
  // to another family from being written onto this family's payment.
  //
  // `kind` is read from the schedule ROW, never from the client: it decides which
  // permission is demanded, so accepting it as an argument would let a caller with
  // only donation rights post a dues payment by mislabelling it.
  if (!input.schedule_id) return { success: false, message: t('act.duesScheduleRequired') }
  const { data: schedule } = await admin
    .from('dues_schedules')
    .select('id, kind')
    .eq('id', input.schedule_id)
    .eq('family_code', familyCode)
    .maybeSingle()
  if (!schedule) return { success: false, message: t('act.duesScheduleNotFound') }

  // A drive's beneficiary may not record against it, and the wording is the same
  // "not found" the line above gives — telling them the id is real but forbidden is
  // telling them a drive exists that they are not supposed to know about.
  //
  // THIS READ IS ON THE ADMIN CLIENT, so the restrictive policies from 20260811000000
  // do not apply and this is the only thing standing here (AGENTS.md §3). The id can
  // only have come from outside the UI — the drive is absent from every list this
  // caller can fetch — so reaching this line at all means a forged or stale argument.
  const { data: hiddenFromMe } = await admin
    .from('donation_beneficiaries')
    .select('id')
    .eq('schedule_id', schedule.id)
    .eq('person_id', myPerson.id)
    .eq('family_code', familyCode)
    .maybeSingle()
  if (hiddenFromMe) return { success: false, message: t('act.duesScheduleNotFound') }

  // Recording a payment asserts that money changed hands. The person who OWES it does
  // not get to make that assertion — basic accounting, and the reason the old
  // self-payment branch is gone. The member-facing path is Pay Online, where a
  // processor attests instead of the member.
  //
  // The branch this replaces was also a live privilege escalation:
  //     if (!(await can(user.id, 'accounting/dues-and-donations', 'edit')) && input.person_id !== myPerson.id)
  // can() is TRUE for scope 'own', so an own-scoped grant made the first operand false,
  // short-circuited the && , and authorised recording a payment for ANYONE.
  // (That `dues` key no longer exists at all — 20260808000001 retired it.)
  //
  // canAny, not can: these records have no coherent "own" version — a payment recorded
  // for yourself is precisely the abuse case.
  const kind: ScheduleKind = schedule.kind === 'donation' ? 'donation' : 'dues'
  const resource = kind === 'donation'
    ? 'accounting/transactions/donation-payments'
    : 'accounting/transactions/dues-payments'
  if (!(await canAny(user.id, resource, 'create'))) {
    return {
      success: false,
      message: kind === 'donation'
        ? 'You do not have permission to record donation payments.'
        : 'You do not have permission to record dues payments.',
    }
  }

  // The person being credited must be in this family. person_id is client-supplied and
  // is written onto a row stamped with the caller's own family_code, which satisfies
  // RLS regardless of where that person actually lives.
  if (!(await belongsToFamily('people', input.person_id, familyCode))) {
    return { success: false, message: t('act.memberNotFound') }
  }

  // ── What a manual entry is allowed to say happened ──
  //
  // Which statuses are open depends on the kind, and the kind came from the schedule
  // ROW above rather than the caller. Waiving a donation is meaningless — nobody owed
  // it, so there is nothing to forgive — which leaves a gift with exactly one outcome
  // worth recording. The form hides the field entirely for that reason; this is what
  // makes the hidden field true rather than merely absent.
  const allowed: readonly string[] = kind === 'donation' ? ['paid'] : ['paid', 'waived']
  if (!allowed.includes(input.status)) {
    return {
      success: false,
      message: kind === 'donation'
        ? 'A donation payment can only be recorded as paid.'
        : 'A dues payment can only be recorded as paid or waived.',
    }
  }

  // Method and reference are required for money that ARRIVED, and forced empty for
  // money that did not. A waived due has no cheque to number: carrying "Cash" and a
  // reference on it would put a payment that never happened into the evidence trail,
  // and the ledger's whole value is that its rows mean what they say.
  const waived = input.status === 'waived'
  const method = waived ? null : (input.payment_method?.trim() || null)
  const reference = waived ? null : (input.payment_reference?.trim() || null)
  if (!waived) {
    if (!method) return { success: false, message: t('act.recordHowPaymentMade') }
    if (!reference) return { success: false, message: t('act.recordCheckNumberReferencePayment') }
  }

  const { data: payment, error } = await admin.from('dues_payments').insert({
    family_code: familyCode,
    person_id: input.person_id,
    schedule_id: input.schedule_id,
    amount_cents: input.amount_cents,
    status: input.status,
    payment_date: input.payment_date,
    payment_method: method,
    payment_reference: reference,
    notes: input.notes,
    recorded_by: myPerson.id,
  }).select('id, amount_cents, payment_date, routed_at').single()
  if (error || !payment) return { success: false, message: error?.message ?? 'Failed to record payment' }

  // Route the money. Only paid payments contribute — dues split across the funds by the
  // routing table, a donation goes whole into the Donations fund.
  if (input.status === 'paid') {
    await routePaidPayment(admin, familyCode, payment, myPerson.id, kind)
  }

  revalidateMemberMoney()
  revalidatePath('/admin/accounting')
  revalidatePath('/reporting/pl-summary')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Post a correcting entry against a payment.
 *
 * dues_payments is append-only — 20260806000002 enforces that with a trigger the
 * service role cannot bypass — so a mis-keyed amount is corrected by posting an equal
 * and opposite row, never by editing or deleting the original. Both stay visible,
 * which is the point: the ledger records what happened, including the mistake.
 *
 * THE MIRROR IS NOT A RE-RUN OF THE WATERFALL. A paid payment was split across funds
 * by routePaidPayment using the fund priorities in force AT THE TIME. Reversing it
 * must undo THAT split, so this negates the fund_contributions rows the original
 * actually produced. Re-running routeContribution would allocate against today's
 * priorities and balances, quietly moving money between funds with no record of a
 * transfer.
 */
export async function reversePayment(
  paymentId: string,
  reason: string,
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }
  const familyCode = await getMyFamilyCode(user.id)
  const myPersonId = await getMyPersonId(user.id)
  if (!myPersonId) return { success: false, message: t('act.profileNotFound') }

  // Its own grant: undoing a posting is not the same authority as making one.
  if (!(await canAny(user.id, 'accounting/transactions/reversals', 'create'))) {
    return { success: false, message: t('act.youDoNotPermissionReverse') }
  }

  // Read the original family-scoped — the id is client-supplied and this runs on the
  // service role, so `.eq('id', …)` alone would reach another family's ledger.
  const { data: original } = await admin
    .from('dues_payments')
    .select('id, person_id, schedule_id, amount_cents, status, payment_date, reverses_id')
    .eq('id', paymentId)
    .eq('family_code', familyCode)
    .maybeSingle()
  if (!original) return { success: false, message: t('act.paymentNotFound') }

  if (original.reverses_id) {
    return { success: false, message: t('act.rowItselfReversal') }
  }

  // The unique index on reverses_id is the real guard against double-reversal; this
  // check exists to say so in words rather than as a constraint violation.
  const { data: existing } = await admin
    .from('dues_payments')
    .select('id')
    .eq('reverses_id', paymentId)
    .maybeSingle()
  if (existing) return { success: false, message: t('act.paymentAlreadyBeenReversed') }

  const { data: reversal, error } = await admin.from('dues_payments').insert({
    family_code:    familyCode,
    person_id:      original.person_id,
    schedule_id:    original.schedule_id,
    amount_cents:   -original.amount_cents,
    status:         original.status,
    payment_date:   new Date().toISOString().split('T')[0],
    payment_method: null,
    notes:          reason?.trim() ? `Reversal: ${reason.trim()}` : 'Reversal',
    recorded_by:    myPersonId,
    reverses_id:    original.id,
    // Stamped immediately: the mirror below IS this row's routing, so the waterfall
    // must never run against it.
    routed_at:      new Date().toISOString(),
  }).select('id').single()
  if (error || !reversal) {
    return { success: false, message: error?.message ?? 'Failed to post the reversal' }
  }

  // Negate exactly what the original produced, fund by fund.
  const { data: originalRouting } = await admin
    .from('fund_contributions')
    .select('fund_id, amount_cents')
    .eq('family_code', familyCode)
    .eq('dues_payment_id', original.id)

  if (originalRouting?.length) {
    await admin.from('fund_contributions').insert(
      originalRouting.map(c => ({
        fund_id:          c.fund_id,
        family_code:      familyCode,
        amount_cents:     -c.amount_cents,
        source:           'reversal',
        dues_payment_id:  reversal.id,
        contributed_date: new Date().toISOString().split('T')[0],
        recorded_by:      myPersonId,
      })),
    )
  }

  revalidateMemberMoney()
  revalidatePath('/accounting/transactions')
  revalidatePath('/admin/accounting')
  revalidatePath('/reporting/pl-summary')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── P&L ────────────────────────────────────────────────────────────────────

/**
 * The family's statement: what came in, what went out, and what each fund holds.
 *
 * ── IT DEMANDED NOTHING BUT A SESSION UNTIL 2026-08-20 ──────────────────────────────
 * This is a `'use server'` export, so it has a URL, and it publishes the family's lifetime
 * income, its lifetime spend, every fund's balance and EVERY PAID DUES PAYMENT WITH THE
 * PAYER'S NAME. Any signed-in member of any family could call it and read their own
 * family's whole financial position, whatever their grants said.
 *
 * `/reporting/pl-summary` being `status: 'future'` withheld the PAGE and did nothing whatever to
 * this — AGENTS.md, "Coming Soon withholds a page. It does not withhold an action" — which
 * is the same shape `/admin/members/organization` and `/admin/members/board-positions` were both found in on the
 * days they were relit, and the reason that section is not written as one bad afternoon.
 *
 * `canAny`, NOT `can`. `can()` is true for scope 'own', and there is no own version of a
 * family-wide statement: a member's own money is /payment-history, which is own-only by
 * construction. An own-scoped grant here would hand somebody the whole ledger, so
 * `family-finances` is in `NO_OWNER_KEYS` and this is what enforces it.
 *
 * ── `null`, NEVER A ZEROED SHAPE ────────────────────────────────────────────────────
 * The refused answer used to be a `PnLData` of zeroes, which renders as a complete
 * statement reading "$0.00 collected" — a family's treasurer would take that to a board
 * meeting. Same reasoning as `getDuesProjection`, and the page 404s on it.
 */
export async function getFamilyPnL(): Promise<PnLData | null> {
  const admin = createAdminClient()
  const { user } = await currentUser()
  if (!user) return null
  if (!(await canAny(user.id, 'reporting/pl-summary', 'view'))) return null
  const familyCode = await getMyFamilyCode(user.id)

  // THREE READS, DOWN FROM SIX. `event_budget_items`, `event_expenses` and `events` are
  // dropped tables (`20260819000006`), so the event ledger this statement carried has no
  // source — and `funds.event_id`, which named a fund's backing event, went with them.
  const [fundsRes, contribRes, disbRes] = await Promise.all([
    admin.from('funds').select('id, name, priority').eq('family_code', familyCode),
    admin.from('fund_contributions').select('fund_id, amount_cents, source, dues_payment_id').eq('family_code', familyCode),
    admin.from('fund_disbursements').select('fund_id, amount_cents').eq('family_code', familyCode),
  ])

  // Paid dues AND donations for the family — both are rows in dues_payments, and
  // both are money the family actually collected. dues_payments has TWO foreign keys to people
  // (person_id and recorded_by), so the people embed MUST be disambiguated to
  // person_id — otherwise PostgREST errors and the result is silently empty.
  const PAYMENT_SELECT = '*, people!person_id(first_name, last_name), dues_schedules(label, kind)'
  const routedPaymentIds = [...new Set(
    (contribRes.data ?? [])
      .filter(c => c.source === 'dues_routing' && c.dues_payment_id)
      .map(c => c.dues_payment_id as string),
  )]
  const [byFamilyRes, byRoutedRes] = await Promise.all([
    admin.from('dues_payments').select(PAYMENT_SELECT).eq('family_code', familyCode).eq('status', 'paid'),
    routedPaymentIds.length
      ? admin.from('dues_payments').select(PAYMENT_SELECT).in('id', routedPaymentIds).eq('status', 'paid')
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])
  const paymentById = new Map<string, Record<string, unknown>>()
  for (const p of (byFamilyRes.data ?? [])) paymentById.set(p.id as string, p)
  for (const p of (byRoutedRes.data ?? [])) paymentById.set(p.id as string, p)

  const allPayments: DuesPayment[] = [...paymentById.values()]
    .map(mapPayment)
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date))

  // THE TOTAL IS COMPUTED BEFORE THE ROWS ARE FILTERED, and that order is the whole
  // decision. A drive's beneficiary loses the ROWS — the label, the giver, the amount,
  // anything that would spoil a surprise — and keeps a truthful family income figure.
  //
  // The alternative was netting the gift out of the total too, which would mean two
  // members of one family being shown two different incomes for the same bank account
  // with neither told which. A treasurer reconciling against a statement has to be able
  // to trust this number. So the cost is accepted openly: for a beneficiary the listed
  // rows do not add up to the headline, and an unexplained few hundred pounds is a far
  // weaker signal than "Gift for Martha — £450".
  const totalIncomeCents = allPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)

  // Service-role reads throughout this function, so the policies never ran — see
  // myHiddenDonationScheduleIds.
  const hidden = await myHiddenDonationScheduleIds(
    admin, familyCode ?? '', await getMyPersonId(user.id),
  )
  const payments = hidden.size === 0
    ? allPayments
    : allPayments.filter(p => !p.schedule_id || !hidden.has(p.schedule_id))

  // Money collected OUTSIDE of dues — admin top-ups and member contributions.
  //
  // `'reversal'` IS EXCLUDED, SINCE 2026-08-20, AND ITS ABSENCE WAS A DOUBLE COUNT. A
  // reversal writes a negative `dues_payments` row (already subtracted from
  // `totalIncomeCents` above) AND a mirroring negative `fund_contributions` row that
  // un-routes the money from the fund. The old filter was `!== 'dues_routing'`, so the
  // mirror fell through to here and the same reversal came off the family's collected total
  // twice. See the note on `totalContributionsCents`.
  const NOT_DUES = (source: string | null) => source !== 'dues_routing' && source !== 'reversal'
  const totalContributionsCents = (contribRes.data ?? [])
    .filter(c => NOT_DUES(c.source))
    .reduce((s, c) => s + (c.amount_cents ?? 0), 0)
  const totalCollectedCents = totalIncomeCents + totalContributionsCents

  // WHERE THE DUES ACTUALLY WENT. Routing moves a paid dues payment into one or more funds
  // as `dues_routing` rows, and a reversal takes it back out again — so the two together are
  // what the funds have received on the income line's behalf, and the remainder is money the
  // family holds that no fund is named for. A family whose routing rules miss a schedule
  // collects into that remainder indefinitely with nothing anywhere saying so.
  const routedFromDuesCents = (contribRes.data ?? [])
    .filter(c => !NOT_DUES(c.source))
    .reduce((s, c) => s + (c.amount_cents ?? 0), 0)
  const unroutedIncomeCents = totalIncomeCents - routedFromDuesCents

  const fundNameById = new Map<string, string>((fundsRes.data ?? []).map(f => [f.id, f.name]))
  const fundPriorityById = new Map<string, number>((fundsRes.data ?? []).map(f => [f.id, f.priority ?? 100]))
  const scheduleLabelByPayment = new Map<string, string | null>(payments.map(p => [p.id, p.schedule_label]))

  // ── Routing: contributions grouped by fund, with a per-source breakdown ──
  const contribByFund = new Map<string, { total: number; sources: Map<string, number> }>()
  for (const c of contribRes.data ?? []) {
    const entry = contribByFund.get(c.fund_id) ?? { total: 0, sources: new Map<string, number>() }
    entry.total += c.amount_cents
    const label = c.source === 'admin_manual'
      ? 'Manual contribution'
      : c.source === 'member_contribution'
        ? 'Member contribution'
        : (c.dues_payment_id ? (scheduleLabelByPayment.get(c.dues_payment_id) ?? 'General dues') : 'General dues')
    entry.sources.set(label, (entry.sources.get(label) ?? 0) + c.amount_cents)
    contribByFund.set(c.fund_id, entry)
  }
  const routing: PnLRoutingFund[] = [...contribByFund.entries()].map(([fundId, entry]) => ({
    fundId,
    fundName: fundNameById.get(fundId) ?? 'Unknown fund',
    contributedCents: entry.total,
    bySource: [...entry.sources.entries()].map(([label, cents]) => ({ label, cents })).sort((a, b) => b.cents - a.cents),
  })).sort((a, b) => b.contributedCents - a.contributedCents)

  // ── Fund balances ──
  // THREE TERMS, NOT FOUR. The event-spend term went with `event_expenses`
  // (`20260819000006`), which also took it out of `fund_balance_cents()` — so this sum and
  // the database's own answer still agree, which is the only thing that matters about it.
  //
  // TRANSFERS ARE STILL NOT A TERM HERE, and that is a pre-existing divergence rather than
  // something this change introduced: `fund_balance_cents()` and `getFunds()` both count
  // them and this does not. Worth knowing before trusting the two side by side.
  const disbByFund = new Map<string, number>()
  for (const d of disbRes.data ?? []) disbByFund.set(d.fund_id, (disbByFund.get(d.fund_id) ?? 0) + d.amount_cents)

  const funds: PnLFundBalance[] = (fundsRes.data ?? []).map(f => {
    const contributed = contribByFund.get(f.id)?.total ?? 0
    const disbursed = disbByFund.get(f.id) ?? 0
    return {
      fundId: f.id,
      fundName: f.name,
      contributedCents: contributed,
      disbursedCents: disbursed,
      balanceCents: contributed - disbursed,
    }
  }).sort((a, b) =>
    (fundPriorityById.get(a.fundId) ?? 100) - (fundPriorityById.get(b.fundId) ?? 100) ||
    a.fundName.localeCompare(b.fundName))

  // ── THE EVENT LEDGER IS GONE, AND `totalExpenseCents` MEANS SOMETHING ELSE ──
  // It was per-event budget lines against what was really spent, built from
  // `event_budget_items` and `event_expenses` — both dropped (`20260819000006`).
  //
  // `totalExpenseCents` was the sum of `event_expenses` and nothing else, so a family that
  // had paid a disbursement and never run an event read "Total Expenses $0.00" over money
  // that had demonstrably left a fund. It is DISBURSEMENTS now: the only outgoing this
  // product records, which makes `netCents` the first honest bottom line this statement has
  // had.
  const totalExpenseCents = (disbRes.data ?? []).reduce((sum, d) => sum + d.amount_cents, 0)

  return {
    totalIncomeCents,
    totalContributionsCents,
    totalCollectedCents,
    unroutedIncomeCents,
    totalExpenseCents,
    netCents: totalCollectedCents - totalExpenseCents,
    payments,
    routing,
    funds,
  }
}
