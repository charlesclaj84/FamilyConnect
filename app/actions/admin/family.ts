'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAny } from '@/lib/auth/permissions'
import { requireEdit, requireRead } from '@/lib/auth/guard'
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
  /** Whether to render the form at all. The write re-checks; this only shapes the UI. */
  canEdit: boolean
}

export type RenameFamilyResult =
  | { success: true; familyName: string }
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
  const [family, members, editable] = await Promise.all([
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
