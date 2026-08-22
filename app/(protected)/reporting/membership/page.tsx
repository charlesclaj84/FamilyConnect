import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAny, requireView } from '@/lib/auth/permissions'
import { getMembershipReport } from '@/app/actions/reports'
import { PageShell } from '@/components/layout/PageShell'
import { MembershipReportView } from '@/components/reports/MembershipReportView'
import type { MembershipRepairRights } from '@/lib/membership-drill'

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
 *
 * ── EVERY SLICE IS A WAY IN, SINCE 2026-08-22, AND NO ROSTER IS SENT WITH IT ───
 * Each legend row opens the people in that slice and offers the one repair the chart is
 * pointing at — file somebody in a chapter, invite a relative nobody has asked, record a
 * birthday. `getMembershipSlice` fetches them WHEN THE ROW IS PRESSED and re-resolves its own
 * two grants, so eight slices on this screen put at most one roster in the browser. That is
 * §5 rather than laziness about payload size: this report's whole privacy story is that it
 * publishes counts and place names and no names at all, and shipping every slice's roster down
 * so a dialog could hide seven of them would undo it in one prop.
 *
 * WHAT THE PAGE RESOLVES IS THE TWO REPAIR GRANTS, and they are TWO because they are two jobs
 * a family may delegate separately: `admin/members:edit` covers filing somebody in a chapter
 * and recording a birthday, and `community/family-tree:edit` covers asking a relative to join.
 * Both are `canAny`, matching the actions exactly — scope 'own' on either would mean the
 * caller's own row, which is not what any of these three writes touches. They decide which
 * control the dialog draws and nothing else; all three actions gate themselves, because a
 * `'use server'` export has a URL whether or not a button exists (§2).
 */
export default async function MembershipReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'membership-report')
  if (!(await canAny(user.id, 'membership-report', 'view'))) notFound()

  // RESOLVED BESIDE THE REPORT rather than after it, so the page costs one round trip's worth
  // of latency for the pair. Neither is a gate; see the header.
  const [report, mayEditMembers, mayInvite] = await Promise.all([
    getMembershipReport(),
    canAny(user.id, 'admin/members', 'edit'),
    canAny(user.id, 'community/family-tree', 'edit'),
  ])
  const rights: MembershipRepairRights = { mayEditMembers, mayInvite }
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
          nothing here is stored. Press any row beside a chart to see who is in it, and to put
          right what it is pointing at.
        </p>
      </div>

      <MembershipReportView report={report} rights={rights} />
    </PageShell>
  )
}
