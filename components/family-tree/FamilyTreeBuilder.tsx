'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Unlink, Users, Crown, Sprout, Pencil } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { NickName } from '@/components/ui/person-name'
import { cn } from '@/lib/utils'
import { disambiguatedName } from '@/lib/name-utils'
import { AddRelativeDialog } from '@/components/family-tree/AddRelativeDialog'
import { PersonRecordDialog } from '@/components/family-tree/PersonRecordDialog'
import {
  TREE_RELATIONSHIPS, leafIds, bloodlineIds, relationshipMeta,
  type LinkKind, type TreeRelation,
} from '@/lib/family-tree'
import {
  removeRelationship, type FamilyTree, type TreeEdge, type TreePerson,
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
 * ── WHAT IT DOES NOT DO YET, and is not pretending to ───────────────────────────────
 * No step relationships (`person_relationships.is_step` exists and is written false), no
 * multiple marriages drawn as separate lines, no dates on the connectors, no zoom, no
 * export. TODO.md carries the second pass. These are a backlog against a finished feature
 * rather than a caveat on a half-built one — which is what the beta badge used to say, and
 * why it came off.
 *
 * ── STATE ───────────────────────────────────────────────────────────────────────────
 * `focusId` is UI-local — which card you are looking at — so it is genuinely not the
 * family-scoped state AGENTS.md's remount rule is about. It is seeded from a prop, which
 * that rule DOES cover, and the layout's `key={familyCode}` on `<main>` is what handles
 * it: switching family remounts this component and the focus resets to the caller's own
 * card in the new family rather than pointing at a person who is not in it.
 */

export function FamilyTreeBuilder({ tree }: { tree: FamilyTree }) {
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
  const [adding, setAdding] = useState<{ anchor: TreePerson; type: string } | null>(null)
  // Managing a record nobody has claimed — the replacement for /direct-lineage. Holds the
  // person rather than a boolean so the dialog remounts per subject, which is what keeps
  // its field initializers honest when you manage two people in a row.
  const [managing, setManaging] = useState<{ person: TreePerson; edge?: TreeEdge } | null>(null)

  // Bloodline or the whole family. UI-local and deliberately NOT keyed on familyCode: it
  // is a way of looking, not a fact about a family, so switching family should not silently
  // change what you are looking at. (The layout remounts this component anyway; this is
  // about not treating it as family-scoped state — see AGENTS.md on the remount rule.)
  const [bloodOnly, setBloodOnly] = useState(false)

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
  const grandparents = parents.flatMap(p => peopleFor(p.id, 'parent'))

  // Who can still be linked here: everybody except the focus and the people already
  // attached to them in ANY direction. Without the second half the picker offers to make
  // somebody their own father's sister.
  const attached = new Set([
    focus.id,
    ...(links.get(focus.id) ?? []).map(e => e.to),
  ])
  const candidates = tree.people.filter(p => !attached.has(p.id))

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

  const addButton = (anchor: TreePerson, type: string, label?: string) => (
    <button
      key={type}
      type="button"
      onClick={() => setAdding({ anchor, type })}
      className="flex min-h-[6.5rem] w-40 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border px-3 py-4 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-primary hover:bg-brand-soft/40 hover:text-brand-on-soft"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {label ?? `Add ${type.toLowerCase()}`}
    </button>
  )

  const card = (person: TreePerson, opts?: { edge?: TreeEdge; highlight?: boolean }) => {
    // The relationship kind is only a CHOICE for a non-marriage link: a marriage never
    // carries blood, and the database corrects one that claims to
    // (`person_relationships_marriage_is_not_blood`), so offering the control there would
    // be offering one that undoes itself.
    const kindEdge = opts?.edge && opts.edge.relation !== 'spouse' ? opts.edge : undefined
    // Manage is offered when there is EITHER a record to edit or a connection to
    // classify. A member with an account owns their own profile — the action refuses
    // their row — but somebody still has to be able to say their son is a step-son.
    const canManage = !person.hasAccount || Boolean(kindEdge)
    return (
      <PersonCard
        key={person.id}
        person={person}
        name={nameOf.get(person.id) ?? `${person.firstName} ${person.lastName}`.trim()}
        highlight={opts?.highlight}
        kind={opts?.edge?.kind}
        onFocus={() => setFocusId(person.id)}
        onDetach={opts?.edge ? () => detach(opts.edge!, nameOf.get(person.id) ?? 'them') : undefined}
        onManage={canManage ? () => setManaging({ person, edge: kindEdge }) : undefined}
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
            {grandparents.length > 0
              ? grandparents.map(p => card(p))
              : (
                <p className="max-w-xs text-center text-xs text-muted-foreground">
                  Grandparents appear on their own once {focus.firstName || 'this person'}&apos;s
                  parents have parents recorded.
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

          <Generation label={spouses.length > 0 ? 'This person, and their spouse' : 'This person'}>
            {card(focus, { highlight: true })}
            {spouses.map(p => card(p, { edge: related(focus.id, 'spouse').find(e => e.to === p.id) }))}
            {spouses.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {TREE_RELATIONSHIPS.filter(r => r.relation === 'spouse')
                  .map(r => addButton(focus, r.type))}
              </div>
            )}
          </Generation>

          <Connector show={children.length > 0} />

          <Generation label="Children">
            {children.map(p => card(p, { edge: related(focus.id, 'child').find(e => e.to === p.id) }))}
            <div className="flex flex-wrap gap-2">
              {TREE_RELATIONSHIPS.filter(r => r.relation === 'child')
                .map(r => addButton(focus, r.type))}
            </div>
          </Generation>
        </div>
      </div>

      {/* SIBLINGS SIT OUTSIDE THE CANVAS, beside it rather than in it, and ancestry does
          the same. They belong to the focus person's own generation, so drawing them in
          that row would put four cards where the eye is looking for one — and a person
          with eight siblings would push their own card off the side of the diagram. */}
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
                {nameOf.get(p.id) ?? `${p.firstName} ${p.lastName}`.trim()}
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
          candidates={candidates}
        />
      )}

      {managing && (
        <PersonRecordDialog
          open
          onClose={() => setManaging(null)}
          person={managing.person}
          name={nameOf.get(managing.person.id)
            ?? `${managing.person.firstName} ${managing.person.lastName}`.trim()}
          edge={managing.edge}
          // The word for the relationship, from the edge's own direction: `relation` says
          // 'child', and which of Son/Daughter that is depends on the person's gender.
          edgeLabel={managing.edge ? relationLabelFor(managing.edge, managing.person) : undefined}
          focusName={nameOf.get(focus.id)}
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
function PersonCard({ person, name, highlight, kind, onFocus, onDetach, onManage, busy }: {
  person: TreePerson
  name: string
  highlight?: boolean
  /** The kind of the link this card was reached by, when there is one. */
  kind?: LinkKind
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
          <span className="block truncate">{name}</span>
          {/* The nickname sits UNDER the name rather than in parentheses beside it: a
              card is 10rem wide and "Charles Allen (Chuck)" truncates to "Charles All…",
              which loses the very thing the nickname was added to supply. */}
          <NickName nickName={person.nickName} className="truncate" />
        </span>
        <span className="flex flex-wrap justify-center gap-1">
          {/* The kind FIRST, because it changes what the card means. Blood prints nothing
              — see LINK_KIND_PREFIX: qualifying the ordinary case would make it look like
              the remarkable one. */}
          {kind && kind !== 'blood' && (
            <Pill title="Not a blood relative, so hidden in the Bloodline view">
              <span className="capitalize">{kind}</span>
            </Pill>
          )}
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
      <span>· Dashed cards are gaps you can fill</span>
      <span>· Removing a connection never removes anyone from the family</span>
    </p>
  )
}
