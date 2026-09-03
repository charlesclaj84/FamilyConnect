import { AlertTriangle, CheckCircle2, Clock, Database, Loader2, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatInstant } from '@/lib/tz'
import type { SystemStatus, JobRun } from '@/app/actions/staff/status'
import { type T } from '@/lib/i18n/t'
import { cn } from '@/lib/utils'

/**
 * What the platform's scheduled work has been doing, as bands.
 *
 * ── NO HOOKS AND NO HANDLERS, WHICH IS WHAT KEEPS IT OFF THE CLIENT ───────────────
 * `t` is a PROP and not `useT()`. This is rendered only by a Server Component, and
 * AGENTS.md's rule is that a component reachable from the server side takes the translator
 * rather than reaching for the hook — a `useT()` here would make the module a client
 * reference and throw at render, which is the defect that shipped on ten components at once
 * and reached production on two.
 *
 * ── EVERY TIME IS SHOWN IN UTC, DELIBERATELY, AND IT SAYS SO ──────────────────────
 * Every cron in this product is scheduled in UTC — 00:05, 00:20, 00:40, 03:00 — so a status
 * page that rendered those runs in a viewer's own zone would put a job that fires at
 * midnight on the previous day for anybody west of Greenwich, and two staff members
 * comparing notes would disagree about which night a failure happened on. `formatInstant`
 * takes the zone explicitly for exactly this reason; `'UTC'` is passed and the label is
 * printed beside the figure so nobody has to guess.
 *
 * This is the one place in the product where UTC is the right answer rather than the
 * reader's zone. A member-facing screen must never do this — see `lib/tz.ts`.
 *
 * ── A REFUSED READ IS SAID OUT LOUD (§8) ──────────────────────────────────────────
 * The worst thing a status page can do is render "nothing has failed" over a read that was
 * refused. Each band takes its own `failed` flag and says so in place of its figures,
 * because a page that is confidently blank is worse than one admitting it cannot see.
 */
export function StaffStatusPanels({ status, t }: { status: SystemStatus; t: T }) {
  return (
    <div className="space-y-6">
      <ZipCrosswalkPanel status={status.zipCrosswalk} t={t} />
      <TierGrantsPanel grants={status.tierGrants} t={t} />
    </div>
  )
}

/**
 * The state marker for one job run.
 *
 * ── `--brand-withheld` FOR A FAILURE, NOT `--destructive` ─────────────────────────
 * This is the one call here that could plausibly go either way, and AGENTS.md settles it:
 * `--destructive` is for *reporting a failure to the person who caused it* — a refused save,
 * a deletion — and `form-message.tsx` owns that job. A cron that did not work is a thing the
 * platform has not done yet, which is precisely the withheld role, and it is the same
 * reading the reports take of an overdue task and a vacant office.
 *
 * A `running` row is neither: it is the shape of a job that died mid-flight OR one that is
 * running right now, and those are indistinguishable from a table. Muted, and the timestamp
 * beside it is what tells them apart.
 */
function StateChip({ state, t }: { state: string; t: T }) {
  const label = state === 'ok' ? t('stf.jobOk')
    : state === 'failed' ? t('stf.jobFailed')
      : state === 'running' ? t('stf.jobRunning')
        : state
  const Icon = state === 'ok' ? CheckCircle2 : state === 'failed' ? AlertTriangle : Loader2
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
      state === 'ok' && 'border-brand-affirm/40 text-brand-affirm',
      state === 'failed' && 'border-brand-withheld/40 text-brand-withheld',
      state !== 'ok' && state !== 'failed' && 'border-border text-muted-foreground',
    )}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  )
}

