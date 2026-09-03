import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode } from '@/lib/auth/family'
import { normalizeTier, tierMeets, type FamilyTier } from '@/lib/tiers'
import { requiredTier } from '@/lib/features'

/**
 * What plan the family being viewed is on.
 *
 * ── WHY THE ADMIN CLIENT ────────────────────────────────────────────────────────────
 * `families` is readable by its own members under RLS, so the user client would work for
 * the ordinary case — and it would fail for the case this has to serve. A PENDING member
 * resolves to no person (`auth_person_id()` is NULL since 20260806000011), so every
 * policy behind `families` matches nothing for them, and `getMyFamilyTier` would answer
 * Free for a family on Premium. That answer then reaches `requireViewOrPending`, which is
 * the one guard a pending member passes, and the awaiting-approval screen would be
 * decided by a plan lookup that failed.
 *
 * Family scoping is therefore hand-applied, per AGENTS.md §3: `.eq('family_code', …)`
 * from the caller's OWN membership (`getMyFamilyCode`), never from an argument. There is
 * no id here that arrives from a client, so §4 has nothing to check.
 *
 * ── WHY IT IS NOT PART OF `PermissionSet` ───────────────────────────────────────────
 * It would be one fewer round trip, and it would put two different kinds of answer in one
 * structure. `lib/auth/permissions.ts` states in its own header that it mirrors
 * `public.auth_permission()` exactly and that a change to one is a change to both — and
 * there is no SQL counterpart to this, deliberately: a tier is not a permission, no
 * policy consults it, and RLS must never start to. A family that stops paying keeps its
 * data and loses its screens.
 *
 * Both are `cache()`d per request, so a page that asks about several resources makes one
 * query for permissions and one for the tier, whatever the SQL would have cost.
 *
 * ── WHAT A TIER IS AND IS NOT ───────────────────────────────────────────────────────
 * It is a commercial fact, enforced at the page and at the rail. It is NOT a security
 * boundary and nothing here should be mistaken for one: family isolation is RLS, and who
 * may do what inside a family is the permission model. Downgrading a family must never be
 * a way to lose data, and upgrading one must never be a way to reach somebody else's.
 */
export const getMyFamilyTier = cache(async (userId: string): Promise<FamilyTier> => {
  if (!userId) return normalizeTier(null)

  const familyCode = await getMyFamilyCode(userId)
  if (!familyCode) return normalizeTier(null)

  return getFamilyTier(familyCode)
})

/**
 * The plan for one family by code.
 *
 * Separate from the caller-scoped version because `/my-families` lists several families
 * at once and `getMyFamilyTier` answers only for the active one. Callers owe the same
 * thing they always owe a code that did not come from `getMyFamilies()`: proof that it is
 * the caller's. This function does not check, and cannot — it is handed a string.
 */
export const getFamilyTier = cache(async (familyCode: string): Promise<FamilyTier> => {
  if (!familyCode) return normalizeTier(null)

  const { data, error } = await createAdminClient()
    .from('families')
    .select('tier')
    .eq('family_code', familyCode)
    .maybeSingle()

  // THE ERROR IS READ RATHER THAN DISCARDED (AGENTS.md §8), and the two outcomes mean
  // different things: no row is a family that does not exist, while a refused query is
  // most likely a database that has not had 20260813000003 applied — PostgREST answers
  // 42703 for a column that is not there and kills the WHOLE query, which is the exact
  // failure that took every page in the app to 404 during Phase 3.
  //
  // Both fall back to Free, which is the safe direction here for the reason DEFAULT_TIER
  // gives: it withholds only what somebody has paid for, and never takes away what every
  // family is entitled to. The log is what stops that being silent, because a whole
  // estate of families quietly demoted to Free looks exactly like a whole estate of
  // families that never upgraded.
  if (error) {
    console.error(
      `[tier] could not read families.tier for ${familyCode}: ${error.message}. ` +
      'Every family will be treated as Free until this is fixed. If this is "column ... ' +
      'does not exist", the app is running against a database that is behind ' +
      'supabase/migrations — check `npx supabase migration list --linked`.',
    )
    return normalizeTier(null)
  }

  return normalizeTier((data as { tier?: string } | null)?.tier)
})

