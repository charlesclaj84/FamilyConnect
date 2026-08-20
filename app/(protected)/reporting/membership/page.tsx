import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAny, requireView } from '@/lib/auth/permissions'
import { getMembershipReport } from '@/app/actions/reports'
import { PageShell } from '@/components/layout/PageShell'
import { MembershipReportView } from '@/components/reports/MembershipReportView'

export const metadata = { title: 'Membership' }

/**
 * Who the family is made up of — nationally, by region, by chapter, by whether each person
 * has finished joining, and by adult against minor.
 *
 * ── TWO CHECKS, AND THE SECOND IS NOT BELT-AND-BRACES ───────────────────────────────
 * `requireView` is §1's preamble and does three jobs: the removed-family check, the tier
 * gate (this is a `plus` feature) and the permission gate. But it resolves the permission
 * with `can()`, which is TRUE FOR SCOPE 'own', and there is no own version of a family-wide
 * count. So `canAny` follows it, matching `getMembershipReport()` exactly.
 *
 * Without it the two would disagree and the honest outcome would be the bad one: the page
 * opens and the action hands back null, so a reader gets an empty screen instead of a 404
 * and cannot tell whether their family has no members or whether they were refused. This is
 * the pattern `/reporting/dues-projections` established, and the reason
 * `reporting/membership` is in `NO_OWNER_KEYS`.
 *
 * ── IT REPLACED `/admin/reports`, AND IS NOT A RENAME OF IT ─────────────────────────
 * That page sold four things and delivered a mixture — a member count, a gathering count,
 * dues collected, t-shirt sizes and the last twenty money entries — which is a dashboard
 * rather than a report, and every money figure on it duplicated a screen that owns it
 * (`/reporting/pl-summary` for the statement, `/reporting/transactions` for the ledger,
 * `/reporting/dues-projections` for what is outstanding). What it did NOT answer was the
 * question an organizer actually brings to a report: where are our people, and how many of
 * them can we reach. This does
 * that and nothing else, which is why it is a member-facing `community` resource under
 * Reporting rather than an admin tool.
 *
 * ── THE FETCH IS GATED, NOT THE RENDER (§5) ─────────────────────────────────────────
 * `getMembershipReport()` re-checks the grant itself and returns `null` rather than a zeroed
 * shape, so a caller who reaches the action directly gets nothing to render. Nothing on this
 * page is fetched and then hidden.
 */
export default async function MembershipReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'membership-report')
  if (!(await canAny(user.id, 'membership-report', 'view'))) notFound()

  const report = await getMembershipReport()
  // Unreachable after the two checks above, and handled rather than asserted: the action
  // also returns null when a read fails, and a page that threw on that would replace a
  // recoverable outage with a stack trace.
  if (!report) notFound()

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold">Membership</h1>
        <p className="text-muted-foreground">
          How the family is made up today — where its members are, how many have finished
          joining, and how many are children. Every figure is worked out when the page loads;
          nothing here is stored.
        </p>
      </div>

      <MembershipReportView report={report} />
    </PageShell>
  )
}