/** One run, as a labelled line. `null` renders the never-run case, which is not a failure. */
function RunLine({ label, run, t }: { label: string; run: JobRun | null; t: T }) {
  if (!run) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {/* NEVER RUN IS NOT A FAILURE, and the wording has to keep them apart: the crosswalk
            needs a credential this repo cannot supply, so "no record" is the expected state
            until somebody sets it rather than a fault to chase. */}
        <p className="text-sm text-muted-foreground">{t('stf.jobNever')}</p>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <StateChip state={run.state} t={t} />
        <span className="text-sm">
          {/* UTC, said out loud — see the module header. */}
          {formatInstant(run.finishedAt ?? run.startedAt, 'UTC')} {t('stf.utc')}
        </span>
      </div>
      {run.detail && <p className="text-xs text-muted-foreground">{run.detail}</p>}
      {/* THE JOB'S OWN ERROR TEXT, VERBATIM AND NOT TRUNCATED. It is the whole value of this
          screen: `HUD answered 401` and "below the 20000 floor" are different problems with
          different fixes, and a summarised message would collapse them. `break-words`
          because these carry URLs and long identifiers. */}
      {run.error && (
        <p className="break-words text-xs text-brand-withheld">{run.error}</p>
      )}
    </div>
  )
}

function ZipCrosswalkPanel({ status, t }: { status: SystemStatus['zipCrosswalk']; t: T }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4 text-primary" />
          {t('stf.zipTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{t('stf.zipBlurb')}</p>
        {status.failed ? (
          /* §8. The figures are WITHHELD rather than shown as zero: a crosswalk reporting
             "0 pairs, never run" over a refused read is the most misleading thing this
             screen could say, because it is exactly what a broken deployment looks like. */
          <p role="alert" className="text-sm text-brand-withheld">{t('stf.readRefused')}</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* BOTH, AND THEY ARE OFTEN DIFFERENT ROWS — the whole of what was asked for.
                  The refresh throttles on the last SUCCESS, so that line is what says whether
                  the data is stale; the latest attempt is what says whether it is broken
                  now. One without the other hides a quarter of failures. */}
              <RunLine label={t('stf.zipLatest')} run={status.latest} t={t} />
              <RunLine label={t('stf.zipLastOk')} run={status.lastSuccess} t={t} />
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">{t('stf.zipPairs')}</p>
              <p className="text-2xl font-semibold">
                {status.pairs === null ? '—' : status.pairs.toLocaleString()}
              </p>
              {/* AN EMPTY TABLE IS EXPECTED UNTIL THE CREDENTIAL EXISTS, and saying so here
                  is what stops somebody treating it as an incident. It is the same sentence
                  `audit_global_lookups.sql` carries on its `allowed_empty` entry. */}
              {status.pairs === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{t('stf.zipEmpty')}</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TierGrantsPanel({ grants, t }: { grants: SystemStatus['tierGrants']; t: T }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          {t('stf.grantsTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('stf.grantsBlurb')}</p>
        {grants.failed ? (
          <p role="alert" className="text-sm text-brand-withheld">{t('stf.readRefused')}</p>
        ) : grants.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('stf.grantsNone')}</p>
        ) : (
          <ul className="divide-y">
            {grants.rows.map((g, i) => (
              <li key={`${g.familyCode}-${g.at}-${i}`} className="py-2 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-mono text-sm font-medium">{g.familyCode}</span>
                  <span className="text-sm text-muted-foreground">
                    {g.fromTier} &rarr; {g.toTier}
                  </span>
                  {/* FORCED IS MARKED. A grant that overrode the billing-state refusal is the
                      one that might still be undone by a sweep, so it is the one worth
                      spotting in a list. */}
                  {g.forced && (
                    <span className="inline-flex items-center gap-1 text-xs text-brand-withheld">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {t('stf.grantForced')}
                    </span>
                  )}
                  <span className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {formatInstant(g.at, 'UTC')} {t('stf.utc')}
                  </span>
                </div>
                {/* THE REASON, which is the only thing that makes the row an audit record
                    rather than a log line. Never truncated. */}
                <p className="mt-0.5 break-words text-xs text-muted-foreground">{g.note}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
