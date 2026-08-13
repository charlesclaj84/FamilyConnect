import Link from 'next/link'
import { GitBranch, Sprout } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TreeSummary } from '@/lib/family-tree'

/**
 * The Golden Master's "Family Tree Highlights" panel, answered with the numbers the data
 * can actually produce.
 *
 * ── THE PANEL THE DASHBOARD SAID IT COULD NOT HAVE ─────────────────────────────────
 * `app/(protected)/dashboard/page.tsx` used to list this among four omitted kit panels,
 * on two grounds: the tree was "the beta scaffold — no data behind it at all", and
 * "nothing computes a family-wide generation depth either". Both stopped being true on
 * 2026-08-13 — the tree is real and `summarizeTree` computes the depth — so the omission
 * expired rather than being overruled.
 *
 * ── IT RENDERS FOR AN EMPTY TREE, DELIBERATELY ─────────────────────────────────────
 * Every other card on this page disappears when it has nothing to say, and this one does
 * the opposite on purpose. A family that has recorded no relationships is the family that
 * most needs telling that a tree exists and is empty — "1 generation, 12 members, 12 not
 * yet connected" is a complete and useful answer, and the card is the only place anybody
 * would find it. A hidden card would leave the feature undiscovered by exactly the
 * families who have not started.
 *
 * That is why the numbers are never suppressed either. Zero is a real answer here, unlike
 * the Pending Approval tile — which hides at zero because a standing "0 waiting" is a
 * control that never changes rather than one figure among three describing one thing.
 *
 * ── THE GATE IS NOT HERE ───────────────────────────────────────────────────────────
 * `summary` arrives already fetched under `family-tree:view` and only when the feature is
 * live — AGENTS.md §5, the same rule every tile on this page follows. If you are tempted
 * to add a `canSee` prop, the check belongs in the page, above its `Promise.all`.
 *
 * ── LEAVES ARE OFFERED AS WORK, NOT AS AN ERROR ────────────────────────────────────
 * "Not yet connected" is the ordinary state of somebody who joined last week, so the row
 * is affirmative green rather than a warning colour and the copy names the next step. A
 * family that reads this as a defect will go looking for a fix that does not exist:
 * connecting people is a judgement about who is related to whom, and nothing should ever
 * guess at it.
 */
export function FamilyTreeCard({ summary }: { summary: TreeSummary }) {
  const { people, generations, leaves } = summary

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 flex items-center gap-2 text-lg">
        <GitBranch className="h-4 w-4 text-brand-accent" aria-hidden="true" />
        Family Tree
      </h2>

      {/* Three figures across, wrapping to two and then one. `auto-fit` with a floor
          rather than a fixed count, so this holds up in the narrow column on a phone and
          beside the ledger on a desktop without a breakpoint for each. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-3">
        <Figure value={generations} label={generations === 1 ? 'Generation' : 'Generations'} />
        <Figure value={people} label={people === 1 ? 'Member' : 'Members'} />
        <Figure value={leaves} label="Not connected" />
      </div>

      {/* THE LEAF LINE IS THE ONE SENTENCE THIS CARD ADDS to the three figures, and it
          changes with the state rather than restating the number: nothing to do, one
          person to place, or several. */}
      <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
        <Sprout className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-affirm" aria-hidden="true" />
        {people === 0
          ? 'There is nobody in this family to build a tree from yet.'
          : leaves === 0
            ? 'Everybody in the family is connected to somebody.'
            : leaves === 1
              ? 'One person is not connected to anybody yet.'
              : `${leaves} people are not connected to anybody yet.`}
      </p>

      <Link
        href="/family-tree"
        className={cn(
          buttonVariants({ size: 'sm', variant: 'outline' }),
          'mt-4 w-full justify-center',
        )}
      >
        {leaves > 0 ? 'Open the tree' : 'View family tree'}
      </Link>
    </section>
  )
}

/**
 * One figure and its caption.
 *
 * `tabular-nums` so a count that ticks up does not shift the caption under it, and a
 * `<span>` rather than a heading — these are figures, and the card's h2 already names the
 * region. Same treatment as `AtAGlance`, which is the panel this sits beside.
 */
function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border bg-background p-3 text-center">
      <span className="block text-2xl font-semibold leading-none tabular-nums">{value}</span>
      <span className="mt-1.5 block text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
