import 'server-only'

/**
 * Ask HUD what each candidate request actually returns, and write nothing.
 *
 * ── WHY THIS EXISTS: TWO WRONG GUESSES, AND A THIRD WAS NOT WORTH MAKING ──────────
 * The bulk shape of this API has now been guessed twice from documentation and been wrong
 * twice, each time costing a merge, a deploy and a day:
 *
 *   `type=2&query=All`  ->  200. Rows carried `geoid: "48"` for a Texas ZIP — the 2-digit
 *                           STATE FIPS.
 *   `type=2&query=01`   ->  400. A FIPS code is not what `query` takes.
 *   `type=2&query=TX`   ->  200, and the SAME state-level rows. Fields present:
 *                           `bus_ratio, city, geoid, oth_ratio, res_ratio, state,
 *                           tot_ratio, zip`.
 *
 * That third result is the informative one and it is why this file exists rather than a
 * fourth guess. Those are crosswalk rows — the four allocation ratios are unmistakable — but
 * the geography they allocate to is the STATE. So a state-level `query` does not filter the
 * ZIP-County crosswalk; it changes which crosswalk you get. HUD's documented usage for
 * `type` 1–5 is a single ZIP, and 41,000 requests is not a job that fits in a serverless
 * function.
 *
 * ── SO THE QUESTION IS NARROW: WHAT BULK REQUEST YIELDS A 5-DIGIT GEOID ──────────
 * This asks HUD directly instead of reading about it, and reports the first row VERBATIM for
 * each candidate. One run answers it.
 *
 * ── IT IS A DIAGNOSTIC AND IT MUST STAY ONE ──────────────────────────────────────
 * It writes nothing, touches no table, and is reachable only behind `CRON_SECRET` on a route
 * that already refuses without it. Once the working combination is known, the candidate that
 * won becomes the request in `zip-counties.ts` and this file can go — it is scaffolding for a
 * question, not a feature.
 *
 * **IT REPORTS RATHER THAN DECIDES.** The temptation is to have the refresh try each
 * candidate until one looks right, and that is the worst available design: it would pick a
 * shape on the strength of a 200 and write whatever came back, which is precisely how a state
 * FIPS ended up in a column named `county_fips`.
 */

/** How many rows of each response to report. Two, because one cannot show a straddling ZIP. */
const SAMPLE_ROWS = 2

/** Bounded, because an HTML error page is a plausible thing to get back from this host. */
const BODY_CHARS = 300

/**
 * The candidates, in the order they are worth knowing about.
 *
 * ── EACH ONE ANSWERS A DIFFERENT QUESTION, WHICH IS WHY THERE ARE FIVE ───────────
 *
 *   `type=2&query=77352`  THE CONTROL, and the most important line. HUD's documented usage
 *                         for types 1–5 is one ZIP. If this returns a 5-digit `geoid` then
 *                         the whole model is confirmed — the crosswalk exists, `type=2` is
 *                         right, and the only problem is bulk. If it ALSO returns "48", the
 *                         model is wrong and `type=2` is not ZIP-County at all.
 *   `type=7&query=TX`     COUNTY-ZIP, the reverse direction, asked by state. ~3,100 counties
 *                         nationally against 41,000 ZIPs, so if a state query works here it
 *                         is 56 requests and the job is done.
 *   `type=7&query=48291`  The same reverse direction asked by COUNTY — Liberty County, Texas,
 *                         which is 77352's real county. Tells us whether the reverse type
 *                         needs a county the way the forward one needs a ZIP.
 *   `type=2&query=TX`     Kept as the ALREADY-MEASURED baseline, so a run of this probe is
 *                         self-contained: whoever reads the output can see the state-level
 *                         shape beside whatever else came back rather than taking it on
 *                         trust from a commit message.
 *   `type=2&query=48291`  A county GEOID on the forward type. Long odds, and cheap.
 */
const CANDIDATES: readonly { label: string; type: string; query: string }[] = [
  { label: 'control: one ZIP, forward', type: '2', query: '77352' },
  { label: 'reverse type, by state', type: '7', query: 'TX' },
  { label: 'reverse type, by county', type: '7', query: '48291' },
  { label: 'baseline: forward, by state', type: '2', query: 'TX' },
  { label: 'forward, by county', type: '2', query: '48291' },
]

export interface ProbeResult {
  label: string
  request: string
  status: number | null
  /** Every field name the first row carries, sorted. The thing the last run was missing. */
  fields?: string[]
  /** The first rows verbatim, so `geoid`'s LENGTH is readable rather than described. */
  sample?: unknown[]
  /** How many rows came back in total, which says whether a bulk answer is even plausible. */
  rows?: number
  /** HUD's own words on a refusal, or ours on a transport failure. */
  error?: string
}

/**
 * Run every candidate and report what came back.
 *
 * Sequential rather than parallel: five requests to a government host that has already
 * refused one of them, and a burst is how a token gets rate-limited on the one run that
 * needed to succeed.
 */
export async function probeZipCrosswalk(): Promise<
  { ok: true; results: ProbeResult[] } | { ok: false; error: string }
> {
  const token = process.env.HUD_USPS_API_TOKEN?.trim()
  if (!token) return { ok: false, error: 'HUD_USPS_API_TOKEN is not set' }

  const results: ProbeResult[] = []
  for (const c of CANDIDATES) {
    const request = `type=${c.type}&query=${c.query}`
    try {
      const response = await fetch(
        `https://www.huduser.gov/hudapi/public/usps?${request}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(60_000),
          cache: 'no-store',
        },
      )
      if (!response.ok) {
        const body = (await response.text().catch(() => '')).trim()
        results.push({
          label: c.label,
          request,
          status: response.status,
          error: body.slice(0, BODY_CHARS) || '(no body)',
        })
        continue
      }
      const payload = await response.json() as { data?: { results?: unknown[] } }
      const rows = payload?.data?.results
      if (!Array.isArray(rows)) {
        // NOT AN ERROR HERE, unlike in the parser: a candidate answering a different shape
        // is a finding, and the whole point of this file is to report the shape rather than
        // refuse it. The top-level keys are what say where the rows went.
        results.push({
          label: c.label,
          request,
          status: response.status,
          error: 'no data.results array; top-level keys: '
            + Object.keys((payload ?? {}) as Record<string, unknown>).sort().join(', '),
        })
        continue
      }
      results.push({
        label: c.label,
        request,
        status: response.status,
        rows: rows.length,
        fields: Object.keys((rows[0] ?? {}) as Record<string, unknown>).sort(),
        sample: rows.slice(0, SAMPLE_ROWS),
      })
    } catch (e) {
      results.push({
        label: c.label,
        request,
        status: null,
        error: `fetch failed: ${e instanceof Error ? e.message : String(e)}`,
      })
    }
  }
  return { ok: true, results }
}
