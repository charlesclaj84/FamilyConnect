import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { rowsFrom, type CrosswalkRow } from '@/lib/geo/zip-crosswalk-rows'

/**
 * Refreshing the ZIP-to-county crosswalk from the HUD USPS file.
 *
 * ── WHY IT IS IN NODE AND NOT IN `pg_cron` ─────────────────────────────────────────
 * The precedent is the billing ladder's and TODO.md states it as a rule rather than a
 * preference: **`pg_cron` owns the STATE and Node owns the NETWORK.** `pg_net` and `http` are
 * both AVAILABLE on this project and neither is installed, deliberately — an outbound HTTP call
 * inside a transaction is not a thing to add casually, and *"the job needs the network"* is not
 * on its own a sufficient argument for the extension.
 *
 * That reasoning applies here more strongly than it did to the ladder, not less. This job
 * fetches a multi-megabyte JSON document, reshapes it and writes it in batches; `http` is
 * synchronous and would hold a database connection for the whole fetch, and `pg_net` is
 * fire-and-forget so the body would have to be collected on a second pass. Neither is an
 * improvement on `fetch` in a route.
 *
 * ── THE SOURCE, AND THE CREDENTIAL NOBODY IN THIS REPO CAN SUPPLY ──────────────────
 * `https://www.huduser.gov/hudapi/public/usps?type=2&query=<2-letter state>` — `type=2` is
 * ZIP→County. HUD builds it from USPS delivery data and publishes it QUARTERLY. It needs a
 * free API token from a huduser.gov registration, in `HUD_USPS_API_TOKEN`.
 *
 * **NOT `query=All`, AND NOT A FIPS CODE** — `STATE_CODES` below records what each of those
 * returned, because both looked right and neither was.
 *
 * **WITH NO TOKEN THIS RETURNS `skipped`, NOT AN ERROR.** A missing credential is a deployment
 * state rather than a fault, and the daily route it rides on carries three other jobs — one
 * of which sends a family's dues reminders. A throw here would take those down over a
 * crosswalk nothing reads yet. `sendEmail`'s "fails soft" reasoning, applied to a fetch.
 *
 * ── QUARTERLY DATA, A WEEKLY REFRESH, A DAILY CRON ────────────────────────────────
 * Three different numbers and each is forced by something:
 *
 *   THE DATA is quarterly. HUD republishes four times a year.
 *   THE REFRESH is weekly, so a new quarter is picked up within seven days. Polling daily
 *     would fetch an identical multi-megabyte document about ninety times per quarter.
 *   THE CRON is daily, because it has to be: AGENTS.md records that Vercel's Hobby plan
 *     permits daily granularity ONLY and rejects a finer expression at deploy time — and a
 *     weekly one is not finer, but `vercel.json` is where the schedule lives and a cron
 *     expression there cannot express "the last success was seven days ago".
 *
 * SO THE THROTTLE IS IN THE DATA, not in the schedule, and that is the better place for it:
 * a missed day does not skip a week, and the interval survives a cron being rescheduled. The
 * same shape as `cycle_on` on a dunning notice — the idempotency lives in a row rather than in
 * a clock.
 *
 * ── AND THE DANGEROUS OPERATION IS A DELETE, WHICH IS WHY IT IS SQL'S JOB ──────────
 * `replace_zip_counties` replaces the rows for exactly the ZIPs in each batch and leaves every
 * other ZIP alone, in one statement. So a fetch that returns half a file refreshes half the
 * ZIPs and destroys nothing; there is no sequence of failures that empties the table. That
 * function's own header argues it against the two alternatives, and the storage reaper's rule
 * is the one it follows — *a truncated read treated as complete becomes a delete list.*
 *
 * Nothing in THIS module deletes anything.
 *
 * ── THE PARSING IS NEXT DOOR, AND `server-only` IS WHY ────────────────────────────
 * `rowsFrom` lives in `lib/geo/zip-crosswalk-rows.ts` — a pure module with no imports at
 * all — because this one opens with `import 'server-only'` and is therefore out of
 * `npm test`'s reach. `vitest.config.mts`' `lib/**` include is a stated BOUNDARY (§7b) and
 * stubbing `server-only` to get around it would let every server module load in the runner
 * that exists to keep them out. The refusal rules are the part worth testing and they are
 * the part that moved.
 */

