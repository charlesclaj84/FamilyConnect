'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember, requireRead } from '@/lib/auth/guard'
import { belongsToFamily } from '@/lib/auth/family'
import { inviteMember } from '@/app/actions/invitations'
import {
  isTreeRelationshipType, inverseTypeFor, relationFor, placeholderEmail, summarizeTree,
  type TreeRelation, type TreeSummary,
} from '@/lib/family-tree'

/**
 * The family-wide tree at `/family-tree` — now the only tree in the product.
 *
 * ── WHAT IT IS BUILT ON, AND WHY NOT A NEW TABLE ────────────────────────────────────
 * `people` and `person_relationships`, the pair 20260602000003 created. A tree table of
 * its own was the obvious alternative and is the wrong answer: the people ON the tree are
 * the family's members, with dues, RSVPs, photo tags and permission templates hanging off
 * them. A parallel table would either duplicate those people or refer to them, and
 * duplicating them is how a directory and a tree come to hold two of everybody.
 *
 * It also inherits every row the retired per-member lineage view wrote, which is the other
 * half of why the table was reused rather than replaced — see the note on that removal in
 * `app/(protected)/family-tree/page.tsx`. Rows it never wrote are still read here: the
 * grandparent relationship types are skipped rather than guessed at, for the reason
 * `relationFor` gives.
 *
 * ── THE READ IS SYMMETRIC; THE WRITE IS NOT ─────────────────────────────────────────
 * `person_relationships` is directional — "person_id HAS type TO related_person_id" — and
 * whether the inverse row exists depends on whether anybody knew a gender at the time
 * (see `inverseTypeFor`). A reader that trusted direction would therefore draw half a
 * tree. `getFamilyTree` normalizes every row into BOTH directions, so a father edge is a
 * parent edge from the child and a child edge from the father whether or not the second
 * row was ever written.
 *
 * ── AUTHORIZATION ───────────────────────────────────────────────────────────────────
 * Reads gate on `family-tree`, which 20260806000006 deliberately left unregistered — so it
 * resolves to viewable for every approved member and a family cannot switch it off. That
 * is a known and recorded gap rather than an oversight here: it was right while
 * `family-tree` meant "my own line", and this page makes it a family-wide roster. TODO.md
 * carries the decision, and retiring the lineage view has narrowed it to one page rather
 * than settled it.
 *
 * Writes are SELF-SERVICE (`requireMember`), matching `person_relationships`' own
 * policies since 20260806000006 — any approved member may record a relationship. What
 * they owe instead is the check self-service always owes: every id arriving from the
 * client is confirmed into the caller's own family before it is written onto a row
 * (AGENTS.md §4). `upsertSpouse`, `upsertAncestor` and `acceptSpouseChild` were each
 * missing exactly that check; every id below goes through `belongsToFamily`.
 */

export interface TreePerson {
  id: string
  firstName: string
  lastName: string
  nickName: string | null
  gender: string | null
  avatarUrl: string | null
  dateOfBirth: string | null
  sunsetDate: string | null
  isMinor: boolean
  /** True when this person holds an account in this family. */
  hasAccount: boolean
  /** 'pending' means invited or applied and not yet admitted. */
  membershipStatus: string
  /** True when their address was generated because they have none. */
  emailIsPlaceholder: boolean
  /** Why they have no address. Only meaningful with `emailIsPlaceholder`. */
  noEmailReason: string | null
}

export interface TreeEdge {
  /** The `person_relationships` row this came from, so it can be removed. */
  id: string
  from: string
  to: string
  /** `from` HAS this relation TO `to`: 'parent' means `to` is `from`'s parent. */
  relation: TreeRelation
  /** True for the direction this edge was DERIVED rather than stored. */
  derived: boolean
}

export interface FamilyTree {
  people: TreePerson[]
  edges: TreeEdge[]
  /** The caller's own people.id, so the canvas can open on them. */
  myPersonId: string | null
}

const EMPTY_TREE: FamilyTree = { people: [], edges: [], myPersonId: null }

type PersonRow = {
  id: string; first_name: string; last_name: string; nick_name: string | null
  gender: string | null; avatar_url: string | null; date_of_birth: string | null
  sunset_date: string | null; is_minor: boolean; user_id: string | null
  membership_status: string | null
  email_is_placeholder: boolean | null; no_email_reason: string | null
}

