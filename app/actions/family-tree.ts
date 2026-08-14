'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEdit, requireMember, requireRead } from '@/lib/auth/guard'
import { belongsToFamily } from '@/lib/auth/family'
import { pickProfileColumns } from '@/lib/profile-columns'
import { inviteMember } from '@/app/actions/invitations'
import {
  isTreeRelationshipType, inverseTypeFor, relationFor, relationshipMeta, placeholderEmail,
  summarizeTree, isLinkKind, type LinkKind, type TreeRelation, type TreeSummary,
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
  /** `person_relationships.link_kind` — only 'blood' conducts. Mirrored onto the
   *  derived direction, because a step-son's step-father is still a step link. */
  kind: LinkKind
  /**
   * The `relationship_types.name` naming `to` relative to `from` — 'Wife', 'Ex-Husband'.
   *
   * COMPUTED PER DIRECTION, not copied: the stored row names one end, and the derived
   * direction needs the inverse word or a spouse card reached from the other side would
   * read "Wife" under a man. Null when the inverse cannot be named, which is whenever the
   * far end has no recorded gender — most of a real tree.
   */
  typeName: string | null
  /** True for the direction this edge was DERIVED rather than stored. */
  derived: boolean
}

export interface FamilyTree {
  people: TreePerson[]
  edges: TreeEdge[]
  /** The caller's own people.id, so the canvas can open on them. */
  myPersonId: string | null
  /**
   * The person the Bloodline view walks out from — the family's FOUNDER.
   *
   * It has to be one person for the whole family, not the caller, or two members would
   * see different bloodlines and the toggle would mean something different on every
   * screen. The founder is the defensible default: they created the family, and a family
   * is usually named for the line it descends from.
   *
   * Null when the founder has left or never had a people row here, and the canvas then
   * hides the toggle rather than guessing — see `bloodlineIds`, which returns null for
   * the same reason. TODO.md carries the case this gets wrong: a founder who married in.
   */
  bloodlineAnchorId: string | null
}

const EMPTY_TREE: FamilyTree = {
  people: [], edges: [], myPersonId: null, bloodlineAnchorId: null,
}

