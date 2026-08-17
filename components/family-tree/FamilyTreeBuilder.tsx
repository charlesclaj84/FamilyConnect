'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Unlink, Users, Crown, Sprout, Pencil, Droplet, AlertTriangle } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { NickName } from '@/components/ui/person-name'
import { cn } from '@/lib/utils'
import { disambiguatedName } from '@/lib/name-utils'
import { AddRelativeDialog } from '@/components/family-tree/AddRelativeDialog'
import {
  PersonRecordDialog, type TreeConnection,
} from '@/components/family-tree/PersonRecordDialog'
import {
  TREE_RELATIONSHIPS, leafIds, bloodlineIds, auditBloodlineAnchor, relationshipMeta,
  type TreeRelation,
} from '@/lib/family-tree'
import {
  removeRelationship, setBloodlineAnchor,
  type FamilyTree, type TreeEdge, type TreePerson,
} from '@/app/actions/family-tree'

/**
 * The family-wide tree — the only tree in the product, since the per-member lineage view
 * was retired on 2026-08-13 (see the page for what that removal did and did not cost).
 *
 * ── THE MODEL IS ANCESTRY'S, AND THAT IS DELIBERATE ─────────────────────────────────
 * One person is in FOCUS, and the canvas draws the four generations around them:
 * grandparents, parents, the focus with their spouses and siblings, and children.
 * Clicking anybody re-focuses on them, so a family walks its tree one step at a time
 * instead of trying to render three hundred people at once.
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
 * No dates on the connectors, no zoom, no export. (`person_relationships.is_step` is
 * superseded by `link_kind` and written false; TODO.md carries dropping the column.) These
 * are a backlog against a finished feature rather than a caveat on a half-built one —
 * which is what the beta badge used to say, and why it came off.
 *
 * ── STATE ───────────────────────────────────────────────────────────────────────────
 * `focusId` is UI-local — which card you are looking at — so it is genuinely not the
 * family-scoped state AGENTS.md's remount rule is about. It is seeded from a prop, which
 * that rule DOES cover, and the layout's `key={familyCode}` on `<main>` is what handles
 * it: switching family remounts this component and the focus resets to the caller's own
 * card in the new family rather than pointing at a person who is not in it.
 */

