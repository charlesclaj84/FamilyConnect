/**
 * The vocabulary of the family-wide tree: which relationship names it uses, how they
 * invert, and how a person with no email address gets one.
 *
 * PURE — data and pure functions, no React, no database, no `server-only`. The page, the
 * server actions and the client canvas all read from here, which is what stops the three
 * of them disagreeing about what "parent" means. Same rule, and the same reason, as
 * `lib/features.ts` and `lib/tiers.ts`.
 *
 * ── IT SITS ON A TABLE THAT ALREADY EXISTS ──────────────────────────────────────────
 * `relationship_types` is a global, read-only lookup seeded by 20260602000003 — Father,
 * Mother, Son, Daughter, Brother, Sister, Husband, Wife, Partner, and the grandparent and
 * cousin rows the per-member lineage view uses. This module does not invent a second
 * vocabulary beside it; it names the SUBSET the tree builder writes and maps each name
 * onto the direction it points.
 *
 * The tree therefore reads rows the lineage view wrote, and the reverse — which is the
 * whole reason it was built on `person_relationships` rather than on a table of its own.
 */

/** How the canvas thinks about an edge, once the specific name is folded away. */
export type TreeRelation = 'parent' | 'child' | 'spouse' | 'sibling'

/**
 * The names the builder offers, and what each one means.
 *
 * ONE BUTTON PER SPECIFIC RELATIONSHIP — "Add father", "Add mother" — rather than one
 * "Add parent" button with a gender field inside it. That is how ancestry.com does it and
 * the reason is not taste: `relationship_types` has no gender-neutral parent, child or
 * sibling row, so a generic button would have to ask for a gender before it could write
 * anything, and a form that cannot be submitted until you answer a question the button
 * could have asked is a worse form. Naming the relationship also sets the new person's
 * gender, which is what makes the inverse edge writable (see `inverseTypeFor`).
 *
 * `Partner` has no gender and is the answer for a couple who are not married and for
 * anybody the other two words do not fit.
 */
export interface RelationshipMeta {
  /** Exactly the `relationship_types.name` value. Do not spell it differently. */
  type: string
  relation: TreeRelation
  /** Button caption on the canvas. */
  label: string
  /** The gender this name implies for the person being ADDED, where it implies one. */
  gender: 'male' | 'female' | null
}

export const TREE_RELATIONSHIPS: readonly RelationshipMeta[] = [
  { type: 'Father',   relation: 'parent',  label: 'Father',  gender: 'male' },
  { type: 'Mother',   relation: 'parent',  label: 'Mother',  gender: 'female' },
  { type: 'Husband',  relation: 'spouse',  label: 'Husband', gender: 'male' },
  { type: 'Wife',     relation: 'spouse',  label: 'Wife',    gender: 'female' },
  { type: 'Partner',  relation: 'spouse',  label: 'Partner', gender: null },
  // THE EX- TYPES, added 2026-08-13. They were seeded into `relationship_types` by
  // 20260610000004 and had never been listed here — which was not merely a missing
  // option, it was a hole: `relationFor('Ex-Wife')` returned undefined, so
  // `getFamilyTree` SKIPPED any such row and the canvas drew nothing at all where a
  // former marriage had been recorded. A family that entered one saw it vanish.
  //
  // They keep `relation: 'spouse'`, so an ex sits beside the focus person exactly where
  // a current spouse does. That is deliberate: a former marriage is still where the
  // children came from, and hiding it would break the line it explains.
  { type: 'Ex-Husband', relation: 'spouse', label: 'Ex-husband', gender: 'male' },
  { type: 'Ex-Wife',    relation: 'spouse', label: 'Ex-wife',    gender: 'female' },
  { type: 'Ex-Partner', relation: 'spouse', label: 'Ex-partner', gender: null },
  { type: 'Son',      relation: 'child',   label: 'Son',     gender: 'male' },
  { type: 'Daughter', relation: 'child',   label: 'Daughter', gender: 'female' },
  { type: 'Brother',  relation: 'sibling', label: 'Brother', gender: 'male' },
  { type: 'Sister',   relation: 'sibling', label: 'Sister',  gender: 'female' },
]

const BY_TYPE = new Map(TREE_RELATIONSHIPS.map(r => [r.type, r]))

/** Is `type` one the builder writes? Rejects anything else a caller sends. */
export function isTreeRelationshipType(type: string): boolean {
  return BY_TYPE.has(type)
}

