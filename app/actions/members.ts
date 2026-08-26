'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode } from '@/lib/auth/family'
import { familyShowsPhotos } from '@/lib/auth/tier'
import { isMinorOn } from '@/lib/age-utils'
import { resolveFamilyZone } from '@/lib/auth/zone'
import { todayIn } from '@/lib/tz'
import { formatRoleTitle } from '@/lib/role-utils'
import { chapterPlaces } from '@/lib/chapter-places'

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
  /**
   * The region the member's chapter belongs to — DERIVED, never stored.
   *
   * `null` means **National**, and it means it for BOTH of the two ways a member gets
   * there: no chapter at all, and a chapter that sits under no region. That is not two
   * facts collapsed into one, it is one fact with two causes — National is the ABSENCE of
   * a region rather than a row (20260817000008), so a member in no chapter and a member in
   * an unassigned chapter are equally under it, and a nationally scoped due bills them
   * identically.
   *
   * The WORD stays in the component, matching `Chapter.region_name` in
   * app/actions/admin/chapters.ts (`// null = "National"`) and the one place that already
   * prints it, `AdminRegionsChaptersClient`. An action that returned the string would be a
   * second spelling of a caption the grid, the dues form and Dues Projections each own.
   */
  region_name: string | null
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
  permission_templates: { name: string } | null
}

interface RoleRow {
  user_id: string | null
  scope: string | null
  chapter_id: string | null
  family_roles: { name: string } | null
}

