'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Unlink, Users, Sprout, Pencil, Droplet } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { NickName } from '@/components/ui/person-name'
import { cn } from '@/lib/utils'
import { disambiguatedName } from '@/lib/name-utils'
import { HelpLink } from '@/components/help/HelpLink'
import { AddRelativeDialog } from '@/components/family-tree/AddRelativeDialog'
import {
  PersonRecordDialog,
} from '@/components/family-tree/PersonRecordDialog'
import {
  TREE_RELATIONSHIPS, leafIds, relationshipMeta,
  generationsFrom, generationLabel,
  type TreeRelation,
} from '@/lib/family-tree'
import {
  removeRelationship,
  type FamilyTree, type TreeEdge, type TreePerson,
} from '@/app/actions/family-tree'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * The family-wide tree — the only tree in the product, since the per-member lineage view
 * was retired on 2026-08-13 (see the page for what that removal did and did not cost).
 *
 * ── THE MODEL IS ANCESTRY'S, AND THAT IS DELIBERATE ─────────────────────────────────
 * One person is in FOCUS, and the canvas draws the generations around them. Clicking
 * anybody re-focuses on them, so a family walks its tree one step at a time instead of
 * trying to render three hundred people at once.
 *
 * ── HOW DEEP DEPENDS ON THE MODE, since 2026-08-17 ──────────────────────────────────
 * VIEW draws three generations up and five down; EDIT draws two up and one down. Reading
 * and building want opposite things from the same diagram: a great-grandmother should see
 * her great-great-grandchildren without walking down two people to find them, and somebody
 * placing a relative should see only the gaps that belong to the person in the middle,
 * because every extra band in Edit is another row of dashed "+" cards for relatives they
 * are not currently adding. `levelsUp` / `levelsDown` is where that is decided, and the
 * mode hint states it — a canvas that silently collapses on pressing Edit reads as a fault.
 *
 * The bands are generated from `generationsFrom` rather than hard-coded, which is what made
 * the depth a parameter at all. Two of them still carry controls (the parents' own "+"
 * slots, the grandparents' per-parent ones) and those are keyed on distance.
 *
 * That is not a simplification of a "whole family on one canvas" design — it IS the
 * design, and for the reason ancestry.com arrived at it: a family of a hundred and forty
 * has no readable single-canvas layout, and every product that has tried has ended up
 * with a diagram you pan around looking for somebody. Focus-plus-context is what makes a
 * big tree navigable, and it is also what makes it BUILDABLE: every gap has a "+" in it,
 * and the gaps you can see are the ones belonging to the person you are looking at.
 *
 * ── EMPTY SLOTS ARE THE POINT ───────────────────────────────────────────────────────
 * A tree with nothing in it should not be an empty page. Father and Mother render as
 * dashed "+ Add father" cards whether or not they exist, so a member who opens this on
 * day one sees the shape of what they are building and where to press. Same for a spouse
 * and for the first child.
 *
 * ── SEVERAL MARRIAGES ARE DRAWN SEPARATELY, since 2026-08-14 ────────────────────────
 * Once a person has more than one spouse the children stop being one undivided row and
 * become one panel per marriage, plus a panel for children the tree cannot attribute to
 * any of them. It is not a nicety: the second marriage is what EXPLAINS the second set of
 * children, and a family looking at a remarried grandfather could previously see three
 * children and nothing at all about which came from where. See `marriages` below for how
 * the split is derived — from the `parent` edges the children already carry, never guessed.
 *
 * ── WHAT IT DOES NOT DO YET, and is not pretending to ───────────────────────────────
 * No zoom and no export. NO DATES ON THE CONNECTORS EITHER, and since 2026-08-22 that is a
 * decision rather than a gap: a tree is read for who is related to whom, and a date on every
 * edge is four more numbers per line on a canvas already dense with names. A reader who wants
 * a date opens the person.
 *
 * These are a backlog against a finished feature rather than a caveat on a half-built one —
 * which is what the beta badge used to say, and why it came off.
 *
 * ── STATE ───────────────────────────────────────────────────────────────────────────
 * `focusId` is UI-local — which card you are looking at — so it is genuinely not the
 * family-scoped state AGENTS.md's remount rule is about. It is seeded from a prop, which
 * that rule DOES cover, and the layout's `key={familyCode}` on `<main>` is what handles
 * it: switching family remounts this component and the focus resets to the caller's own
 * card in the new family rather than pointing at a person who is not in it.
 */

export function FamilyTreeBuilder({
  tree, canEdit, canViewDirectory = true,
}: {
  tree: FamilyTree
  canEdit: boolean
  /**
   * `members:view` — the DIRECTORY's grant, not the tree's. Decides whether a card opens
   * the person panel at all; see the page, which argues why the two keys differ here.
   *
   * Defaults TRUE, so the only way to lose the panel is for a caller to be resolved as
   * not holding the Directory grant. A default of `false` would silently take the panel
   * away from any call site that forgot the prop, which is the wrong direction to fail in
   * for a control that withholds no data by itself — the panel renders what the canvas
   * already fetched.
   */
  canViewDirectory?: boolean
}) {
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  // WHERE THE TREE OPENS, and it is no longer flatly "on you".
  //
  // It was, and for somebody who married in that is a canvas with nothing on it: the rows
  // above and below the focus are the focus person's OWN parents and children, and a member
  // whose only recorded relationship is a marriage has neither. Their spouse's father hangs
  // off their SPOUSE's card, so the tree looked empty until they thought to click across.
  // They are not unattached — `leafIds` is a different and narrower thing — so nothing on
  // the page was telling them either.
  //
  // So: open on yourself when there is anything to see, and otherwise open on the person
  // you are attached to. `openingFocus` explains itself on screen when it moves, because a
  // tree that silently centres on somebody else is worse than one that starts empty.
  const [focusId, setFocusId] = useState<string>(() => openingFocus(tree))
  const [adding, setAdding] = useState<{
    anchor: TreePerson
    type: string
    /**
     * Which of the anchor's relatives the dialog should offer as a co-parent, when the
     * "+" that opened it already knows.
     *
     * Undefined means "work it out" — the anchor's parents for a sibling, every spouse
     * for a child — which is what every "+" outside a marriage group does. The per-
     * marriage "+ Son" buttons pass the ONE spouse whose group they sit in, so adding a
     * child to a marriage records that marriage rather than offering all of them and
     * hoping the right box is ticked.
     */
    coParentIds?: string[]
  } | null>(null)
  // Managing somebody on the tree. Holds the person rather than a boolean so the dialog
  // remounts per subject, which is what keeps its field initializers honest when you
  // manage two people in a row.
  //
  // IT NO LONGER CARRIES THE EDGE IT WAS REACHED BY. It used to carry exactly one — the
  // link from the focus person — so what you could re-classify depended on which card you
  // had clicked: a grandparent, reached through a parent, arrived with no edge at all and
  // offered nothing, and the tree's own instruction to mark a step-relationship had
  // nowhere to be carried out. The dialog is handed EVERY connection this person has and
  // nowhere to be carried out.
  //
  // THE CONNECTION LIST LEFT THE DIALOG ON 2026-09-03, asked for: "Manage xyz" no longer
  // shows a "How xyz is related" section. What that section still carried was the one
  // control for renaming a marriage — Wife to Ex-Wife — so `setRelationshipType` has no
  // caller in the product now. TODO.md records that rather than the action being deleted
  // in passing: a caller-less `'use server'` export is still a live HTTP endpoint
  // (AGENTS.md, "COMING SOON WITHHOLDS A PAGE"), and where the control should re-appear is
  // a product decision rather than a tidy-up.
  const [managing, setManaging] = useState<TreePerson | null>(null)

  // Bloodline or the whole family. UI-local and deliberately NOT keyed on familyCode: it
  // is a way of looking, not a fact about a family, so switching family should not silently
  // change what you are looking at. (The layout remounts this component anyway; this is
  // about not treating it as family-scoped state — see AGENTS.md on the remount rule.)
  const [bloodOnly, setBloodOnly] = useState(false)

  // VIEW OR EDIT, and it starts in VIEW even for somebody who may edit.
  //
  // The canvas carries a control on almost every surface — a "+" in each empty slot, an
  // unlink on each drawn relative, a pencil on each card — and every one of them is there
  // for BUILDING the tree. Reading it is the commoner act by a wide margin, and reading a
  // diagram whose every node has two buttons on it is reading around the furniture. In
  // view the marks that carry meaning stay (the droplet, the pills, the focus ring) and
  // everything that acts is gone.
  //
  // Defaulting to edit would have been the smaller change and is the wrong one: a member
  // opening the tree to look something up should not have to tidy it first, and the "+"
  // cards in particular read as things that are MISSING rather than things you may add.
  //
  // `editing` is UI-local and per session, deliberately not persisted: the mode is what
  // you are doing right now, not a preference about yourself.
  const [editing, setEditing] = useState(false)
  // The one place the two combine, so no control has to remember both. A non-member who
  // somehow reached the page cannot flip into edit at all, and every action re-checks
  // regardless — see the note on `canEdit` in the page.
  const canAct = canEdit && editing

  const byId = useMemo(
    () => new Map(tree.people.map(p => [p.id, p])),
    [tree.people],
  )

  // Adjacency, built once. `getFamilyTree` has already normalized every stored row into
  // both directions, so a lookup here is symmetric without this component knowing which
  // way any row was written.
  const links = useMemo(() => {
    const map = new Map<string, TreeEdge[]>()
    for (const edge of tree.edges) {
      const list = map.get(edge.from)
      if (list) list.push(edge); else map.set(edge.from, [edge])
    }
    return map
  }, [tree.edges])

  // WHO IS IN THE BLOODLINE — `people.is_bloodline`, read rather than derived.
  //
  // IT WAS `bloodlineIds(tree.people, tree.edges, tree.bloodlineAnchorId)` UNTIL
  // `20260902000000`: a walk over every relationship in the family, from an anchor the
  // family had to name, recomputed on this client on every render. It is a `Set` still,
  // because everything below tests membership and a set says so; what changed is that
  // nothing here decides who is in it.
  //
  // THERE IS NO NULL ANY MORE. The old walk answered null for "do not know" — no anchor,
  // or an anchor outside the roster — and every consumer below had to carry that case.
  // `is_bloodline` is `NOT NULL DEFAULT false`, so the honest answer for a family that has
  // said nothing is an EMPTY set, and `canFilterBlood` is what stops an empty set reading
  // as "nobody is blood": with nobody marked there is nothing to filter to, so the toggle
  // is not offered at all — the same judgement the null case produced, from a simpler fact.
  const bloodline = useMemo(
    () => new Set(tree.people.filter(p => p.isBloodline).map(p => p.id)),
    [tree.people],
  )
  // OFFERED ONLY WHEN IT WOULD NARROW SOMETHING. Nobody marked means an empty set and a
  // toggle that hides the whole family; everybody marked means a toggle that does nothing.
  // Both are controls that exist to mislead, so neither is drawn.
  const canFilterBlood = bloodline.size > 0 && bloodline.size < tree.people.length
  const showingBlood = bloodOnly && canFilterBlood

  const inView = (personId: string): boolean =>
    !showingBlood || bloodline.has(personId)

  const related = (personId: string, relation: TreeRelation): TreeEdge[] =>
    (links.get(personId) ?? [])
      .filter(e => e.relation === relation)
      // In Bloodline the non-blood people are HIDDEN, not dimmed, so the edges to them go
      // too — otherwise the detach controls and the "+ Add father" slots would be computed
      // against relatives who are not on screen.
      .filter(e => inView(e.to))

  const peopleFor = (personId: string, relation: TreeRelation): TreePerson[] =>
    related(personId, relation)
      .map(e => byId.get(e.to))
      .filter((p): p is TreePerson => Boolean(p))

  // WHO IS ON NOBODY'S TREE. The canvas is focus-plus-context, so a person with no
  // relationships at all can never be reached by walking it — they are in the Directory,
  // they are in this family, and there is no focus from which they appear. Without a list
  // of them the tree silently stops mentioning most of a new family.
  //
  // Computed with the SAME function the Dashboard's card counts with, so the number on the
  // card and the number of names here cannot disagree.
  const leaves = useMemo(() => {
    const ids = new Set(leafIds(tree.people, tree.edges))
    return tree.people.filter(p => ids.has(p.id))
  }, [tree.people, tree.edges])

  // The index below, and the Bloodline filter applies to it: a toggle that hides somebody
  // from the canvas and leaves them in the list underneath is two answers to one question.
  const roster = useMemo(
    () => (bloodOnly && bloodline ? tree.people.filter(p => bloodline.has(p.id)) : tree.people),
    [tree.people, bloodOnly, bloodline],
  )

  const focus = byId.get(focusId) ?? tree.people[0] ?? null

  // Names are disambiguated against the WHOLE roster, never a subset — two Martha Allens
  // are likelier in a large family, and a tree is the one screen where confusing them
  // silently rewrites who is descended from whom.
  const nameOf = useMemo(() => {
    const source = tree.people.map(p => ({
      id: p.id,
      first_name: p.firstName,
      last_name: p.lastName,
      nick_name: p.nickName,
      date_of_birth: p.dateOfBirth,
    }))
    const map = new Map<string, string>()
    // `nickShownSeparately`: the cards print the nickname on its own line via <NickName>,
    // so letting the disambiguator put it in parentheses too would say it twice. Two
    // people of the same name fall through to their birth year instead.
    for (const p of source) map.set(p.id, disambiguatedName(p, source, { nickShownSeparately: true }))
    return map
  }, [tree.people])

  if (!focus) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {t('tree.nobodyToBuild')}
        </p>
      </div>
    )
  }

  const spouses = peopleFor(focus.id, 'spouse')
  const siblings = peopleFor(focus.id, 'sibling')

  // ── HOW DEEP THE CANVAS GOES, and it is not the same in both modes ─────────────────
  //
  // VIEW reads: three generations up and five down, so a great-grandmother sees her
  // great-great-grandchildren from her own card instead of walking down two people to
  // find them. EDIT builds: two up and one down, which is every gap that belongs to the
  // person in the middle and nothing else.
  //
  // That asymmetry is the point rather than a limitation of the editor. Each extra band in
  // Edit is another row of "+" cards for relatives you are not currently placing, and the
  // dashed slots are the loudest thing on the canvas — a five-deep edit view is a screen of
  // furniture with a tree behind it.
  //
  // A CANVAS THAT SILENTLY SHRINKS WHEN YOU PRESS EDIT READS AS SOMETHING HAVING GONE
  // WRONG, so it is said somewhere. It used to be a sentence beside the View/Edit switch;
  // on 2026-09-02 the two switches moved onto one row and the hints went with them, so it
  // is `family-tree#view-vs-edit` in the manual now. If that paragraph is ever deleted,
  // this behaviour is undocumented rather than merely unexplained.
  const levelsUp = canAct ? 2 : 3
  const levelsDown = canAct ? 1 : 5

  // THE BLOODLINE FILTER, APPLIED ONCE, HERE. `related` filters edge by edge as it walks;
  // the generation walk needs the same answer but cannot ask per edge, so the filter goes
  // on the edge list it is handed. Both ends are tested: an edge into somebody off screen
  // must not be a route through them to their descendants.
  const visibleEdges = showingBlood
    ? tree.edges.filter(e => inView(e.from) && inView(e.to))
    : tree.edges

  const peopleAt = (ids: string[]): TreePerson[] =>
    ids.map(id => byId.get(id)).filter((p): p is TreePerson => Boolean(p))

  const upLevels = generationsFrom(tree.people, visibleEdges, focus.id, 'parent', levelsUp)
  const downLevels = generationsFrom(tree.people, visibleEdges, focus.id, 'child', levelsDown)

  /**
   * The bands to draw, as rows.
   *
   * `generationsFrom` stops at the first empty level, so VIEW renders only bands that have
   * somebody in them — no "Great-grandchildren" heading over a family that has none. EDIT
   * renders every band it is allowed regardless, because two of them hold the "+" slots and
   * the sentence explaining where grandparents come from, and those have to be reachable on
   * a tree that is empty.
   */
  const upDepth = canAct ? levelsUp : upLevels.length
  const downDepth = canAct ? levelsDown : downLevels.length

  // Deepest first: the canvas draws the oldest generation at the top.
  const aboveRows = Array.from({ length: upDepth }, (_, i) => upDepth - i)
    .map(distance => ({ distance, people: peopleAt(upLevels[distance - 1] ?? []) }))
  const belowRows = Array.from({ length: downDepth }, (_, i) => i + 1)
    .map(distance => ({ distance, people: peopleAt(downLevels[distance - 1] ?? []) }))

  // The two bands the rest of this component still names directly: the parents own the
  // grandparent "+" slots and the father/mother test, and the children are grouped by
  // marriage. Read from the walk rather than re-queried, so one answer feeds both.
  const parents = aboveRows.find(r => r.distance === 1)?.people ?? []
  const children = belowRows.find(r => r.distance === 1)?.people ?? []

  // GRANDPARENTS ARE DERIVED, never read from a "Paternal Grandfather" row — which is now a
  // property of the walk rather than a line of its own: `aboveRows` at distance 2 IS the
  // parents' parents. That is what keeps them correct when the middle generation is filled
  // in later (record somebody's father today and their grandparents appear from HIS
  // parents), and `generationsFrom` dedupes globally, so cousins who married cannot put one
  // grandmother in two bands.

  // Who can still be linked to a given ANCHOR: everybody except the anchor and the people
  // already attached to them in ANY direction. Without the second half the picker offers
  // to make somebody their own father's sister.
  //
  // A FUNCTION OF THE ANCHOR, not of the focus, since the grandparent slots landed. Those
  // "+" cards attach to a PARENT rather than to the person in the middle of the canvas, so
  // a list computed against the focus would offer the focus's own father as a candidate
  // for his father — and hide people who are merely attached to the focus, who are exactly
  // the ones a grandparent is likely to be.
  const candidatesFor = (anchorId: string) => {
    const attached = new Set([anchorId, ...(links.get(anchorId) ?? []).map(e => e.to)])
    return tree.people.filter(p => !attached.has(p.id))
  }

  // ── WHICH MARRIAGE EACH CHILD CAME FROM ─────────────────────────────────────────────
  // A person with two marriages had every one of their children drawn in one undivided
  // row, so a family looking at Charles — two wives, one child by the first and two by the
  // second — saw three children and no way to tell which. The database has always known:
  // each child carries a `parent` edge to each of their parents, and the answer is the
  // intersection with each spouse.
  //
  // A child is claimed by the FIRST spouse who is also their parent, so nobody is drawn
  // twice; the remainder — children with no other parent recorded, and children whose
  // other parent is not a recorded spouse — falls into a group of its own rather than
  // being attributed to a marriage nobody stated. Guessing is the one thing a family tree
  // must not do here.
  const parentIdsOf = (personId: string) =>
    new Set(related(personId, 'parent').map(e => e.to))

  const claimed = new Set<string>()
  const marriages = spouses.map(spouse => {
    const withThem = children.filter(child => {
      if (claimed.has(child.id)) return false
      if (!parentIdsOf(child.id).has(spouse.id)) return false
      claimed.add(child.id)
      return true
    })
    return { spouse, children: withThem }
  })
  const unattributedChildren = children.filter(c => !claimed.has(c.id))

  // Grouped only when there is more than one marriage to tell apart. With one spouse, or
  // none, the groups would be a box drawn round the whole row — and the row already says
  // everything a single caption could add.
  const groupChildren = spouses.length > 1

  async function detach(edge: TreeEdge, personName: string) {
    const ok = await confirm({
      title: t('tree.removeConnection'),
      description: t('tree.removeLinkConfirm', {
        a: nameOf.get(focus!.id) ?? t('tree.thisPerson'),
        b: personName,
      }),
      confirmLabel: t('tree.removeConnectionAction'),
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const r = await removeRelationship(edge.id)
      if (!r.success) { setError(r.message ?? t('tree.removeConnectionFailed')); return }
      router.refresh()
    })
  }

  const addButton = (
    anchor: TreePerson,
    type: string,
    label?: string,
    coParentIds?: string[],
  ) => !canAct ? null : (
    <button
      key={`${anchor.id}:${type}`}
      type="button"
      onClick={() => setAdding({ anchor, type, coParentIds })}
      className="flex min-h-[6.5rem] w-40 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border px-3 py-4 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-primary hover:bg-brand-soft/40 hover:text-brand-on-soft"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {label ?? `Add ${type.toLowerCase()}`}
    </button>
  )

  const displayName = (person: TreePerson) =>
    nameOf.get(person.id) ?? `${person.firstName} ${person.lastName}`.trim()

  const card = (person: TreePerson, opts?: {
    edge?: TreeEdge
    highlight?: boolean
    /** A word under the pills — the relationship this card was reached by. */
    caption?: string
  }) => {
    // MANAGE IS OFFERED FROM EVERY CARD, full stop, and the qualifier that used to be
    // here is the bug this removed.
    //
    // It read `canViewDirectory && (!person.hasAccount || <has any connection>)`, and that
    // second clause was correct for exactly as long as the panel had nothing to offer a
    // connected-to-nobody member with an account: the details half is read-only for
    // somebody with an account (they are the authority on their own name), the invitation
    // half does not apply to them, and the connections list would be empty. Three empty
    // halves is a dialog worth not opening.
    //
    // `20260902000000` PUT SOMETHING IN IT. The bloodline is a tick on the PERSON now,
    // rendered above the connections and offered whether or not there are any — so the one
    // case this clause excluded is precisely a member for whom the tick is the entire
    // point, and there was no route to it anywhere in the product. Reported as: cannot set
    // bloodline for a member who is not on the tree.
    //
    // THE DIRECTORY GRANT STAYS, since 20260819000008. The panel is where a person's
    // RECORD is read and corrected — names, nickname, birthday, gender, and the invitation
    // — which is the Member Directory's question rather than the tree's, so it follows
    // `members` and not `family-tree`. A family that restricted its roster gets the tree's
    // SHAPE and not a way to read the roster one card at a time.
    //
    // It ANDs with `canAct` below rather than replacing it: losing the Directory grant
    // closes the panel, and losing the tree's edit grant closes it too. Neither implies
    // the other.
    const canManage = canViewDirectory
    return (
      <PersonCard
        key={person.id}
        person={person}
        name={displayName(person)}
        caption={opts?.caption}
        highlight={opts?.highlight}
        inBloodline={bloodline ? bloodline.has(person.id) : undefined}
        onFocus={() => setFocusId(person.id)}
        onDetach={canAct && opts?.edge ? () => detach(opts.edge!, displayName(person)) : undefined}
        onManage={canAct && canManage ? () => setManaging(person) : undefined}
        busy={isPending}
      />
    )
  }

  const hasFather = related(focus.id, 'parent').some(e => byId.get(e.to)?.gender === 'male')
  const hasMother = related(focus.id, 'parent').some(e => byId.get(e.to)?.gender === 'female')

  const openedElsewhere = tree.myPersonId !== null && focus.id !== tree.myPersonId

  return (
    <div className="space-y-4">
      <FormError message={error} />

      {/* ── THE TWO MODE SWITCHES, ON ONE ROW, TOP RIGHT ───────────────────────────
          They were two stacked rows, each with a sentence of hint beside it, and the older
          comment argued for that: *"Its own row above the Bloodline filter, because the two
          are different kinds of thing: this one changes what the canvas LETS YOU DO, the
          other changes who is on it."* That distinction is real and it is not worth two
          rows of vertical space above a canvas — which is the thing the page is for, and
          which was being pushed down by chrome explaining itself.

          `justify-end` puts them where a pair of view switches belongs and where the eye
          already goes for them; `flex-wrap` is what keeps that honest below `sm`, where two
          segmented controls do not fit a phone and the second drops under the first rather
          than shrinking.

          EACH IS STILL CONDITIONAL AND INDEPENDENTLY SO. A caller who cannot edit gets one
          control, a family that has marked nobody gets the other, and somebody with neither
          gets an empty row that collapses to nothing — no wrapper is rendered around them
          beyond this flex, so there is no empty box left behind.

          THE HINTS ARE GONE WITH THE ROWS and that is the trade being made. What they said
          is still true and is now in the manual: the depth changing between View and Edit is
          `family-tree#view-vs-edit`, and who the Bloodline toggle shows is `family-tree#bloodline`,
          which the help link beside it goes straight to. */}
      {(canEdit || canFilterBlood) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit && (
            <div className="inline-flex rounded-xl border p-0.5" role="group" aria-label={t('tree.mode')}>
              {/* IDS AND KEYS, not ids and English. `perm.action.view` / `perm.action.edit`
                  exist and are translated ('Ver' / 'Editar'), so this rendered English beside
                  a grid that did not — `npm run i18n:onscreen` found it, and neither static
                  gate could: a lone capitalised word in a registry is deliberately not prose
                  they recognise. */}
              {([
                { id: false, label: t('perm.action.view') },
                { id: true, label: t('perm.action.edit') },
              ] as const).map(o => (
                <button
                  key={String(o.id)}
                  type="button"
                  onClick={() => setEditing(o.id)}
                  aria-pressed={editing === o.id}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    editing === o.id
                      ? 'bg-brand-primary text-brand-on-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {/* BLOODLINE OR EVERYONE. Offered only when the family has marked SOME of its
              relatives and not all of them — see `canFilterBlood`. */}
          {canFilterBlood && (
            <div className="inline-flex rounded-xl border p-0.5" role="group" aria-label={t('tree.whichRelatives')}>
              {([
                { id: false, label: t('tree.fullFamily') },
                { id: true, label: t('tree.bloodline') },
              ] as const).map(o => (
                <button
                  key={String(o.id)}
                  type="button"
                  onClick={() => setBloodOnly(o.id)}
                  aria-pressed={bloodOnly === o.id}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    bloodOnly === o.id
                      ? 'bg-brand-primary text-brand-on-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {/* THE HELP LINK STAYS, and it is the one piece of the old Bloodline row that has
              to: what the toggle shows is genuinely worth a paragraph, and with the sentence
              beside it gone this is the only route to it. `family-tree#bloodline` explains
              that the answer is family-wide rather than per viewer, that an unmarked relative
              is hidden rather than absent, and that a blood-only due prices against the same
              ticks. */}
          {canFilterBlood && (
            <HelpLink
              slug="family-tree"
              section="bloodline"
              label={t('tree.bloodlineHelp')}
              className="size-6"
            />
          )}
        </div>
      )}

      {/* THE WAY BACK TO YOUR OWN CARD, when the tree opened somewhere else — which
          happens when your own line is empty (see `openingFocus`).

          THE EXPLANATION WENT ON 2026-09-02 and the OFFER did not, which is the whole of
          the change. It read "You have no parents or children recorded yet, so this opens on
          your family rather than on an empty page" — a sentence about why, printed every
          time, to somebody who mostly wants the link. A tree that quietly centres on your
          spouse with no route back is what this block exists to prevent, and the button is
          that route; the paragraph was the part that could go. */}
      {openedElsewhere && (
        <p className="text-xs">
          <button
            type="button"
            onClick={() => setFocusId(tree.myPersonId!)}
            className="font-medium text-brand-accent underline underline-offset-2"
          >
            {t('tree.centreOnMe')}
          </button>
        </p>
      )}

      {/* THE ONE SANCTIONED `overflow-x-auto` IN THE APP, and AGENTS.md names it: "a tree
          is a wide diagram and panning it is the interaction, not a fallback". The table
          rules do not apply — there are no columns to fold and no headings to lose. */}
      <div className="overflow-x-auto rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] sm:p-8">
        <div className="mx-auto flex min-w-fit flex-col items-center gap-0">

          {/* ── THE GENERATIONS ABOVE, oldest band first ──────────────────────────────
              Generated rather than hard-coded, so View can reach three deep and Edit stays
              at two — see `levelsUp`. Two of these bands carry controls and the rest are
              cards, which is why the slot blocks below are keyed on `distance` rather than
              rendered per row. */}
          {aboveRows.map((row, i) => (
            <Fragment key={`up-${row.distance}`}>
              <Generation label={generationLabel(row.distance, 'up')}>
                <GenerationCards
                  people={row.people}
                  render={p => card(p, {
                    // The unlink control belongs only to a connection the FOCUS person
                    // owns. A grandparent's edge runs to a parent, not to the focus, so
                    // detaching it from here would be removing somebody else's link.
                    edge: row.distance === 1
                      ? related(focus.id, 'parent').find(e => e.to === p.id)
                      : undefined,
                  })}
                />

                {canAct && row.distance === 1 && (
                  <>
                    {!hasFather && addButton(focus, t('tree.father'))}
                    {!hasMother && addButton(focus, t('tree.mother'))}
                  </>
                )}

                {/* ── ADDING A GRANDPARENT FROM HERE ────────────────────────────────
                    One pair of slots per PARENT, anchored on that parent, because a
                    grandparent is somebody's mother or father and the tree has no other
                    way to say which side they are on. Building it any other way would mean
                    inventing a "grandparent" relationship type — the thing `relationFor`
                    deliberately refuses to map, for the reason it gives: a grandparent is
                    two parent edges, and a row filed as one edge draws somebody's
                    grandfather where their father belongs.

                    The slots are named for the parent so two sets of them are never a coin
                    toss, and the dialog they open asks whether the link is blood exactly as
                    it does everywhere else. Only at distance 2: past that the same argument
                    applies one generation further out and the answer is to centre on the
                    grandparent, which is one click. */}
                {canAct && row.distance === 2 && parents.map(parent => {
                  const parentEdges = related(parent.id, 'parent')
                  const hasDad = parentEdges.some(e => byId.get(e.to)?.gender === 'male')
                  const hasMum = parentEdges.some(e => byId.get(e.to)?.gender === 'female')
                  const who = parent.firstName || displayName(parent)
                  return (
                    <Fragment key={parent.id}>
                      {!hasDad && addButton(parent, t('tree.father'),
                        t('tree.addSomeonesFather', { who }))}
                      {!hasMum && addButton(parent, t('tree.mother'),
                        t('tree.addSomeonesMother', { who }))}
                    </Fragment>
                  )
                })}

                {/* Only when the band is genuinely empty AND has no slots in it. In edit
                    mode with a parent recorded there are "+" cards to press, and a sentence
                    saying grandparents appear on their own would be contradicted by them.
                    In view mode an empty band is never rendered at all — the walk stops at
                    the first gap — so this only ever speaks for Edit. */}
                {row.people.length === 0 && row.distance === 2 && parents.length === 0 && (
                  <p className="max-w-xs text-center text-xs text-muted-foreground">
                    Record {focus.firstName || 'this person'}&apos;s parents first —
                    grandparents hang off them.
                  </p>
                )}
              </Generation>

              {/* Between this band and whatever is under it: the next band up the list, or
                  the focus row, which always has somebody in it. */}
              <Connector show={row.people.length > 0
                && (i === aboveRows.length - 1 || aboveRows[i + 1].people.length > 0)} />
            </Fragment>
          ))}

          <Generation label={spouses.length > 1
            ? t('tree.thisAndMarriages')
            : spouses.length > 0 ? t('tree.thisAndSpouse') : t('tree.thisPerson')}>
            {card(focus, { highlight: true })}
            {/* THE WORD ON THE CARD — "Wife", "Ex-wife", "Partner". With one spouse it is
                a small courtesy; with two it is the row's whole meaning, because three
                cards side by side otherwise read as three people rather than as a person
                and two marriages. It comes from the edge's own `typeName`, which names the
                far end, and is absent when nobody has recorded a gender to name it with. */}
            {spouses.map(p => {
              const edge = related(focus.id, 'spouse').find(e => e.to === p.id)
              return card(p, { edge, caption: edge?.typeName ?? undefined })
            })}
            {/* OFFERED WHETHER OR NOT THERE IS ALREADY A SPOUSE. This was
                `spouses.length === 0`, which meant a family could record exactly one
                marriage per person and then had no way to record a second — no
                remarriage, no former partner, and no way in at all once the first was
                entered. A second marriage is ordinary, and it is usually where the other
                half of somebody's children come from.

                Only the CURRENT three get a "+" of their own; an ex is reached by adding
                the relationship and then renaming it in the manage dialog, because
                "+ Add ex-husband" as a first move is a strange thing to offer somebody
                building a tree. */}
            <div className="flex flex-wrap gap-2">
              {TREE_RELATIONSHIPS.filter(r => r.relation === 'spouse' && !r.type.startsWith('Ex-'))
                .map(r => addButton(focus, r.type, spouses.length > 0
                  ? t('tree.addAnother', { relation: r.label.toLowerCase() })
                  : undefined))}
            </div>
          </Generation>

          <Connector show={children.length > 0} />

          {/* ── CHILDREN, BY MARRIAGE ────────────────────────────────────────────────
              One undivided row for somebody with two marriages says nothing about which
              children came from which, and that is the single most load-bearing fact on a
              tree of a remarried family — it is what the second marriage EXPLAINS. So
              once there is more than one spouse the row becomes one panel per marriage,
              captioned with the spouse, plus a panel for children whose other parent is
              not one of them.

              The "+ Son" and "+ Daughter" buttons live INSIDE each panel and carry that
              panel's spouse as the co-parent, so adding a child to a marriage records the
              marriage. Adding from the wrong row was previously impossible to notice: the
              dialog offered every spouse with all of them ticked. */}
          {groupChildren ? (
            <section aria-label={t('tree.children')} className="w-full">
              <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t('tree.children')}
              </p>
              <div className="flex flex-wrap items-start justify-center gap-4">
                {marriages.map(({ spouse, children: theirs }) => (
                  <MarriageGroup
                    key={spouse.id}
                    caption={t('tree.withPerson', { name: displayName(spouse) })}
                    empty={t('tree.noChildrenWith', {
                      name: spouse.firstName || displayName(spouse),
                    })}
                    hasChildren={theirs.length > 0}
                    canAct={canAct}
                  >
                    {theirs.map(p => card(p, {
                      edge: related(focus.id, 'child').find(e => e.to === p.id),
                    }))}
                    {TREE_RELATIONSHIPS.filter(r => r.relation === 'child')
                      .map(r => addButton(focus, r.type, undefined, [spouse.id]))}
                  </MarriageGroup>
                ))}

                {/* The remainder, and it is only drawn when there is one. An empty
                    "no other parent recorded" panel standing beside two marriages would
                    read as a third relationship nobody has. `coParentIds: []` is not the
                    same as leaving it undefined: it says "offer nobody", because the whole
                    definition of this group is a child the tree cannot attribute. */}
                {(unattributedChildren.length > 0 || canAct) && (
                  <MarriageGroup
                    caption={t('tree.otherChildren')}
                    empty={t('tree.otherChildrenEmpty')}
                    hasChildren={unattributedChildren.length > 0}
                    canAct={canAct}
                  >
                    {unattributedChildren.map(p => card(p, {
                      edge: related(focus.id, 'child').find(e => e.to === p.id),
                    }))}
                    {TREE_RELATIONSHIPS.filter(r => r.relation === 'child')
                      .map(r => addButton(focus, r.type, undefined, []))}
                  </MarriageGroup>
                )}
              </div>
            </section>
          ) : (
            <Generation label={t('tree.children')}>
              <GenerationCards
                people={children}
                render={p => card(p, { edge: related(focus.id, 'child').find(e => e.to === p.id) })}
              />
              <div className="flex flex-wrap gap-2">
                {TREE_RELATIONSHIPS.filter(r => r.relation === 'child')
                  .map(r => addButton(focus, r.type))}
              </div>
            </Generation>
          )}

          {/* ── THE GENERATIONS BELOW THE CHILDREN ────────────────────────────────────
              View only, because `levelsDown` is 1 in Edit — see the note there. These are
              plain bands of cards: no "+" slots, because a grandchild is added from their
              own parent's card, and no marriage grouping, because grouping a band of
              grandchildren would need a panel per child rather than per marriage and would
              caption most of the tree.

              No detach control either. These cards are reached through somebody else's
              connection, so an unlink here would be removing a link the focus person does
              not own — the same reason a grandparent above carries no `edge`. */}
          {belowRows.filter(row => row.distance > 1).map(row => (
            <Fragment key={`down-${row.distance}`}>
              <Connector show={row.people.length > 0} />
              <Generation label={generationLabel(row.distance, 'down')}>
                <GenerationCards people={row.people} render={p => card(p)} />
              </Generation>
            </Fragment>
          ))}
        </div>
      </div>

      {/* SIBLINGS SIT OUTSIDE THE CANVAS, beside it rather than in it, and ancestry does
          the same. They belong to the focus person's own generation, so drawing them in
          that row would put four cards where the eye is looking for one — and a person
          with eight siblings would push their own card off the side of the diagram. */}
      {/* NOT RENDERED AT ALL when there is nothing to put in it. In edit mode it always
          has the two "+" cards, so this only bites in view: without the guard a person
          with no recorded siblings got a heading, a sentence explaining where siblings
          are listed, and then nothing — a section whose whole content was an apology for
          being empty. Same rule the "Not on the tree yet" section already follows. */}
      {(siblings.length > 0 || canAct) && (
        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="mb-1 text-lg">
            {focus.firstName
              ? t('tree.someonesSiblings', { name: focus.firstName })
              : t('tree.siblings')}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">{t('ui.siblingsSharePersonS')}</p>
          <div className="flex flex-wrap gap-3">
            {siblings.map(p => card(p, { edge: related(focus.id, 'sibling').find(e => e.to === p.id) }))}
            {TREE_RELATIONSHIPS.filter(r => r.relation === 'sibling')
              .map(r => addButton(focus, r.type))}
          </div>
        </section>
      )}

      {/* ── NOT ON THE TREE YET ───────────────────────────────────────────────────────
          The people with no relationship recorded in any direction. They are the whole
          family on day one, and a handful of new joiners on day two hundred, and in both
          cases they are invisible on a focus-plus-context canvas by construction — there
          is no focus from which somebody connected to nobody appears.

          IT IS WORK TO DO, NOT A WARNING, and the copy says so. Being unattached is the
          ordinary state of a member who has just joined; nothing here offers to guess at
          their parents, because guessing at somebody's parentage is the one mistake a
          family tree must never make. What it offers is the thing that fixes it: click a
          name to centre the tree on them, then use the "+" cards around them.

          RENDERED ONLY WHEN THERE ARE SOME. A permanent "0 unconnected" heading is a
          control that never changes and a section of the page spent on nothing — the same
          rule the Dashboard's Pending Approval tile follows. The card on the Dashboard
          states the count whether or not it is zero, and that is a different job: there it
          is one figure in a row of three that together describe the tree. */}
      {leaves.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="mb-1 flex flex-wrap items-center gap-2 text-lg">
            <Sprout className="h-4 w-4 text-brand-affirm" aria-hidden="true" />
            {t('tree.notOnTree')}
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-on-soft">
              {leaves.length}
            </span>
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {t('tree.unattachedLede', {
              who: leaves.length === 1
                ? t('tree.thisPersonIs')
                : t('tree.thesePeopleAre'),
            })}
          </p>
          <div className="flex flex-wrap gap-3">
            {/* No `edge`, so no detach control — there is nothing to detach, which is the
                definition of being here. */}
            {leaves.map(p => card(p))}
          </div>
        </section>
      )}

      {/* ── EVERYONE IN THIS FAMILY ───────────────────────────────────────────────────
          The canvas is focus-plus-context, which is right for a family of a hundred and
          forty and has one cost: from any given focus you see four generations around ONE
          person, and everybody else is somewhere you have to know to click. For a member
          whose own line is empty that read as "the tree is broken" — the complaint that
          produced this section.

          So the whole roster is listed, always, and every name centres the tree. Nobody is
          more than one click from anybody, whoever they are and whoever is looking.

          IT IS NOT THE "NOT ON THE TREE YET" SECTION and does not replace it. That one
          answers a different question — who is connected to NOBODY, which is work to do —
          and its people would otherwise appear at no focus at all. This one is an index. */}
      <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-1 flex flex-wrap items-center gap-2 text-lg">
          <Users className="h-4 w-4 text-brand-accent" aria-hidden="true" />
          {t('tree.everyone')}
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-on-soft">
            {roster.length}
          </span>
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('tree.rosterLede')}
          {/* KEYED, and it was a bare English literal in a JSX expression until 2026-09-02
              — the shape AGENTS.md's i18n section calls a MIXED JSX TEXT NODE, which the
              first four literal shapes were blind to. A Spanish reader was told in English
              that the index follows the filter. */}
          {showingBlood && ` ${t('tree.rosterFollowsFilter')}`}
        </p>
        <div className="flex flex-wrap gap-2">
          {roster.map(p => {
            const isFocus = p.id === focus.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setFocusId(p.id)}
                aria-current={isFocus ? 'true' : undefined}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-start text-sm transition-colors',
                  isFocus
                    ? 'border-brand-legacy bg-brand-soft text-brand-on-soft'
                    : 'hover:border-brand-primary/50 hover:bg-brand-soft/40',
                )}
              >
                <span className="flex items-center gap-1">
                  {nameOf.get(p.id) ?? `${p.firstName} ${p.lastName}`.trim()}
                  <BloodDroplet show={bloodline ? bloodline.has(p.id) : undefined} />
                </span>
                <NickName nickName={p.nickName} />
              </button>
            )
          })}
        </div>
      </section>

      {adding && (
        <AddRelativeDialog
          open
          onClose={() => setAdding(null)}
          anchor={adding.anchor}
          relationshipType={adding.type}
          // Against the ANCHOR, which is a PARENT for the grandparent slots rather than
          // the focus person — see `candidatesFor`.
          candidates={candidatesFor(adding.anchor.id)}
          // WHO ELSE COULD BE A PARENT of the person being added. A sibling shares the
          // anchor's parents; a child's other parent is the anchor's spouse. Computed here
          // rather than in the dialog because this is where the adjacency already is, and
          // resolved against the ANCHOR — which is the focus person for most "+" cards on
          // the canvas and is a parent for the grandparent slots.
          //
          // NARROWED when the button that opened this already knew. The per-marriage
          // "+ Son" passes its one spouse; the "Other children" panel passes none at all,
          // which is what that group means.
          coParents={(() => {
            const meta = relationshipMeta(adding.type)
            const from = meta?.relation === 'sibling' ? 'parent'
              : meta?.relation === 'child' ? 'spouse'
              : null
            if (!from) return []
            const named = adding.coParentIds
            return peopleFor(adding.anchor.id, from)
              .filter(p => !named || named.includes(p.id))
              .map(p => ({ id: p.id, name: displayName(p) }))
          })()}
        />
      )}

      {managing && (
        /* ── KEYED ON THE PERSON, AND THAT IS NOW LOAD-BEARING — 2026-09-03 ──────────
           React reconciles by position, so `managing` moving from one person straight to
           another re-renders this component rather than remounting it — and every field in
           it is seeded by a `useState` initializer, which runs once. That was survivable
           while each control wrote as it was touched; it is not now the dialog HOLDS
           unsaved edits, because one relative's half-typed name would be sitting in the
           form over another relative's record with Save enabled.

           The `key` is the fix rather than an effect that re-imposes the props: an effect
           would fight the member's own typing. Same judgement as `<main key={familyCode}>`
           in the protected layout, one scope down. */
        <PersonRecordDialog
          key={managing.id}
          open
          onClose={() => setManaging(null)}
          person={managing}
          name={displayName(managing)}
        />
      )}
    </div>
  )
}