export function FamilyTreeBuilder({ tree, canEdit, canSetAnchor = false }: {
  tree: FamilyTree
  canEdit: boolean
  /** `admin/family:edit` — see the page. Decides whether the anchor picker is offered. */
  canSetAnchor?: boolean
}) {
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
  // offers each of them (see `connectionsFor`).
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

  // WHO IS IN THE BLOODLINE. Null when the family has no anchor to walk from — the
  // founder has left, or never had a row here — and the toggle is then not offered at
  // all rather than answering with a guess.
  const bloodline = useMemo(
    () => bloodlineIds(tree.people, tree.edges, tree.bloodlineAnchorId),
    [tree.people, tree.edges, tree.bloodlineAnchorId],
  )

  // IS THE ANCHOR STANDING HIGH ENOUGH. Non-empty `parentIds` means the bloodline is being
  // walked from somebody who has parents recorded, so BOTH their lines are in it — which is
  // how a mother who married in comes back as blood. See `auditBloodlineAnchor`, and the
  // block below, which is the only thing that ever said so on screen.
  const anchorAudit = useMemo(
    () => auditBloodlineAnchor(tree.people, tree.edges, tree.bloodlineAnchorId),
    [tree.people, tree.edges, tree.bloodlineAnchorId],
  )
  const canFilterBlood = bloodline !== null && bloodline.size < tree.people.length
  const showingBlood = bloodOnly && bloodline !== null

  const inView = (personId: string): boolean =>
    !showingBlood || bloodline!.has(personId)

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
          There is nobody in this family to build a tree from yet.
        </p>
      </div>
    )
  }

  const parents = peopleFor(focus.id, 'parent')
  const children = peopleFor(focus.id, 'child')
  const spouses = peopleFor(focus.id, 'spouse')
  const siblings = peopleFor(focus.id, 'sibling')

  // GRANDPARENTS ARE DERIVED, never read from a "Paternal Grandfather" row. That is what
  // keeps them correct when the middle generation is filled in later: record somebody's
  // father today and their grandparents appear from HIS parents, rather than from a
  // second set of rows that would then disagree with him.
  // DEDUPED, because two of the focus person's parents can share one. Cousins who married
  // is the ordinary way that happens and it is not rare in a family large enough to want
  // this product — the same grandmother would otherwise be drawn twice, under one React
  // key, which is a duplicate-key warning and a card that cannot be told from its twin.
  const grandparents = [...new Map(
    parents.flatMap(p => peopleFor(p.id, 'parent')).map(g => [g.id, g]),
  ).values()]

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
      title: 'Remove this connection',
      description:
        `Remove the link between ${nameOf.get(focus!.id) ?? 'this person'} and ${personName}? `
        + 'This only removes the connection — nobody is removed from the family, and '
        + 'nothing they have recorded is deleted.',
      confirmLabel: 'Remove connection',
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const r = await removeRelationship(edge.id)
      if (!r.success) { setError(r.message ?? 'Could not remove that connection.'); return }
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

  /**
   * Every connection this person has, as the manage dialog needs them.
   *
   * `getFamilyTree` normalizes each stored row into BOTH directions, so the edges out of
   * one person are the whole of their adjacency however the rows were written. Taking
   * them from the PERSON rather than from the card that was clicked is what lets a
   * grandparent's link be re-classified: their edge is to a parent, not to the focus, so
   * the card the tree drew them on carried nothing to hand over.
   *
   * `label` names the OTHER person relative to this one, which is what the edge's own
   * direction already says: `relation` reads "`to` is `from`'s parent", and `to` is who
   * we are labelling.
   */
  const connectionsFor = (person: TreePerson): TreeConnection[] =>
    (links.get(person.id) ?? []).flatMap(edge => {
      const other = byId.get(edge.to)
      if (!other) return []
      return [{
        edge,
        otherId: other.id,
        otherName: displayName(other),
        label: relationLabelFor(edge, other),
      }]
    })

  const card = (person: TreePerson, opts?: {
    edge?: TreeEdge
    highlight?: boolean
    /** A word under the pills — the relationship this card was reached by. */
    caption?: string
  }) => {
    // MANAGE IS OFFERED FROM EVERY CARD WITH SOMETHING TO CHANGE, which is a record to
    // correct or any connection at all. It used to be offered only for the edge this card
    // was reached by, so a grandparent — drawn from their child's card, with no edge to
    // the focus person — got no pencil, and there was no way anywhere in the product to
    // say that a grandmother was a step-grandmother.
    const canManage = !person.hasAccount || (links.get(person.id)?.length ?? 0) > 0
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

      {/* VIEW OR EDIT. Offered only to somebody who may actually edit, so it is not a
          control that exists to be refused. Its own row above the Bloodline filter,
          because the two are different kinds of thing: this one changes what the canvas
          LETS YOU DO, the other changes who is on it. */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border p-0.5" role="group" aria-label="Tree mode">
            {([
              { id: false, label: 'View' },
              { id: true, label: 'Edit' },
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
          <p className="text-xs text-muted-foreground">
            {editing
              ? 'Add relatives, correct records and remove connections. Nothing here removes anybody from the family.'
              : 'Reading the tree. Switch to Edit to add relatives or change a connection.'}
          </p>
        </div>
      )}

      {/* BLOODLINE OR EVERYONE. Offered only when the family HAS a bloodline that differs
          from its roster: with no anchor there is no honest answer, and with everybody in
          it the toggle is a control that does nothing. */}
      {canFilterBlood && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border p-0.5" role="group" aria-label="Which relatives to show">
            {([
              { id: false, label: 'Full family' },
              { id: true, label: 'Bloodline' },
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
          <p className="text-xs text-muted-foreground">
            {showingBlood
              ? `Showing the ${bloodline!.size} people descended from this family's line. Spouses, step and adopted relatives are hidden.`
              : `Everyone in the family — ${tree.people.length} people, ${bloodline!.size} of them by blood.`}
          </p>
        </div>
      )}

      {/* WHOSE LINE. The single most consequential setting on this page and the one nobody
          would think to look for, so it sits next to the thing it decides rather than in
          Family Settings.

          It matters because the default is a poor one: anchored on the FOUNDER, a family
          created by a son walks up through his mother — so his father's former wife comes
          back as blood while the current wife correctly does not, from the same rule. The
          fix is to name the person the line descends from, usually the oldest recorded
          ancestor rather than whoever signed up.

          Offered on `admin/family:edit`, the grant that renames the family, because it is
          the same kind of decision: one setting that changes what every member sees. */}
      {canSetAnchor && bloodline !== null && (
        <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <label htmlFor="bloodline-anchor" className="font-medium">
            Bloodline descends from
          </label>
          <select
            id="bloodline-anchor"
            value={tree.bloodlineAnchorId ?? ''}
            disabled={isPending}
            onChange={e => {
              const next = e.target.value || null
              setError('')
              startTransition(async () => {
                const r = await setBloodlineAnchor(next)
                if (!r.success) { setError(r.message ?? 'Could not change that.'); return }
                router.refresh()
              })
            }}
            className="rounded-lg border bg-transparent px-2 py-1 text-xs"
          >
            {/* An explicit "clear" rather than a blank first row, so the fallback is a
                choice somebody can make on purpose and read back afterwards. */}
            <option value="">Whoever created the family</option>
            {tree.people.map(p => (
              <option key={p.id} value={p.id}>
                {nameOf.get(p.id) ?? `${p.firstName} ${p.lastName}`.trim()}
              </option>
            ))}
          </select>
          <span>
            Everyone who shares an ancestor with them is a blood relative; their spouses
            are not.
          </span>
        </div>

        {/* ── THE ANCHOR IS STANDING TOO LOW ────────────────────────────────────────
            The one thing about this setting nobody could see, and the reason the whole
            feature reads as broken the first time a family records a parent.

            The bloodline is everybody who shares an ancestor WITH THE ANCHOR, and the
            anchor's ancestors run up through both of its parents. So the moment the anchor
            has a mother recorded, she and her whole line are blood — which is true of her
            relationship to the anchor and is not what the family means by its line.

            What a member reaches for instead is the mother connection's blood/step control,
            and it is the wrong lever: she really is their blood mother, so marking it step
            records a falsehood and mis-classifies her own relatives on the way past. This
            block is what points at the right one.

            A plain muted well with an AlertTriangle, matching the record-mode notice in
            AddRelativeDialog. Deliberately NOT `--destructive` (nothing failed) and not
            `--brand-withheld` (no capability is going away) — see AGENTS.md on both. */}
        {anchorAudit && anchorAudit.parentIds.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="space-y-1.5">
              <p>
                The bloodline is being worked out from{' '}
                <span className="font-medium text-foreground">
                  {nameOf.get(tree.bloodlineAnchorId ?? '') ?? 'the person named above'}
                </span>
                , who has {anchorAudit.parentIds.length === 1 ? 'a parent' : 'parents'} on the
                tree — so{' '}
                {anchorAudit.parentIds
                  .map(id => nameOf.get(id) ?? 'that parent')
                  .join(' and ')}{' '}
                and everybody they descend from count as blood, on both sides. A spouse who
                married in is included that way.
              </p>
              <p>
                If your family&apos;s line runs through one of them, name that person
                instead. Do not mark a real parent as step to get them out of the view —
                they are a blood parent, and recording otherwise makes the tree wrong in a
                way nothing else can correct.
              </p>
              {/* THE TOPMOST ANCESTORS, as one click each. Usually two — a father's line
                  and a mother's — and which of them the family descends from is precisely
                  the fact only the family knows, so nothing here picks. */}
              {anchorAudit.rootIds.filter(id => id !== tree.bloodlineAnchorId).length > 0 && (
                <p className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span>Oldest recorded on each line:</span>
                  {anchorAudit.rootIds
                    .filter(id => id !== tree.bloodlineAnchorId)
                    .map(id => (
                      <button
                        key={id}
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setError('')
                          startTransition(async () => {
                            const r = await setBloodlineAnchor(id)
                            if (!r.success) { setError(r.message ?? 'Could not change that.'); return }
                            router.refresh()
                          })
                        }}
                        className="rounded-lg border px-2 py-0.5 font-medium text-brand-accent transition-colors hover:bg-brand-soft/40 disabled:opacity-60"
                      >
                        Use {nameOf.get(id) ?? 'them'}
                      </button>
                    ))}
                </p>
              )}
            </div>
          </div>
        )}
        </div>
      )}

      {/* WHY YOU ARE LOOKING AT SOMEBODY ELSE. Only when the tree opened somewhere other
          than the caller's own card, which happens when their own line is empty — see
          `openingFocus`. A tree that quietly centres on your spouse is more confusing than
          one that starts empty, so it says so and offers the way back. */}
      {openedElsewhere && (
        <p className="text-xs text-muted-foreground">
          You have no parents or children recorded yet, so this opens on your family rather
          than on an empty page.{' '}
          <button
            type="button"
            onClick={() => setFocusId(tree.myPersonId!)}
            className="font-medium text-brand-accent underline underline-offset-2"
          >
            Centre on me
          </button>
        </p>
      )}

      {/* THE ONE SANCTIONED `overflow-x-auto` IN THE APP, and AGENTS.md names it: "a tree
          is a wide diagram and panning it is the interaction, not a fallback". The table
          rules do not apply — there are no columns to fold and no headings to lose. */}
      <div className="overflow-x-auto rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] sm:p-8">
        <div className="mx-auto flex min-w-fit flex-col items-center gap-0">

          <Generation label="Grandparents">
            {grandparents.map(p => card(p))}

            {/* ── ADDING A GRANDPARENT FROM HERE ────────────────────────────────────
                One pair of slots per PARENT, anchored on that parent, because a
                grandparent is somebody's mother or father and the tree has no other way
                to say which side they are on. Building it any other way would mean
                inventing a "grandparent" relationship type — the thing `relationFor`
                deliberately refuses to map, for the reason it gives: a grandparent is two
                parent edges, and a row filed as one edge draws somebody's grandfather
                where their father belongs.

                The slots are named for the parent so two sets of them are never a coin
                toss, and the dialog they open asks whether the link is blood exactly as it
                does everywhere else — which is the other half of the request. Before this,
                reaching a grandparent meant clicking through to the parent first, and
                nothing on the canvas said so. */}
            {canAct && parents.map(parent => {
              const parentEdges = related(parent.id, 'parent')
              const hasDad = parentEdges.some(e => byId.get(e.to)?.gender === 'male')
              const hasMum = parentEdges.some(e => byId.get(e.to)?.gender === 'female')
              const who = parent.firstName || displayName(parent)
              return (
                <Fragment key={parent.id}>
                  {!hasDad && addButton(parent, 'Father', `Add ${who}'s father`)}
                  {!hasMum && addButton(parent, 'Mother', `Add ${who}'s mother`)}
                </Fragment>
              )
            })}

            {/* Only when the row is genuinely empty. In edit mode with a parent recorded
                there are slots to press, and a sentence explaining that grandparents
                appear on their own would be contradicted by the two "+" cards beside it. */}
            {grandparents.length === 0 && (!canAct || parents.length === 0) && (
              <p className="max-w-xs text-center text-xs text-muted-foreground">
                {parents.length === 0
                  ? `Record ${focus.firstName || 'this person'}'s parents first — grandparents hang off them.`
                  : `Grandparents appear on their own once ${focus.firstName || 'this person'}'s parents have parents recorded.`}
              </p>
            )}
          </Generation>

          <Connector show={grandparents.length > 0 && parents.length > 0} />

          <Generation label="Parents">
            {parents.map(p => card(p, { edge: related(focus.id, 'parent').find(e => e.to === p.id) }))}
            {!hasFather && addButton(focus, 'Father')}
            {!hasMother && addButton(focus, 'Mother')}
          </Generation>

          <Connector show={parents.length > 0} />

          <Generation label={spouses.length > 1
            ? 'This person, and their marriages'
            : spouses.length > 0 ? 'This person, and their spouse' : 'This person'}>
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
                .map(r => addButton(focus, r.type, spouses.length > 0 ? `Add another ${r.label.toLowerCase()}` : undefined))}
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
            <section aria-label="Children" className="w-full">
              <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Children
              </p>
              <div className="flex flex-wrap items-start justify-center gap-4">
                {marriages.map(({ spouse, children: theirs }) => (
                  <MarriageGroup
                    key={spouse.id}
                    caption={`With ${displayName(spouse)}`}
                    empty={`No children recorded with ${spouse.firstName || displayName(spouse)}.`}
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
                    caption="Other children"
                    empty="Children whose other parent is not recorded appear here."
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
            <Generation label="Children">
              {children.map(p => card(p, { edge: related(focus.id, 'child').find(e => e.to === p.id) }))}
              <div className="flex flex-wrap gap-2">
                {TREE_RELATIONSHIPS.filter(r => r.relation === 'child')
                  .map(r => addButton(focus, r.type))}
              </div>
            </Generation>
          )}
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
            {focus.firstName ? `${focus.firstName}'s brothers and sisters` : 'Brothers and sisters'}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Siblings share this person&apos;s generation, so they are listed here rather than
            drawn in the row above.
          </p>
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
            Not on the tree yet
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-on-soft">
              {leaves.length}
            </span>
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {leaves.length === 1 ? 'This person is' : 'These people are'} in the family but
            not connected to anybody, so they do not appear anywhere above. Click a name to
            centre the tree on them, then fill in the relatives around them.
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
          Everyone in this family
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-on-soft">
            {roster.length}
          </span>
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          The tree above shows the four generations around one person. Click anybody here to
          centre it on them.
          {showingBlood && ' This list follows the Bloodline filter too.'}
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
                  'rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors',
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
        <PersonRecordDialog
          open
          onClose={() => setManaging(null)}
          person={managing}
          name={displayName(managing)}
          // EVERY connection they have, not the one their card was reached by. That is
          // what makes "is this person in the bloodline?" answerable from anywhere on the
          // canvas rather than only from the card of somebody they are directly linked to.
          connections={connectionsFor(managing)}
        />
      )}
    </div>
  )
}