export function relationshipMeta(type: string): RelationshipMeta | undefined {
  return BY_TYPE.get(type)
}

/**
 * Which direction an edge points, for any name in `relationship_types` — including the
 * ones the builder does not write but the lineage view does.
 *
 * The grandparent rows are deliberately UNMAPPED and return undefined. A grandparent is
 * two parent edges, and treating "Paternal Grandfather" as a parent edge would draw
 * somebody's grandfather in the row where their father belongs. The lineage view keeps
 * those rows and walks them its own way; this tree derives grandparents by walking
 * parents twice, which is the only version that stays correct when the middle generation
 * is filled in later.
 */
export function relationFor(type: string): TreeRelation | undefined {
  return BY_TYPE.get(type)?.relation
}

/**
 * The name for the edge pointing BACK, or null when it cannot be known.
 *
 * `anchorGender` is the gender of the person the relationship is being added TO — because
 * that is what the inverse name describes. Adding a Father to Martha means "Martha has a
 * Father" going out, and "…has a Daughter" coming back, and the word "Daughter" is a fact
 * about Martha rather than about her father.
 *
 * NULL IS AN ORDINARY ANSWER, not a failure. Gender is optional on `people` and always
 * will be, so for a great deal of the tree the inverse name is genuinely unknown. The
 * reader treats every edge as bidirectional — see `normalizeEdges` — so the inverse row
 * is a convenience for the OTHER surfaces that read this table (the lineage view walks
 * `person_relationships` directionally), never a requirement for the tree to be correct.
 *
 * That asymmetry is the design: write the inverse when it can be named, and never block
 * an addition on a fact nobody has.
 */
export function inverseTypeFor(
  type: string,
  anchorGender: string | null | undefined,
): string | null {
  const meta = BY_TYPE.get(type)
  if (!meta) return null

  const male = anchorGender === 'male'
  const female = anchorGender === 'female'

  // FORMER STAYS FORMER, and this is the conjunct that was missing when the Ex- types
  // were added on 2026-08-13. Without it an Ex-Wife's inverse came back as "Husband" —
  // the database would then hold "Ada has an Ex-Wife, Mary" beside "Mary has a Husband,
  // Ada", which is not two views of one fact but a contradiction, and the second one is
  // what a report or an export would print.
  const former = meta.type.startsWith('Ex-')

  if (!male && !female) {
    // The cases that survive an unknown gender: Partner is symmetric, so a partner's
    // partner is a Partner whoever they are, and the same holds once it is over.
    if (meta.type === 'Partner') return 'Partner'
    if (meta.type === 'Ex-Partner') return 'Ex-Partner'
    return null
  }

  switch (meta.relation) {
    // They are my parent, so I am their child.
    case 'parent':  return male ? 'Son' : 'Daughter'
    // They are my child, so I am their parent.
    case 'child':   return male ? 'Father' : 'Mother'
    case 'sibling': return male ? 'Brother' : 'Sister'
    // Partner is handled above and stays Partner; a Husband's spouse is a Wife and vice
    // versa, decided by the ANCHOR's gender like every other case here.
    case 'spouse':
      if (former) return male ? 'Ex-Husband' : 'Ex-Wife'
      return male ? 'Husband' : 'Wife'
  }
}

/** The spouse types, in the order the tree offers them. Current first, then former. */
export const SPOUSE_TYPES: readonly string[] =
  TREE_RELATIONSHIPS.filter(r => r.relation === 'spouse').map(r => r.type)

/**
 * A generated address for somebody who has none —
 * `{familycode}_{first}_{last}_{8 hex}@genorra.com`.
 *
 * ── WHY GENERATE ONE AT ALL ─────────────────────────────────────────────────────────
 * `people.primary_email` is nullable, so nothing in the schema demands this. What demands
 * it is telling two states apart. Every other way a person joins the tree produces an
 * address — they are a member, or they were invited — so a row with a NULL address would
 * mean either "no email exists" or "we have not got round to asking", and no screen could
 * distinguish them. A synthetic address plus `email_is_placeholder` says which.
 *
 * ── WHAT IT MUST NEVER DO ───────────────────────────────────────────────────────────
 * It must never be MAILED. `@genorra.com` is a domain we control precisely so that a
 * mistake bounces to us rather than to a stranger — but the real guard is the column:
 * anything that sends mail owes a check on `email_is_placeholder`, and the address alone
 * is not the signal, because a family could legitimately hold a genorra.com address one
 * day.
 *
 * ── THE FORMAT ──────────────────────────────────────────────────────────────────────
 * The family code first, so a stray row is traceable to a family at a glance. Then the
 * name, so a human reading the database can tell who it is. Then eight hex characters,
 * which is what makes it unique: two Martha Allens in one family are likelier than in
 * most datasets, and a collision here would be one person's record silently standing in
 * for another's. Names are folded to `[a-z0-9]` so an apostrophe or an accent cannot
 * produce an address that is not one.
 *
 * `suffix` is injected rather than generated inside, so this stays a pure function and
 * the caller decides where the randomness comes from — `crypto.randomUUID()` on the
 * server. A default would make it easy to forget, so there is none.
 */