type PersonRow = {
  id: string; first_name: string; last_name: string; nick_name: string | null
  gender: string | null; avatar_url: string | null; date_of_birth: string | null
  sunset_date: string | null; user_id: string | null
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

  const [peopleResult, edgeResult, typeResult, familyResult] = await Promise.all([
    admin
      .from('people')
      .select('id, first_name, last_name, nick_name, gender, avatar_url, date_of_birth, sunset_date, user_id, membership_status, email_is_placeholder, no_email_reason')
      .eq('family_code', g.familyCode)
      .order('last_name')
      .order('first_name'),
    admin
      .from('person_relationships')
      .select('id, person_id, related_person_id, relationship_type_id, link_kind')
      .eq('family_code', g.familyCode),
    // The global lookup, unscoped by design — `relationship_types` has no family_code and
    // is the same twenty rows for everybody (20260602000003).
    admin.from('relationship_types').select('id, name'),
    // THE BLOODLINE ANCHOR. `families.created_by` is an auth user id, so it takes a second
    // hop to reach their people row IN THIS FAMILY — a founder who belongs to two families
    // has a row in each, and `.eq('family_code', …)` is what picks the right one (§3).
    admin.from('families').select('created_by, bloodline_anchor_id')
      .eq('family_code', g.familyCode).maybeSingle(),
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
    hasAccount: Boolean(p.user_id),
    membershipStatus: p.membership_status ?? 'approved',
    emailIsPlaceholder: Boolean(p.email_is_placeholder),
    noEmailReason: p.no_email_reason,
  }))

  const known = new Set(people.map(p => p.id))
  const genderById = new Map(people.map(p => [p.id, p.gender]))
  const edges: TreeEdge[] = []
  const seen = new Set<string>()

  for (const row of (edgeResult.data ?? []) as {
    id: string; person_id: string; related_person_id: string; relationship_type_id: string
    link_kind: string | null
  }[]) {
    const relation = relationFor(typeName.get(row.relationship_type_id) ?? '')
    // An unmapped type is skipped rather than guessed at. The grandparent rows the
    // lineage view writes are the case: a grandparent is two parent edges, and filing one
    // as a parent edge would draw somebody's grandfather where their father belongs.
    if (!relation) continue
    // Both ends must be people we loaded. A dangling reference cannot happen through the
    // foreign key, but a row whose person was filtered out would draw an edge to nowhere.
    if (!known.has(row.person_id) || !known.has(row.related_person_id)) continue

    // An unrecognised kind falls back to 'blood', matching the column default and the
    // behaviour of every row written before 20260813000007. Failing closed here would be
    // worse than it sounds: it would quietly drop people OUT of the bloodline, which is
    // the answer nobody can tell is wrong by looking.
    const kind: LinkKind = isLinkKind(row.link_kind ?? '') ? (row.link_kind as LinkKind) : 'blood'

    const storedName = typeName.get(row.relationship_type_id) ?? null

    push(edges, seen, {
      id: row.id, from: row.person_id, to: row.related_person_id, relation, kind,
      typeName: storedName, derived: false,
    })

    // THE DERIVED HALF, and it is what makes the canvas correct rather than convenient.
    // The stored row says "A has a Father, B"; the tree also needs "B has a child, A", and
    // whether that second row was ever written depended on somebody knowing A's gender.
    //
    // `kind` is carried across UNCHANGED: a step-son's step-father is still a step link,
    // so blood must not travel back up an edge it could not travel down.
    const mirror = MIRROR[relation]
    // The inverse WORD, named against the gender of the person the stored row is about —
    // the same call `linkRelationship` makes when it writes the second row.
    const mirrorName = storedName
      ? inverseTypeFor(storedName, genderById.get(row.person_id) ?? null)
      : null
    push(edges, seen, {
      id: row.id, from: row.related_person_id, to: row.person_id, relation: mirror, kind,
      typeName: mirrorName, derived: true,
    })
  }

  // §8 again, and deliberately NOT fatal: a family whose founder row cannot be read still
  // has a tree worth drawing. The anchor goes null, `bloodlineIds` answers null, and the
  // canvas hides the toggle — one control missing rather than an empty page.
  if (familyResult.error) {
    console.error('[family-tree] could not read the founder for ' + g.familyCode
      + ': ' + familyResult.error.message)
  }
  // THE FAMILY'S CHOICE FIRST, the founder only as a fallback (20260813000008).
  //
  // The founder is a poor default and was the reported bug: a family created by a SON
  // walks up from him, so his mother — his father's former wife, and no blood relation to
  // the line — comes back as blood, while the current wife correctly does not. One rule,
  // two answers, decided by who happened to register.
  //
  // The set anchor is re-checked against the roster below rather than trusted: the column
  // is ON DELETE SET NULL and guarded to this family, but a person filtered out of THIS
  // query (there is no filter today, and that is not a promise) would leave the walk
  // starting nowhere.
  const familyRow = familyResult.data as
    { created_by: string | null; bloodline_anchor_id: string | null } | null
  const roster = (peopleResult.data ?? []) as PersonRow[]

  const chosen = familyRow?.bloodline_anchor_id
  const anchor = (chosen && roster.some(p => p.id === chosen))
    ? chosen
    : (familyRow?.created_by
      ? roster.find(p => p.user_id === familyRow.created_by)?.id ?? null
      : null)

  return { people, edges, myPersonId: g.personId, bloodlineAnchorId: anchor }
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
  /**
   * What the link IS. Omitted means 'blood', matching the column default.
   *
   * Only meaningful for parent, child and sibling links — a marriage is never blood, and
   * `person_relationships_marriage_is_not_blood` corrects it in the database rather than
   * trusting this, so a caller passing 'blood' for a Wife is fixed rather than refused.
   */
  linkKind?: LinkKind
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
  /**
   * People who should ALSO become parents of the person being added.
   *
   * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────────
   * A sibling edge records that two people are siblings and nothing about WHOSE children
   * they are. So adding a sister put her beside you and left her invisible from your
   * father's card — he had a son and, as far as the database knew, no daughter. The tree
   * looked wrong from one end and right from the other, which is the worst way for a
   * family tree to be wrong.
   *
   * Siblings share parents by definition, so the dialog offers the anchor's parents here
   * and ticks them; a child added to somebody with a spouse offers the spouse the same
   * way. It is OFFERED rather than assumed, because half-siblings are ordinary and
   * silently inventing a parent is exactly the mistake a family tree must never make.
   *
   * Every id is checked into the caller's family before it is written (§4), like every
   * other id on this input.
   */
  sharedParentIds?: string[]
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

  // §8: `data` alone cannot tell a missing row from a refused query, and here the two
  // deserve different answers. An empty `relationship_types` — which is what hosted had
  // until 20260813000005, the whole table truncated and never re-seeded — really is "not
  // set up", and a member reading that can do nothing about it but report it. A query
  // that FAILED is an outage wearing the same sentence, and it stayed invisible for as
  // long as this line discarded the error.
  const { data: typeRow, error: typeError } = await admin
    .from('relationship_types').select('id').eq('name', type).maybeSingle()
  if (typeError) {
    console.error('[family-tree] relationship_types lookup failed for ' + type + ': ' + typeError.message)
    return { success: false, message: 'Could not read the relationship types' }
  }
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
        gender: relationshipMeta(type)?.gender ?? null,
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
        gender: relationshipMeta(type)?.gender ?? null,
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
    // Validated rather than trusted: this is a `'use server'` export, so the segmented
    // control in the dialog is not in its request path and an arbitrary string can arrive.
    // The CHECK constraint would refuse it, but with a constraint-violation message.
    linkKind: isLinkKind(input.linkKind ?? '') ? (input.linkKind as LinkKind) : 'blood',
  })
  if (!link.ok) return { success: false, message: link.message }

  // ── THE SHARED PARENTS ────────────────────────────────────────────────────────────
  // A second set of edges, so a sister is also her father's daughter and shows up on HIS
  // card rather than only beside the person who added her. See `sharedParentIds`.
  //
  // BEST-EFFORT, and deliberately after the edge above rather than beside it: the
  // relationship the member asked for is already recorded and correct, so a parent link
  // that cannot be written must not fail the whole addition and lose it.
  //
  // The word is the CHILD's, from the gender the relationship implied — a Brother is his
  // parents' Son. Nothing to write when that is unknown (Partner, or a plain 'existing'
  // link to somebody whose gender nobody has recorded), because `relationship_types` has
  // no gender-neutral child and inventing one is not this function's decision.
  const childType = relationshipMeta(type)?.gender === 'male' ? 'Son'
    : relationshipMeta(type)?.gender === 'female' ? 'Daughter'
    : null

  const sharedParents = (input.sharedParentIds ?? []).filter(id => id && id !== personId)
  if (childType && sharedParents.length > 0) {
    const { data: childTypeRow } = await admin
      .from('relationship_types').select('id').eq('name', childType).maybeSingle()

    if (childTypeRow) {
      for (const parentId of sharedParents) {
        // §4 on every one of them, individually. They arrive from the client and each
        // becomes the `person_id` of a row whose family_code satisfies every policy.
        if (!(await belongsToFamily('people', parentId, g.familyCode))) continue
        await linkRelationship({
          familyCode: g.familyCode,
          userId: g.userId,
          anchorPersonId: parentId,
          personId,
          typeId: childTypeRow.id as string,
          type: childType,
          // A shared parent is a blood link by default for the same reason the main edge
          // is, and the caller's answer carries across: somebody adding a step-brother is
          // saying the parent link is a step one too.
          linkKind: isLinkKind(input.linkKind ?? '') ? (input.linkKind as LinkKind) : 'blood',
        })
      }
    }
  }

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
    /**
     * From the relationship that created them — Brother means male, Daughter female,
     * Partner nothing.
     *
     * `lib/family-tree.ts` has claimed since it was written that "naming the relationship
     * also sets the new person's gender, which is what makes the inverse edge writable",
     * and until 2026-08-13 nothing did it. The cost compounded quietly: no gender meant
     * `inverseTypeFor` returned null, so the inverse row was never written, so the
     * father/mother slots stayed empty and `setRelationshipType` from the far side had
     * nothing to name the relationship with.
     */
    gender?: string | null
    email_is_placeholder?: boolean; no_email_reason?: string
  },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await createAdminClient()
    .from('people')
    .insert({
      family_code: familyCode,
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
  linkKind: LinkKind
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createAdminClient()

  const { error } = await admin.from('person_relationships').upsert({
    person_id: o.anchorPersonId,
    related_person_id: o.personId,
    relationship_type_id: o.typeId,
    is_step: false,
    link_kind: o.linkKind,
    family_code: o.familyCode,
    created_by: o.userId,
  }, { onConflict: 'person_id,related_person_id,relationship_type_id' })

  if (error) return { ok: false, message: error.message }

  const { data: anchor } = await admin
    .from('people').select('gender').eq('id', o.anchorPersonId).maybeSingle()

  const inverse = inverseTypeFor(o.type, (anchor as { gender: string | null } | null)?.gender)
  if (!inverse) return { ok: true }

  // Best-effort by design (see the header), so neither branch fails the addition — but a
  // refused query is still logged rather than discarded. Without this, an empty or
  // unreadable lookup table means the inverse row silently stops being written and the
  // only trace is a "Daughter" nobody recorded, months later.
  const { data: inverseType, error: inverseError } = await admin
    .from('relationship_types').select('id').eq('name', inverse).maybeSingle()
  if (inverseError) {
    console.error('[family-tree] inverse type lookup failed for ' + inverse + ': ' + inverseError.message)
    return { ok: true }
  }
  if (!inverseType) return { ok: true }

  await admin.from('person_relationships').upsert({
    person_id: o.personId,
    related_person_id: o.anchorPersonId,
    relationship_type_id: inverseType.id,
    // THE SAME KIND, both ways. A step-son's step-father is still a step link, and an
    // inverse row written as 'blood' would put him back in the bloodline from the other
    // side — where the walk reaches him just as happily.
    is_step: false,
    link_kind: o.linkKind,
    family_code: o.familyCode,
    created_by: o.userId,
  }, { onConflict: 'person_id,related_person_id,relationship_type_id' })

  return { ok: true }
}

/**
 * Edit somebody who has no account, from the tree.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────────────
 * Until 2026-08-13 a record nobody had claimed was editable by exactly one person: the
 * parent who created it, through `/direct-lineage`. That page is gone, and with it the
 * idea that a child is a different kind of record with an owner. What replaced it has to
 * answer the same question — somebody typed your father's birthday wrong, who can fix it?
 *
 * ANY APPROVED MEMBER CAN. A family tree is built collaboratively, by whoever happens to
 * know the fact, and the alternatives were both worse: `created_by` leaves a record
 * uneditable the day its author leaves the family, and administrators-only means an
 * ordinary member cannot correct their own father's record.
 *
 * ── THE TWO THINGS THAT BOUND IT ────────────────────────────────────────────────────
 *   * ACCOUNT-LESS ONLY. The moment a row has a `user_id`, its owner is the authority on
 *     their own name and this action refuses — that is what `saveProfileSection` is for,
 *     and what stops "any member may edit" from meaning "any member may rewrite anyone".
 *   * THE ALLOW-LIST, minus the address. `pickProfileColumns` is the same guard
 *     `saveProfileSection` and `updateUserProfile` use (see lib/profile-columns.ts), so a
 *     POST carrying `membership_status` or `permission_template_id` writes neither.
 *
 * `primary_email` is then dropped on top of that list, and the omission is the design
 * rather than caution. A record here holds a GENERATED address paired with
 * `email_is_placeholder` and a stated reason; writing a real address into it would leave
 * those two flags describing an address that is no longer generated, and anything that
 * checks before mailing would then refuse a mailbox that works. Giving somebody a real
 * address is `invitePersonRecord` below, which routes it through an invitation and lets
 * `redeem_family_invitation` clear both flags at the moment the account attaches.
 *
 * THE ADMIN CLIENT, and §3 requires the justification: the `people` UPDATE policy admits a
 * member's write to their OWN row, so the user's client cannot touch a record belonging to
 * nobody — the policy would match zero rows and the caller would be shown "saved". Family
 * scoping is therefore hand-applied, twice: `belongsToFamily` before the write and
 * `.eq('family_code', …)` on it.
 */
export async function editPersonRecord(
  personId: string,
  fields: Record<string, unknown>,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'No family selected' }

  // §4: the id arrives from the client and decides which row is rewritten.
  if (!(await belongsToFamily('people', personId, g.familyCode))) {
    return { success: false, message: 'Person not found' }
  }

  const admin = createAdminClient()
  const { data: row, error: readError } = await admin
    .from('people')
    .select('user_id')
    .eq('id', personId)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  // §8: `data` alone cannot tell a refused query from a missing row, and refusing on a
  // read failure is the safe direction — the alternative is treating an outage as
  // "nobody owns this row" and letting the write through.
  if (readError) {
    console.error('[family-tree] could not read ' + personId + ': ' + readError.message)
    return { success: false, message: 'Could not read that record' }
  }
  if (!row) return { success: false, message: 'Person not found' }
  if (row.user_id) {
    return { success: false, message: 'They have an account and manage their own profile.' }
  }

  const patch = pickProfileColumns(fields)
  // Never through this door — see the header.
  delete patch.primary_email
  if (Object.keys(patch).length === 0) return { success: true }

  const { error } = await admin
    .from('people')
    .update(patch)
    .eq('id', personId)
    .eq('family_code', g.familyCode)
    .is('user_id', null)

  if (error) return { success: false, message: error.message }

  revalidatePath('/family-tree')
  revalidatePath('/members')
  return { success: true }
}

