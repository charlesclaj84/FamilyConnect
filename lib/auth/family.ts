import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Family membership for the authenticated caller.
 *
 * An email may belong to more than one family: `people` holds one row per
 * (user, family), and which one is "current" comes from user_family_settings.
 * The resolution order below mirrors public.auth_family_code() exactly, so the
 * app and RLS always agree on which family the user is acting in:
 *
 *     active selection  →  login default  →  oldest membership
 *
 * Candidates are always the caller's OWN people rows, so a stale or bogus
 * active/default value can never point at a family they are not a member of —
 * it simply falls through to the next candidate.
 *
 * Do NOT read family_code from `user.user_metadata`: it is editable by end users
 * (supabase.auth.updateUser({ data })), so a member could rewrite it to point at
 * another family. People rows are written with the service-role client, and the
 * active/default selection can only be changed through the membership-checking
 * RPCs (see app/actions/family.ts).
 */

export interface FamilyMembership {
  familyCode: string
  familyName: string
  /** The caller's people row id *in that family*. */
  personId: string
  /** True for the family the caller is currently acting in. */
  isActive: boolean
  /** True for the family that opens on login. */
  isDefault: boolean
}

interface PersonRow {
  id: string
  family_code: string
  created_at: string
}

/**
 * All of the caller's memberships, resolved and ordered by display name.
 *
 * Memoized per request: family_code is consulted by most server actions, and
 * without this the settings lookup would repeat dozens of times per render.
 */
export const getMyFamilies = cache(async (userId: string): Promise<FamilyMembership[]> => {
  if (!userId) return []
  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('people')
    .select('id, family_code, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  const people = (rows ?? []) as PersonRow[]
  if (people.length === 0) return []

  const codes = [...new Set(people.map(p => p.family_code).filter(Boolean))]

  // user_family_settings and families are both optional: the first does not exist
  // until 20260617000000 is applied, and a family may have no display row. Either
  // way we fall back to the oldest membership / the raw code, so the app keeps
  // working before the migration is applied.
  const [settings, names] = await Promise.all([
    loadSettings(userId),
    loadFamilyNames(codes),
  ])

  const activeCode = resolveActiveCode(people, settings)

  return people
    .map(p => ({
      familyCode: p.family_code,
      familyName: names.get(p.family_code) ?? p.family_code,
      personId: p.id,
      isActive: p.family_code === activeCode,
      isDefault: p.family_code === settings?.default_family_code,
    }))
    .sort((a, b) => a.familyName.localeCompare(b.familyName))
})

interface FamilySettings {
  active_family_code: string | null
  default_family_code: string | null
}

/** Null when the table is absent (pre-migration) or the user has no row yet. */
async function loadSettings(userId: string): Promise<FamilySettings | null> {
  const admin = createAdminClient()
  try {
    const { data } = await admin
      .from('user_family_settings')
      .select('active_family_code, default_family_code')
      .eq('user_id', userId)
      .maybeSingle()
    return (data as FamilySettings | null) ?? null
  } catch {
    return null
  }
}

async function loadFamilyNames(codes: string[]): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map()
  const admin = createAdminClient()
  try {
    const { data } = await admin
      .from('families')
      .select('family_code, family_name')
      .in('family_code', codes)
    const rows = (data ?? []) as { family_code: string; family_name: string }[]
    return new Map(rows.map(f => [f.family_code, f.family_name]))
  } catch {
    return new Map()
  }
}

/** active → default → oldest, considering only real memberships. */
function resolveActiveCode(people: PersonRow[], settings: FamilySettings | null): string {
  const has = (code: string | null | undefined) =>
    Boolean(code) && people.some(p => p.family_code === code)

  if (has(settings?.active_family_code)) return settings!.active_family_code!
  if (has(settings?.default_family_code)) return settings!.default_family_code!
  return people[0]?.family_code ?? ''
}

/**
 * The family the caller is currently acting in. Returns '' when they have no
 * people row yet (e.g. a registration whose profile-seed step failed); callers
 * should treat '' as "no family / deny".
 */
export async function getMyFamilyCode(userId: string): Promise<string> {
  const families = await getMyFamilies(userId)
  return families.find(f => f.isActive)?.familyCode ?? families[0]?.familyCode ?? ''
}

/**
 * The caller's people row id in the family they are currently acting in.
 *
 * Use this instead of `.eq('user_id', id).maybeSingle()`: with more than one
 * membership that query matches several rows and `maybeSingle()` errors, and
 * picking an arbitrary row would attribute writes to the wrong family.
 */
export async function getMyPersonId(userId: string): Promise<string> {
  const families = await getMyFamilies(userId)
  return families.find(f => f.isActive)?.personId ?? families[0]?.personId ?? ''
}

/** The active family's code and person id together, for callers that need both. */
export async function getMyActiveMembership(
  userId: string,
): Promise<{ familyCode: string; personId: string }> {
  const families = await getMyFamilies(userId)
  const active = families.find(f => f.isActive) ?? families[0]
  return { familyCode: active?.familyCode ?? '', personId: active?.personId ?? '' }
}

/** True when the caller belongs to more than one family (drives the switcher UI). */
export async function hasMultipleFamilies(userId: string): Promise<boolean> {
  return (await getMyFamilies(userId)).length > 1
}

/**
 * True when `id` names a row of `table` that lives in `familyCode`.
 *
 * For the one case RLS structurally cannot cover: an id that arrives from the
 * client and is then written ONTO a row of the caller's own family. A partner's
 * people.id, a dues schedule id, a child's people.id. The inserted row is
 * legitimately the caller's, so its family_code satisfies every policy — while
 * the id it carries points into somebody else's family. The policy examines the
 * row, not the rows the row references, so nothing in the database objects.
 *
 * That makes this an action's responsibility, not RLS's, even on the user
 * client. tests/rls covers each caller.
 *
 * Deliberately the service-role client: the answer must not depend on whether
 * the caller happens to hold view permission on the referenced table, or a
 * family that restricts its Member Directory would break its own family tree.
 */
export async function belongsToFamily(
  table: string,
  id: string | null | undefined,
  familyCode: string,
): Promise<boolean> {
  if (!id || !familyCode) return false
  const { data } = await createAdminClient()
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('family_code', familyCode)
    .maybeSingle()
  return Boolean(data)
}
