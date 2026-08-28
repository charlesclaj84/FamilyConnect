import { redirect, notFound } from 'next/navigation'
import { requireView, can, canAny } from '@/lib/auth/permissions'
import { tierAllows } from '@/lib/auth/tier'
import {
  getAdminGatheringDetail, getGatheringAssignableMembers, getGatheringFundOptions,
} from '@/app/actions/admin/gatherings'
import { getGatheringTemplates } from '@/app/actions/admin/gathering-templates'
import { getSchedulableTemplates } from '@/app/actions/gatherings'
import { AdminGatheringDetailClient } from '@/components/admin/AdminGatheringDetailClient'
import { PageShell } from '@/components/layout/PageShell'
import { currentUser } from '@/lib/auth/current-user'

export const metadata = { title: 'Gathering — Admin' }

/**
 * ONE GATHERING, from the organizer's side: its details and status, the fund it draws on and
 * what it budgets, which templates built it, and the task table where the work is handed out
 * and ruled on.
 *
 * ── `notFound()` FOR ANOTHER FAMILY'S ID, AND FOR NO SUCH GATHERING ─────────────────
 * `getAdminGatheringDetail` reads on the service role, so `.eq('id', …)` is not a predicate on
 * its own — it applies `.eq('family_code', …)` beside it and answers null for anything outside
 * the caller's family (§3). Both cases become the same 404 deliberately: distinguishing them
 * would confirm that another family's gathering exists.
 *
 * ── WIDE, NOT `reading` ─────────────────────────────────────────────────────────────
 * The test AGENTS.md sets is not "does this page contain sentences" but whether the CONTENT is
 * one column read start to finish. This is a task table, a budget band and a set of status
 * pills, so it is the default measure — the same call the member-facing `/gatherings/[id]`
 * makes.
 *
 * ── THE ROSTER AND THE FUND BALANCES ARE FETCHED ONLY WHERE THEY CAN BE USED ────────
 * A family roster is PII that reaches the browser in the RSC payload whether the picker renders
 * it or not, so this page asks for it only behind `edit` (§5). Fund balances are behind
 * `gatherings/budget:view`, the key that withholds the money on this page — and
 * `getGatheringFundOptions` gates on that same key itself, so skipping the call is what keeps
 * the two from being able to disagree.
 *
 * **The roster's boundary is the ACTION's, not this page's, and the two now agree.**
 * `getGatheringAssignableMembers` gates itself on `admin/gatherings:edit` — the same scope this
 * call site is behind, and the same one `assignGatheringTask` demands to use the result. That
 * matters because a server action is a public HTTP endpoint (§2) with this page nowhere in its
 * request path: skipping the call here keeps a roster carrying every approved relative's date of
 * birth out of a payload that has no picker to spend it on, and it is the action's own
 * `requireScope` that stops a caller reaching the endpoint directly. This paragraph said the
 * action gated on `view` and that the narrowing was still owed; it landed on 2026-08-19, and the
 * two halves must move together if either ever changes again.
 *
 * The template list is the union of two self-gating reads, for the reason `/admin/gatherings`
 * states in its own header: neither one exactly matches the set `addGatheringTemplate` accepts.
 *
 * ── TWO MORE GRANTS, FOR TWO LINKS THAT LEAVE THIS KEY ──────────────────────────────
 * The **Member view** button goes to `/gatherings/[id]` and the "no fund yet" sentence goes to
 * `/admin/accounting`. Each destination gates on its OWN key and 404s a caller without it, and both
 * splits are ordinary for a family to make — an organizer without the member-facing list, an
 * organizer without Accounting. Resolved from the destinations' keys, with `can` because that is
 * what `requireView` resolves through over there.
 */
export default async function AdminGatheringDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/gatherings')

  // ── THREE OF THESE ANSWERS ARE A GRANT *AND* A PLAN SINCE 2026-08-19 ──────────────
  // `requireView('admin/gatherings')` above resolves the tier for THIS page, which is Free.
  // Three of the things on it are not, and each is its own registry row in `lib/features.ts`
  // rather than a judgement made here:
  //
  //   gatherings/budget            standard — the money band, and the fund picker behind it
  //   admin/gathering-templates    standard — the checklists this gathering can be rebuilt from
  //   admin/account               standard — where the "set up a fund" link goes
  //
  // The last one is the one worth pausing on: it is not a fetch at all, it is a LINK, and a
  // link offered to a family whose plan does not include its destination is a link that
  // bounces off `/upgrade`. Withholding it is the same rule as withholding a fetch, applied to
  // the only thing on this page that has no data behind it.
  const [
    mayEdit, mayDelete, budgetGranted, mayViewMemberPage, accountingGranted,
    budgetInPlan, templatesInPlan, accountingInPlan,
  ] = await Promise.all([
    canAny(user.id, 'admin/gatherings', 'edit'),
    canAny(user.id, 'admin/gatherings', 'delete'),
    canAny(user.id, 'gatherings/budget', 'view'),
    can(user.id, 'gatherings', 'view'),
    can(user.id, 'admin/accounting', 'view'),
    tierAllows(user.id, 'gatherings/budget'),
    tierAllows(user.id, 'admin/gatherings/templates'),
    tierAllows(user.id, 'admin/accounting'),
  ])

  const mayManageBudget = budgetGranted && budgetInPlan
  const mayViewAccounting = accountingGranted && accountingInPlan

  const [gathering, members, funds, libraryTemplates, schedulableTemplates] = await Promise.all([
    getAdminGatheringDetail(id),
    mayEdit ? getGatheringAssignableMembers() : [],
    mayManageBudget ? getGatheringFundOptions() : [],
    mayEdit && templatesInPlan ? getGatheringTemplates() : [],
    mayEdit && templatesInPlan ? getSchedulableTemplates() : [],
  ])

  if (!gathering) notFound()

  const templateOptions = new Map<string, { id: string; name: string; description: string | null }>()
  for (const t of libraryTemplates) {
    if (t.isArchived) continue
    templateOptions.set(t.id, { id: t.id, name: t.name, description: t.description })
  }
  for (const t of schedulableTemplates) {
    templateOptions.set(t.id, { id: t.id, name: t.name, description: t.description })
  }

  return (
    <PageShell className="space-y-8">
      <AdminGatheringDetailClient
        gathering={gathering}
        members={members}
        funds={funds}
        templates={[...templateOptions.values()].sort((a, b) => a.name.localeCompare(b.name))}
        mayEdit={mayEdit}
        mayDelete={mayDelete}
        mayManageBudget={mayManageBudget}
        mayViewMemberPage={mayViewMemberPage}
        mayViewAccounting={mayViewAccounting}
        /* WHETHER THE PLANNING HALF IS IN THE FAMILY'S PLAN AT ALL. `templatesInPlan` already
           withheld the two template FETCHES above, which left this screen rendering a Segments
           panel with nothing addable and a Tasks panel saying "add a template above" —
           instructions for a control that is not there. This flag is what lets the client
           replace both with the one honest sentence. Same key, one question. */
        plansGatherings={templatesInPlan}
      />
    </PageShell>
  )
}