/**
 * Invite somebody already on the tree — the record grew into an email address.
 *
 * THIS IS WHAT REPLACED `convertChildToAdult`, and the difference is the whole point of
 * the change. Converting flipped `is_minor` and wrote an address onto the row, which made
 * somebody a member by editing a column; nobody was asked and no account was created. This
 * sends them the ordinary invitation, and they join the approvals queue like anybody else.
 *
 * The record is not duplicated: `inviteMember` carries `personId` through to
 * `create_family_invitation`, and `redeem_family_invitation`'s ADOPT branch attaches the
 * new account to this row — so the tree edges around it survive and the family does not
 * end up with one person twice (20260813000004).
 *
 * NOT `preApproved`. Putting somebody on a tree was never a decision about who gets into
 * the family, and neither is this.
 *
 * The names come from the ROW rather than from the caller, because the record already
 * holds them and a second copy in the request is a second chance to disagree.
 */
export async function invitePersonRecord(
  personId: string,
  email: string,
): Promise<{ success: boolean; message?: string; emailed?: boolean }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'No family selected' }

  const address = (email ?? '').trim().toLowerCase()
  if (!address) return { success: false, message: 'Enter an email address' }

  if (!(await belongsToFamily('people', personId, g.familyCode))) {
    return { success: false, message: 'Person not found' }
  }

  const admin = createAdminClient()
  const { data: row, error: readError } = await admin
    .from('people')
    .select('user_id, first_name, last_name')
    .eq('id', personId)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  if (readError) {
    console.error('[family-tree] could not read ' + personId + ': ' + readError.message)
    return { success: false, message: 'Could not read that record' }
  }
  if (!row) return { success: false, message: 'Person not found' }
  if (row.user_id) return { success: false, message: 'They already have an account.' }

  const firstName = (row.first_name as string | null) ?? ''
  const lastName = (row.last_name as string | null) ?? ''
  if (!firstName.trim() || !lastName.trim()) {
    return { success: false, message: 'Give them a first and last name before inviting them' }
  }

  const sent = await inviteMember(
    address,
    { firstName, lastName },
    false,
    g.familyCode,
    personId,
  )
  if (!sent.success) return { success: false, message: sent.message }

  revalidatePath('/family-tree')
  revalidatePath('/members')
  // The send fails soft (lib/email/README.md), so the caller is told which of the two
  // things happened rather than being shown "invited" over a message that never went.
  return { success: true, emailed: sent.emailed }
}

