import { requireStaff } from '@/lib/auth/staff'
import { getSystemStatus } from '@/app/actions/staff/status'
import { StaffStatusPanels } from '@/components/staff/StaffStatusPanels'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('page./staff/status.title')
}

/**
 * What the platform's scheduled work has actually been doing.
 *
 * ── WHY IT IS A SCREEN AND NOT A LOG LINE ──────────────────────────────────────────
 * Asked for 2026-09-03, starting with the HUD USPS crosswalk: *"I want to see the last
 * refresh and its result, as well as the last successful one."*
 *
 * Every scheduled job in this product records what it did in a table and surfaces none of
 * it. A `failed` row had no reader at all — TODO.md says so in as many words about the
 * subscription reaper, *"visible only in a log line"* — and a job that fails silently for a
 * quarter is indistinguishable from one that is working.
 *
 * ── THE GUARD, AGAIN, AND FOR THE THIRD TIME ───────────────────────────────────────
 * `requireStaff()` here as well as in the layout and again inside `getSystemStatus`.
 * AGENTS.md §1 and §2 are the same argument twice over: the layout is not in the request
 * path of a server action, and neither is this page. Each gates itself, and the reads are
 * memoized so the three calls cost one query.
 *
 * It 404s rather than showing a refusal, like every other page under `app/(staff)` — a
 * staff console should not advertise that it exists.
 *
 * ── §5: THE FETCH IS BEHIND THE SAME GATE AS THE SCREEN ────────────────────────────
 * Props are serialized into the RSC payload whether a component renders them or not, so
 * fetching the platform's operational state and letting the client decide what to show
 * would have published it. One fetch, behind the guard, and the client component below
 * renders exactly what it is handed.
 *
 * ── NO `permission_resources` ROW, AND NONE MAY BE ADDED ───────────────────────────
 * Staffness is orthogonal to the family permission model, and a row on that grid would tell
 * a family's own administrator the console exists. Same reasoning as every other route
 * here — `lib/auth/staff.ts` carries it.
 */
export default async function StaffStatusPage() {
  await requireStaff()
  const { t } = await callerI18n(null)
  const status = await getSystemStatus()

  return (
    <PageShell className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t('page./staff/status.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('stf.statusBlurb')}</p>
      </div>
      <StaffStatusPanels status={status} t={t} />
    </PageShell>
  )
}
