import { notFound, redirect } from 'next/navigation'
import { canAny, requireView } from '@/lib/auth/permissions'
import { getDuesProjection } from '@/app/actions/dues'
import { PageShell } from '@/components/layout/PageShell'
import {
  DuesProjectionsClient, ProjectionsLegend,
} from '@/components/dues/DuesProjectionsClient'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('page./reporting/dues-projections.title')
}

/**
 * What the family should collect in dues this year, what has come in, and who still owes.
 *
 * ── TWO CHECKS, AND THE SECOND IS NOT BELT-AND-BRACES ───────────────────────────────
 * `requireView` is §1's preamble and does two jobs here — the tier gate (this is a `plus`
 * feature) and the permission gate. But it resolves the permission with `can()`, which is
 * TRUE FOR SCOPE 'own', and there is no own version of a family-wide projection: an
 * own-scoped grant on this key would open a page listing every member's outstanding balance
 * by name.
 *
 * So `canAny` follows it, matching `getDuesProjection()` exactly. Without it the two would
 * disagree and the honest outcome would be the bad one: the page opens and the action hands
 * back null, so a member reads an empty screen instead of a 404 and cannot tell whether the
 * family has collected nothing or whether they were refused.
 *
 * `dues-projections` is in `NO_OWNER_KEYS`, so Members & Access never offers 'own' on it in
 * the first place — this is what makes that a rule rather than a convention, and what holds
 * if a row is ever written by hand.
 *
 * ── WHY IT IS NOT A SECTION OF /admin/account ───────────────────────────────────────
 * That screen is where the money is CONFIGURED — schedules, funds, routing, milestones —
 * and its own copy says so. A projection is neither configuration nor a ledger. It was also
 * deliberately not `/admin/reports`, which sold four things and would then have been live
 * while delivering one — and that route was deleted for that reason on 2026-08-20 rather
 * than eventually made to deliver the other three. See `lib/features.ts`.
 *
 * ── THE FETCH IS GATED, NOT THE RENDER (§5) ─────────────────────────────────────────
 * `getDuesProjection()` re-checks the grant itself and returns `null` rather than a zeroed
 * shape, so a caller who reaches the action directly gets nothing to render. Nothing on this
 * page is fetched and then hidden.
 */
export default async function DuesProjectionsPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'reporting/dues-projections')

  const { t } = await callerI18n(user.id)
  if (!(await canAny(user.id, 'reporting/dues-projections', 'view'))) notFound()

  const result = await getDuesProjection()
  // Unreachable after the two checks above, and handled rather than asserted: the action
  // also returns null when a read fails, and a page that threw on that would replace a
  // recoverable outage with a stack trace.
  if (!result) notFound()

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('page./reporting/dues-projections.title')}</h1>
      </div>

      <ProjectionsLegend />

      <DuesProjectionsClient result={result} />
    </PageShell>
  )
}