/**
 * Change what an existing relationship IS — blood, step, adopted or foster.
 *
 * ── WHY THIS IS NOT OPTIONAL ────────────────────────────────────────────────────────
 * `link_kind` defaults to 'blood', so every relationship recorded before 20260813000007
 * — and every one added without thinking about it since — claims to carry blood. A family
 * with three children, one of them theirs by blood, has two rows that are wrong the moment
 * the column exists. Without a way to correct them the Bloodline view is decorative: it
 * would answer confidently and be wrong, which is worse than not offering it.
 *
 * ── IT MOVES BOTH DIRECTIONS ────────────────────────────────────────────────────────
 * `linkRelationship` writes an inverse row whenever it can name one, and the two rows are
 * one fact. Updating only the stored direction would leave the inverse claiming blood, and
 * `bloodlineIds` walks whichever it meets first — so the toggle would keep including
 * somebody with no visible reason. Same `.or(...)` shape as `removeRelationship` below,
 * and for the same reason.
 *
 * ── AUTHORIZATION ───────────────────────────────────────────────────────────────────
 * Self-service (`requireMember`), matching `addRelative` and `removeRelationship`: any
 * approved member may record a relationship, so any approved member may correct one. The
 * row is read family-scoped FIRST, so an id from another family finds nothing and is
 * refused with the message a missing row gets — telling a prober nothing.
 */
