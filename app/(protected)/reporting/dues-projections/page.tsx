import { notFound, redirect } from 'next/navigation'
import { canAny, requireView } from '@/lib/auth/permissions'
import { tierAllows } from '@/lib/auth/tier'
import { getDuesProjection, getReminderReport } from '@/app/actions/dues'
import { ReminderOutcomes } from '@/components/dues/ReminderOutcomes'
import { resolveZone } from '@/lib/auth/zone'
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
 *
 * ── AND THE REMINDER BAND IS A THIRD GATE, BY HAND, FOR TWO REASONS ────────────────
 * Added 2026-09-03. It is the only thing on this page not covered by the two checks above, and
 * it needs a different answer to both of them:
 *
 *   THE TIER. Automatic dues reminders are PREMIUM and this page is `plus`. `requireTier` —
 *   folded into `requireView` — resolves the PAGE's own key and cannot see a band, so
 *   `/reporting/dues-projections/reminders` carries the tier as a `FEATURES` row and
 *   `tierAllows()` is asked for it here. That row's comment in `lib/features.ts` carries the
 *   whole device.
 *
 *   THE GRANT. `permission_table_map` keys `dues_reminders` on `admin/accounting`, not on this
 *   page's key, so the composed SELECT policy answers to that grant and this is checked
 *   against the same one. Resolving on `reporting/dues-projections` instead would render a
 *   band the policy then answers `[]` to — §8's silent empty with an extra step. A projections
 *   reader without the Accounting grant gets no band, which is right: how the family chases
 *   its money is a treasurer's business.
 *
 * BOTH ARE RESOLVED BEFORE THE FETCH and the fetch is skipped rather than the band hidden,
 * because a delivery report names every relative the family cannot reach by email — see §5.
 */
export default async function DuesProjectionsPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'reporting/dues-projections')

  const { t } = await callerI18n(user.id)
  if (!(await canAny(user.id, 'reporting/dues-projections', 'view'))) notFound()

  // ── RESOLVED FIRST, THEN THE FETCH IS SKIPPED (§5) ──────────────────────────────
  // `tierAllows` and `canAny` in parallel with the projection itself, because neither depends
  // on it. `getReminderReport` re-resolves the grant too — it is a `'use server'` export and
  // therefore a URL (§2) — so this decides whether to ASK, not whether the answer is allowed.
  const [maySeeReminders, result] = await Promise.all([
    Promise.all([
      tierAllows(user.id, '/reporting/dues-projections/reminders'),
      canAny(user.id, 'admin/accounting', 'view'),
    ]).then(([tier, grant]) => tier && grant),
    getDuesProjection(),
  ])
  // Unreachable after the two checks above, and handled rather than asserted: the action
  // also returns null when a read fails, and a page that threw on that would replace a
  // recoverable outage with a stack trace.
  if (!result) notFound()

  // AFTER the `notFound()`, so a caller who cannot read the projection is never asked about
  // the reminders either — and sequential rather than in the `Promise.all` above, because it
  // is only ever reached for somebody entitled to the whole page.
  const [reminders, zone] = maySeeReminders
    ? await Promise.all([getReminderReport(), resolveZone(user.id)])
    : [null, 'UTC']

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('page./reporting/dues-projections.title')}</h1>
      </div>

      <ProjectionsLegend />

      {/* ── THE BAND ABOVE THE FIGURES, AND THAT ORDER IS THE DECISION ───────────────
          A treasurer opening this page to ask why nobody has paid needs to know whether
          anybody was ASKED before they read a column of outstanding balances. Below the
          tables it is a band nobody scrolls to on a screen whose whole content is figures —
          the same judgement that put the Gallery's search on the rail rather than under the
          albums.

          `reminders === null` IS A REFUSAL AND RENDERS NOTHING, deliberately distinct from
          the "none queued yet" state the band draws for itself: the first is about the
          reader, the second about the family, and a refusal dressed as an empty queue would
          tell a treasurer their reminders are not running. */}
      {reminders && <ReminderOutcomes report={reminders} zone={zone} t={t} />}

      <DuesProjectionsClient result={result} />
    </PageShell>
  )
}
