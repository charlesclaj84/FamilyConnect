'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Unlink, Users, Crown, Sprout } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { cn } from '@/lib/utils'
import { disambiguatedName } from '@/lib/name-utils'
import { AddRelativeDialog } from '@/components/family-tree/AddRelativeDialog'
import { TREE_RELATIONSHIPS, leafIds, type TreeRelation } from '@/lib/family-tree'
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
  const [focusId, setFocusId] = useState<string>(
    () => tree.myPersonId ?? tree.people[0]?.id ?? '',
  )
  const [adding, setAdding] = useState<{ anchor: TreePerson; type: string } | null>(null)

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

  const related = (personId: string, relation: TreeRelation): TreeEdge[] =>
    (links.get(personId) ?? []).filter(e => e.relation === relation)

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
    for (const p of source) map.set(p.id, disambiguatedName(p, source))
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

  const card = (person: TreePerson, opts?: { edge?: TreeEdge; highlight?: boolean }) => (
    <PersonCard
      key={person.id}
      person={person}
      name={nameOf.get(person.id) ?? `${person.firstName} ${person.lastName}`.trim()}
      highlight={opts?.highlight}
      onFocus={() => setFocusId(person.id)}
      onDetach={opts?.edge ? () => detach(opts.edge!, nameOf.get(person.id) ?? 'them') : undefined}
      busy={isPending}
    />
  )

  const hasFather = related(focus.id, 'parent').some(e => byId.get(e.to)?.gender === 'male')
  const hasMother = related(focus.id, 'parent').some(e => byId.get(e.to)?.gender === 'female')

  return (
    <div className="space-y-4">
      <FormError message={error} />

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

      {adding && (
        <AddRelativeDialog
          open
          onClose={() => setAdding(null)}
          anchor={adding.anchor}
          relationshipType={adding.type}
          candidates={candidates}
        />
      )}
    </div>
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
 */
function PersonCard({ person, name, highlight, onFocus, onDetach, busy }: {
  person: TreePerson
  name: string
  highlight?: boolean
  onFocus: () => void
  onDetach?: () => void
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
        <span className="w-full truncate text-sm font-medium">{name}</span>
        <span className="flex flex-wrap justify-center gap-1">
          {!person.hasAccount && <Pill>Record only</Pill>}
          {person.hasAccount && person.membershipStatus === 'pending' && <Pill>Invited</Pill>}
          {person.emailIsPlaceholder && (
            <Pill title={person.noEmailReason ?? undefined}>No email</Pill>
          )}
          {person.isMinor && <Pill>Child</Pill>}
        </span>
      </button>

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
