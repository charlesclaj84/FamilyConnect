import { type T } from '@/lib/i18n/t'

/**
 * What a family is paying for, and what that entitles them to reach.
 *
 * THE COUNTERPART TO `lib/features.ts`, and the two answer different questions about the
 * same route. The registry answers "has this shipped at all?"; this answers "is it
 * included in what this family pays for?". Both have to be true before a member sees a
 * page, and they fail differently on purpose:
 *
 *   not shipped        →  Coming Soon. Nobody can have it yet, on any plan.
 *   above the tier     →  the upgrade screen. It exists, it works, and this family has
 *                         not bought it.
 *
 * Answering both with one screen was the obvious shortcut and is wrong in both
 * directions: telling a paying family that a feature is "coming soon" when it shipped a
 * year ago is a lie, and telling a free family to "wait for it" when there is a button
 * that would give it to them today is a sale nobody made.
 *
 * ── WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────────────────
 * FutureFeature.md put it plainly before any of this was built: *"there is no tier
 * enforcement anywhere in the codebase … until there is, every flip is a Free flip,
 * whatever the pricing page says."* Two Plus bullets were already being given away —
 * RSVPs and head counts came free with the Events flip, profile pictures never were
 * gated — and each was recorded as its own special case because there was no mechanism
 * to be a case OF. This is that mechanism.
 *
 * ── TWO RULES ───────────────────────────────────────────────────────────────────────
 *
 * 1. **Keep it pure.** Data and pure functions, no React, no `server-only`, no database.
 *    `lib/features.ts` states the same rule for the same reason — `proxy.ts` is bundled
 *    separately from the render path — and this module is imported from it.
 *
 * 2. **Tiers are ORDERED and INCLUSIVE.** Premium contains Plus contains Standard
 *    contains Free, exactly as `/pricing` sells them ("Everything in Plus, plus:"). So a
 *    check is `>=` on the rank and never an equality: `tier === 'plus'` would lock a
 *    Premium family out of the thing they pay the most for, and it is the mistake this
 *    module exists to make unavailable.
 *
 * ── STANDARD WAS INSERTED IN THE MIDDLE ON 2026-08-19, WHICH IS WHY RULE 2 MATTERS ──
 * It went in BETWEEN Free and Plus rather than on the end, and everything derived from
 * `TIERS` re-ranked itself correctly because the order is the semantics: `TIER_RANK` is
 * built from the array, `tierMeets` reads the rank, and `planAddsBetween()` walks it. The
 * one thing that could not re-derive is `families_tier_check` in the database, which is why
 * inserting a tier is a MIGRATION as well as an edit here — 20260819000008 widened the
 * CHECK, and its header says what would have happened without it (every write of the new
 * value refused by Postgres, on a value the app considers ordinary).
 *
 * NOTHING WAS RE-RANKED IN THE DATABASE, and nothing needed to be: no policy consults
 * `families.tier` and none may, so the column holds a word rather than a position. A family
 * on Plus is still on Plus and reaches strictly more than it did — the routes that moved
 * moved DOWN from Plus or UP from Free, and Plus contains both.
 */

export type FamilyTier = 'free' | 'standard' | 'plus' | 'premium'

/**
 * Cheapest first. The ORDER is the semantics — `TIER_RANK` is derived from it, so adding
 * a tier in the middle re-ranks everything correctly and adding one at the end does not
 * disturb what is already sold.
 */
export const TIERS: readonly FamilyTier[] = ['free', 'standard', 'plus', 'premium']

/** Higher includes lower. Derived, so it cannot disagree with TIERS. */
export const TIER_RANK: Record<FamilyTier, number> = Object.fromEntries(
  TIERS.map((t, i) => [t, i]),
) as Record<FamilyTier, number>

/**
 * What a family gets by default, and what an unrecognized value falls back to.
 *
 * FREE IS THE FAIL-CLOSED DIRECTION HERE, which is worth stating because it is the
 * opposite of how it reads. Every other default in this codebase denies; this one grants
 * the base plan — but the base plan is what every family is entitled to without paying,
 * so falling back to it withholds only what somebody has paid for and never takes away
 * what they have not. Falling back to Premium would give the whole product away on a
 * typo in a database column.
 */
export const DEFAULT_TIER: FamilyTier = 'free'

/**
 * The name shown to a member. Matches `PLANS[].name` on `/pricing` exactly — a family
 * told they need "Plus" has to find a card called Plus.
 */
export const TIER_LABEL: Record<FamilyTier, string> = {
  free: 'Free',
  standard: 'Standard',
  plus: 'Plus',
  premium: 'Premium',
}

/** One line per plan, lifted from the taglines on `/pricing` so the two cannot drift. */
export function tierTagline(t: T, tier: FamilyTier): string {
  return t(`tier.tagline.${tier}`)
}

/** True when a value is one of the four. Narrows, so callers need no cast. */
export function isFamilyTier(value: unknown): value is FamilyTier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value)
}

/**
 * Read a tier out of whatever the database handed back.
 *
 * NULL is the ordinary case rather than an error: `families.tier` is `NOT NULL DEFAULT
 * 'free'` since 20260813000003, but this also runs against a database that has not had
 * that migration applied, where the column is absent and reads `undefined`. Both mean
 * "nobody has said otherwise", which is Free.
 */
export function normalizeTier(value: unknown): FamilyTier {
  return isFamilyTier(value) ? value : DEFAULT_TIER
}

/** Does a family on `current` reach something requiring `required`? Inclusive. */
export function tierMeets(current: FamilyTier, required: FamilyTier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required]
}

/** The tiers a family on `current` has paid for, cheapest first. Free is always in it. */
export function tiersIncludedIn(current: FamilyTier): FamilyTier[] {
  return TIERS.filter(t => tierMeets(current, t))
}
