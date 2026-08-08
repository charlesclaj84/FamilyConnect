'use server'

import { createClient } from '@/lib/supabase/server'
import { computeIsMinor } from '@/lib/age-utils'
import { formatRoleTitle } from '@/lib/role-utils'

export interface MemberRecord {
  id: string
  user_id: string | null
  prefix: string | null
  first_name: string
  last_name: string
  nick_name: string | null
  avatar_url: string | null
  primary_email: string | null
  primary_phone: string | null
  chapter_id: string | null
  chapter_name: string | null
  primary_role_title: string | null
  is_active: boolean
  is_minor: boolean
  /** "City, State", either half alone, or null when the member recorded neither. */
  location: string | null
  /**
   * The member's permission template — the thing this app calls a Group.
   *
   * Readable through the user's client on purpose: `permission_templates` has a
   * "readable in family" SELECT policy for approved members (20260807000000), so the
   * directory needs no service-role query and no second family scoping to show it.
   * Null when no template is assigned, or when the assignment points outside this
   * family — a stale id resolves to nothing rather than naming another family's group.
   */
  group_name: string | null
}

/**
 * The two rows this action reads, declared rather than cast field by field.
 *
 * The `as any` per property that used to be here was working around the same thing this
 * says once: there are no generated database types in this project, so the client's own
 * inference does not know these columns or embeds. One named shape per query is honest
 * about what is expected back and lets the mapping below read as a mapping.
 */
interface PersonRow {
  id: string
  user_id: string | null
  prefix: string | null
  first_name: string
  last_name: string
  nick_name: string | null
  avatar_url: string | null
  primary_email: string | null
  primary_phone: string | null
  city: string | null
  state: string | null
  chapter_id: string | null
  date_of_birth: string | null
  chapters: { name: string } | null
  permission_templates: { name: string } | null
}

interface RoleRow {
  user_id: string | null
  scope: string | null
  family_roles: { name: string } | null
  chapters: { name: string } | null
}

export async function getMembers(): Promise<MemberRecord[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Fetch all people in the family (adults and minors).
  //
  // `permission_templates(name)` is the Group column on the directory. It resolves
  // through people.permission_template_id, and RLS on permission_templates carries its
  // own `family_code = auth_family_code()` — so an assignment pointing at another
  // family's template embeds as null rather than naming it.
  const { data: people } = await supabase
    .from('people')
    .select('id, user_id, prefix, first_name, last_name, nick_name, avatar_url, primary_email, primary_phone, city, state, chapter_id, date_of_birth, chapters(name), permission_templates(name)')
    // Approved only: an applicant is not in the family yet, so they are not in the
    // directory, not nominatable in an election and not taggable in a photo — the three
    // screens this feeds.
    //
    // THE FILTER IS HERE BECAUSE RLS DELIBERATELY DOES NOT APPLY IT. The people SELECT
    // policy admits a non-approved row to anyone holding admin/approvals:view, which
    // Member Approvals needs and every other reader inherits. So the queue was visible
    // to administrators in the directory and nowhere else was it wanted; the policy is
    // right for its purpose and the wrong place to express this.
    //
    // Safe for children and pre-entered relatives, which is the thing to check before
    // copying this: the stamp trigger returns early for a row with no user_id, so an
    // unlinked person keeps the column default — 'approved'. Only a real applicant, who
    // always has an account, is stamped 'pending'.
    .eq('membership_status', 'approved')
    .order('last_name')
    .order('first_name')

  if (!people) return []

  // user_roles links by user_id (not person_id) — build a user_id → scoped title map
  // (e.g. "Texas Chapter President", "National Secretary", "Regional President").
  const { data: roleAssignments } = await supabase
    .from('user_roles')
    .select('user_id, scope, family_roles(name), chapters(name)')

  const primaryRoleByUserId = new Map<string, string>()
  for (const ra of (roleAssignments ?? []) as unknown as RoleRow[]) {
    const name = ra.family_roles?.name
    if (name && ra.user_id && !primaryRoleByUserId.has(ra.user_id)) {
      primaryRoleByUserId.set(ra.user_id, formatRoleTitle({
        role_name: name,
        assignment_scope: ra.scope ?? 'national',
        chapter_name: ra.chapters?.name ?? null,
      }))
    }
  }

  return ((people ?? []) as unknown as PersonRow[]).map(p => ({
    id: p.id,
    user_id: p.user_id,
    prefix: p.prefix ?? null,
    first_name: p.first_name,
    last_name: p.last_name,
    nick_name: p.nick_name ?? null,
    avatar_url: p.avatar_url ?? null,
    primary_email: p.primary_email ?? null,
    primary_phone: p.primary_phone ?? null,
    location: [p.city, p.state].filter(Boolean).join(', ') || null,
    group_name: p.permission_templates?.name ?? null,
    chapter_id: p.chapter_id ?? null,
    chapter_name: p.chapters?.name ?? null,
    primary_role_title: p.user_id ? (primaryRoleByUserId.get(p.user_id) ?? null) : null,
    is_active: !!p.user_id,
    is_minor: computeIsMinor(p.date_of_birth),
  }))
}
