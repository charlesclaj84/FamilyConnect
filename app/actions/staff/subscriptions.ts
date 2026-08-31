'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/auth/staff'
import { isFamilyTier, type FamilyTier } from '@/lib/tiers'
import { TIER_PRICE } from '@/lib/plans'

/**
 * What the platform is being paid, across every family.
 *
 * ── IT READS THE PLATFORM LEDGER AND NOT THE FAMILY ONE. NEVER BOTH ────────────────
 * AGENTS.md's first rule about money in this product is that there are two directions and the
 * two ledgers must never meet: `platform_payments` is what a family pays GENORRA, and
 * `dues_payments` is what a relative pays their family. This module touches only the first,
 * and that is not a stylistic preference — a figure on this screen that included a family's
 * own dues would report GENORRA's revenue as several times what it is, on the one screen
 * somebody would quote in a board meeting.
 *
 * So: `platform_billing_accounts` for standing, `platform_payments` for money that has
 * actually moved, `families` for the name and the tier in force. Nothing here reads
 * `dues_payments`, `funds` or `fund_contributions`, and nothing here may start to.
 *
 * ── `requireStaff()`, NOT OWNER ────────────────────────────────────────────────────
 * Reading what the platform is owed is what a support conversation starts from, and it
 * destroys nothing. `owner` is the line for irreversible acts (`/staff/access` and
 * `app/actions/staff/destroy.ts`); drawing it here as well would mean a support engineer
 * could not answer "are they actually paying?", which is the most common question there is.
 *
 * ── AND IT READS ACROSS FAMILIES BY DESIGN (§3 INVERTED) ───────────────────────────
 * The admin client with NO `family_code` filter, which in the Dashboard would be the bug
 * `audit:family-scope` exists to catch. Here it is the feature — the whole console is the
 * one place in this product that reads across the boundary — and `scripts/family-scope.mjs`
 * recognises `app/actions/staff/**` with the verdict STAFF for exactly this.
 */

export interface StaffSubscriptionRow {
  familyCode: string
  familyName: string
  /**
   * The tier IN FORCE, from `families.tier` — the only thing any gate reads.
   *
   * Deliberately beside `paidTier` rather than instead of it: they can differ, and the
   * difference is the interesting part of this screen. A family whose card failed keeps its
   * tier while the platform is not being paid, and a family mid-downgrade has paid for a
   * higher tier than it will have next month.
   */
  tier: FamilyTier
  /** What the last payment BOUGHT. Null for a family that has never paid. */
  paidTier: FamilyTier | null
  /** Inclusive last day the family has paid for. Null when nothing is paid. */
  paidThrough: string | null
  /** `recurring` (a Stripe subscription) or `prepaid` (a term bought outright). */
  mode: 'recurring' | 'prepaid' | null
  /** Stripe's own word for the subscription, verbatim. Null for prepaid and for never-paid. */
  subscriptionStatus: string | null
  /** True when Stripe will not renew it. A paying family that is leaving. */
  cancelAtPeriodEnd: boolean
  /** Set when a payment has failed and not yet recovered. The delinquency signal. */
  delinquentSince: string | null
  /** A downgrade already promised, and the day it takes effect. */
  scheduledTier: FamilyTier | null
  scheduledTierOn: string | null
  /** Every cent this family has ever paid GENORRA. */
  lifetimeCents: number
  /** The most recent payment, for "when did they last pay". */
  lastPaidAt: string | null
}

export interface StaffSubscriptionSummary {
  /** Families with a live paid standing today — the headline figure. */
  paying: number
  /** Of those, how many are set to lapse at the end of the period. */
  leaving: number
  /** Families whose last payment attempt failed and has not recovered. */
  delinquent: number
  /**
   * Monthly recurring revenue, in cents, from families on a RECURRING plan whose standing is
   * live and which are not cancelling.
   *
   * ── PREPAID IS DELIBERATELY NOT IN IT, AND THAT IS THE HONEST READING ───────────
   * A family that bought twelve months outright is revenue already collected, not revenue
   * recurring — folding it in at a twelfth per month would invent a subscription nobody has
   * and would make this figure disagree with Stripe's own. `prepaidCents` is beside it so the
   * two are both visible and neither is hidden inside the other.
   */
  mrrCents: number
  /** Lifetime total across every family, which is the one figure that cannot be argued with. */
  lifetimeCents: number
  /** Families on a prepaid term that has not run out. */
  prepaid: number
  /**
   * True when the underlying read was refused (§8). A screen that rendered zeros over a
   * failed read would report a platform with no customers, which on this screen is the worst
   * possible wrong answer.
   */
  failed: boolean
}

export interface StaffSubscriptionPage {
  rows: StaffSubscriptionRow[]
  summary: StaffSubscriptionSummary
}

const EMPTY_SUMMARY: StaffSubscriptionSummary = {
  paying: 0, leaving: 0, delinquent: 0, mrrCents: 0, lifetimeCents: 0, prepaid: 0, failed: true,
}

function readMode(value: unknown): 'recurring' | 'prepaid' | null {
  return value === 'recurring' || value === 'prepaid' ? value : null
}

function readTier(value: unknown): FamilyTier | null {
  return isFamilyTier(value) ? value : null
}

/**
 * Whether a paid term still covers today.
 *
 * ── A STRING COMPARISON ON PURPOSE ────────────────────────────────────────────────
 * `paid_through` is a DATE and inclusive, and ISO dates sort lexicographically — so
 * `paidThrough >= today` is the whole test and needs no `Date`, no timezone and no
 * off-by-one. AGENTS.md's calendar section is emphatic about why a `new Date('2026-08-01')`
 * comparison is how a term comes to expire a day early for half the world.
 */
