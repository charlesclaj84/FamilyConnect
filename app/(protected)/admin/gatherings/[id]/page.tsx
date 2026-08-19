import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView, can, canAny } from '@/lib/auth/permissions'
import {
  getAdminGatheringDetail, getGatheringAssignableMembers, getGatheringFundOptions,
} from '@/app/actions/admin/gatherings'
import { getGatheringTemplates } from '@/app/actions/admin/gathering-templates'
import { getSchedulableTemplates } from '@/app/actions/gatherings'
import { AdminGatheringDetailClient } from '@/components/admin/AdminGatheringDetailClient'
import { PageShell } from '@/components/layout/PageShell'

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
 * `/admin/account`. Each destination gates on its OWN key and 404s a caller without it, and both
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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/gatherings')

  const [mayEdit, mayDelete, mayManageBudget, mayViewMemberPage, mayViewAccounting] =
    await Promise.all([
      canAny(user.id, 'admin/gatherings', 'edit'),
      canAny(user.id, 'admin/gatherings', 'delete'),
      canAny(user.id, 'gatherings/budget', 'view'),
      can(user.id, 'gatherings', 'view'),
      can(user.id, 'admin/account', 'view'),
    ])

  const [gathering, members, funds, libraryTemplates, schedulableTemplates] = await Promise.all([
    getAdminGatheringDetail(id),
    mayEdit ? getGatheringAssignableMembers() : [],
    mayManageBudget ? getGatheringFundOptions() : [],
    mayEdit ? getGatheringTemplates() : [],
    mayEdit ? getSchedulableTemplates() : [],
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
      />
    </PageShell>
  )
}
