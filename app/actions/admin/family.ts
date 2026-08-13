'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAny } from '@/lib/auth/permissions'
import { requireEdit, requireRead } from '@/lib/auth/guard'
import { getMyFamilyTier } from '@/lib/auth/tier'
import { isFamilyTier, type FamilyTier } from '@/lib/tiers'
import { FAMILY_RESOURCE, MAX_FAMILY_NAME } from '@/components/admin/family-settings'

/**
 * Family Settings — the family's own identity, as opposed to the eighteen admin
 * surfaces that are about running it.
 *
 * RENAMING IS THE ONLY WRITE, and that is a decision rather than a stopping point.
 * `family_code` is the join key carried by 34 tables and is immutable after insert
 * (families_guard_family_code, 20260812000000); deleting a family is not built at all,
 * because nothing has a foreign key to `families` and so a DELETE would remove one row
 * and orphan everything else. TODO.md carries what that half would need.
 *
 * WHY THE RENAME IS SAFE: `family_name` is carried by no other table. Nothing joins on
 * it, nothing keys on it, no policy reads it. A rename cannot orphan a row — which is
 * why this half could ship without the other.
 */

export interface FamilySettings {
  familyCode: string
  familyName: string
  /** Approved, admitted members — what "how big is this family" actually means. */
  memberCount: number
  createdAt: string | null
  /**
   * The plan this family is on.
   *
   * NO LONGER READ-ONLY, since 2026-08-13 — `setFamilyTier` below is the scaffolding for
   * choosing a plan from inside the product, and any of the three may be picked. Read
   * that function's header before touching it: what changed is who may move the value,
   * and NOT the rule underneath. `families_guard_tier` (20260813000003) still refuses the
   * `authenticated` role outright, so the write goes through the service role — which is
   * what keeps `renameFamily` from ever being able to carry a tier along with a name.
   */
  tier: FamilyTier
  /** Whether to render the form at all. The write re-checks; this only shapes the UI. */
  canEdit: boolean
}

export type RenameFamilyResult =
  | { success: true; familyName: string }
  | { success: false; message: string }

export type SetTierResult =
  | { success: true; tier: FamilyTier }
  | { success: false; message: string }

/**
 * Everything the page shows.
 *
 * Gated on view before anything is read (AGENTS.md §5) — a page that fetches and then
 * hides has still published, because props are serialized into the RSC payload whether
 * a component renders them or not.
 *
 * The families row comes through the USER client, so the SELECT policy scopes it; the
 * member count goes through the service role, which sees past RLS and therefore
 * re-applies the family scoping by hand (§3). Counting through the user client would
 * have been the tidier read and gives a DIFFERENT number: the `people` SELECT policy
 * hides applicants from anyone without admin/approvals, so the total would move with
 * the reader's grants rather than with the family.
 */
export async function getFamilySettings(): Promise<FamilySettings | null> {
  const g = await requireRead(FAMILY_RESOURCE)
  if (!g.ok || !g.familyCode) return null

  const supabase = await createClient()
  const [family, members, editable, tier] = await Promise.all([
    supabase
      .from('families')
      .select('family_code, family_name, created_at')
      .eq('family_code', g.familyCode)
      .maybeSingle(),
    createAdminClient()
      .from('people')
      .select('id', { count: 'exact', head: true })
      .eq('family_code', g.familyCode)
      .eq('membership_status', 'approved'),
    canAny(g.userId, FAMILY_RESOURCE, 'edit'),
    // Read separately rather than added to the select above, on purpose: `tier` reaches
    // this app only through `getMyFamilyTier`, which normalizes an unknown or absent
    // value to Free and logs a refused query. Selecting the column here as well would be
    // a second reader free to disagree with the one every guard in the app uses — and it
    // would fail differently, because PostgREST answers 42703 for a missing column and
    // kills the WHOLE query, so a database behind on migrations would take the family's
    // NAME down along with its plan.
    getMyFamilyTier(g.userId),
  ])

  // The error is read rather than discarded (AGENTS.md §8): `null` from maybeSingle()
  // is also what a refused query returns, and the two mean opposite things — "this
  // family has no display row", which the fallback below handles, versus "PostgREST
  // said no", which is a misconfiguration the page should not paper over silently.
  if (family.error) {
    console.error(`[admin/family] could not read families for ${g.familyCode}: ${family.error.message}`)
    return null
  }

  const row = family.data as { family_code: string; family_name: string; created_at: string } | null

  return {
    familyCode: g.familyCode,
    // A family with a people row but no `families` row predates that table. Showing
    // the code is honest; showing an empty name would read as a rename having failed.
    familyName: row?.family_name ?? g.familyCode,
    memberCount: members.count ?? 0,
    createdAt: row?.created_at ?? null,
    canEdit: editable,
    tier,
  }
}

/**
 * Rename the family the caller is currently acting in.
 *
 * NO FAMILY IDENTIFIER IS ACCEPTED, and that is the security design rather than a
 * convenience: this is a `'use server'` export, so it has a URL and any signed-in user
 * can post to it with arguments of their choosing. A `familyCode` parameter would be an
 * id arriving from the client that then decides which row is written — the shape
 * AGENTS.md §4 is about — so the target is derived from the caller instead, exactly as
 * auth_family_code() derives it inside the policy. The two cannot disagree.
 *
 * requireEdit(), which is requireScope(…, 'edit') and so goes through canAny(). Scope
 * 'own' would otherwise pass, and there is no personal copy of the family's name to
 * own — a narrowed grant would silently mean what the unrestricted one means. The
 * policy on `families` tests `auth_permission('admin/family','edit') = 'any'` for the
 * same reason, and scopesFor() stops the grid offering the button at all.
 *
 * The USER client, so the policy 20260812000000 adds is what actually admits the write
 * and tests/rls exercises it for real. `.eq('family_code', …)` is still written out:
 * the policy admits exactly one row today, so the filter is redundant *today*, and it
 * is what keeps an unfiltered UPDATE from ever being one policy rewrite away from
 * renaming every family in the database.
 */