/**
 * "Son", "Daughter", "Father" — the specific word for an edge, given the person it points
 * at.
 *
 * `TreeEdge.relation` is the folded form ('parent', 'child', 'sibling'), which is what the
 * canvas lays out with and is the wrong thing to show somebody: "How is Ada Charles's
 * child?" reads as a riddle. `TREE_RELATIONSHIPS` maps back the other way through gender.
 *
 * Falls back to the folded word when the gender is not recorded, which is most of a real
 * tree and is why this returns a string rather than insisting.
 */
function relationLabelFor(edge: TreeEdge, person: TreePerson): string {
  const match = TREE_RELATIONSHIPS.find(
    r => r.relation === edge.relation && r.gender === person.gender,
  )
  return match?.label ?? relationshipMeta(edge.relation)?.label ?? edge.relation
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
          {!person.hasAccount && <Pill>Record only</Pill>}
          {person.hasAccount && person.membershipStatus === 'pending' && <Pill>Invited</Pill>}
          {person.emailIsPlaceholder && (
            <Pill title={person.noEmailReason ?? undefined}>No email</Pill>
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
          title="Edit this record, or invite them"
          aria-label={`Edit ${name}'s record, or invite them`}
          className="absolute -left-1.5 -top-1.5 rounded-full border bg-card p-1 text-muted-foreground shadow-sm transition-colors hover:text-brand-accent disabled:opacity-50"
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      {onDetach && (
        <button
          type="button"
          onClick={onDetach}
          disabled={busy}
          title="Remove this connection"
          aria-label={`Remove the connection to ${name}`}
          className="absolute -right-1.5 -top-1.5 rounded-full border bg-card p-1 text-muted-foreground shadow-sm transition-colors hover:text-destructive disabled:opacity-50"
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
  if (!show) return null
  return (
    <span className="shrink-0 leading-none" title="In the bloodline">
      <Droplet className="h-3 w-3 fill-brand-primary text-brand-primary" aria-hidden="true" />
      {/* The icon is the whole signal, so it owes a screen reader the words. `title`
          alone is not read reliably and is not reachable by keyboard. */}
      <span className="sr-only">In the bloodline</span>
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
 * `Crown` belongs to the legend rather than to the cards: the gold focus ring already
 * marks the focus person, and a second marker on the same card would be two things saying
 * one thing.
 */
export function TreeLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Crown className="h-3 w-3 text-brand-legacy" aria-hidden="true" />
        Click anybody to centre the tree on them
      </span>
      {/* The droplet is the one mark on a card that is not self-evident, so it is the one
          the legend spends a line on. A colour with no key is decoration. */}
      <span className="flex items-center gap-1.5">
        <Droplet className="h-3 w-3 fill-brand-primary text-brand-primary" aria-hidden="true" />
        Marks a blood relative
      </span>
      <span>· Dashed cards are gaps you can fill</span>
      <span>· Removing a connection never removes anyone from the family</span>
    </p>
  )
}
