/**
 * Reading HUD's ZIP-to-county document, and refusing one this code cannot understand.
 *
 * ── WHY IT IS ITS OWN MODULE ────────────────────────────────────────────────────────
 * `lib/geo/zip-counties.ts` opens with `import 'server-only'`, because it holds the service-role
 * client and must never reach a browser bundle. That also puts it out of `npm test`'s reach:
 * `vitest.config.mts`' `lib/**` include is a stated BOUNDARY rather than a default (§7b) — no
 * jsdom, no React, no Supabase — and stubbing `server-only` to get around it would let every
 * server module load in the runner that exists to keep them out.
 *
 * So the PARSING lives here, where it can be checked, and the fetching and writing live next
 * door, where they cannot. That is the same split `lib/dues-utils.ts` has from
 * `app/actions/dues.ts` and for the same reason.
 *
 * ── IT REFUSES RATHER THAN FILTERS, AND THAT IS THE WHOLE OF ITS JOB ───────────────
 * A row this cannot understand means the FILE's shape has changed. Dropping it and carrying on
 * would refresh a ZIP with a PARTIAL county list — a straddling ZIP silently reduced to one
 * county — which is worse than not refreshing that ZIP at all, and is invisible afterwards
 * because the row that survives looks perfectly normal.
 *
 * `replace_zip_counties` refuses the same class again in SQL. Both, because this one can say
 * WHICH field of WHICH row and that one is the layer nothing can bypass.
 *
 * ── EVERY FIELD IS CHECKED AT RUNTIME BECAUSE IT IS A THIRD PARTY ─────────────────
 * A type annotation is erased (§2's rule about `Partial<T>`, in a different costume), and this
 * document arrives from a government API on a quarterly release cycle. Nothing here trusts a
 * declared shape.
 */

/** One row as `replace_zip_counties` wants it. */
export interface CrosswalkRow {
  zip: string
  county_fips: string
  state: string
  county_name: string | null
  res_ratio: number | null
}

/**
 * HUD's response shape, as much of it as is read. Optional throughout on purpose — this is a
 * description of what is HOPED for, and every field is verified below.
 */
interface HudResponse {
  data?: { results?: unknown[] }
}

export function rowsFrom(payload: unknown): { rows: CrosswalkRow[] } | { error: string } {
  const results = (payload as HudResponse)?.data?.results
  if (!Array.isArray(results)) {
    return { error: 'the response has no data.results array — the API shape has changed' }
  }

  const rows: CrosswalkRow[] = []
  for (const raw of results) {
    const r = (raw ?? {}) as Record<string, unknown>
    // HUD names them `zip` and `geoid`; for `type=2` the geoid is the 5-digit state+county
    // FIPS code, which is what an NWS alert carries.
    const zip = typeof r.zip === 'string' ? r.zip : null
    const fips = typeof r.geoid === 'string' ? r.geoid : null
    // TWO NAMES FOR THE STATE, and both are read. The `usps_zip_pref_state` field is what the
    // raw crosswalk file calls it and `state` is what the API has used; accepting either means
    // a rename between quarters does not stop the job, and neither is guessed at.
    const state = typeof r.state === 'string' ? r.state
      : typeof r.usps_zip_pref_state === 'string' ? r.usps_zip_pref_state
        : null

    if (!zip || !/^[0-9]{5}$/.test(zip)) {
      return { error: `a result has no usable zip (${JSON.stringify(r.zip)})` }
    }
    if (!fips || !/^[0-9]{5}$/.test(fips)) {
      // A 2-DIGIT GEOID IS THE KNOWN TRAP AND IT GETS ITS OWN SENTENCE — measured against the
      // real API on 2026-09-03, which answered `geoid: "48"` for a Texas ZIP. That is the
      // STATE FIPS: `query=All` returns a state-level rollup rather than the county crosswalk,
      // whatever `type=2` asks for. The REQUEST was wrong, not the row, so refusing was right
      // and deriving a county from a state would have been the worst available answer.
      // `STATE_FIPS` in zip-counties.ts is the fix; this message is what names it if it
      // regresses.
      const hint = /^[0-9]{2}$/.test(fips ?? '')
        ? ' — that is a 2-digit STATE FIPS, so this response is a state-level rollup rather '
          + 'than the ZIP-County crosswalk. Query per state, never `query=All`'
        : ''
      return {
        error: `zip ${zip} has no usable county geoid (${JSON.stringify(r.geoid)})${hint}`
          // The KEYS, because a shape change is the other reason to be here and a message
          // naming one field sends somebody looking at the wrong thing.
          + `. Fields present: ${Object.keys(r).sort().join(', ')}`,
      }
    }
    if (!state || state.length !== 2) {
      return { error: `zip ${zip} has no usable state (${JSON.stringify(state)})` }
    }

    // THE RATIO IS OPTIONAL AND A MISSING ONE IS NOT AN ERROR — the only field of the five
    // that is allowed to be absent. It is carried for a consumer that wants ONE county out of
    // several, and a null means "the source did not say", which a highest-ratio sort reads as
    // last rather than as zero. A value outside 0..1 is treated as not-said rather than
    // refused, because the CHECK on the column would refuse the whole batch over a rounding
    // artefact in a column nothing yet reads.
    // `Number('')` and `Number(null)` are both 0, so coercing whatever arrived would turn a
    // BLANK ratio into "none of this ZIP is in this county" — a false statement rather than an
    // absent one, and one a reader would take literally. Only a number or a non-blank string is
    // a figure the source actually stated. Found by the test rather than by reading.
    const stated = typeof r.res_ratio === 'number' ? r.res_ratio
      : typeof r.res_ratio === 'string' && r.res_ratio.trim() ? Number(r.res_ratio)
        : Number.NaN
    rows.push({
      zip,
      county_fips: fips,
      state: state.toUpperCase(),
      county_name: typeof r.county_name === 'string' && r.county_name.trim()
        ? r.county_name.trim()
        : null,
      res_ratio: Number.isFinite(stated) && stated >= 0 && stated <= 1 ? stated : null,
    })
  }
  return { rows }
}
