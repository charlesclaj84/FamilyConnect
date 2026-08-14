import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { isApprovedMember } from '@/lib/auth/family'
import { getFamilyTree } from '@/app/actions/family-tree'
import { PageShell } from '@/components/layout/PageShell'
import { FamilyTreeBuilder, TreeLegend } from '@/components/family-tree/FamilyTreeBuilder'

export const metadata = { title: 'Family Tree' }

/**
 * The family-wide tree — Community > Family Tree, and the only tree in the product.
 *
 * ── WHAT CHANGED ON 2026-08-13 ──────────────────────────────────────────────────────
 * This page was a beta NOTICE: a heading, a paragraph explaining that the tree was being
 * rebuilt, and a static sketch of the layout it was heading for. It fetched nothing,
 * deliberately, because §5 is the reason not to fetch a roster "ready for" a build.
 *
 * It is now the tree. It fetches, it writes, and the reason the old comment's caution no
 * longer applies is that the roster is what this page is FOR rather than what it might
 * one day want.
 *
 * ── THE PER-MEMBER LINEAGE VIEW IS GONE, and this is what replaced it ───────────────
 * `/members/family-tree` — the original pedigree view, opened from a Directory row with
 * `?view=` — has been deleted, along with `FamilyTreeClient`, `app/actions/ancestors.ts`
 * and `app/actions/spouse.ts`. FutureFeature.md decision 5 asked whether it retires when
 * the real tree lands or stays as a per-person drill-down; this is that decision, made.
 *
 * IT COST NOTHING IN DATA, which is why it could be a deletion rather than a migration.
 * Both surfaces were always two readers of `person_relationships`, so every row the
 * lineage view ever wrote is on this canvas already. What it offered that this does not
 * is the *directional* walk — and this tree answers the same question by re-focusing on
 * anybody you click, which is the same drill-down without a second page, a second
 * vocabulary of relationship types, or a second set of writes that could disagree.
 *
 * The retired actions are not merely unreferenced, they are DELETED, and that matters
 * beyond tidiness: every export of a `'use server'` file is a public HTTP endpoint, so a
 * page nobody links to is not the same as an action nobody can call. `upsertSpouse` and
 * `upsertAncestor` — both named in AGENTS.md §4 as having shipped without their
 * `belongsToFamily` check — went with them.
 *
 * ── NO BETA BADGE, since 2026-08-13 ─────────────────────────────────────────────────
 * It came off with this pass. `lib/features.ts` never derived it — `status` has two values
 * and "live but unfinished" is a property of one of them — so it was hand-set here and on
 * the rail item, and both are gone. What TODO.md still lists for a second pass (step
 * relationships, several marriages drawn separately, dates on the connectors) is now an
 * ordinary backlog against a finished feature rather than a caveat on a half-built one.
 *
 * ── THE PERMISSION KEY ──────────────────────────────────────────────────────────────
 * `family-tree`, which 20260806000006 deliberately left unregistered — a member's own
 * things are not something a family administers — so it resolves to viewable for every
 * approved member and cannot be switched off. That was the right call while the key meant
 * "my own line". This page makes it a family-wide roster, which is a change in what the
 * key governs rather than a change in the key, and it is recorded in TODO.md as a decision
 * to make rather than quietly made here. The §1 preamble is still owed and still present:
 * it is what stops this page being the exception that teaches the next one to skip it.
 */
export default async function FamilyTreePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'family-tree')

  // Gated INSIDE the action on the same key, because a `'use server'` export has a URL of
  // its own and the page in front of it is a convenience rather than a gate.
  const tree = await getFamilyTree()

  // WHO MAY EDIT THE TREE, resolved server-side and handed down as one boolean.
  //
  // Today it is "an approved member of this family", which is exactly what every write
  // action behind the canvas already demands (`requireMember()`), so the toggle appears
  // for precisely the people whose edits would in fact succeed. A pending applicant reads
  // the tree and is refused every write, and now sees no edit affordance to be refused at.
  //
  // IT IS RESOLVED HERE RATHER THAN IN THE COMPONENT so that registering `family-tree` as
  // a permission resource — the open decision in TODO.md, which this feature is the second
  // half of — is a change to THIS LINE and nothing else. The canvas already asks a
  // question it does not answer.
  //
  // NOT A GATE. It decides what is offered, not what is permitted: every action re-checks
  // for itself, because this boolean travels in the RSC payload and a caller who edits it
  // has changed a prop rather than a permission.
  const canEdit = await isApprovedMember(user.id)

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold">Family Tree</h1>
        <p className="text-muted-foreground">
          One tree for the whole family. Start from anybody, fill in the gaps around them,
          and click a relative to carry on from there.
        </p>
      </div>

      <TreeLegend />

      {/* NO LINEAGE LINK UNDER THE CANVAS ANY MORE — the page it pointed at is gone, and
          the sentence that offered "one person's line rather than the family's" described
          a distinction that no longer exists. Clicking anybody on the canvas re-centres
          the tree on them, which is what that link was for. */}
      <FamilyTreeBuilder tree={tree} canEdit={canEdit} />
    </PageShell>
  )
}