function coversToday(paidThrough: string | null, today: string): boolean {
  return typeof paidThrough === 'string' && paidThrough >= today
}

export async function listStaffSubscriptions(): Promise<StaffSubscriptionPage> {
  await requireStaff()
  const admin = createAdminClient()

  const [billing, payments, families] = await Promise.all([
    // ONE STRING LITERAL, not a concatenation. supabase-js infers the row type from the
    // select at the type level, and a `'a, b' + 'c'` expression is opaque to that inference —
    // every field then comes back as `GenericStringError` and the whole read is untyped.
    // Long line rather than a broken type.
    admin.from('platform_billing_accounts').select('family_code, mode, paid_tier, paid_through, subscription_status, cancel_at_period_end, delinquent_since, scheduled_tier, scheduled_tier_on'),
    admin.from('platform_payments').select('family_code, amount_cents, paid_at'),
    admin.from('families').select('family_code, family_name, tier'),
  ])

  // §8: `const { data }` discards the error, and every one of these three failing silently
  // produces a DIFFERENT wrong answer — no customers, no revenue, or every family unnamed.
  // Reported as one refusal rather than three partial screens.
  if (billing.error || payments.error || families.error) {
    console.error('[staff/subscriptions] a read was refused: '
      + [billing.error?.message, payments.error?.message, families.error?.message]
        .filter(Boolean).join(' · '))
    return { rows: [], summary: EMPTY_SUMMARY }
  }

  const nameOf = new Map<string, { name: string; tier: FamilyTier }>()
  for (const f of families.data ?? []) {
    nameOf.set(f.family_code as string, {
      name: (f.family_name as string | null) ?? (f.family_code as string),
      tier: readTier(f.tier) ?? 'free',
    })
  }

  // Folded in TypeScript rather than asked of PostgREST. A `sum()` grouped by family is an
  // aggregate PostgREST will do, and it would be a second definition of "what has this family
  // paid us" living next to `platform_payments`' own append-only ledger — and the whole table
  // is a few rows per family per year, so there is nothing to optimise.
  const lifetime = new Map<string, number>()
  const lastPaid = new Map<string, string>()
  for (const p of payments.data ?? []) {
    const code = p.family_code as string
    lifetime.set(code, (lifetime.get(code) ?? 0) + Number(p.amount_cents ?? 0))
    const at = p.paid_at as string | null
    if (at && (!lastPaid.has(code) || at > lastPaid.get(code)!)) lastPaid.set(code, at)
  }

  const today = new Date().toISOString().slice(0, 10)

  const rows: StaffSubscriptionRow[] = (billing.data ?? []).map(b => {
    const code = b.family_code as string
    const family = nameOf.get(code)
    return {
      familyCode: code,
      familyName: family?.name ?? code,
      tier: family?.tier ?? 'free',
      paidTier: readTier(b.paid_tier),
      paidThrough: (b.paid_through as string | null) ?? null,
      mode: readMode(b.mode),
      subscriptionStatus: (b.subscription_status as string | null) ?? null,
      cancelAtPeriodEnd: b.cancel_at_period_end === true,
      delinquentSince: (b.delinquent_since as string | null) ?? null,
      scheduledTier: readTier(b.scheduled_tier),
      scheduledTierOn: (b.scheduled_tier_on as string | null) ?? null,
      lifetimeCents: lifetime.get(code) ?? 0,
      lastPaidAt: lastPaid.get(code) ?? null,
    }
  })

  // Paying FIRST, then the largest lifetime. A support engineer opening this screen is
  // looking for a customer, and a list led by families that have never paid buries them.
  rows.sort((a, b) => {
    const liveA = coversToday(a.paidThrough, today) ? 1 : 0
    const liveB = coversToday(b.paidThrough, today) ? 1 : 0
    if (liveA !== liveB) return liveB - liveA
    if (a.lifetimeCents !== b.lifetimeCents) return b.lifetimeCents - a.lifetimeCents
    return a.familyName.localeCompare(b.familyName)
  })

  const live = rows.filter(r => coversToday(r.paidThrough, today))
  const summary: StaffSubscriptionSummary = {
    paying: live.length,
    leaving: live.filter(r => r.cancelAtPeriodEnd).length,
    delinquent: rows.filter(r => r.delinquentSince != null).length,
    prepaid: live.filter(r => r.mode === 'prepaid').length,
    // See `mrrCents` on why prepaid is excluded and why a cancelling family is too: this
    // figure answers "what arrives next month", and neither of those does.
    mrrCents: live
      .filter(r => r.mode === 'recurring' && !r.cancelAtPeriodEnd)
      .reduce((n, r) => n + monthlyCentsFor(r.paidTier), 0),
    lifetimeCents: rows.reduce((n, r) => n + r.lifetimeCents, 0),
    failed: false,
  }

  return { rows, summary }
}

/**
 * The monthly rate for a tier, in cents.
 *
 * READ FROM `TIER_PRICE` rather than from the family's own payments, and the difference
 * matters: a family's last invoice may have been a part month or a prorated upgrade, so
 * averaging what they paid would report a rate nobody is on. `lib/plans.ts` is the one place
 * a price is written down (AGENTS.md), and this is a consumer of it.
 */
function monthlyCentsFor(tier: FamilyTier | null): number {
  if (!tier) return 0
  return TIER_PRICE[tier]?.monthlyCents ?? 0
}
