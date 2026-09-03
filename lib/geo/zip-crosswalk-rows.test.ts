import { describe, expect, it } from 'vitest'
import { rowsFrom } from '@/lib/geo/zip-crosswalk-rows'

/**
 * The one thing about the ZIP crosswalk that `npm test` can reach, and the one thing worth
 * reaching: whether a document this code cannot understand is REFUSED rather than partly read.
 *
 * ── WHY THAT IS THE INTERESTING PROPERTY ──────────────────────────────────────────
 * Dropping an unreadable row and carrying on would refresh a ZIP with a PARTIAL county list —
 * a straddling ZIP silently reduced to one county — and the row that survived would look
 * perfectly normal afterwards. There is nothing downstream that could notice. So the assertion
 * is not "does it parse a good file" but "does a bad one stop it".
 *
 * The fetching, the batching and the weekly throttle need a database and a government API and
 * are next door behind `server-only`; `20260903000002`'s own probe covers the SQL half —
 * a batch naming one ZIP leaves another alone, an empty batch deletes nothing, and a malformed
 * `county_fips` is refused without touching the ZIP beside it.
 *
 * ── MUTATION-CHECKED, SEVEN WAYS ─────────────────────────────────────────────────
 * Each of these turns at least one case below red, and none of them turns the whole file red —
 * which is the property worth having, because a mutation that reddens everything is caught by
 * any test at all:
 *
 *   each of the three `return { error }` refusals -> `continue`   (1, 2 and 1 case)
 *   `if (!Array.isArray(results))`                -> `if (false)` (1)
 *   the stated-ratio read                         -> `Number(r.res_ratio)` (1)
 *   the county-name trim removed                             (1)
 *   `state.toUpperCase()`                         -> `state`  (1)
 *
 * AND THE FIFTH WAS NOT A MUTATION FIRST — it is how the parser was written, and this file
 * found it: `Number('')` and `Number(null)` are both 0, so a blank ratio read as "none of this
 * ZIP is in this county" rather than as "the source did not say".
 */

const good = (over: Record<string, unknown> = {}) => ({
  zip: '02134',
  geoid: '25025',
  state: 'MA',
  county_name: 'Suffolk County',
  res_ratio: 0.9,
  ...over,
})

const parse = (results: unknown[]) => rowsFrom({ data: { results } })