/**
 * `chapterPlaces` LIVES IN lib/chapter-places.ts, and for one day it lived in BOTH this file
 * and the other member table's, verbatim.
 *
 * Neither could share it: both are `'use server'` modules, everything exported from one of
 * those gets a public URL, and a chapter-and-region lookup taking a `familyCode` and a list of
 * ids as parameters is the shape AGENTS.md §2b tells you not to publish. A plain module both
 * import is the way out — the same answer `lib/notifications.ts` and
 * `lib/announcement-audience.ts` are built on.
 *
 * IT MATTERS THAT THERE IS ONE COPY. Region and Chapter are two of the four columns AGENTS.md's
 * "A table is a table" requires the Member Directory and Members & Access to agree on, so an
 * answer that differed between them would be the exact drift that section exists to stop — and
 * the two copies had already begun to, differing in the prefix they logged a refused read under.
 */

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
  //
  // `chapters(name)` USED TO BE IN THIS EMBED and deliberately is not any more: the policy
  // on that table is administrator-only, so it resolved to null for almost every reader.
  // `chapterPlaces` above resolves the chapter AND its region, for everybody, and says why.
  const { data: people, error: peopleError } = await supabase
    .from('people')
    .select('id, user_id, prefix, first_name, last_name, nick_name, avatar_url, primary_email, primary_phone, city, state, chapter_id, date_of_birth, permission_templates(name)')
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

  // §8. The error used to be discarded here, which made a refused read and an empty family
  // the same thing on screen — three screens rendering "nobody is here" over a hundred and
  // forty people, with nothing anywhere saying so. The RETURN is unchanged, because an empty
  // directory is still the only honest thing to draw when the roster could not be read; what
  // changes is that it is now reported instead of inferred.
  if (peopleError) {
    console.error(`[members] roster read failed: ${peopleError.message}`)
    return []
  }
  if (!people) return []

  // user_roles links by user_id (not person_id) — build a user_id → scoped title map
  // (e.g. "Texas Chapter President", "National Secretary", "Regional President").
  //
  // `chapters(name)` USED TO BE IN THIS EMBED TOO, and it went for the same reason it left the
  // `people` select above: the embed is evaluated under the RLS of the table being embedded, and
  // the policy on `chapters` is administrator-only. So `chapter_name` arrived null for almost
  // every reader and `formatRoleTitle`'s `chapter_name ?? 'Chapter'` fall-back then printed
  // "Chapter President" — which reads as a REAL title rather than as a withheld one, and is the
  // worse of the two failures. A missing word nobody can see is how a caption comes to be wrong
  // in a way nobody reports. `chapter_id` is selected instead and resolved below through the
  // same `chapterPlaces` map the two member tables already use, so the role's chapter and the
  // member's chapter cannot come out spelled differently on one screen.
  // THE ADMIN CLIENT, AND THAT IS THE 2026-08-19 FIX rather than a shortcut. On the user
  // client this read returned almost nothing to almost everybody, twice over: the
  // `user_roles` SELECT policy releases a row to its own holder OR to somebody with
  // `admin/boardpositions:view = 'any'`, and the `family_roles` embed under it is evaluated
  // by the same key — so an ordinary member saw their own title and no one else's, and the
  // column read as "this family has one officer". A board position is the one fact about a
  // member that is deliberately public WITHIN the family; the key governs the screen that
  // curates the list, not who may see who holds what. §3's obligation is discharged by the
  // `family_code` conjunct, from the caller's own membership.
  const familyCode = await getMyFamilyCode(user.id)
  // THE FAMILY'S ZONE for the age split. `computeIsMinor` read `todayLocal()` internally,
  // which on the server is UTC — so a relative counted as an adult five hours early every
  // evening, and two surfaces could disagree about the same person. `isMinorOn` is the pure
  // rule and takes the date, which is what makes the answer stateable (§7b).
  const familyToday = todayIn(await resolveFamilyZone(familyCode))
  const showPhotos = await familyShowsPhotos(user.id)
  const { data: roleAssignments, error: rolesError } = await createAdminClient()
    .from('user_roles')
    .select('user_id, scope, chapter_id, family_roles(name)')
    .eq('family_code', familyCode)

  // Reported and NOT fatal, which is the difference between this read and the one above: a
  // lost roles read costs the board title and nothing else, so failing the whole directory
  // over it would trade a missing caption for a missing family.
  if (rolesError) {
    console.error(`[members] board-title read failed: ${rolesError.message}`)
  }

  const rows = people as unknown as PersonRow[]
  const roleRows = (roleAssignments ?? []) as unknown as RoleRow[]

  // Region and Chapter, for the two member tables AND for the chapter-scoped board titles — ONE
  // read, so the two cannot disagree about what a chapter is called. The family code comes from
  // the caller's own membership and never from anything they sent (§3); the ids come from rows
  // RLS has already released to them, on both tables.
  const places = await chapterPlaces(
    familyCode,
    [...new Set([
      ...rows.map(r => r.chapter_id),
      ...roleRows.map(r => r.chapter_id),
    ].filter(Boolean))] as string[],
  )

  const primaryRoleByUserId = new Map<string, string>()
  for (const ra of roleRows) {
    const name = ra.family_roles?.name
    if (name && ra.user_id && !primaryRoleByUserId.has(ra.user_id)) {
      primaryRoleByUserId.set(ra.user_id, formatRoleTitle({
        role_name: name,
        assignment_scope: ra.scope ?? 'national',
        // null keeps `formatRoleTitle`'s existing fall-back, which is right for a role that is
        // genuinely national or regional — those carry no chapter and never did.
        chapter_name: ra.chapter_id ? places.get(ra.chapter_id)?.chapterName ?? null : null,
      }))
    }
  }

  return rows.map(p => {
    // AN UNRESOLVED CHAPTER ID READS AS "NO CHAPTER" — em-dash for Chapter, National for
    // Region — and that is chosen rather than fallen into. It is reachable two ways and both
    // are already accounted for: a refused lookup, which `chapterPlaces` logs, and a
    // chapter_id belonging to another family, which the family conjunct is there to strand.
    // The alternative is a third state ("there is a chapter and you may not know which"),
    // and the two columns these tables now carry have nowhere to put it, so it would become
    // a footnote for a case that should not occur.
    const place = p.chapter_id ? places.get(p.chapter_id) : undefined
    return {
      id: p.id,
      user_id: p.user_id,
      prefix: p.prefix ?? null,
      first_name: p.first_name,
      last_name: p.last_name,
      nick_name: p.nick_name ?? null,
      // Profile pictures are Standard (2026-08-22). `familyShowsPhotos` is the one place the
      // key is named — see `lib/auth/tier.ts` for why the gate is on the read. Every surface
      // this feeds (the Directory, Members & Access, the election nominee picker, the photo
      // tagger) already falls back to initials for a member who never uploaded one.
      avatar_url: showPhotos ? (p.avatar_url ?? null) : null,
      primary_email: p.primary_email ?? null,
      primary_phone: p.primary_phone ?? null,
      location: [p.city, p.state].filter(Boolean).join(', ') || null,
      group_name: p.permission_templates?.name ?? null,
      chapter_id: p.chapter_id ?? null,
      chapter_name: place?.chapterName ?? null,
      region_name: place?.regionName ?? null,
      primary_role_title: p.user_id ? (primaryRoleByUserId.get(p.user_id) ?? null) : null,
      is_active: !!p.user_id,
      is_minor: isMinorOn(p.date_of_birth, familyToday),
    }
  })
}
