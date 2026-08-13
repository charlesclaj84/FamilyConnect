import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GitBranch } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { PageShell } from '@/components/layout/PageShell'
import { BetaBadge } from '@/components/ui/beta-badge'
import { Button } from '@/components/ui/button'
import { PedigreePreview } from '@/components/family-tree/PedigreePreview'

export const metadata = { title: 'Family Tree' }

/**
 * The new family-wide tree, being rebuilt — Community > Family Tree.
 *
 * WHAT THIS IS AND IS NOT. The per-member lineage view still exists and is unchanged; it
 * moved to `/members/family-tree`, under the Directory, because that is what it has always
 * been in practice — the tree of ONE person, opened from a row and walked outwards with
 * `?view=`. This route is the family-wide tree being built to replace it, and it is
 * deliberately live and empty rather than gated: a member who clicks Family Tree should
 * find out where the work stands, not meet the Coming Soon wall for a thing whose nav item
 * they can see.
 *
 * SO IT IS `status: 'live'` IN THE REGISTRY WITH NOTHING BEHIND IT, which is the one shape
 * `lib/features.ts` cannot describe on its own — the registry has two states and this is a
 * property of a live one. `BetaBadge` is what carries it, on this heading and on the rail
 * item, and neither is derived from anything. When the real tree lands here, both come off
 * by hand.
 *
 * IT FETCHES NOTHING, and that is not laziness — there is nothing to show yet, and §5 of
 * AGENTS.md is the reason not to fetch a roster "ready for" the build: props are serialized
 * into the RSC payload whether a component renders them or not, so a page that fetches the
 * family and draws a mock-up has published the family. The gate above is still owed and
 * still here: §1 admits no exception for a page with no query, and skipping it would leave
 * the one thing a later edit is most likely to forget to add.
 */
export default async function FamilyTreeBetaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // `family-tree` has no `permission_resources` row on purpose — 20260806000006 made a
  // member's own things unrestrictable — so this resolves to viewable for everybody. It is
  // the §1 preamble rather than a switch anybody can turn off, and it is what stops this
  // page being the exception that teaches the next one to skip it.
  await requireView(user.id, 'family-tree')

  return (
    <PageShell className="space-y-8">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2.5">
          <h1 className="text-3xl font-bold">Family Tree</h1>
          <BetaBadge />
        </div>
        <p className="text-muted-foreground">
          A tree of the whole family, being rebuilt from the ground up.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <span className="inline-flex w-fit rounded-xl bg-brand-soft p-2.5">
            <GitBranch className="h-6 w-6 text-brand-on-soft" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-3">
            <h2 className="text-xl">This page is not finished yet</h2>
            <p className="leading-relaxed text-muted-foreground">
              What is coming here is one tree for the entire family — every household on the
              same canvas, rather than one person&apos;s line at a time. It is being built
              differently from the view it replaces, so it is starting from nothing rather
              than growing out of that one.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Nothing has been taken away in the meantime. The lineage view you have been
              using is unchanged, and it now lives with the Directory — pick anybody in the
              family and walk their parents, children and spouses from there.
            </p>
            <Link href="/members/family-tree" className="inline-block">
              <Button variant="outline">Open the lineage view</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl">The shape it is heading for</h2>
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          A sketch of the layout, not your family — the cards below are labelled with
          relationships because there is no data behind them yet, and none of them does
          anything when clicked.
        </p>
        <div className="rounded-xl border bg-brand-soft/30 p-4 sm:p-6">
          <PedigreePreview />
        </div>
      </div>
    </PageShell>
  )
}
