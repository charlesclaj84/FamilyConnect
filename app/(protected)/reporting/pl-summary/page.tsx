import { notFound, redirect } from 'next/navigation'
import { can, canAny, requireView } from '@/lib/auth/permissions'
import { getFamilyPnL } from '@/app/actions/dues'
import { getFunds } from '@/app/actions/funds'
import { AccountPnLCard } from '@/components/account/AccountPnLCard'
import { FundsSection } from '@/components/account/FundsSection'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('page./reporting/pl-summary.title')
}

/**
 * The family's profit-and-loss statement: what came in, what went out, and what is left.
 *
 * ── CAPTIONED "P&L Summary" SINCE 2026-08-20, WHERE IT WAS "Family Finances" ────────
 * The route and the resource key both stay `family-finances` — that string is wired into
 * `permission_table_map`, into every grant already issued and into `lib/features.ts`, so
 * renaming the path would orphan all of it to retitle a heading. This is the same trade
 * `admin/family` made when it became "Settings" (20260812000001).
 *
 * The caption changed because the rail item moved: this screen sits under **Reporting** now,
 * beside Membership, Payment History, Transactions and Dues Projections, and
 * "Family Finances" beside four other financial readings does not say which one it is. What
 * this page uniquely holds is the STATEMENT — income against expenses, and the bottom line.
 * The permission grid says "P&L Summary" too; the label is the caption the rail prints, and
 * the two are one row in `permission_resources`.
 *
 * ── TWO CHECKS, AND THE SECOND IS NOT BELT-AND-BRACES ───────────────────────────────
 * `requireView` handles the removed-family check, the tier gate and the permission gate —
 * but it resolves the permission with `can()`, which is TRUE FOR SCOPE 'own', and there is
 * no own version of a family-wide statement. A member's own money is /payment-history. So
 * `canAny` follows it, matching `getFamilyPnL()` exactly, and `family-finances` is in
 * `NO_OWNER_KEYS` so the grid never offers the switch either.
 *
 * That action demanded NOTHING BUT A SESSION until 2026-08-20 — see its header. Both halves
 * were fixed together, and this is the half that stops the page opening over a `null`.
 */
export default async function FamilyFinancesPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'reporting/pl-summary')

  const { t, intl } = await callerI18n(user.id)
  if (!(await canAny(user.id, 'reporting/pl-summary', 'view'))) notFound()

  const [pnlData, funds] = await Promise.all([
    getFamilyPnL(),
    getFunds(),
  ])

  // Unreachable after the two checks above, and handled rather than asserted: the action
  // also answers null for a caller with no family, and a page that threw on that would
  // replace a recoverable state with a stack trace.
  if (!pnlData) notFound()

  return (
    <PageShell className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold">{t('page./reporting/pl-summary.title')}</h1>
      </div>

      <section className="space-y-3">
        <AccountPnLCard data={pnlData} intl={intl} t={t} />
      </section>

      <section>
        {/* `admin/account/funds:view`, not `family-finances:edit`. The prop decides one
            thing — whether to offer the Manage Funds link — and that link goes to
            /admin/account?section=funds, so it is that section's grant the question is
            about. Summary passes the same expression; see the prop's own note. */}
        <FundsSection funds={funds} canManage={await can(user.id, 'admin/accounting/funds', 'view')} />
      </section>
    </PageShell>
  )
}