/**
 * Everybody in the family, and every relationship between them.
 *
 * THE ADMIN CLIENT, and it needs justifying because AGENTS.md §3 says to prefer the
 * user's. Two reasons, and the second is the one that decides it:
 *
 *   * The `people` SELECT policy hides applicants from anybody who cannot view
 *     `admin/approvals`. That is right for the Directory — an applicant is not a member
 *     yet — and wrong here, because the tree's whole invite flow creates a PENDING person
 *     and puts a card on the canvas. Under the user's client that card would vanish the
 *     moment it was created, for everybody but an approvals administrator.
 *   * `person_relationships` rows reference people, and a half-visible roster produces
 *     edges pointing at nothing, which draws a broken tree rather than a smaller one.
 *
 * So family scoping is hand-applied on both queries — `.eq('family_code', familyCode)`,
 * from the caller's own membership and never from an argument — which is the whole of
 * §3's requirement, and the only thing standing between one family's tree and another's.
 */
export async function getFamilyTree(): Promise<FamilyTree> {
  const g = await requireRead('family-tree')
  if (!g.ok || !g.familyCode) return EMPTY_TREE

  const admin = createAdminClient()

  const [peopleResult, edgeResult, typeResult] = await Promise.all([
    admin
      .from('people')
      .select('id, first_name, last_name, nick_name, gender, avatar_url, date_of_birth, sunset_date, is_minor, user_id, membership_status, email_is_placeholder, no_email_reason')
      .eq('family_code', g.familyCode)
      .order('last_name')
      .order('first_name'),
    admin
      .from('person_relationships')
      .select('id, person_id, related_person_id, relationship_type_id')
      .eq('family_code', g.familyCode),
    // The global lookup, unscoped by design — `relationship_types` has no family_code and
    // is the same twenty rows for everybody (20260602000003).
    admin.from('relationship_types').select('id, name'),
  ])

  // §8: an empty result and a refused query are different things and `data` cannot tell
  // them apart. A refused query here would render an empty tree over a family that has
  // one, which reads as "nobody has built this yet" — the most misleading possible
  // answer, because it invites somebody to build it a second time.
  if (peopleResult.error || edgeResult.error || typeResult.error) {
    console.error(
      '[family-tree] could not load the tree for ' + g.familyCode + ': '
      + (peopleResult.error?.message ?? edgeResult.error?.message ?? typeResult.error?.message),
    )
    return EMPTY_TREE
  }

  const typeName = new Map(
    ((typeResult.data ?? []) as { id: string; name: string }[]).map(t => [t.id, t.name]),
  )

  const people: TreePerson[] = ((peopleResult.data ?? []) as PersonRow[]).map(p => ({
    id: p.id,
    firstName: p.first_name ?? '',
    lastName: p.last_name ?? '',
    nickName: p.nick_name,
    gender: p.gender,
    avatarUrl: p.avatar_url,
    dateOfBirth: p.date_of_birth,
    sunsetDate: p.sunset_date,
    isMinor: Boolean(p.is_minor),
    hasAccount: Boolean(p.user_id),
    membershipStatus: p.membership_status ?? 'approved',
    emailIsPlaceholder: Boolean(p.email_is_placeholder),
    noEmailReason: p.no_email_reason,
  }))

  const known = new Set(people.map(p => p.id))
  const edges: TreeEdge[] = []
  const seen = new Set<string>()

  for (const row of (edgeResult.data ?? []) as {
    id: string; person_id: string; related_person_id: string; relationship_type_id: string
  }[]) {
    const relation = relationFor(typeName.get(row.relationship_type_id) ?? '')
    // An unmapped type is skipped rather than guessed at. The grandparent rows the
    // lineage view writes are the case: a grandparent is two parent edges, and filing one
    // as a parent edge would draw somebody's grandfather where their father belongs.
    if (!relation) continue
    // Both ends must be people we loaded. A dangling reference cannot happen through the
    // foreign key, but a row whose person was filtered out would draw an edge to nowhere.
    if (!known.has(row.person_id) || !known.has(row.related_person_id)) continue

    push(edges, seen, {
      id: row.id, from: row.person_id, to: row.related_person_id, relation, derived: false,
    })

    // THE DERIVED HALF, and it is what makes the canvas correct rather than convenient.
    // The stored row says "A has a Father, B"; the tree also needs "B has a child, A", and
    // whether that second row was ever written depended on somebody knowing A's gender.
    const mirror = MIRROR[relation]
    push(edges, seen, {
      id: row.id, from: row.related_person_id, to: row.person_id, relation: mirror, derived: true,
    })
  }

  return { people, edges, myPersonId: g.personId }
}