export async function setRelationshipKind(
  relationshipId: string,
  kind: LinkKind,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'No family selected' }

  // Validated here because this is a public endpoint and the CHECK constraint's message
  // is not one to show somebody.
  if (!isLinkKind(kind)) return { success: false, message: 'That is not a relationship kind' }

  const admin = createAdminClient()
  const { data: row, error: readError } = await admin
    .from('person_relationships')
    .select('id, person_id, related_person_id, family_code')
    .eq('id', relationshipId)
    .maybeSingle()

  if (readError) {
    console.error('[family-tree] could not read relationship ' + relationshipId
      + ': ' + readError.message)
    return { success: false, message: 'Could not read that connection' }
  }
  if (!row || row.family_code !== g.familyCode) {
    return { success: false, message: 'Relationship not found' }
  }

  const { error } = await admin
    .from('person_relationships')
    .update({ link_kind: kind })
    .eq('family_code', g.familyCode)
    .or(
      `and(person_id.eq.${row.person_id},related_person_id.eq.${row.related_person_id}),`
      + `and(person_id.eq.${row.related_person_id},related_person_id.eq.${row.person_id})`,
    )

  if (error) return { success: false, message: error.message }

  revalidatePath('/family-tree')
  return { success: true }
}

/**
 * Change WHAT a relationship is called — Wife to Ex-Wife, Partner to Husband.
 *
 * ── WHY THIS IS SEPARATE FROM `setRelationshipKind` ─────────────────────────────────
 * They answer different questions and only one of them is about blood. `link_kind` says
 * whether blood travels down the edge; this says which word names it. A marriage that
 * ends changes the word and not the kind — it was never blood and still is not — and a
 * step-son who is adopted changes the kind and not the word.
 *
 * ── IT MOVES THE INVERSE ROW TOO, AND RENAMES IT ────────────────────────────────────
 * `linkRelationship` writes both directions where it can name them, and the two are one
 * fact. Renaming only the stored row leaves "Ada has an Ex-Wife, Mary" beside "Mary has a
 * Husband, Ada" — not a stale copy but a contradiction, and the tree reads whichever it
 * meets first. So the inverse is renamed with it, through `inverseTypeFor` against the
 * OTHER person's gender, which is the same call `linkRelationship` makes when it writes
 * the pair in the first place.
 *
 * A missing or unnameable inverse is not an error: gender is optional, so for much of a
 * real tree there is no second row to move. That is the same asymmetry `linkRelationship`
 * documents, and the canvas is correct either way because `getFamilyTree` derives both
 * directions from either row.
 *
 * ── THE RELATION MUST NOT CHANGE ────────────────────────────────────────────────────
 * Wife to Ex-Wife is a rename; Wife to Daughter is not, it is a different edge in a
 * different row of the diagram, and letting one become the other through a rename would
 * move somebody between generations without anyone choosing to. Refused, and it is the
 * one check here that is about the shape of the tree rather than about authorization.
 */