/**
 * The person the canvas opens on.
 *
 * Yourself, unless your own card has no vertical relatives to draw — no parents and no
 * children — in which case the tree opens on somebody you ARE attached to, preferring a
 * spouse. That is the married-in case exactly: one spouse edge, nothing above or below,
 * and a canvas that shows a name and two "+" buttons.
 *
 * SIBLINGS COUNT AS "SOMETHING TO SEE" even though they render beside the canvas rather
 * than in it, because they carry the same generation onward — somebody with four brothers
 * recorded is looking at a real tree, not an empty one.
 *
 * Falls back to the first person in the roster, which is what it always did, so a family
 * with no relationships recorded at all behaves exactly as before.
 */
function openingFocus(tree: FamilyTree): string {
  const me = tree.myPersonId
  if (!me) return tree.people[0]?.id ?? ''

  const mine = tree.edges.filter(e => e.from === me)
  if (mine.some(e => e.relation !== 'spouse')) return me

  const spouse = mine.find(e => e.relation === 'spouse')
  return spouse?.to ?? mine[0]?.to ?? me
}

/**
 * One marriage's children, in a panel of their own.
 *
 * Dashed and unfilled rather than a solid card: it is a grouping of the cards inside it,
 * not a thing in its own right, and a second solid surface around a row of solid cards
 * makes the panel look like the subject. Same treatment, and the same reasoning, as the
 * dashed "+" slots it usually contains.
 *
 * `hasChildren` decides between the cards and a sentence. The sentence matters most on
 * the marriage that has none: an empty panel beside a full one reads as something that
 * failed to load, where "No children recorded with Angela" is a fact about the family.
 *
 * In VIEW mode a panel with no children renders nothing at all — there are no "+" cards
 * down there to reach, so it would be a box containing an apology.
 */