/**
 * The three numbers the Dashboard's Family Tree card shows: how many people, how many
 * generations deep, and how many are attached to nobody.
 *
 * ── IT REUSES `getFamilyTree` RATHER THAN COUNTING IN SQL ───────────────────────────
 * Three aggregate queries would be fewer bytes over the wire and would put the definition
 * of "generation" into a recursive CTE — a second implementation of `summarizeTree`, free
 * to disagree with the one the canvas is drawn from. The card and the tree must never
 * report different families. `getFamilyTree` is two indexed reads scoped to one family,
 * which is the size of a family rather than the size of the database, and both callers on
 * a page share React's request cache anyway.
 *
 * It also inherits the authorization for free: `getFamilyTree` gates on `family-tree` and
 * returns the empty tree to anybody it refuses, so an unentitled caller gets zeroes rather
 * than a leak. THE PAGE STILL MUST NOT CALL THIS WITHOUT THE GRANT (AGENTS.md §5) — zeroes
 * in the RSC payload are not a disclosure, but a card rendering "0 members" over a family
 * of ninety is a worse answer than no card.
 *
 * ZERO IS A REAL ANSWER AND IS NOT HIDDEN. A family that has recorded no relationships has
 * one generation, everybody a leaf, and that is precisely the state the card exists to
 * report — see the component, which renders for an empty tree deliberately.
 */
export async function getFamilyTreeSummary(): Promise<TreeSummary> {
  const tree = await getFamilyTree()
  return summarizeTree(tree.people, tree.edges)
}

/** parent ⇄ child; spouse and sibling are their own mirror. */
const MIRROR: Record<TreeRelation, TreeRelation> = {
  parent: 'child',
  child: 'parent',
  spouse: 'spouse',
  sibling: 'sibling',
}

/**
 * Add an edge once per (from, to, relation).
 *
 * The duplicate this collapses is the ordinary case rather than a defect: a family that
 * recorded BOTH directions — which `addRelative` does whenever it can name the inverse —
 * produces a stored edge and a derived one saying the same thing. Without this the canvas
 * would draw the father twice.
 *
 * The stored row wins on `id`, because that is what `removeRelative` addresses. `seen`
 * being keyed without `derived` is what makes the first write win, and the stored row is
 * always pushed first.
 */
function push(edges: TreeEdge[], seen: Set<string>, edge: TreeEdge): void {
  const key = `${edge.from}:${edge.to}:${edge.relation}`
  if (seen.has(key)) return
  seen.add(key)
  edges.push(edge)
}

/** How the new person is established. */
export type AddRelativeMode = 'existing' | 'invite' | 'record'

export interface AddRelativeInput {
  /** The person the new relative is being attached to. */
  anchorPersonId: string
  /** A `relationship_types.name` the builder offers — see TREE_RELATIONSHIPS. */
  relationshipType: string
  mode: AddRelativeMode
  /** mode 'existing': the people.id to link. */
  existingPersonId?: string
  /** modes 'invite' and 'record'. */
  firstName?: string
  lastName?: string
  /** mode 'invite' only. */
  email?: string
  /** mode 'record' only, and required there. */
  noEmailReason?: string
}

export type AddRelativeResult =
  | { success: true; personId: string; invited: boolean; emailed: boolean; placeholderEmail?: string }
  | { success: false; message: string }

/**
 * Attach a relative to somebody already on the tree.
 *
 * THREE WAYS IN, and the third is deliberately the hardest to reach:
 *
 *   existing   link a person the family already has. No new record, no invitation.
 *   invite     create the record AND email an invitation. The invitee joins the
 *              approvals queue exactly as they would from My Families — `preApproved`
 *              is not requested, because building a tree is not a decision about who
 *              gets into the family.
 *   record     create the record with a GENERATED address and a stated reason. For the
 *              dead, for elders with no email, and for children. Rare on purpose.
 *
 * The invitation carries `p_person_id`, so when it is redeemed the account attaches to
 * the record already on the tree instead of creating a second one — see 20260813000004.
 * Without that the family gets Ada-on-the-tree and Ada-in-the-directory as two people.
 */