export async function setRelationshipType(
  relationshipId: string,
  typeName: string,
  /**
   * WHO `typeName` DESCRIBES — the person whose card the caller is looking at.
   *
   * `person_relationships` is directional and names one end relative to the other: "A has
   * a Wife, B" names B. The canvas draws BOTH directions from that single row, so the same
   * edge is reached from A's card (where the word is "Wife") and from B's (where it is
   * "Husband"). Taking the word without taking whose it is means writing "Ex-Husband" into
   * a row that should have said "Ex-Wife" — a silent inversion, visible only to whoever
   * next reads the database directly.
   *
   * So the caller states it and the conversion happens here, once, next to the row it is
   * about, rather than in a client that would have to know which direction it was handed.
   */
  subjectPersonId: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'No family selected' }

  const type = (typeName ?? '').trim()
  if (!isTreeRelationshipType(type)) {
    return { success: false, message: 'That is not a relationship this tree records' }
  }

  const admin = createAdminClient()
  const { data: row, error: readError } = await admin
    .from('person_relationships')
    .select('id, person_id, related_person_id, relationship_type_id, family_code')
    .eq('id', relationshipId)
    .maybeSingle()

  if (readError) {
    console.error('[family-tree] could not read relationship ' + relationshipId
      + ': ' + readError.message)
    return { success: false, message: 'Could not read that connection' }
  }
  if (!row || row.family_code !== g.familyCode) {
    return { success: false, message: 'Relationship not found' }
  }

  const { data: types, error: typesError } = await admin
    .from('relationship_types').select('id, name')
  if (typesError || !types) {
    return { success: false, message: 'Could not read the relationship types' }
  }
  const idByName = new Map((types as { id: string; name: string }[]).map(t => [t.name, t.id]))
  const nameById = new Map((types as { id: string; name: string }[]).map(t => [t.id, t.name]))

  // Same row of the diagram, or it is not a rename — see the header. Checked against the
  // word the CALLER used, before any conversion, because that is the one they chose.
  const before = relationFor(nameById.get(row.relationship_type_id) ?? '')
  const after = relationFor(type)
  if (!before || !after || before !== after) {
    return { success: false, message: 'That would change how they are related, not just what it is called' }
  }

  // WHOSE WORD IS IT. `typeName` names `subjectPersonId`; the stored row names
  // `related_person_id`. When those are the same person it is written as given, and when
  // they are opposite ends it has to be turned round first — see the parameter's note.
  let storedType = type
  if (subjectPersonId === row.person_id) {
    const { data: anchor } = await admin
      .from('people').select('gender').eq('id', row.related_person_id)
      .eq('family_code', g.familyCode).maybeSingle()
    const turned = inverseTypeFor(type, (anchor as { gender: string | null } | null)?.gender)
    // No inverse nameable — the other end has no recorded gender — so there is nothing
    // honest to write. Refused rather than guessed at: writing the caller's word
    // unturned would record the opposite of what they chose.
    if (!turned) {
      return {
        success: false,
        message: 'Record a gender for the other person first, so we can name this from their side too.',
      }
    }
    storedType = turned
  } else if (subjectPersonId !== row.related_person_id) {
    return { success: false, message: 'That person is not part of this connection' }
  }

  const targetId = idByName.get(storedType)
  if (!targetId) return { success: false, message: 'That relationship type is not set up' }

  const { error } = await admin
    .from('person_relationships')
    .update({ relationship_type_id: targetId })
    .eq('id', row.id)
    .eq('family_code', g.familyCode)

  if (error) return { success: false, message: error.message }

  // THE INVERSE, best-effort. Named against the OTHER end's gender, because the inverse
  // word describes them: renaming "Ada has an Ex-Wife" makes Mary's row "Ex-Husband" only
  // if Ada is male.
  const { data: other } = await admin
    .from('people').select('gender').eq('id', row.person_id)
    .eq('family_code', g.familyCode).maybeSingle()

  const inverse = inverseTypeFor(storedType, (other as { gender: string | null } | null)?.gender)
  const inverseId = inverse ? idByName.get(inverse) : undefined
  if (inverseId) {
    // Only a row already pointing the other way, and only one in the same row of the
    // diagram — never an insert. If the family never had the second row, this is not the
    // moment to invent one.
    const { data: back } = await admin
      .from('person_relationships')
      .select('id, relationship_type_id')
      .eq('family_code', g.familyCode)
      .eq('person_id', row.related_person_id)
      .eq('related_person_id', row.person_id)

    for (const candidate of (back ?? []) as { id: string; relationship_type_id: string }[]) {
      if (relationFor(nameById.get(candidate.relationship_type_id) ?? '') !== after) continue
      await admin.from('person_relationships')
        .update({ relationship_type_id: inverseId })
        .eq('id', candidate.id)
        .eq('family_code', g.familyCode)
    }
  }

  revalidatePath('/family-tree')
  return { success: true }
}