function MarriageGroup({ caption, empty, hasChildren, canAct, children }: {
  caption: string
  empty: string
  hasChildren: boolean
  canAct: boolean
  children: React.ReactNode
}) {
  if (!hasChildren && !canAct) return null
  return (
    <section aria-label={caption} className="rounded-2xl border border-dashed px-3 py-3">
      <p className="mb-2 text-center text-[11px] font-medium text-muted-foreground">
        {caption}
      </p>
      <div className="flex flex-wrap items-stretch justify-center gap-3">
        {hasChildren
          ? children
          : (
            <>
              <p className="max-w-[10rem] self-center text-center text-xs text-muted-foreground">
                {empty}
              </p>
              {children}
            </>
          )}
      </div>
    </section>
  )
}

/**
 * How many cards one generation band draws before it stops and says how many are left.
 *
 * Five generations down is where this stops being hypothetical: a founding couple with five
 * children, four grandchildren each and three after that puts sixty cards in one band and a
 * hundred and twenty in the next. Those render — React does not mind — but a band that wraps
 * to eight lines is not a diagram of anything, and the page below it becomes unreachable.
 *
 * 24 is roughly four wrapped lines at a desktop width, which still reads as one generation.
 */
const BAND_LIMIT = 24

/**
 * The cards in one band, with an honest overflow.
 *
 * NEVER TRUNCATE QUIETLY — the rule `PersonMultiSelect`'s overflow count follows, and it
 * matters more here: a band that stopped at 24 while LOOKING complete is how somebody
 * concludes a great-grandchild is not in the family. So the count is stated, and it names
 * where the rest are, which is the roster index at the bottom of the page — every name in it
 * re-centres the tree, so nobody in the overflow is more than one click away.
 */
