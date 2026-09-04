import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { refreshZipCounties } from '@/lib/geo/zip-counties'
import { probeZipCrosswalk } from '@/lib/geo/zip-crosswalk-probe'

/**
 * The daily run that keeps the ZIP-to-county crosswalk current.
 *
 * ── WHY IT IS ITS OWN ROUTE AND NOT A FOURTH JOB ON `/api/billing/notices` ─────────
 * That route already carries three unrelated jobs, and AGENTS.md explains why: it is *"the ONLY
 * place in this product where Node runs on a clock with the service key"*, so things rode
 * together out of necessity. The same section says *"the file's own name is now the weakest
 * thing about it"* — and a crosswalk of postal codes on a route called `billing/notices` is the
 * next turn of that screw.
 *
 * Nothing forces it. Vercel takes several cron entries (Hobby allows two, and this is the
 * second), and the two jobs share nothing: one sends a family's money mail on a strict ordering
 * behind two `pg_cron` sweeps, the other refreshes public government data on no schedule
 * anybody depends on. Putting them in one handler would mean a slow HUD fetch delaying a dues
 * reminder, which is the exact coupling this separation avoids.
 *
 * ── DAILY CRON, WEEKLY REFRESH, QUARTERLY DATA ────────────────────────────────────
 * `lib/geo/zip-counties.ts` argues all three. The one that belongs here: the SCHEDULE is
 * daily because AGENTS.md records that Vercel's Hobby plan permits daily granularity only, and
 * because a `vercel.json` expression cannot say *"the last success was seven days ago"* — so
 * the interval lives in `zip_county_refreshes` instead, where a missed day does not skip a week
 * and the throttle survives the schedule being changed. Most runs answer `not-due` and cost one
 * indexed query.
 *
 * ── THE SAME AUTH AS THE BILLING DRAIN, DELIBERATELY COPIED ───────────────────────
 * `CRON_SECRET` is the variable Vercel Cron sets on its own requests. No secret means the route
 * REFUSES rather than running open — a scheduled job that anybody can trigger is a way to make
 * this product hammer a government API from an arbitrary caller. The length is compared before
 * `timingSafeEqual`, which throws on unequal lengths, and a mismatch answers the same 401 as a
 * wrong secret.
 *
 * ── IT ANSWERS 200 FOR EVERY OUTCOME EXCEPT A REFUSAL, AND THAT IS THE DECISION ───
 * Not the webhook rule. `finish_stripe_event`'s *"a handler that could not do its job must
 * answer 500"* is about a sender that decides whether to REDELIVER — Vercel Cron does not
 * retry, so a 500 here buys nothing and would put a red row in the platform's log every day a
 * token is missing. The outcome is in the BODY and in `zip_county_refreshes`, which is where
 * somebody would look anyway; `skipped`, `not-due`, `ok` and `failed` are four different
 * answers and a status code has room for two.
 *
 * `nodejs` because `@supabase/supabase-js` wants it; `force-dynamic` because a cached response
 * is a refresh that never ran and would look exactly like one that succeeded.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * A HUD fetch of a multi-megabyte document plus eleven batched writes. The default would kill
 * it mid-run, which is survivable — `replace_zip_counties` is atomic per batch — but leaves a
 * `running` row every week and never completes. `AbortSignal.timeout` inside the module is the
 * inner bound; this is the outer one.
 */
export const maxDuration = 300

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  const offered = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (offered.length !== secret.length) return false
  const a = Buffer.from(offered)
  const b = Buffer.from(secret)
  return timingSafeEqual(a, b)
}

async function run(request: NextRequest): Promise<Response> {
  if (!process.env.CRON_SECRET) {
    console.error('[zip-counties] CRON_SECRET is not set; the refresh is refusing to run')
    return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }
  if (!authorized(request)) {
    return Response.json({ error: 'Not authorized' }, { status: 401 })
  }

  // ── `?probe=1` ASKS HUD WHAT EACH CANDIDATE REQUEST RETURNS, AND WRITES NOTHING ──
  // Behind the same secret as the run. It exists because the bulk shape of this API has been
  // guessed from documentation twice and been wrong twice — see `lib/geo/zip-crosswalk-probe.ts`
  // — and a third guess costs another merge, deploy and day. It reports and never decides:
  // having the refresh try candidates until one answered 200 is exactly how a state FIPS
  // ended up in a column named `county_fips`.
  //
  // SCAFFOLDING FOR A QUESTION. When the working combination is known it becomes the request
  // in `zip-counties.ts` and this branch goes with the module.
  if (new URL(request.url).searchParams.get('probe') === '1') {
    const probe = await probeZipCrosswalk()
    console.log(`[zip-counties] probe: ${JSON.stringify(probe)}`)
    return Response.json(probe)
  }

  // `?force=1` SKIPS THE WEEKLY THROTTLE AND NOTHING ELSE. It is behind the same secret as the
  // run itself, and it is here because the alternative — waiting up to seven days to see
  // whether a newly-set token works — is how a credential gets set and then forgotten about.
  const force = new URL(request.url).searchParams.get('force') === '1'

  try {
    const result = await refreshZipCounties({ force })
    // LOGGED AT EVERY OUTCOME, because the platform's log is the only place a daily run is
    // visible without opening the database, and `not-due` is the answer that proves the job
    // is alive.
    console.log(`[zip-counties] ${result.outcome}${result.detail ? `: ${result.detail}` : ''}`)
    return Response.json(result)
  } catch (e) {
    // `refreshZipCounties` returns rather than throws, so this is a genuine surprise — a
    // client that would not construct, a JSON body larger than the runtime will hold. Reported
    // as a 500 because there is nothing in the refresh log to read either.
    console.error(`[zip-counties] refresh threw: ${e instanceof Error ? e.message : e}`)
    return Response.json({ error: 'refresh failed' }, { status: 500 })
  }
}

/** Vercel Cron issues a GET. */
export async function GET(request: NextRequest): Promise<Response> {
  return run(request)
}

/** And a POST, so the job can be driven by hand the way the billing drain can. */
export async function POST(request: NextRequest): Promise<Response> {
  return run(request)
}