/**
 * The shape this module needs of an edge, stated structurally.
 *
 * NOT IMPORTED FROM `app/actions/family-tree.ts`, deliberately: that module imports THIS
 * one, and a type import back the other way is a cycle waiting for somebody to add a value
 * to it. `TreeEdge` is assignable to this by structure, so callers pass their real edges
 * and nothing has to be converted.
 */
export interface TreeLink {
  from: string
  to: string
  relation: TreeRelation
  /** `person_relationships.link_kind`. Only 'blood' conducts — see `bloodlineIds`. */
  kind: LinkKind
}

/**
 * What a relationship IS — `person_relationships.link_kind` (20260813000007).
 *
 * The order is the order the picker offers, and 'blood' is first because it is the answer
 * for most links and the column default.
 */
export const LINK_KINDS = ['blood', 'step', 'adopted', 'foster'] as const

export type LinkKind = (typeof LINK_KINDS)[number]

/**
 * Captions, keyed by kind. 'blood' is deliberately the EMPTY string: an ordinary
 * relationship needs no qualifier on the card, and printing "Blood son" beside every
 * other child would make the unremarkable case look like the remarkable one.
 */
export const LINK_KIND_PREFIX: Record<LinkKind, string> = {
  blood: '',
  step: 'Step',
  adopted: 'Adopted',
  foster: 'Foster',
}

/** "Step-son", "Adopted daughter", or plain "Son". */
export function linkKindLabel(kind: LinkKind, relationshipLabel: string): string {
  const prefix = LINK_KIND_PREFIX[kind]
  if (!prefix) return relationshipLabel
  // Hyphenated for 'step' and spaced for the rest, which is how English writes them:
  // "step-son" but "adopted son". Not a rule worth a table for four values.
  const joiner = kind === 'step' ? '-' : ' '
  return `${prefix}${joiner}${relationshipLabel.toLowerCase()}`
}

export function isLinkKind(value: string): value is LinkKind {
  return (LINK_KINDS as readonly string[]).includes(value)
}