function GenerationCards({ people, render }: {
  people: TreePerson[]
  render: (person: TreePerson) => React.ReactNode
}) {
  const t = useT()
  const shown = people.slice(0, BAND_LIMIT)
  const hidden = people.length - shown.length
  return (
    <>
      {shown.map(render)}
      {hidden > 0 && (
        <p className="max-w-[10rem] self-center text-center text-xs text-muted-foreground">
          {t('tree.moreInGeneration', { n: String(hidden) })}{' '}
          <span className="font-medium">{t('tree.everyone')}</span> below.
        </p>
      )}
    </>
  )
}

/** One horizontal band of the diagram, with its generation named for a screen reader. */
function Generation({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="w-full">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap items-stretch justify-center gap-3">{children}</div>
    </section>
  )
}

/**
 * The vertical rule between two generations.
 *
 * `aria-hidden`, and it carries no information a reader loses: the `<section>` labels
 * above and below already say which generation is which, and a line that only exists to
 * be looked at should not be announced. Rendered as a gradient in Legacy gold, which is
 * the one thing that token may always be — a non-text accent (AGENTS.md).
 */
function Connector({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span
      aria-hidden="true"
      className="my-3 h-8 w-px bg-gradient-to-b from-transparent via-brand-legacy to-transparent"
    />
  )
}