/** The one source. Named on every refresh row so a row is readable years later. */
const SOURCE = 'hud-usps-zip-county'

/**
 * ── THE CROSSWALK IS FETCHED PER STATE, AND THE QUERY IS AN ABBREVIATION ──────────
 * Two measurements got this here, and both are worth keeping because each ruled something
 * out that looked right:
 *
 *   `type=2&query=All`  ->  200, and every row carried `geoid: "48"` for a Texas ZIP. That
 *                           is the 2-digit STATE FIPS: the "All" response is a state-level
 *                           rollup, not the ZIP-County crosswalk. The parser refused the
 *                           whole document, correctly — a state code in the county column
 *                           would have made every Texas ZIP resolve to one "county" no NWS
 *                           alert will ever name.
 *   `type=2&query=01`   ->  **400**. A 2-digit FIPS is not what `query` takes.
 *
 * HUD's own published example is a two-letter USPS abbreviation — `query=VA` — so that is
 * what this sends. The R and Python wrappers document `query` for types 1–5 as a 5-digit
 * ZIP and say nothing about states, which is the other reading available; if the
 * abbreviation is refused too, the failure now carries HUD's own explanation (below) rather
 * than a bare status code, and asking 56 times is not the way to find that out.
 *
 * ── `page` IS NOT SENT ON THE FIRST REQUEST, AND THAT IS DELIBERATE ───────────────
 * The 400 above carried BOTH a changed `query` and an added `page`, so either could have
 * caused it. The first request for each state now sends neither variable — just
 * `type` and `query` — and `page` is added only for a second page, once the response has
 * said there is one. If pagination was the offender, every first page now succeeds; if it
 * was the query, the body says so.
 *
 * ── THE LIST IS EXPLICIT ──────────────────────────────────────────────────────────
 * 50 states, DC and the five territories HUD publishes. Written out rather than derived:
 * there is no list of these anywhere else in the product, and generating them from FIPS
 * numbers is what produced the 400 in the first place.
 *
 * A STATE THAT ANSWERS NOTHING IS LOGGED AND SKIPPED, never treated as a failure: HUD may
 * hold no rows for a territory in a given quarter, and `replace_zip_counties` replaces per
 * ZIP — so a missing state leaves its ZIPs exactly as they were rather than deleting them.
 * `MINIMUM_PAIRS` is what catches losing a state that should have been there.
 */
const STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
  'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'AS', 'GU', 'MP', 'PR', 'VI',
] as const

/**
 * How much of HUD's response body to carry into a failure message.
 *
 * ── A STATUS CODE IS NOT A DIAGNOSIS, WHICH THIS JOB HAS NOW PROVED TWICE ────────
 * `HUD answered 400 for state 01 page 1` is exactly as much as we knew after the run, and
 * it cost a round trip through somebody else's Vercel deployment to learn what a 400 means.
 * An API that refuses a request almost always says why in the body; that sentence is the
 * single most useful thing this job can report, and it was being thrown away.
 *
 * Bounded because it is going into a database column and a log line, and an HTML error page
 * is a plausible thing to get back from a government host.
 */
const ERROR_BODY_CHARS = 400

/**
 * How many pages of one state to follow before giving up on it.
 *
 * `nextPage` reads several candidate field names and stops when none of them says there is
 * more, so this is the runaway guard: a response that always claims another page would
 * otherwise loop until the platform kills the request, taking the three jobs that share the
 * route with it. A state has at most a few thousand ZIPs, so 40 is far above any real answer.
 */
const MAX_PAGES_PER_STATE = 40

/** How long a crosswalk stays fresh. See the header for why this is not the cron's schedule. */
const REFRESH_AFTER_DAYS = 7