export async function addRelative(input: AddRelativeInput): Promise<AddRelativeResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'No family selected' }

  const type = (input.relationshipType ?? '').trim()
  if (!isTreeRelationshipType(type)) {
    return { success: false, message: 'That is not a relationship this tree records' }
  }

  // §4: the anchor arrives from the client and is about to be written onto a row whose
  // family_code satisfies every policy. Confirm it into THIS family first.
  if (!(await belongsToFamily('people', input.anchorPersonId, g.familyCode))) {
    return { success: false, message: 'Person not found' }
  }

  const admin = createAdminClient()

  const { data: typeRow } = await admin
    .from('relationship_types').select('id').eq('name', type).maybeSingle()
  if (!typeRow) return { success: false, message: 'That relationship type is not set up' }

  let personId: string
  let invited = false
  let emailed = false
  let generatedEmail: string | undefined

  if (input.mode === 'existing') {
    const target = (input.existingPersonId ?? '').trim()
    if (!target) return { success: false, message: 'Choose somebody from your family' }
    if (target === input.anchorPersonId) {
      return { success: false, message: 'Somebody cannot be their own relative' }
    }
    // §4 again, on the OTHER id. This is the check `upsertSpouse` and `upsertAncestor`
    // were each missing: without it, one family's member can be linked into another's tree.
    if (!(await belongsToFamily('people', target, g.familyCode))) {
      return { success: false, message: 'Person not found' }
    }
    personId = target
  } else {
    const firstName = (input.firstName ?? '').trim()
    const lastName = (input.lastName ?? '').trim()
    if (!firstName || !lastName) {
      return { success: false, message: 'Enter a first and last name' }
    }

    if (input.mode === 'record') {
      const reason = (input.noEmailReason ?? '').trim()
      // REQUIRED, and checked here as well as by the CHECK constraint. This path is the
      // escape hatch from "every relative gets invited", and an escape hatch with no
      // friction becomes the default route.
      if (!reason) {
        return { success: false, message: 'Say why this person has no email address' }
      }
      generatedEmail = placeholderEmail(g.familyCode, firstName, lastName, crypto.randomUUID())
      const created = await createPerson(g.familyCode, g.userId, {
        first_name: firstName,
        last_name: lastName,
        primary_email: generatedEmail,
        email_is_placeholder: true,
        no_email_reason: reason,
      })
      if (!created.ok) return { success: false, message: created.message }
      personId = created.id
    } else {
      const email = (input.email ?? '').trim().toLowerCase()
      if (!email) return { success: false, message: 'Enter an email address' }

      const created = await createPerson(g.familyCode, g.userId, {
        first_name: firstName,
        last_name: lastName,
        primary_email: email,
      })
      if (!created.ok) return { success: false, message: created.message }
      personId = created.id

      // THE INVITATION IS SENT AFTER the record exists, so it can name it. `preApproved`
      // is false: this is the My Families flow, where the invitee waits for an
      // administrator, and putting somebody on a tree is not that decision.
      //
      // A FAILED INVITATION DOES NOT UNDO THE RECORD. The card on the tree is the thing
      // the member asked for and it is correct either way; the message says what happened
      // so nobody is told an email went out that did not. `inviteMember` refuses an
      // address already in the family, which is the common failure here and is exactly
      // the case where keeping the record and reporting it is right.
      const sent = await inviteMember(
        email,
        { firstName, lastName },
        false,
        g.familyCode,
        personId,
      )
      invited = sent.success
      emailed = sent.success && sent.emailed
    }
  }

  // The edge itself, and its inverse where the inverse can be named.
  const link = await linkRelationship({
    familyCode: g.familyCode,
    userId: g.userId,
    anchorPersonId: input.anchorPersonId,
    personId,
    typeId: typeRow.id as string,
    type,
  })
  if (!link.ok) return { success: false, message: link.message }

  revalidatePath('/family-tree')
  revalidatePath('/members')
  return {
    success: true,
    personId,
    invited,
    emailed,
    ...(generatedEmail ? { placeholderEmail: generatedEmail } : {}),
  }
}

/**
 * Insert a `people` row for somebody who is not a member yet.
 *
 * The ADMIN client, because the row has no `user_id` and the `people` INSERT policy
 * requires `created_by = auth.uid() OR user_id = auth.uid()` — which the service role
 * cannot satisfy, and which the user's client satisfies only by writing `created_by`
 * itself. Both work; the admin client is used because the caller may also need to set
 * `email_is_placeholder`, which is not in `lib/profile-columns.ts` and must not be.
 *
 * `family_code` comes from the caller's own membership, never from an argument (§3).
 */