/**
 * Does the caller's family include the resource `resourceKey` names?
 *
 * The key is the route without its leading slash — the same string `requireView()` takes
 * and the same one `permission_resources` is keyed by — so a sub-key inherits its page's
 * plan by `getFeature()`'s longest-prefix match. `admin/users/templates` is Free because
 * `/admin/members` is; `transactions/dues-payments` is Free because `/reporting/transactions` is.
 * That is the behaviour to want: a tab is part of the page it is on.
 */
export async function tierAllows(userId: string, resourceKey: string): Promise<boolean> {
  return tierMeets(await getMyFamilyTier(userId), requiredTier(`/${resourceKey}`))
}

/**
 * Does the family currently being viewed include profile pictures?
 *
 * ── ONE FUNCTION SO THE KEY IS TYPED ONCE ──────────────────────────────────────────
 * Six call sites read `avatar_url` for rendering — My Profile, the Directory, the family
 * tree, the top bar, the dashboard's own tile and the profile-completeness meter — and each
 * of them has to answer the same question before it hands the column back. A bare
 * `tierAllows(userId, 'personal-info/photo')` at six sites is six chances for a key move to
 * leave one behind, and an UNREGISTERED key resolves to Free rather than failing (see
 * `getFeature`), so the one that was missed would silently keep showing the picture. That is
 * the failure mode `20260820000004` shipped four times over and nothing caught for two days.
 *
 * ── AND IT IS A RENDER GATE, NEVER A WRITE GATE ON EXISTING ROWS ───────────────────
 * `uploadAvatar` writes `avatar_url` to every `people` row the user has — one per family, on
 * purpose, because a portrait is a fact about a person rather than about a membership. So a
 * Free family's copy of the column may well be populated, and what withholds it is the READ.
 * Three consequences, and the second is the one a write-side gate could not give:
 *
 *   * a member of a Standard family and a Free one sees their picture in the first and
 *     initials in the second;
 *   * a family that UPGRADES sees the pictures its members already have, with nothing to
 *     re-upload;
 *   * a family that DOWNGRADES keeps every row and loses only the rendering, which is what
 *     AGENTS.md requires of every tier in the product.
 *
 * A read may NARROW on the plan and may never REFUSE on one: `avatar_url` comes back null and
 * every other column is untouched. Refusing the read outright would be the thing that section
 * forbids.
 */
export async function familyShowsPhotos(userId: string): Promise<boolean> {
  return tierAllows(userId, 'personal-info/photo')
}

/**
 * Does the family currently being viewed PLAN its gatherings, or only put them on the calendar?
 *
 * ── THE BOUNDARY RUNS THROUGH THE FEATURE, WHICH IS WHY THIS EXISTS ────────────────
 * `/gatherings`, `/gatherings/calendar` and `/admin/gatherings` are Free — the DATE, the place
 * and the description — and the planning half is Standard: the templates a gathering is built
 * from, the tasks handed out from them, the money band. So a Free family has real gatherings
 * with no tasks, no segments and nothing to organize, and four surfaces have to say so
 * consistently: the member-facing detail page, the organizer console, the scheduling form and
 * the status vocabulary.
 *
 * ── ONE FUNCTION SO THE KEY IS TYPED ONCE ──────────────────────────────────────────
 * `familyShowsPhotos` above carries the argument in full and it applies verbatim: an
 * UNREGISTERED key resolves to Free rather than failing, so a key move that left one of the
 * call sites behind would silently keep OFFERING the planning half to a family that cannot use
 * it — and `20260820000004` shipped exactly that failure four times over with nothing catching
 * it for two days.
 *
 * ── IT IS KEYED ON THE TASKS, NOT ON THE TEMPLATES ─────────────────────────────────
 * `gatherings/my-tasks` and `admin/gatherings/templates` are both Standard, so either answers
 * the same today. The tasks key is the honest one: what a Free family is missing is the WORK
 * being handed out and tracked, and the template library is the mechanism rather than the
 * point. If the two ever separate, this is the half a screen means when it asks.
 *
 * ── AND IT IS A RENDER GATE, NEVER A WRITE GATE ────────────────────────────────────
 * The actions behind the planning screens are deliberately NOT tier-checked (AGENTS.md: "the
 * server actions behind a paid page are deliberately not tier-checked") — the first time a
 * family downgraded, one would start answering "Not authorized" for their own records. A
 * gathering that already has tasks keeps them, and a Free family is simply not shown the
 * machinery for making more.
 */
export async function familyPlansGatherings(userId: string): Promise<boolean> {
  return tierAllows(userId, 'gatherings/my-tasks')
}
