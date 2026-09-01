import { cache } from 'react'

import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode } from '@/lib/auth/family'
import { canAny } from '@/lib/auth/permissions'
import {
  adminsLockedOut, daysUntilDrop, delinquencyStage, membersLockedOut,
  type DelinquencyStage,
} from '@/lib/platform-billing'

/**
 * What a failed payment closes, and when.
 *
 * The app-layer half of `20260901000002`'s ladder. Read that migration's §A for the rungs and
 * §C for why this is a GUARD and not a tier; what follows is only what the TypeScript adds.
 *
 * ── NOTHING ABOUT THE FAMILY'S PLAN CHANGES UNTIL DAY 60 ───────────────────────────
 * `families.tier` is untouched, no row is deleted, and a family that pays on day 29 finds
 * everything exactly where it was. That is only true because the lockout was never a tier — so
 * do not be tempted to "simplify" it into one.
 *
 * ── AND NO POLICY MAY CONSULT IT, WHICH THE MIGRATION ASSERTS ─────────────────────
 * `delinquent_since` withholds SCREENS, exactly as `families.status` and `families.tier` do.
 * The database answers every query normally and this is the whole of the app layer's
 * contribution — which also means the server ACTIONS behind these pages are deliberately not
 * lockout-checked, for `requireTier`'s reason: a family that pays must find its records
 * untouched, and an action refusing "Not authorized" for their own history would be the
 * mechanism outliving the debt.
 *
 * ── THE ADMINISTRATOR IS WHOEVER CAN ACTUALLY PAY ─────────────────────────────────
 * `admin/settings:edit` — the exact grant that opens the Billing panel, decided 2026-08-23 and
 * already what `20260823000007` keeps a family from being left without. Not `is_admin`, which
 * does not exist, and not a template name, which a family can rename.
 */

/**
 * Today, in UTC, as `YYYY-MM-DD`.
 *
 * ── DELIBERATELY NOT `todayLocal()`, WHICH IS THE OPPOSITE RULE ───────────────────
 * That helper exists because `<input type="date">` holds a LOCAL calendar date, and its own
 * header records the incident: a treasurer in Pacific time got tomorrow's date on a payment
 * form. This is the other case entirely — the number being compared is `delinquent_since`, and
 * the thing that moves the family down the ladder is `sweep_platform_billing()` counting from
 * `CURRENT_DATE`, which on this database is UTC.
 *
 * So the guard uses the SWEEP's clock. Using the reader's would put a member on one side of
 * day 10 and the sweep's email on the other, for eight hours a day, in California.
 */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Which screens survive a lockout, and for whom. */
export interface BillingLockout {
  stage: DelinquencyStage
  /** True when this caller is shut out of everything but the exempt list. */
  locked: boolean
  /** Days until the family drops to Free. `null` when they are not on the ladder. */
  daysLeft: number | null
  /** True when the caller can reach the billing screen — i.e. they can fix it. */
  canPay: boolean
}

/**
 * The screens a LOCKED-OUT MEMBER may still reach.
 *
 * `REMOVED_FAMILY_RESOURCES`' list and its reasoning, deliberately: the notice itself, the
 * member's own profile, the family switcher and the manual.
 *
 * ── `my-families` IS THE ONE THAT MATTERS ─────────────────────────────────────────
 * A member of two families must not be shut out of the OTHER one because this one has a
 * billing problem. Dropping it from this list would trap somebody in a family they cannot use
 * with no route to a family they can — which is a worse outcome than the debt.
 *
 * It is a separate constant from `REMOVED_FAMILY_RESOURCES` for that file's own reason: the two
 * are the same keys today and answer different questions, and the day they diverge this is
 * where the billing half is decided.
 */
export const BILLING_LOCKOUT_RESOURCES: readonly string[] = [
  'dashboard',
  'personal-info',
  'my-families',
  'help',
]

/**
 * And the one screen an ADMINISTRATOR keeps on top of those, from day 30.
 *
 * "Every screen except the one that takes a payment", which is `/admin/settings` — the Billing
 * panel lives there. One key, and it must stay one: the point of day 30 is that the only thing
 * left to do is pay.
 */
export const BILLING_PAYMENT_RESOURCE = 'admin/settings'

/**
 * Where the family being viewed is on the ladder, and what it means for THIS caller.
 *
 * ── THE ADMIN CHECK IS ONLY MADE WHEN IT MATTERS ─────────────────────────────────
 * `canAny` is a permission read, and the overwhelmingly common case is a family that is not on
 * the ladder at all — so the stage is resolved first and the grant is asked about only if it
 * could change the answer. On every ordinary page load this is one `platform_billing_accounts`
 * row and nothing else.
 *
 * `cache()`d per request, so the guard, the layout and the dashboard's notice all share one
 * answer and cannot disagree about whether somebody is locked out.
 */
export const billingLockout = cache(async (userId: string): Promise<BillingLockout> => {
  const none: BillingLockout = { stage: 'current', locked: false, daysLeft: null, canPay: false }
  if (!userId) return none

  const familyCode = await getMyFamilyCode(userId)
  if (!familyCode) return none

  const { data, error } = await createAdminClient()
    .from('platform_billing_accounts')
    .select('delinquent_since')
    .eq('family_code', familyCode)
    .maybeSingle()

  // ── §8: THE ERROR IS READ, AND IT FAILS OPEN ────────────────────────────────────
  // Deliberately the opposite direction from every permission read in this codebase, and the
  // reason is what the two withhold. A refused PERMISSION read denies a screen somebody may
  // not be entitled to; a refused BILLING read would lock an entire paying family out of their
  // own product because PostgREST hiccuped. The debt does not go away while this is broken —
  // the sweep still runs, and the family is still on the ladder — so failing open costs a
  // delay, and failing closed costs an outage.
  if (error) {
    console.error(
      `[billing] could not read the ladder for ${familyCode}: ${error.message}. `
      + 'No family will be locked out until this is fixed.',
    )
    return none
  }

  const since = (data as { delinquent_since?: string | null } | null)?.delinquent_since ?? null
  const stage = delinquencyStage(since, todayUTC())
  if (stage === 'current') return none

  const canPay = await canAny(userId, BILLING_PAYMENT_RESOURCE, 'edit')
  const locked = canPay ? adminsLockedOut(stage) : membersLockedOut(stage)

  return {
    stage,
    locked,
    daysLeft: since ? daysUntilDrop(since, todayUTC()) : null,
    canPay,
  }
})

/**
 * May this caller reach `resource` while the family is behind on its bill?
 *
 * The predicate `requireView` folds in. Pure once the lockout is resolved, so the guard and the
 * dashboard notice cannot disagree about which screens survive.
 */
export function lockoutAdmits(lock: BillingLockout, resource: string): boolean {
  if (!lock.locked) return true
  if (BILLING_LOCKOUT_RESOURCES.includes(resource)) return true
  // An administrator keeps the screen that takes a payment. A member never had it.
  return lock.canPay && resource === BILLING_PAYMENT_RESOURCE
}
