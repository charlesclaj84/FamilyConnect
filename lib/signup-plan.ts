/**
 * Whether a family is still owed the checkout they asked for when they signed up.
 *
 * ── THE GAP THIS FILLS ──────────────────────────────────────────────────────────────
 * `/pricing` sells Standard and Plus, and pressing the button on either cannot take a
 * payment: there is no family yet to be the Stripe Customer, and `enable_confirmations` is
 * on, so registration ends without a session for `startPlanCheckout` to authorize. The
 * choice is therefore recorded against the family
 * (`platform_billing_accounts.signup_tier`) and offered again at the first moment there is
 * somebody signed in to take it — which is this function's one job: deciding whether that
 * moment is now.
 *
 * ── PURE, AND `today` IS A PARAMETER (§7b) ──────────────────────────────────────────
 * No React, no database, no `new Date()`. The staleness rule below is the only real edge
 * case in the feature and it is a date comparison, which is exactly the class of thing
 * `lib/dues-utils.ts` learned to take the clock as an argument for. `lib/signup-plan.test.ts`
 * is the mutation-checked version of every rule here.
 *
 * ── IT DECIDES A PROMPT AND NEVER AN ENTITLEMENT ────────────────────────────────────
 * Nothing here grants anything. `families.tier` is what every gate reads and the Stripe
 * webhook is what writes it; a family that chose Plus at signup and never paid is a Free
 * family that once clicked a button. Do not let this module be read for "which plan does
 * this family have" — that is `entitlementOn()` and `families.tier`, and the migration
 * header for 20260823000008 says why keeping them apart matters.
 */

import { TIER_IS_SOLD } from '@/lib/plans'
import { daysBetween } from '@/lib/platform-billing'
import { isFamilyTier, tierMeets, type FamilyTier } from '@/lib/tiers'

/**
 * How long a signup choice is still worth asking about.
 *
 * ── WHY THERE IS A WINDOW AT ALL ────────────────────────────────────────────────────
 * Without one the prompt is permanent for every family that ever looked at Plus and never
 * bought it, and a banner that is always there is furniture. The dismissal handles the
 * family that DECIDES against it; this handles the much commoner case of nobody deciding
 * anything — they signed up, got on with the directory, and the choice they made in a
 * pricing table four months ago is no longer a decision they are waiting on.
 *
 * NINETY DAYS rather than thirty: a family's first quarter is when they are getting
 * relatives to join at all, and the reunion that made them look at Plus may be further out
 * than a month. Erring long costs a banner nobody presses; erring short costs the sale
 * somebody actually intended.
 *
 * AGEING OUT IS NOT A DISMISSAL and nothing is written when it happens — the intent stays
 * on the row as a record of what they wanted, and `/admin/settings` still sells every plan.
 * A family can always buy Plus; what expires is us ASKING them to.
 */
export const SIGNUP_PLAN_PROMPT_DAYS = 90

/**
 * Why a prompt is not being shown, when it is not.
 *
 * NAMED RATHER THAN A BARE `null`, because four of these five are states somebody will one
 * day have to debug from a support conversation ("it never offered me Plus"), and a
 * boolean cannot tell `already-held` from `stale`. The caller renders nothing for all of
 * them; the value is that a test asserts WHICH rule fired, so a change that makes the right
 * decision for the wrong reason goes red.
 */
export type SignupPlanSkip =
  | 'none-chosen'
  | 'dismissed'
  | 'already-held'
  | 'not-sold'
  | 'stale'

export type SignupPlanPrompt =
  | { prompt: false; skip: SignupPlanSkip }
  | { prompt: true; tier: FamilyTier; ageDays: number }

/**
 * Should this family be asked to pay for the plan they chose at signup?
 *
 * The order of the tests is deliberate and is the order a person would explain it in:
 *
 *   1. nothing was chosen           — the ordinary case, and the cheapest to answer
 *   2. they said no                 — a decision, and it outranks everything below it
 *   3. they already have it         — paid, by any route. Asking again would be a second
 *                                     charge for something they hold, which is the worst
 *                                     failure available here
 *   4. we no longer sell it         — `TIER_IS_SOLD` is a product decision that can move
 *                                     AFTER a choice was recorded, and a checkout for a
 *                                     withdrawn plan is refused by the action anyway. Better
 *                                     to not offer it than to offer it and refuse
 *   5. it is too old to still mean anything
 *
 * `tierMeets` and not equality at step 3, so a family that chose Standard and bought Plus is
 * not asked to buy Standard — the tiers are inclusive and Plus contains it (`lib/tiers.ts`).
 */
export function signupPlanPrompt(input: {
  /** `platform_billing_accounts.signup_tier`, as it came out of the database. */
  signupTier: string | null | undefined
  /** `signup_tier_at`. A timestamp; only its date half is used. */
  signupTierAt: string | null | undefined
  dismissedAt: string | null | undefined
  /** What `families.tier` says today — the tier the product is actually enforcing. */
  activeTier: FamilyTier
  /** `YYYY-MM-DD`, resolved on the server. */
  today: string
}): SignupPlanPrompt {
  const { signupTier, signupTierAt, dismissedAt, activeTier, today } = input

  // NARROWED, NEVER TRUSTED. A CHECK constraint keeps 'free' out of the column, and this
  // still refuses it: the value reaches here through a `select('*')` and a row written before
  // that constraint existed, or by a hand-run UPDATE, would otherwise offer somebody a
  // checkout for the plan they are already on.
  if (!isFamilyTier(signupTier) || signupTier === 'free' || !signupTierAt) {
    return { prompt: false, skip: 'none-chosen' }
  }
  if (dismissedAt) return { prompt: false, skip: 'dismissed' }
  if (tierMeets(activeTier, signupTier)) return { prompt: false, skip: 'already-held' }
  if (!TIER_IS_SOLD[signupTier]) return { prompt: false, skip: 'not-sold' }

  // A choice recorded in the future is not stale. Clock skew between the database's `NOW()`
  // and the server's date can put the intent a few hours ahead of `today`, and treating a
  // negative age as an expiry would suppress the prompt for exactly the families who signed
  // up minutes ago — the ones it is most for.
  const ageDays = daysBetween(signupTierAt.slice(0, 10), today)
  if (ageDays > SIGNUP_PLAN_PROMPT_DAYS) return { prompt: false, skip: 'stale' }

  return { prompt: true, tier: signupTier, ageDays: Math.max(0, ageDays) }
}

/**
 * The plan named in a `?plan=` parameter, or null.
 *
 * SHARED BY THE PAGE AND THE ACTION on purpose. `/register` reads it to preselect a card and
 * `registerUser` reads it again to decide what to record, and the second is the one that
 * matters — a server action is a public HTTP endpoint and the form in front of it is a
 * convenience (§2). One narrowing function means the two cannot come to disagree about
 * whether `?plan=PLUS` or `?plan=premium` is something we sell.
 *
 * `TIER_IS_SOLD` IS CONSULTED HERE, so a tier that exists and is not for sale answers null
 * rather than being recorded and then refused at the till. Premium is that case today.
 */
export function sellablePlanParam(value: unknown): FamilyTier | null {
  if (typeof value !== 'string') return null
  const tier = value.trim().toLowerCase()
  if (!isFamilyTier(tier) || tier === 'free') return null
  return TIER_IS_SOLD[tier] ? tier : null
}