/**
 * One person on the canvas.
 *
 * THE WHOLE CARD IS THE RE-FOCUS CONTROL, which is why it is a `<button>` rather than a
 * div with a click handler — it is reachable by keyboard and announced as pressable
 * without any aria of our own. The detach control is a SIBLING, not a child: a button
 * inside a button is invalid markup that browsers reparent and screen readers cannot
 * describe. Same trap `RecentUpdates` avoids with its pin control.
 *
 * FOUR STATES ARE MARKED and each is a fact somebody needs while building:
 *   focus              gold ring — where you are
 *   no account         "Record only", so it is obvious who could still be invited
 *   awaiting approval  they have been invited and have not accepted
 *   no email address   the generated-address case, with the reason on hover
 *
 * THERE IS NO "CHILD" PILL, and its removal on 2026-08-13 was the point of that change
 * rather than a side effect. It rendered `person.isMinor`, which came from a stored
 * `people.is_minor` — a boolean about age that never changed when somebody had a
 * birthday, written by a flow (`/direct-lineage`) in which a child was a different kind
 * of record with a parent who owned it. There is one kind of person now. What a card
 * still needs to say is whether anybody can reach them, which is what the three pills
 * above answer; how old they are is on their profile, and is derived from a date.
 */
function PersonCard({ person, name, caption, highlight, inBloodline, onFocus, onDetach, onManage, busy }: {
  person: TreePerson
  name: string
  /**
   * The relationship this card was reached by — "Wife", "Ex-wife". Given for a spouse and
   * for nothing else: on the other rows the generation band above already says it, and a
   * "Son" under every child card would caption the unremarkable case.
   */
  caption?: string
  highlight?: boolean
  /**
   * Marked with a droplet. Undefined when the family has no anchor to walk from, and the
   * card then says nothing rather than implying "not blood" — see `bloodlineIds`.
   */
  inBloodline?: boolean
  onFocus: () => void
  onDetach?: () => void
  /** Given when there is a record to edit or a connection to classify. */
  onManage?: () => void
  busy: boolean
}) {
  const t = useT()
  const initials = [person.firstName[0], person.lastName[0]].filter(Boolean).join('').toUpperCase()

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onFocus}
        aria-current={highlight ? 'true' : undefined}
        className={cn(
          'flex min-h-[6.5rem] w-40 flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 text-center transition-colors',
          highlight
            ? 'border-brand-legacy bg-brand-soft text-brand-on-soft ring-2 ring-brand-legacy'
            : 'bg-card hover:border-brand-primary/50 hover:bg-brand-soft/40',
        )}
      >
        <Avatar url={person.avatarUrl} initials={initials} size="sm" />
        <span className="w-full text-sm font-medium">
          <span className="flex min-w-0 items-center justify-center gap-1">
            <span className="truncate">{name}</span>
            <BloodDroplet show={inBloodline} />
          </span>
          {/* The nickname sits UNDER the name rather than in parentheses beside it: a
              card is 10rem wide and "Charles Allen (Chuck)" truncates to "Charles All…",
              which loses the very thing the nickname was added to supply. */}
          <NickName nickName={person.nickName} className="truncate" />
        </span>
        {caption && (
          <span className="w-full truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {caption}
          </span>
        )}
        <span className="flex flex-wrap justify-center gap-1">
          {!person.hasAccount && <Pill>{t('tree.recordOnly')}</Pill>}
          {person.hasAccount && person.membershipStatus === 'pending' && <Pill>{t('tree.invited')}</Pill>}
          {person.emailIsPlaceholder && (
            <Pill title={person.noEmailReason ?? undefined}>{t('tree.noEmail')}</Pill>
          )}
        </span>
      </button>

      {/* SIBLINGS OF THE CARD, never children of it — a button inside a button is invalid
          markup that browsers reparent and screen readers cannot describe. Both sit in the
          top corners: detach on the right where it has always been, manage on the left, so
          neither moves depending on whether the other is there. */}
      {onManage && (
        <button
          type="button"
          onClick={onManage}
          disabled={busy}
          title={t('tree.editOrInvite')}
          aria-label={t('tree.editRecordAria', { name })}
          className="absolute -start-1.5 -top-1.5 rounded-full border bg-card p-1 text-muted-foreground shadow-sm transition-colors hover:text-brand-accent disabled:opacity-50"
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      {onDetach && (
        <button
          type="button"
          onClick={onDetach}
          disabled={busy}
          title={t('tree.removeConnection')}
          aria-label={t('tree.removeConnectionAria', { name })}
          className="absolute -end-1.5 -top-1.5 rounded-full border bg-card p-1 text-muted-foreground shadow-sm transition-colors hover:text-destructive disabled:opacity-50"
        >
          <Unlink className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/**
 * A droplet of blood beside the name of somebody in the bloodline.
 *
 * ── IT MARKS THE RULE, NOT THE EXCEPTION, AND THAT IS THE CHANGE ────────────────────
 * The cards used to carry the opposite: a "Step" / "Adopted" / "Foster" pill on everybody
 * who was NOT blood. That reads as a correction attached to a person — a word about how
 * somebody joined the family, printed on their face, on the one screen the whole family
 * looks at. Marking the bloodline instead says the same thing about the tree without
 * saying anything about them.
 *
 * It is also the more honest shape. The pill described the EDGE you happened to arrive by,
 * so the same person carried a different label depending on whose card you were looking
 * from; the droplet describes the person's place in the family, which is one answer
 * wherever you stand.
 *
 * ── THE COLOUR ──────────────────────────────────────────────────────────────────────
 * `--brand-primary` and not a literal (AGENTS.md forbids the literal, and there is no
 * blood-red token). It is the one brand role that stays burgundy in BOTH themes —
 * Heritage in light, `--genorra-heritage-lift` in dark at a measured 6.81 — where
 * `--brand-ink` would turn to sand and `--brand-accent` to gold. A droplet has to be the
 * colour of the thing it is a droplet of, in both themes or in neither.
 *
 * ── UNDEFINED IS NOT FALSE ──────────────────────────────────────────────────────────
 * `show` is undefined when the family has no bloodline anchor, and nothing renders. An
 * absent droplet then means "we do not know", exactly as the missing toggle does; only
 * `false` means "not in it", and both look the same on purpose — a card that has never
 * been asked the question should not answer it.
 */
function BloodDroplet({ show }: { show?: boolean }) {
  const t = useT()
  if (!show) return null
  return (
    <span className="shrink-0 leading-none" title={t('tree.inBloodline')}>
      <Droplet className="h-3 w-3 fill-brand-primary text-brand-primary" aria-hidden="true" />
      {/* The icon is the whole signal, so it owes a screen reader the words. `title`
          alone is not read reliably and is not reachable by keyboard. */}
      <span className="sr-only">{t('tree.inBloodline')}</span>
    </span>
  )
}

function Pill({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
    >
      {children}
    </span>
  )
}

/**
 * The one-line key under the page heading.
 *
 * IT IS ONE MARK NOW. It carried a crown too, over the words "Click anybody to centre the
 * tree on them" — which is not what a crown means. The crown marked the FOCUS person, the
 * gold ring on that card already marks them, and the sentence beside it was describing the
 * canvas's interaction rather than decoding a symbol. A legend is for the marks that are
 * not self-evident; that row was instructions wearing a legend's clothes.
 *
 * The droplet is the one that earns a line, because nothing about a small blue drop says
 * "this person is in the family's bloodline" and the toggle above depends on it.
 */
export function TreeLegend() {
  const t = useT()
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {/* The droplet is the one mark on a card that is not self-evident, so it is the one
          the legend spends a line on. A colour with no key is decoration. */}
      <span className="flex items-center gap-1.5">
        <Droplet className="h-3 w-3 fill-brand-primary text-brand-primary" aria-hidden="true" />
        {t('tree.marksBlood')}
      </span>
      <span>{t('tree.dashedCardsAreGaps')}</span>
      <span>{t('tree.removingNeverRemoves')}</span>
    </p>
  )
}
