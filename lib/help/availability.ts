import { getFeature, requiredTier } from '@/lib/features'
import { viewableResources } from '@/lib/auth/permissions'
import { getMyFamilyTier } from '@/lib/auth/tier'
import { tierMeets, type FamilyTier } from '@/lib/tiers'
import { HELP_CHAPTERS } from './content'

/**
 * Whether the reader can actually open the screen a chapter is about.
 *
 * ── WHY THE MANUAL ANSWERS THIS AT ALL ──────────────────────────────────────────────
 * Because the alternative is a manual whose links 404. Every screen in this product is
 * behind two independent narrowings — has the feature shipped, and has this family granted
 * it to this member — and a reader who follows "open Accounting" into a plain Not Found
 * learns nothing except that the manual is wrong.
 *
 * So the chapter is still there and still readable; it simply says which of the three walls
 * is in the way. That is strictly more useful than hiding it, and it is the only version
 * that works for the case the manual exists for — somebody who has just been asked to keep
 * the books and needs to know what to ask for.
 *
 * ── IT IS NOT A GATE, AND MUST NEVER BE READ AS ONE ─────────────────────────────────
 * Nothing here withholds anything. The pages it labels each gate themselves (AGENTS.md §1)
 * and the data behind them is protected by RLS; this resolves a LABEL. Deriving it from
 * `viewableResources()` — the same answer the rail is built from — is what keeps the label
 * and the rail from disagreeing, which is the only way this stays true as grants change.
 *
 * ── WHY THE THREE STATES ARE SEPARATE ───────────────────────────────────────────────
 * They are three different conversations. "Coming soon" is a fact about the build and
 * nobody has it on any plan; "needs a plan" is a purchase somebody can make today; "not
 * granted" is a conversation with an administrator in your own family. Collapsing them
 * into one "unavailable" would send every reader to the wrong person.
 */
export type HelpAvailability =
  /** No single screen — a reference chapter. Nothing to check. */
  | { state: 'general' }
  /** The reader can open it now. */
  | { state: 'open' }
  /** Not built yet. Opening the route shows Coming Soon. */
  | { state: 'coming-soon' }
  /** Built, and above this family's plan. Opening the route shows the upgrade screen. */
  | { state: 'needs-plan'; tier: FamilyTier }
  /** Built and paid for, and this member's template does not grant view. */
  | { state: 'not-granted' }

const GENERAL: HelpAvailability = { state: 'general' }

/**
 * One answer per chapter slug, resolved in the order the app itself resolves them —
 * shipped, then plan, then permission — because that is the order the reader hits them.
 *
 * Two round trips at most, both `cache()`d and both already warmed by the protected
 * layout, so this costs a help page nothing it was not already paying.
 *
 * CALL IT ONLY FOR AN APPROVED MEMBER. A pending caller resolves to the three pages the
 * awaiting-approval screens use, so every other chapter would come back 'not-granted' —
 * true of the moment and quite the wrong thing to tell somebody whose access is a decision
 * away. The help pages pass `null` instead and say what is actually happening.
 */
export async function resolveHelpAvailability(userId: string): Promise<Map<string, HelpAvailability>> {
  const [viewable, tier] = await Promise.all([
    viewableResources(userId),
    getMyFamilyTier(userId),
  ])

  const out = new Map<string, HelpAvailability>()
  for (const chapter of HELP_CHAPTERS) {
    out.set(chapter.slug, resolveOne(chapter.route, viewable, tier))
  }
  return out
}

function resolveOne(
  route: string | undefined,
  viewable: Set<string>,
  tier: FamilyTier,
): HelpAvailability {
  if (!route) return GENERAL

  // An unregistered path is not a gated one — `lib/features.ts` gates what it knows about
  // and lets everything else through — so treat it the way the route gate would.
  const feature = getFeature(route)
  if (!feature) return { state: 'open' }

  if (feature.status === 'future') return { state: 'coming-soon' }

  const need = requiredTier(route)
  if (!tierMeets(tier, need)) return { state: 'needs-plan', tier: need }

  // The resource key is the route without its leading slash — the same derivation
  // `viewableResources()` uses to build the set, so the two cannot drift.
  return viewable.has(route.replace(/^\//, '')) ? { state: 'open' } : { state: 'not-granted' }
}
