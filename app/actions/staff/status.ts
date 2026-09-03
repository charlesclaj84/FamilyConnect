'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/auth/staff'

/**
 * What the platform's scheduled work has actually been doing, for the GENORRA staff console.
 *
 * ── WHY THIS SCREEN EXISTS ─────────────────────────────────────────────────────────
 * Asked for 2026-09-03: *"Need a 'System Status' page that reports various results. Firstly
 * I want to see the last HUD USPS refresh and its result, as well as the last successful
 * one."*
 *
 * Every scheduled job in this product records what it did in a table and reports nothing
 * anywhere. The ZIP crosswalk writes `zip_county_refreshes`, the dunning ladder writes
 * `platform_billing_notices`, the subscription reaper writes
 * `platform_subscription_cancellations` — and the only way to read any of it was a query
 * somebody typed by hand. A row left `failed` had no surface, which TODO.md already
 * recorded as the honest gap for two of those three.
 *
 * ── THE LAST ATTEMPT **AND** THE LAST SUCCESS, WHICH IS THE WHOLE ASK ─────────────
 * Two different questions and the second is the one that matters. `refreshZipCounties`
 * throttles on the last SUCCESS — a week of failures must not stall it forever — so "when
 * did this last work" is what decides whether the data is stale, and "what happened last
 * time" is what says whether it is currently broken. A screen showing only the most recent
 * row answers the second and lets the first go unnoticed for a quarter.
 *
 * ── §3 IS INVERTED HERE, exactly as it is in the rest of `staff/` ─────────────────
 * No `.eq('family_code', …)` anywhere: these tables describe GENORRA's own scheduled work
 * and two of them have no `family_code` at all. `requireStaff()` first in every export is
 * the whole isolation boundary, and adding an export to this file without it is adding an
 * unauthenticated read of the platform's operational state. There is no policy underneath
 * any of it — the service role has none.
 *
 * ── AND A REFUSED READ IS A REFUSAL, NEVER AN EMPTY SECTION (§8) ──────────────────
 * `const { data } = …` discards the error, and on a status page that is the worst possible
 * shape: a refused read renders as "no failures recorded", which is the single most
 * misleading thing this screen could say. Every read here is checked and reports `failed`
 * for its own band, so one broken query cannot make the platform look healthy.
 */

/** One row of a job's history, in the shape every band renders. */
export interface JobRun {
  id: string
  /** `running`, `ok` or `failed` — whatever the job's own table records. */
  state: string
  startedAt: string | null
  finishedAt: string | null
  /** The job's own error text, verbatim. Null on a success. */
  error: string | null
  /** Whatever the job counted, already worded — "54,013 pairs across 41,704 ZIPs". */
  detail: string | null
}

export interface ZipCrosswalkStatus {
  /** The most recent attempt, whatever became of it. */
  latest: JobRun | null
  /**
   * The most recent SUCCESS, which may be the same row as `latest` or much older.
   *
   * Rendered as its own line rather than folded into the one above, because the gap between
   * them is the fact somebody is actually looking for: a failure yesterday over data that
   * last landed in March is a different situation from a failure over data from Tuesday.
   */
  lastSuccess: JobRun | null
  /** How many (zip, county) pairs the table holds right now. */
  pairs: number | null
  /** A read was REFUSED, which is not the same as a job that has never run (§8). */
  failed: boolean
}

export interface SystemStatus {
  zipCrosswalk: ZipCrosswalkStatus
  /** Recent staff plan grants — the console's own audit trail (20260903000004). */
  tierGrants: {
    rows: { familyCode: string; fromTier: string; toTier: string; note: string; forced: boolean; at: string }[]
    failed: boolean
  }
}

/** How many recent grants to show. Enough to see a pattern, few enough to read. */
const GRANT_LIMIT = 20

function runFrom(row: Record<string, unknown> | null | undefined): JobRun | null {
  if (!row) return null
  const pairs = typeof row.pairs === 'number' ? row.pairs : null
  const zips = typeof row.zips === 'number' ? row.zips : null
  return {
    id: String(row.id),
    state: String(row.state ?? 'unknown'),
    startedAt: (row.started_at as string | null) ?? null,
    finishedAt: (row.finished_at as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    // WORDED HERE, where the numbers' meaning is known, rather than in the component. A
    // count of "pairs" and a count of "ZIPs" are different things and a status band that
    // printed two bare integers side by side would invite the reader to average them.
    detail: pairs === null && zips === null
      ? null
      : [
        pairs === null ? null : `${pairs.toLocaleString()} pair(s)`,
        zips === null ? null : `${zips.toLocaleString()} ZIP(s)`,
      ].filter(Boolean).join(' across '),
  }
}

export async function getSystemStatus(): Promise<SystemStatus> {
  await requireStaff()
  const admin = createAdminClient()

  // ── FOUR READS, AND EACH OWNS ITS OWN FAILURE ─────────────────────────────────
  // `Promise.all` rather than sequential, because none depends on another — and the errors
  // are collected per band rather than thrown, so a broken crosswalk read still leaves the
  // grants band true.
  const [latestRes, successRes, pairsRes, grantsRes] = await Promise.all([
    admin.from('zip_county_refreshes')
      .select('id, state, started_at, finished_at, error, pairs, zips')
      .order('started_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('zip_county_refreshes')
      .select('id, state, started_at, finished_at, error, pairs, zips')
      .eq('state', 'ok')
      .order('finished_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('zip_counties').select('zip', { count: 'exact', head: true }),
    admin.from('staff_tier_grants')
      .select('family_code, from_tier, to_tier, note, forced, created_at')
      .order('created_at', { ascending: false }).limit(GRANT_LIMIT),
  ])

  // Every error READ, per §8 — and logged, because a status page whose own reads are being
  // refused is exactly the situation where the log is the only place left to look.
  const zipFailed = Boolean(latestRes.error || successRes.error || pairsRes.error)
  if (latestRes.error) console.error(`[staff/status] zip latest: ${latestRes.error.message}`)
  if (successRes.error) console.error(`[staff/status] zip last success: ${successRes.error.message}`)
  if (pairsRes.error) console.error(`[staff/status] zip pair count: ${pairsRes.error.message}`)
  if (grantsRes.error) console.error(`[staff/status] tier grants: ${grantsRes.error.message}`)

  return {
    zipCrosswalk: {
      latest: runFrom(latestRes.data as Record<string, unknown> | null),
      lastSuccess: runFrom(successRes.data as Record<string, unknown> | null),
      // NULL rather than 0 on a refusal. Zero is a claim about the table and would read as
      // a crosswalk that had never loaded.
      pairs: pairsRes.error ? null : (pairsRes.count ?? 0),
      failed: zipFailed,
    },
    tierGrants: {
      rows: grantsRes.error ? [] : ((grantsRes.data ?? []) as Record<string, unknown>[]).map(r => ({
        familyCode: String(r.family_code),
        fromTier: String(r.from_tier),
        toTier: String(r.to_tier),
        note: String(r.note),
        forced: Boolean(r.forced),
        at: String(r.created_at),
      })),
      failed: Boolean(grantsRes.error),
    },
  }
}