/**
 * How many pairs go to the database at once.
 *
 * The payload is ~54,000 rows and a single `replace_zip_counties` call carrying all of them
 * would be a multi-megabyte JSON body through PostgREST and one very long statement. 5,000 is
 * eleven calls, each atomic for its own ZIPs — which is exactly the granularity the safety
 * argument wants: a batch that fails leaves ITS ZIPs untouched and says how far it got.
 */
const BATCH = 5000

/**
 * The floor a payload has to clear before it is written at all.
 *
 * ── A SANITY CHECK ON THE SOURCE, NOT ON OUR PARSING ──────────────────────────────
 * There are about 41,000 US ZIPs and about 54,000 (zip, county) pairs. A response holding two
 * hundred rows is not a smaller crosswalk — it is an error page, a truncated transfer, or a
 * changed API that now needs a parameter. Writing it would replace two hundred ZIPs with
 * whatever that document happened to say and leave the rest at whatever they were, which is a
 * table nobody can reason about.
 *
 * Deliberately generous rather than tight: the point is to catch a document that is the wrong
 * KIND of thing, not to police a legitimate change in the count.
 */
const MINIMUM_PAIRS = 20000

export interface ZipCountyRefresh {
  /** What happened, in one word a log line can carry. */
  outcome: 'ok' | 'skipped' | 'not-due' | 'failed'
  /** Why, for the outcomes that need it. */
  detail?: string
  pairs?: number
  zips?: number
}

/**
 * Is a refresh due?
 *
 * ── THE MOST RECENT SUCCESS, NOT THE MOST RECENT ATTEMPT ──────────────────────────
 * A week of failures must not throttle the job into never trying again — which is what
 * measuring from `started_at` of any row would do. So this reads `state = 'ok'` only, and a
 * failing source is retried daily until it works. The opposite reading is the one that turns a
 * transient outage into a permanent stall.
 */
async function lastSuccessAt(
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ at: string | null } | { error: string }> {
  const { data, error } = await admin
    .from('zip_county_refreshes')
    .select('finished_at')
    .eq('state', 'ok')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // §8: the error is READ. Treating a refused query as "never refreshed" would re-fetch a
  // multi-megabyte file every single day, which is the failure that looks like it is working.
  if (error) return { error: error.message }
  return { at: (data?.finished_at as string | null) ?? null }
}

/**
 * The next page number, or `null` when this was the last one.
 *
 * ── IT READS WHAT THE RESPONSE SAYS AND ASSUMES NOTHING ───────────────────────────
 * The single `query=All` call this replaced followed no pagination at all, which is half of
 * why it was wrong. The field names are not something to hard-code from memory — HUD has used
 * more than one convention and the one thing measured here is `data.results`, so the
 * candidates are tried in order and an absent set of them means "no more pages".
 *
 * **THE DEFAULT IS TO STOP, WHICH IS THE SAFE DIRECTION.** Guessing wrong and stopping early
 * under-fetches, and `MINIMUM_PAIRS` catches that loudly before anything is written; guessing
 * wrong and continuing would loop on an endpoint that keeps answering the same page, and
 * `MAX_PAGES_PER_STATE` is the second guard on exactly that.
 */
function nextPage(payload: unknown, current: number): number | null {
  const d = (payload as { data?: Record<string, unknown> })?.data
  if (!d) return null

  const num = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
    return Number.isFinite(n) ? n : null
  }

  // "How many pages are there" — if we know the total, the answer is arithmetic.
  for (const key of ['total_pages', 'totalpages', 'totalPages', 'pages', 'page_count']) {
    const total = num(d[key])
    if (total !== null) return current < total ? current + 1 : null
  }
  // Otherwise: an explicit next-page pointer.
  for (const key of ['next_page', 'nextpage', 'nextPage']) {
    const next = num(d[key])
    if (next !== null && next > current) return next
  }
  return null
}

