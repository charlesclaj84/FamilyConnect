import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMyDuesSummary } from '@/app/actions/dues'
import { DuesPlanSection } from '@/components/account/DuesPlanSection'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Dues' }

/**
 * What this member owes, on what plan, and when the next installment falls.
 *
 * A PANE OF /account-summary UNTIL 20260815000000, and a screen since. The permission
 * key moved with the route — `account-summary/dues` became `dues` — because AGENTS.md
 * §1 gives no choice about that: the key is the route without its leading slash, and a
 * nav item whose href and key disagree cannot be hidden by the switch that appears to
 * hide it. The migration copies every family's existing pane grant onto the new key, so
 * nobody's access changed on deploy.
 *
 * ONE GATE, and no second one inside. `requireView` is the whole check: everything this
 * screen reads is the caller's own, filtered `.eq('person_id', myPersonId)` in
 * getMyDuesSummary() before RLS is consulted at all. The cadence picker and the opt-out
 * are self-service (setMyDuesPlan / setMyDuesOptOut, both `requireMember()`), so the
 * resource declares `view` and nothing else — an edit column here would be a switch
 * wired to nothing.
 */
export default async function DuesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'accounting/dues')

  const summary = await getMyDuesSummary()

  return (
    <PageShell className="space-y-8">
      <h1 className="text-3xl font-bold">Dues</h1>
      <DuesPlanSection summary={summary} />
    </PageShell>
  )
}