/**
 * Who in this family is related to the anchor BY BLOOD, as opposed to by marriage.
 *
 * ── THE RULE: A SHARED ANCESTOR ─────────────────────────────────────────────────────
 * Two people are blood relatives when they have an ancestor in common. So: walk UP from
 * the anchor through `parent` edges marked 'blood' to get its ancestors — itself
 * included — and then keep anybody whose own ancestors intersect that set.
 *
 * That covers every case a family means by the word, and covers them for one reason
 * rather than several: descendants (their ancestors include the anchor), siblings and
 * cousins (a shared parent or grandparent), aunts and great-uncles (a shared ancestor
 * further up). Nothing is special-cased.
 *
 * ── WHY IT IS NOT A CONNECTED-COMPONENT WALK, WHICH IS WHAT IT USED TO BE ───────────
 * The first version walked OUT from the anchor through parent, child and sibling edges
 * in both directions and kept whoever it reached. That is wrong, and wrong in a way that
 * looks right until a real family hits it, because the relation "connected by blood
 * edges" is not the relation "blood relative": a child is blood to BOTH parents, so a
 * walk that goes down to a child and back up to their other parent has crossed from one
 * line into an unrelated one.
 *
 * It was reported as step-children carrying the droplet anyway. Marking them `step` had
 * done nothing, because there was a second route in:
 *
 *     Charles --Daughter[blood]--> Sydnee     (his daughter, correctly blood)
 *     Angel   --Sister  [blood]--> Sydnee     (her half-sister, also correctly blood)
 *
 * Both rows are true. The old walk chained them and put Angel — Charles's step-daughter,
 * explicitly marked — in his bloodline. The same chain reached one step further and put
 * Sydnee's MOTHER in it, who is Charles's wife.
 *
 * Nothing about the data was wrong. Half-siblings really are blood relatives of each
 * other; they are simply not blood relatives of each other's other parent, and only a
 * directed rule can tell those apart.
 *
 * ── SIBLING EDGES DO NOT CONDUCT, AND THAT IS THE DELIBERATE COST ───────────────────
 * Only `parent` edges are walked. A brother recorded with no shared parent on record is
 * therefore NOT in the bloodline — the tree has been told they are siblings and not told
 * whose children they are, and guessing which parent they share is exactly how Angel got
 * a droplet. The dialog now asks for the shared parents when a sibling is added, which is
 * where that fact belongs; recording it puts them in.
 *
 * Erring this way is deliberate: a missing droplet is a fact nobody has entered yet, and
 * a wrong one is the product telling a family something false about itself.
 *
 * ── IT IS FAMILY-WIDE, NOT PER VIEWER ───────────────────────────────────────────────
 * The anchor is the FAMILY's, so the same set comes back whoever is looking. A
 * viewer-relative version ("blood relative of me") was the other option and makes the
 * toggle mean something different on every screen — two members would disagree about who
 * is in the bloodline, which is not a thing a family can disagree about.
 *
 * ── NULL MEANS "DO NOT KNOW", AND CALLERS MUST NOT TREAT IT AS EMPTY ────────────────
 * Returned when the anchor is missing or is not in this roster. The honest answer then is
 * silence: an empty set would be read as "nobody is blood" and would hide the entire
 * family behind the toggle. The canvas hides the control instead.
 */
export function bloodlineIds(
  people: readonly { id: string }[],
  edges: readonly TreeLink[],
  anchorId: string | null | undefined,
): Set<string> | null {
  if (!anchorId) return null
  const known = new Set(people.map(p => p.id))
  if (!known.has(anchorId)) return null

  // Who each person's blood parents are. `relation: 'parent'` reads "`to` is `from`'s
  // parent", so this is already the upward direction and needs no mirroring — the derived
  // half of every stored row is in `edges` too, carrying the same `kind`.
  const parents = new Map<string, string[]>()
  for (const edge of edges) {
    if (edge.relation !== 'parent') continue
    if (edge.kind !== 'blood') continue
    if (!known.has(edge.from) || !known.has(edge.to)) continue
    const list = parents.get(edge.from)
    if (list) list.push(edge.to); else parents.set(edge.from, [edge.to])
  }

  /**
   * Everybody at or above `id`. Memoized across calls because a family converges: two
   * cousins share a grandparent, and without the cache that subtree is walked once per
   * descendant.
   *
   * `visiting` guards a cycle. `person_relationships` has no constraint stopping somebody
   * being recorded as their own grandfather, and an unguarded upward walk on such a graph
   * does not return a wrong answer — it never returns. Same reasoning as `summarizeTree`.
   */
  const cache = new Map<string, Set<string>>()
  const visiting = new Set<string>()
  function ancestorsOf(id: string): Set<string> {
    const hit = cache.get(id)
    if (hit) return hit
    if (visiting.has(id)) return new Set([id])
    visiting.add(id)

    const out = new Set<string>([id])
    for (const parent of parents.get(id) ?? []) {
      for (const up of ancestorsOf(parent)) out.add(up)
    }

    visiting.delete(id)
    cache.set(id, out)
    return out
  }

  const anchorLine = ancestorsOf(anchorId)
  const blood = new Set<string>()
  for (const person of people) {
    for (const up of ancestorsOf(person.id)) {
      if (anchorLine.has(up)) { blood.add(person.id); break }
    }
  }
  return blood
}

/** What the dashboard widget and the canvas both want to know about a tree. */
export interface TreeSummary {
  /** Everybody in the family, connected or not. */
  people: number
  /**
   * How many generations deep the recorded parentage goes — the longest unbroken chain of
   * parent→child links, counted in PEOPLE rather than in links, so one person with no
   * parents and no children is one generation and not zero.
   *
   * 0 only for a family with nobody in it, which is a state that cannot last: a family is
   * created by somebody.
   */
  generations: number
  /** People with no relationship of any kind recorded — see `leafIds`. */
  leaves: number
}