describe('rowsFrom', () => {
  it('reads a well-formed result', () => {
    const out = parse([good()])
    expect('rows' in out).toBe(true)
    if (!('rows' in out)) return
    expect(out.rows).toEqual([{
      zip: '02134',
      county_fips: '25025',
      state: 'MA',
      county_name: 'Suffolk County',
      res_ratio: 0.9,
    }])
  })

  it('keeps EVERY county of a straddling ZIP, which is the point of the table', () => {
    const out = parse([good(), good({ geoid: '25017', county_name: 'Middlesex', res_ratio: 0.1 })])
    expect('rows' in out && out.rows).toHaveLength(2)
  })

  it('accepts either name for the state', () => {
    // The raw crosswalk file calls it `usps_zip_pref_state` and the API has used `state`.
    // Reading both means a rename between quarters does not stop the job.
    const out = parse([good({ state: undefined, usps_zip_pref_state: 'ma' })])
    expect('rows' in out && out.rows[0].state).toBe('MA')
  })

  it('is not confused by an empty result set', () => {
    // An empty file is a legitimate answer to read — the FLOOR that refuses a suspiciously
    // small payload is in the caller, on the whole document, because a parser cannot know
    // whether 200 rows is wrong.
    expect(parse([])).toEqual({ rows: [] })
  })

  // ── THE REFUSALS ────────────────────────────────────────────────────────────────
  //
  // Each of these is a row that could have been dropped instead. Every one of them means the
  // FILE changed shape, so continuing would write a partial answer for whichever ZIP it
  // touched — see the header.

  it('refuses a payload with no results array at all', () => {
    for (const payload of [null, undefined, {}, { data: {} }, { data: { results: 'nope' } }, []]) {
      const out = rowsFrom(payload)
      expect('error' in out, JSON.stringify(payload)).toBe(true)
    }
  })

  it('refuses a missing or malformed zip, and NAMES the field', () => {
    for (const zip of [undefined, null, '', '2134', '021345', 'ABCDE', 2134]) {
      const out = parse([good({ zip })])
      expect('error' in out, String(zip)).toBe(true)
      if ('error' in out) expect(out.error).toContain('zip')
    }
  })

  it('refuses a malformed county geoid, and names the ZIP it belongs to', () => {
    for (const geoid of [undefined, null, '', '2502', '250255', 'BAD', 25025]) {
      const out = parse([good({ geoid })])
      expect('error' in out, String(geoid)).toBe(true)
      // The ZIP is in the message because the point of refusing is that somebody can go and
      // look at the row; an error naming only the field would send them through 54,000 of them.
      if ('error' in out) expect(out.error).toContain('02134')
    }
  })

  it('refuses a 2-digit STATE fips in the county column, and says that is what it is', () => {
    // THE REGRESSION. Reported 2026-09-03 against the real API: `zip 77352 has no usable
    // county geoid ("48")`. 48 is Texas. `type=2&query=All` answers a state-level rollup, so
    // every row named a state where a county was wanted — and refusing was right, because a
    // state code in the county column would have made every Texas ZIP resolve to one "county"
    // no NWS alert will ever name, with nothing downstream able to notice.
    const out = parse([good({ zip: '77352', geoid: '48' })])
    expect('error' in out).toBe(true)
    if (!('error' in out)) return
    expect(out.error).toContain('77352')
    // The message has to name the CAUSE, or the next person reads it as a bad row rather than
    // as a bad request. The fix was `STATE_FIPS`, one module over.
    expect(out.error).toContain('STATE FIPS')
    expect(out.error).toContain('never `query=All`')
    // ...and the fields present, because a shape change is the other reason to land here.
    expect(out.error).toContain('Fields present:')
  })

  it('refuses a malformed state', () => {
    for (const state of [undefined, null, '', 'M', 'MAS', 'Massachusetts']) {
      const out = parse([good({ state, usps_zip_pref_state: undefined })])
      expect('error' in out, String(state)).toBe(true)
    }
  })

  it('REFUSES THE WHOLE BATCH, not just the bad row', () => {
    // The assertion the header is about. One unreadable row among three good ones stops all
    // three — because the two good ones may be the OTHER counties of the bad one's ZIP, and
    // writing them would be exactly the partial county list this is meant to prevent.
    const out = parse([good(), good({ geoid: 'BAD' }), good({ zip: '78701', geoid: '48453' })])
    expect('error' in out).toBe(true)
  })

  // ── AND THE ONE FIELD THAT IS ALLOWED TO BE ABSENT ──────────────────────────────

  it('treats a missing or nonsensical ratio as not-said rather than refusing', () => {
    // The only optional field. A null means "the source did not say", which a highest-ratio
    // sort reads as last rather than as zero — and refusing over a rounding artefact in a
    // column nothing yet reads would stop the job for nothing.
    for (const res_ratio of [undefined, null, '', 'x', -0.1, 1.5, NaN]) {
      const out = parse([good({ res_ratio })])
      expect('rows' in out, String(res_ratio)).toBe(true)
      if ('rows' in out) expect(out.rows[0].res_ratio).toBeNull()
    }
  })

  it('keeps a ratio of exactly 0 and exactly 1', () => {
    // The boundaries, because `Number.isFinite(0)` is true and a truthiness test would have
    // silently turned a ZIP wholly outside a county into "not said".
    expect('rows' in parse([good({ res_ratio: 0 })])
      && (parse([good({ res_ratio: 0 })]) as { rows: { res_ratio: number | null }[] }).rows[0].res_ratio)
      .toBe(0)
    const one = parse([good({ res_ratio: 1 })])
    expect('rows' in one && one.rows[0].res_ratio).toBe(1)
  })

  it('trims a county name and treats a blank one as absent', () => {
    const blank = parse([good({ county_name: '   ' })])
    expect('rows' in blank && blank.rows[0].county_name).toBeNull()
    const padded = parse([good({ county_name: '  Suffolk  ' })])
    expect('rows' in padded && padded.rows[0].county_name).toBe('Suffolk')
  })
})
