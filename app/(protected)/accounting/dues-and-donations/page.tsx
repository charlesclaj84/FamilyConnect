import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMyDuesSummary, getDonationProgress } from '@/app/actions/dues'
import { getDuesOnlineStatus } from '@/app/actions/pay-dues'
import { DuesAndDonationsShell } from '@/components/account/DuesAndDonationsShell'
import { PageShell } from '@/components/layout/PageShell'
import { resolveMoneyPane } from '@/lib/money-panes'

export const metadata = { title: 'Dues & Donations' }

/**
 * What this member owes, and what their family is inviting them to give to.
 *
 * ── TWO SCREENS UNTIL 2026-08-20, AND ONE KEY SINCE ─────────────────────────────────
 * `/accounting/dues` and `/accounting/donations` were separate routes with separate permission
 * keys, and both are gone: `20260820000009` merged `accounting/dues` and
 * `accounting/donations` into `accounting/dues-and-donations`, carrying every family's grant
 * upward so nobody lost a screen on deploy. That migration is where the argument for one key
 * rather than two panes-with-keys lives; the short version is AGENTS.md's own test — a family
 * could never sensibly grant one and withhold the other, so they were one job.
 *
 * ONE GATE, and no second one inside. `requireView` is the whole check: everything either pane
 * reads is the caller's own, filtered `.eq('person_id', myPersonId)` in the action before RLS
 * is consulted at all. The cadence picker and the opt-out are self-service (`setMyDuesPlan`,
 * `setMyDuesOptOut`, both `requireMember()`), so the resource declares `view` and nothing
 * else — an edit column here would be a switch wired to nothing.
 *
 * NOT A PAGE THAT RESOLVES PANES BY HAND, which is the other shape AGENTS.md describes and the
 * one this deliberately is not. `/admin/members` and `/community/announcements` decompose
 * `requireView` into a union of `can()` calls because any one of several keys is a sufficient
 * reason to be on the screen — and each therefore owes `requireFamilyActive` and `requireTier`
 * BY HAND. There is one key here, so the ordinary `requireView` folds both in and there is
 * nothing to remember.
 *
 * ── BOTH READS ALWAYS HAPPEN, and that is right rather than lazy ────────────────────
 * §5 says gate the FETCH, not the button. There is nothing to gate: one grant admits the whole
 * page, so a caller who reaches this line is entitled to both halves. Skipping the donations
 * read for somebody sitting on the dues pane would only make the first pane switch slower, and
 * both figures are the caller's own.
 */
export default async function DuesAndDonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ pane?: string | string[] }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'accounting/dues-and-donations')

  // Resolved on the server so the first paint is already the right pane — a client-side
  // default followed by a correction is a visible flash of the wrong list. `resolveMoneyPane`
  // takes the raw value including the `string[]` a repeated key yields, and falls back rather
  // than throwing: a hand-typed `?pane=whatever` lands on Dues.
  const { pane: raw } = await searchParams
  const pane = resolveMoneyPane(raw)

  const [summary, donations, online] = await Promise.all([
    getMyDuesSummary(),
    getDonationProgress(),
    // NOT GATED ON A THIRD GRANT. It answers a question about the caller's OWN card
    // arrangements and about a family-wide capability flag, and one `requireView` already
    // admits the whole page — so there is nothing here a reader of this screen is not entitled
    // to. `getDuesOnlineStatus` gates itself on `requireMember()` anyway.
    getDuesOnlineStatus(),
  ])

  return (
    <PageShell className="space-y-8">
      <h1 className="text-3xl font-bold">Dues &amp; Donations</h1>
      <DuesAndDonationsShell
        initialPane={pane}
        summary={summary}
        donations={donations}
        online={online}
      />
    </PageShell>
  )
}