export async function renameFamily(familyName: string): Promise<RenameFamilyResult> {
  const g = await requireEdit(FAMILY_RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }

  const name = (familyName ?? '').trim()
  if (!name) return { success: false, message: 'Enter a family name' }
  if (name.length > MAX_FAMILY_NAME) {
    return { success: false, message: `That family name is too long (${MAX_FAMILY_NAME} characters maximum).` }
  }

  // `.select()` on the mutation, so a write the policy matched ZERO rows with comes
  // back as a failure instead of `{ success: true }` over an unchanged row. That silent
  // no-op is a known failure mode of this codebase (TODO.md, "Members without a grant
  // are told their write succeeded when it did not"); this action does not add to it.
  //
  // It turns out to do a SECOND job, found by mutating the layers apart and re-running
  // tests/rls rather than by reading: PostgreSQL ANDs the SELECT policy into an UPDATE
  // that carries a RETURNING clause. So `.select()` also confines this write to rows the
  // caller may READ — which on `families` is their own family. With the `.eq` deleted
  // AND both conjuncts stripped from the UPDATE policy, BRAVO's administrator still
  // could not touch ALPHA's row; only opening the SELECT policy as well let it through.
  // Worth knowing before anyone "tidies up" a `.select()` that looks decorative.
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('families')
    .update({ family_name: name })
    .eq('family_code', g.familyCode)
    .select('family_name')

  if (error) {
    console.error(`[admin/family] rename refused for ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not rename the family. Please try again.' }
  }
  if (!data || data.length === 0) {
    return { success: false, message: 'Not authorized' }
  }

  // The name is read on every page that names the family — the switcher, My Families,
  // the dashboard — so the whole layout is revalidated rather than this route alone.
  revalidatePath('/', 'layout')
  return { success: true, familyName: name }
}

/**
 * Put the family on a plan.
 *
 * ── THIS IS SCAFFOLDING, AND THE SCAFFOLD IS THE POINT ──────────────────────────────
 * There is no billing. Any of the three tiers can be picked and nothing is charged, which
 * is why the panel that calls this says so in as many words rather than reading as a
 * checkout. What it buys today is the ability to SEE the tier gates work — put a family on
 * Free and `/family-finances`, `/photos`, `/documents` and `/elections` become the upgrade
 * screen; put them back on Plus and they return, with every row they ever entered intact,
 * because no policy consults `families.tier` and none may start to (20260813000003).
 *
 * It changes nothing about Home. `/pricing` still sells three tiers to a visitor, still
 * shows Plus and Premium as "Not yet available", and is not derived from this in either
 * direction — see `lib/plans.ts`.
 *
 * ── WHY THE SERVICE ROLE, WHICH LOOKS LIKE THE THING THE GUARD FORBIDS ──────────────
 * `families_guard_tier` refuses a change made by the `authenticated` role — the role the
 * BROWSER speaks as — and says nothing about the service role. That boundary is drawn
 * around the role rather than around the column on purpose, and it is exactly what makes
 * this action possible without weakening it: `renameFamily` writes through the USER
 * client, so a `{ tier }` smuggled into that update still hits the trigger and still
 * fails. The plan moves only through a function that has decided to move it.
 *
 * So the authorization is entirely this function's, and it is the same one renaming
 * requires — `requireEdit`, which is `canAny(…, 'edit')`. Scope 'own' would otherwise
 * pass and there is no personal copy of the family's plan to own.
 *
 * ── §3, IN FULL, BECAUSE THE SERVICE ROLE HAS NO RLS ────────────────────────────────
 * The family code is derived from the caller's own membership and never taken as an
 * argument — the same reasoning `renameFamily`'s header gives — and `.eq('family_code',
 * …)` is what confines the UPDATE to one row. With the service role there is no policy
 * behind that filter, so it is not belt and braces here: it IS the isolation.
 */
export async function setFamilyTier(tier: string): Promise<SetTierResult> {
  const g = await requireEdit(FAMILY_RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }

  // Narrowed rather than cast. This is a `'use server'` export, so the argument arrives
  // from an HTTP request and the panel is not in its path; `families_tier_check` would
  // refuse an unknown value anyway, but a checked string is a message the caller can read
  // instead of a constraint violation logged as "could not save".
  if (!isFamilyTier(tier)) return { success: false, message: 'That is not a plan.' }

  const { data, error } = await createAdminClient()
    .from('families')
    .update({ tier })
    .eq('family_code', g.familyCode)
    .select('tier')

  if (error) {
    console.error(`[admin/family] tier change refused for ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not change the plan. Please try again.' }
  }
  // Zero rows is a family with a people row and no `families` row — the same pre-table
  // case `getFamilySettings` handles by falling back to the code. Reported rather than
  // returned as success over an unchanged value.
  if (!data || data.length === 0) {
    return { success: false, message: 'This family has no settings record to change.' }
  }

  // THE WHOLE LAYOUT, not this route. A tier decides which items the sidebar renders
  // (`viewableResources` narrows on it) and which pages `requireView` admits, so a
  // revalidation confined to /admin/family would leave the rail advertising the old plan
  // until the next full navigation.
  revalidatePath('/', 'layout')
  return { success: true, tier }
}

// NO `planLabel` HELPER HERE, and the reason is a build error rather than taste: every
// export of a `'use server'` file must be an async function, because Next.js gives each
// one a URL. `TIER_LABEL` is a plain object in `lib/tiers.ts` and every caller imports it
// from there.