async function createPerson(
  familyCode: string,
  userId: string,
  fields: {
    first_name: string; last_name: string; primary_email: string
    email_is_placeholder?: boolean; no_email_reason?: string
  },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await createAdminClient()
    .from('people')
    .insert({
      family_code: familyCode,
      is_minor: false,
      created_by: userId,
      ...fields,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, message: error?.message ?? 'Could not create that record' }
  }
  return { ok: true, id: data.id as string }
}

/**
 * Write the relationship, and its inverse when the inverse has a name.
 *
 * The inverse is best-effort by design. `inverseTypeFor` returns null whenever the anchor
 * has no recorded gender, which is most of a real tree — and the canvas does not need it,
 * because `getFamilyTree` derives both directions from either row.
 *
 * SO WHY WRITE IT AT ALL, now the lineage view that walked this table directionally is
 * gone? Because the row is a fact and the derivation is a convenience. "Martha has a
 * Father, Samuel" and "Samuel has a Daughter, Martha" are two things a family knows, and
 * only the second one records that Martha is a daughter rather than a son — the tree can
 * infer the EDGE from either row and cannot infer the WORD. Anything that ever asks the
 * database directly, from a report to an export to the next screen, gets the whole answer
 * rather than half of it.
 *
 * A failed insert of the inverse is still not a reason to fail the whole addition: the
 * edge the member asked for is already there and the canvas will draw it.
 */
async function linkRelationship(o: {
  familyCode: string
  userId: string
  anchorPersonId: string
  personId: string
  typeId: string
  type: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createAdminClient()

  const { error } = await admin.from('person_relationships').upsert({
    person_id: o.anchorPersonId,
    related_person_id: o.personId,
    relationship_type_id: o.typeId,
    is_step: false,
    family_code: o.familyCode,
    created_by: o.userId,
  }, { onConflict: 'person_id,related_person_id,relationship_type_id' })

  if (error) return { ok: false, message: error.message }

  const { data: anchor } = await admin
    .from('people').select('gender').eq('id', o.anchorPersonId).maybeSingle()

  const inverse = inverseTypeFor(o.type, (anchor as { gender: string | null } | null)?.gender)
  if (!inverse) return { ok: true }

  const { data: inverseType } = await admin
    .from('relationship_types').select('id').eq('name', inverse).maybeSingle()
  if (!inverseType) return { ok: true }

  await admin.from('person_relationships').upsert({
    person_id: o.personId,
    related_person_id: o.anchorPersonId,
    relationship_type_id: inverseType.id,
    is_step: false,
    family_code: o.familyCode,
    created_by: o.userId,
  }, { onConflict: 'person_id,related_person_id,relationship_type_id' })

  return { ok: true }
}

/**
 * Remove one relationship, in both directions.
 *
 * THE ROW IS READ FIRST, family-scoped, so the decision is made against what the database
 * holds rather than anything the caller sent — the same shape `deleteAnnouncement` uses.
 * An id from another family finds no row and is refused with the message a missing row
 * gets, which tells a prober nothing about whether it exists.
 *
 * IT DELETES THE PERSON'S EDGE, NOT THE PERSON. Removing somebody from a tree must never
 * remove them from the family: the row may carry dues, RSVPs, photo tags and a permission
 * template, and a mis-click on a canvas is not a decision to delete a member. Detaching
 * leaves them in the Directory to be re-attached.
 */
export async function removeRelationship(
  relationshipId: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'No family selected' }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('person_relationships')
    .select('id, person_id, related_person_id, family_code')
    .eq('id', relationshipId)
    .maybeSingle()

  if (!row || row.family_code !== g.familyCode) {
    return { success: false, message: 'Relationship not found' }
  }

  // Both directions, because the pair is one fact. Deleting only the stored row would
  // leave the inverse behind and the canvas would keep drawing the edge — from the other
  // side, which reads as the delete having silently failed.
  const { error } = await admin
    .from('person_relationships')
    .delete()
    .eq('family_code', g.familyCode)
    .or(
      `and(person_id.eq.${row.person_id},related_person_id.eq.${row.related_person_id}),`
      + `and(person_id.eq.${row.related_person_id},related_person_id.eq.${row.person_id})`,
    )

  if (error) return { success: false, message: error.message }

  revalidatePath('/family-tree')
  return { success: true }
}