/**
 * Fetch the crosswalk and write it, if a week has passed since it last worked.
 *
 * Returns rather than throws, for the reason in the header: this rides on a daily route that
 * also sends a family's dues reminders, and a crosswalk nothing reads yet must not take those
 * down.
 */
export async function refreshZipCounties(
  options: { force?: boolean } = {},
): Promise<ZipCountyRefresh> {
  const token = process.env.HUD_USPS_API_TOKEN?.trim()
  if (!token) {
    return { outcome: 'skipped', detail: 'HUD_USPS_API_TOKEN is not set' }
  }

  const admin = createAdminClient()

  const last = await lastSuccessAt(admin)
  if ('error' in last) {
    return { outcome: 'failed', detail: `could not read the refresh log: ${last.error}` }
  }
  if (!options.force && last.at) {
    const days = (Date.now() - new Date(last.at).getTime()) / 86_400_000
    if (days < REFRESH_AFTER_DAYS) {
      return {
        outcome: 'not-due',
        detail: `last refreshed ${days.toFixed(1)} day(s) ago; due after ${REFRESH_AFTER_DAYS}`,
      }
    }
  }

  // THE ATTEMPT IS RECORDED BEFORE THE FETCH, so a run that dies mid-transfer leaves a
  // `running` row rather than no trace — which is the difference between "the job crashed" and
  // "the job never ran", and they need different fixes. It is deliberately NOT a claim: this
  // job has exactly one caller on a daily schedule, so there is no concurrency to guard, and a
  // claim would need a recovery window like `stripe_webhook_events` has.
  const { data: attempt, error: attemptError } = await admin
    .from('zip_county_refreshes')
    .insert({ source: SOURCE, state: 'running' })
    .select('id')
    .single()
  if (attemptError || !attempt) {
    return { outcome: 'failed', detail: `could not open a refresh row: ${attemptError?.message}` }
  }
  const attemptId = attempt.id as string

  const finish = async (
    state: 'ok' | 'failed',
    extra: { pairs?: number; zips?: number; error?: string },
  ) => {
    const { error } = await admin
      .from('zip_county_refreshes')
      .update({ state, finished_at: new Date().toISOString(), ...extra })
      .eq('id', attemptId)
    // Logged and not returned: the WORK either happened or it did not, and failing to write
    // the log afterwards must not be reported as the refresh having failed. What it costs is
    // a `running` row that never resolves, which is visible.
    if (error) console.error(`[zip-counties] could not close refresh ${attemptId}: ${error.message}`)
  }

  // ── EVERY STATE IS FETCHED BEFORE ANYTHING IS WRITTEN ────────────────────────────
  // Accumulated in memory (~54,000 small objects, a few MB) rather than written per state,
  // because `MINIMUM_PAIRS` is a question about the WHOLE DOCUMENT and a state cannot answer
  // it — state sizes range from Wyoming to California, so a per-state floor would either
  // admit an error page for a small state or refuse a legitimate one.
  const all: CrosswalkRow[] = []
  const emptyStates: string[] = []

  for (const stateCode of STATE_CODES) {
    let page = 1
    let pagesRead = 0
    let stateRows = 0

    while (pagesRead < MAX_PAGES_PER_STATE) {
      let payload: unknown
      try {
        // A TIMEOUT, EXPLICITLY, PER REQUEST. A hanging endpoint would otherwise hold the whole
        // daily route open until the platform kills it — taking the dues reminders and the two
        // reapers that run after it with it. 60s per page rather than 120s for the lot, because
        // there are now up to 56 of these and the ceiling has to be the sum.
        // `page` ONLY FROM THE SECOND PAGE ON — see the header. The first request sends the
        // two parameters HUD documents and nothing else.
        const url = `https://www.huduser.gov/hudapi/public/usps?type=2&query=${stateCode}`
          + (page > 1 ? `&page=${page}` : '')
        const response = await fetch(
          url,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(60_000),
            // No caching: a cached crosswalk is a refresh that did not happen and would look
            // exactly like one that did.
            cache: 'no-store',
          },
        )
        // A 404 ON ONE STATE IS NOT A FAILED REFRESH. HUD may hold nothing for a territory in
        // a given quarter, and treating that as fatal would let the smallest jurisdiction stop
        // the other 55 from ever refreshing.
        if (response.status === 404) break
        if (!response.ok) {
          // HUD'S OWN EXPLANATION, CARRIED. See `ERROR_BODY_CHARS`: a bare status code cost a
          // deploy-and-wait to interpret, and a refusal almost always says why in the body.
          // `.catch` because a body that cannot be read must not turn a 400 into an
          // unhandled rejection — the status is still worth reporting on its own.
          const body = (await response.text().catch(() => '')).trim()
          const detail = `HUD answered ${response.status} for ${stateCode}`
            + (page > 1 ? ` page ${page}` : '')
            + (body ? `: ${body.slice(0, ERROR_BODY_CHARS)}` : '')
          await finish('failed', { error: detail, pairs: all.length })
          return { outcome: 'failed', detail }
        }
        payload = await response.json()
      } catch (e) {
        const detail =
          `fetch failed for ${stateCode} page ${page}: `
          + (e instanceof Error ? e.message : String(e))
        await finish('failed', { error: detail, pairs: all.length })
        return { outcome: 'failed', detail }
      }

      const parsed = rowsFrom(payload)
      if ('error' in parsed) {
        // THE STATE AND PAGE ARE IN THE MESSAGE. The first version of this said only what the
        // row was missing, and the report that came back — *"zip 77352 has no usable county
        // geoid"* — could not say which of 56 requests produced it.
        const detail = `${stateCode} page ${page}: ${parsed.error}`
        await finish('failed', { error: detail, pairs: all.length })
        return { outcome: 'failed', detail }
      }

      all.push(...parsed.rows)
      stateRows += parsed.rows.length
      pagesRead += 1

      const next = nextPage(payload, page)
      if (next === null) break
      page = next
    }

    if (stateRows === 0) emptyStates.push(stateCode)
  }

  if (emptyStates.length) {
    // NOT SILENT. AGENTS.md's rule about a skip being visible: a state that answered nothing
    // leaves its ZIPs untouched, which is safe and is also exactly what losing a state looks
    // like. The floor below is what decides whether it mattered.
    console.warn(`[zip-counties] no rows for: ${emptyStates.join(', ')}`)
  }

  // ── THE FLOOR, BEFORE ANYTHING IS WRITTEN ────────────────────────────────────────
  // See `MINIMUM_PAIRS`. Checked here rather than per batch or per state, because the question
  // is about the DOCUMENT and neither of those can answer it.
  if (all.length < MINIMUM_PAIRS) {
    const detail =
      `only ${all.length} pair(s) — below the ${MINIMUM_PAIRS} floor, so this is a truncated `
      + 'or changed response rather than a smaller crosswalk. Nothing was written'
      + (emptyStates.length ? `. ${emptyStates.length} state(s) answered nothing` : '')
    await finish('failed', { error: detail, pairs: all.length })
    return { outcome: 'failed', detail }
  }

  let written = 0
  const zips = new Set<string>()
  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH)
    const { error } = await admin.rpc('replace_zip_counties', { p_rows: batch })
    if (error) {
      // WHAT WAS WRITTEN IS RECORDED, not discarded. Each earlier batch replaced its own ZIPs
      // atomically and correctly, so the honest report is "this far and no further" — and the
      // next run refreshes the rest, because the throttle reads a SUCCESSFUL refresh only.
      const detail = `batch at row ${i} failed after ${written} pair(s): ${error.message}`
      await finish('failed', { error: detail, pairs: written, zips: zips.size })
      return { outcome: 'failed', detail, pairs: written, zips: zips.size }
    }
    written += batch.length
    for (const row of batch) zips.add(row.zip)
  }

  await finish('ok', { pairs: written, zips: zips.size })
  return { outcome: 'ok', pairs: written, zips: zips.size }
}