/**
 * People nobody has been attached to yet.
 *
 * ── WHY "LEAF" MEANS THIS AND NOT THE BOTANICAL THING ───────────────────────────────
 * In graph terms a leaf is a node with one edge, and on a family tree that would be every
 * childless person in the newest generation — which is not a problem anybody needs
 * pointing out. What a family actually needs to find is the person with NO edges at all:
 * a member who has joined, or a record somebody created, and who is connected to nobody,
 * so they exist in the Directory and do not appear on the tree at any focus. They are
 * invisible precisely because the canvas is focus-plus-context — you can only see the
 * people related to somebody, and by definition these are related to nobody.
 *
 * Being unattached is the ORDINARY state of a new member, not a defect. That is why the
 * count is offered as work to do rather than as a warning, and why nothing here suggests
 * fixing it automatically: guessing at somebody's parents is exactly the mistake a family
 * tree must never make.
 *
 * Order follows `people`, which `getFamilyTree` has already sorted by last then first
 * name, so the caller gets a list it can render without re-sorting.
 */
export function leafIds(
  people: readonly { id: string }[],
  edges: readonly TreeLink[],
): string[] {
  const attached = new Set<string>()
  for (const edge of edges) {
    attached.add(edge.from)
    attached.add(edge.to)
  }
  return people.filter(p => !attached.has(p.id)).map(p => p.id)
}

/**
 * Count the people, the generations and the leaves in one pass over the tree.
 *
 * ── HOW GENERATIONS ARE COUNTED ─────────────────────────────────────────────────────
 * The longest path through the parent→child edges, which is the only definition that
 * survives a real family. Two alternatives were considered and both are wrong here:
 *
 *   * *Distance from the caller* — makes the answer different for every member looking at
 *     it, and a great-grandmother's tree is not shallower because her grandson opened it.
 *   * *Counting distinct "levels"* — needs a single root, and a family tree has as many
 *     roots as it has recorded ancestors with no parents of their own. There is no one
 *     top of this graph.
 *
 * SPOUSE AND SIBLING EDGES ARE IGNORED, which is what makes the number mean generations
 * rather than hops: a husband and wife are one generation, and so are eight siblings.
 *
 * `getFamilyTree` normalizes every stored row into BOTH directions, so this walks
 * 'child' edges alone and gets the whole answer — a father recorded from his son's side is
 * still a child edge from the father.
 *
 * CYCLES CANNOT HAPPEN THROUGH THE UI and are guarded anyway. `person_relationships` has
 * no constraint preventing somebody being recorded as their own grandfather, whether by a
 * typo through the builder or by a row written before it existed, and an unguarded depth
 * walk on such a graph does not return a wrong number — it never returns. The `visiting`
 * set stops at the repeat and takes the depth of the path it has, which is the honest
 * reading of a loop.
 */
export function summarizeTree(
  people: readonly { id: string }[],
  edges: readonly TreeLink[],
): TreeSummary {
  const children = new Map<string, string[]>()
  for (const edge of edges) {
    if (edge.relation !== 'child') continue
    const list = children.get(edge.from)
    if (list) list.push(edge.to); else children.set(edge.from, [edge.to])
  }

  // Memoized, so a family where many lines converge is walked once per person rather than
  // once per path through them — the difference between linear and exponential on a tree
  // with cousins who married.
  const depthOf = new Map<string, number>()
  const visiting = new Set<string>()

  function depth(id: string): number {
    const cached = depthOf.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) return 0   // a cycle: stop, and count the path we have
    visiting.add(id)

    let best = 0
    for (const child of children.get(id) ?? []) {
      const d = depth(child)
      if (d > best) best = d
    }

    visiting.delete(id)
    const result = best + 1
    depthOf.set(id, result)
    return result
  }

  let generations = 0
  for (const person of people) {
    const d = depth(person.id)
    if (d > generations) generations = d
  }

  return {
    people: people.length,
    generations,
    leaves: leafIds(people, edges).length,
  }
}

export function placeholderEmail(
  familyCode: string,
  firstName: string,
  lastName: string,
  suffix: string,
): string {
  const slug = (s: string) => s.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase()

  // 'x' rather than '' for a name that folds to nothing — an address with a double
  // underscore where a name should be is still parseable, and an empty segment is not.
  const first = slug(firstName) || 'x'
  const last = slug(lastName) || 'x'
  const code = slug(familyCode) || 'family'
  return `${code}_${first}_${last}_${slug(suffix).slice(0, 8).padEnd(8, '0')}@genorra.com`
}
