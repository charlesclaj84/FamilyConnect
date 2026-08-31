import Link from 'next/link'
import Image from 'next/image'
import { GitBranch, Sprout } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TreeSummary } from '@/lib/family-tree'
import familyTreeIllustration from '@/components/dashboard/illustrations/family-tree.png'
import type { T } from '@/lib/i18n/t'

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
 * most needs telling that a tree exists and is empty — "1 generation, 12 members, 12
 * leaves" is a complete and useful answer, and the card is the only place anybody would
 * find it. A hidden card would leave the feature undiscovered by exactly the families who
 * have not started.
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
 * ── "LEAVES", NOT "NOT CONNECTED" ──────────────────────────────────────────────────
 * The caption is the tree's own word for these people, and `leafIds` in
 * `lib/family-tree.ts` sets out at length what it means here: not the botanical sense and
 * not the graph-theory one, but somebody with NO relationship recorded in any direction,
 * who therefore appears at no focus on the canvas and is invisible until something lists
 * them.
 *
 * A bare "Leaves" over a number teaches nobody that, so the sentence underneath is the
 * gloss and is not decoration — it is where the figure acquires its meaning, and it is why
 * the caption can afford to be one word. The old caption said "Not connected", which read
 * as a fault report about a family that had merely not finished typing.
 *
 * ── LEAVES ARE OFFERED AS WORK, NOT AS AN ERROR ────────────────────────────────────
 * Being unattached is the ordinary state of somebody who joined last week, so the row is
 * affirmative green rather than a warning colour and the copy names the next step. A
 * family that reads this as a defect will go looking for a fix that does not exist:
 * connecting people is a judgement about who is related to whom, and nothing should ever
 * guess at it.
 */
export function FamilyTreeCard({ summary, t }: {
  summary: TreeSummary
  /**
   * The reader's language, bound. Threaded from the page rather than resolved here: a
   * Server Component cannot read `LocaleProvider` and has no `user` of its own. See
   * `lib/i18n/server.ts`.
   */
  t: T
}) {
  const { people, generations, leaves } = summary

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 flex items-center gap-2 text-lg">
        <GitBranch className="h-4 w-4 text-brand-accent" aria-hidden="true" />
        {t('dash.tree.title')}
      </h2>

      {/* THE KIT'S OWN ARRANGEMENT: figures down the left, the tree at the right, the
          action across the bottom — `09_PREVIEW/FamilyTreeHighlights.png`.

          The three figures were a row of bordered tiles across the top, matching
          `AtAGlance` next door, and stacking them is what made room for the illustration:
          this card lives in the Dashboard's NARROW column (~21rem at `lg`), and three
          tiles plus a portrait illustration do not both fit in it. The kit stacks them
          bare for the same reason, so following it costs nothing that was chosen. */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <Figure value={generations} label={generations === 1 ? t('dash.tree.generationOne') : t('dash.tree.generationMany')} />
          <Figure value={people} label={people === 1 ? 'Member' : 'Members'} />
          <Figure value={leaves} label={leaves === 1 ? t('dash.tree.leafOne') : t('dash.tree.leavesMany')} />
        </div>

        {/* ── THE ILLUSTRATION ──────────────────────────────────────────────────────
            `alt=""`, because it is decorative in the strict sense: it is the kit's stock
            tree, not a drawing of THIS family, and the three figures beside it plus the
            sentence below carry every fact on the card. Giving it a description would
            have a screen reader announce an image that says nothing.

            DERIVED FROM THE KIT, NOT COPIED FROM IT, and `scripts/kit-illustration.mjs`
            is where that happens and why. The short version: the kit's
            `FamilyTree_Golden_ExactPixelVector.svg` is 10,490 one-pixel `<rect>`s — a
            180x205 bitmap wearing an SVG hat, 608 KB — and its `DirectTrace` sibling is a
            broken trace with severed branches. So the artwork is shipped as the raster it
            actually is, with the cream matte lifted into an alpha channel so it sits on
            the card's own ground in both themes. `npm run art:check` fails if the
            committed file and the kit ever stop agreeing.

            STATICALLY IMPORTED rather than served from `public/`: AGENTS.md keeps that
            directory to three things and puts component imagery beside its component, so
            `next/image` gets the intrinsic size and a bad path fails `next build` instead
            of rendering an empty box.

            `w-24 sm:w-28` and `sizes` name the same widths. The master is 180px wide, so
            the largest of these is still comfortably inside it and the illustration is
            never asked to scale up past its own resolution. */}
        <Image
          src={familyTreeIllustration}
          alt=""
          sizes="(min-width: 640px) 7rem, 6rem"
          className="h-auto w-24 shrink-0 sm:w-28"
        />
      </div>

      {/* THE LEAF LINE IS THE ONE SENTENCE THIS CARD ADDS to the three figures, and it
          does two jobs: it changes with the state rather than restating the number, and it
          is what defines "leaf" for a reader who has never seen the word used this way. */}
      <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
        <Sprout className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-affirm" aria-hidden="true" />
        {people === 0
          ? t('dash.tree.empty')
          : leaves === 0
            ? t('dash.tree.allConnected')
            : leaves === 1
              ? t('dash.tree.oneLeaf')
              : t('dash.tree.manyLeaves', { n: leaves })}
      </p>

      <Link
        href="/community/family-tree"
        className={cn(
          buttonVariants({ size: 'sm', variant: 'secondary' }),
          'mt-4 w-full justify-center',
        )}
      >
        {leaves > 0 ? t('dash.tree.open') : t('dash.tree.view')}
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
 *
 * NO BORDERED WELL ANY MORE. Three tiles in a row could carry one each and share the
 * card's width between them; three stacked down one side of an illustration cannot, and
 * boxing them there draws two columns of frames where the kit draws none.
 */
function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <span className="block text-2xl font-semibold leading-none tabular-nums">{value}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