/**
 * Set the person the family's bloodline descends from (20260813000008).
 *
 * ── WHY A FAMILY DECIDES THIS RATHER THAN THE DATA ──────────────────────────────────
 * The Bloodline view walks up from an anchor and keeps everybody who shares an ancestor
 * with it. Anchored on the FOUNDER — which is what it did until this existed — a family
 * created by a son walks up through his mother, so his father's former wife comes back as
 * a blood relative of the line while the current wife correctly does not. Same rule, two
 * answers, decided by who happened to register first.
 *
 * There is no better guess available. "The oldest person" is wrong the moment a spouse's
 * parents are recorded; "the most descendants" is wrong until the tree is built. Which
 * line a family considers ITS line is a fact about the family, so they state it.
 *
 * ── THE GRANT ───────────────────────────────────────────────────────────────────────
 * `admin/family:edit`, the same as `renameFamily`, and for the same reason: this is
 * family-wide configuration that changes what every member sees, not a self-service
 * record like a relationship. Deliberately NOT the tree's own self-service rule — any
 * member may say who their father is, and that is a different kind of claim from
 * redefining whose line the family is.
 *
 * Passing null clears it, and the tree falls back to the founder — which is the behaviour
 * every family had before the column existed, so clearing is a real answer rather than a
 * broken state.
 */
export async function setBloodlineAnchor(
  personId: string | null,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireEdit('admin/family')
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'No family selected' }

  // §4: the id decides what every member sees on the tree, and the database guard
  // (`families_guard_bloodline_anchor`) is the second layer rather than the only one —
  // it raises, and a raised exception is a worse message than this one.
  if (personId && !(await belongsToFamily('people', personId, g.familyCode))) {
    return { success: false, message: 'Person not found' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('families')
    .update({ bloodline_anchor_id: personId })
    .eq('family_code', g.familyCode)

  if (error) return { success: false, message: error.message }

  revalidatePath('/family-tree')
  revalidatePath('/dashboard')
  return { success: true }
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
