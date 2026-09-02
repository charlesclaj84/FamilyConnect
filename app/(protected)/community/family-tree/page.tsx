import { redirect } from 'next/navigation'
import { can, canAny, requireView } from '@/lib/auth/permissions'
import { getFamilyTree } from '@/app/actions/family-tree'
import { PageShell } from '@/components/layout/PageShell'
import { FamilyTreeBuilder, TreeLegend } from '@/components/family-tree/FamilyTreeBuilder'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('page./community/family-tree.title')
}

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
 * `/community/directory/family-tree` — the original pedigree view, opened from a Directory row with
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
 * the rail item, and both are gone. Everything TODO.md listed against this feature is now
 * settled: step relationships and several marriages drawn separately were built, the dead
 * `is_step` column was dropped on 2026-08-22 (`20260822000024`), and dates on the connectors
 * were withdrawn rather than deferred — a tree is read for who is related to whom, and a date
 * on every edge is four more numbers per line on a canvas already dense with names.
 *
 * ── THE PERMISSION KEY, AND WHY IT IS ONE AT ALL ────────────────────────────────────
 * `community/family-tree` is a registered resource with a switch on Members & Access, and it
 * was not always. `20260806000006` deliberately left `family-tree` UNREGISTERED — a member's
 * own things are not something a family administers — so it resolved to viewable for every
 * approved member and no family could switch it off.
 *
 * That was right while the key meant "my own line", and it stopped being right when this page
 * turned into a family-wide roster: the same key now governs every `people` row in the family
 * and every relationship between them. `20260819000008` registered it, which is a change to
 * what the key GOVERNS being followed by a change to the key, in that order and deliberately —
 * the decision was recorded and argued before it was taken rather than smuggled in with the
 * feature that made it necessary.
 *
 * The §1 preamble below is the ordinary one now rather than an exception: `requireView` on a
 * real key, and `canAny` for the edit toggle.
 */
export default async function FamilyTreePage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'community/family-tree')

  const { t } = await callerI18n(user.id)

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
  // IT IS RESOLVED HERE RATHER THAN IN THE COMPONENT, which is what made registering
  // `family-tree` as a permission resource a change to THIS LINE and nothing else. The
  // canvas asks a question it does not answer, which is why the answer can move.
  //
  // NOT A GATE. It decides what is offered, not what is permitted: every action re-checks
  // for itself, because this boolean travels in the RSC payload and a caller who edits it
  // has changed a prop rather than a permission.
  //
  // ── IT IS THE GRANT NOW, since 20260819000008 ─────────────────────────────────────
  // It was `isApprovedMember(user.id)` until then, because `family-tree` was an
  // unregistered key and there was no grant to ask about. The comment above predicted
  // this would be "a change to THIS LINE and nothing else", and that was very nearly
  // right: the other half is that the six write actions gate themselves on the same
  // grant, because a page guard is a convenience and a `'use server'` export is a URL.
  //
  // `canAny` and not `can`, matching `requireTreeEditor()` in the action module exactly.
  // The two must agree or the canvas offers an Edit mode whose every write is refused —
  // and an Own grant is precisely the case where `can` and `canAny` disagree.
  //
  // Approved membership is still required and is not dropped: a pending applicant
  // resolves to 'none' on every resource, so `canAny` refuses them on its own.
  const canEdit = await canAny(user.id, 'community/family-tree', 'edit')

  // THERE IS NO BLOODLINE ANCHOR ANY MORE, and so no second grant on this page.
  //
  // `canSetAnchor` resolved `admin/settings:edit` here, on the argument that naming the
  // ancestor a family's line descends from was family-wide configuration rather than a
  // self-service record. `20260902000000` deleted the anchor: the bloodline is
  // `people.is_bloodline`, ticked per person, and `setPersonBloodline` resolves the TREE's
  // own edit grant — `canEdit` above, which the canvas already has.
  //
  // That is a widening and it is the intended one: recording who is in the family's
  // bloodline is the same kind of act as recording who somebody's father is, and both are
  // now the same grant. What it is NOT is self-service — `setPersonBloodline` uses `canAny`,
  // because a member editing their own row is the abuse case when
  // `dues_schedules.bloodline_only` prices against the column.

  // WHETHER A CARD OPENS A PERSON PANEL AT ALL — the Directory's grant, not the tree's.
  //
  // The tree is gated on its own key (above), so a family may show the SHAPE of itself to
  // somebody it has not given the roster to: who is related to whom is what a tree is for.
  // What the panel behind a card adds is the RECORD — names, nickname, birthday, gender,
  // and the invitation control — and that is the Member Directory's question, on the
  // Directory's key. A family that restricted `members` has said the roster is not for
  // everybody, and this is the one surface that would otherwise hand it back a card at a
  // time.
  //
  // `can`, not `canAny`: an Own view grant on `members` is a real grant — it is the RLS
  // predicate that narrows the roster to the caller's own row — so it should open the
  // panel and let the narrowing happen, exactly as the Directory itself does. The tree
  // canvas draws names either way; that is `family-tree:view`'s business and not this
  // boolean's.
  //
  // THE COUPLING IS DELIBERATE AND IS THE ONE AGENTS.md §4 WARNS ABOUT, so it is worth
  // being exact about what is and is not coupled. `belongsToFamily` still uses the service
  // role, so a restricted Directory cannot break a WRITE the tree makes — the hazard that
  // section is about. What is coupled is only whether this one dialog opens.
  const canViewDirectory = await can(user.id, 'community/directory', 'view')

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('page./community/family-tree.title')}</h1>
      </div>

      <TreeLegend />

      {/* NO LINEAGE LINK UNDER THE CANVAS ANY MORE — the page it pointed at is gone, and
          the sentence that offered "one person's line rather than the family's" described
          a distinction that no longer exists. Clicking anybody on the canvas re-centres
          the tree on them, which is what that link was for. */}
      <FamilyTreeBuilder
        tree={tree}
        canEdit={canEdit}
        canViewDirectory={canViewDirectory}
      />
    </PageShell>
  )
}
