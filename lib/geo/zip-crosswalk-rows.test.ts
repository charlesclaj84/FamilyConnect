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
 *   the 2-digit skip -> a refusal (its pre-2026-09-04 behaviour)  (1)
 *   the 2-digit skip -> accepted as a county                       (1)
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
    // Nothing unplaceable in a clean document — the counter must not creep.
    expect(out.unplaceable).toBe(0)
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
    expect(parse([])).toEqual({ rows: [], unplaceable: 0 })
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
    // Two digits is deliberately absent from this list: it is the one value that is NOT
    // malformed, and the case below pins that. Everything here is a shape HUD has never sent.
    for (const geoid of [undefined, null, '', '2502', '250255', 'BAD', 25025]) {
      const out = parse([good({ geoid })])
      expect('error' in out, String(geoid)).toBe(true)
      // The ZIP is in the message because the point of refusing is that somebody can go and
      // look at the row; an error naming only the field would send them through 54,000 of them.
      if ('error' in out) expect(out.error).toContain('02134')
    }
  })

  it('SKIPS a ZIP HUD cannot place, and counts it', () => {
    // ── THIS CASE ASSERTED THE OPPOSITE FOR A DAY, AND THE ASSERTION WAS THE BUG ──
    // It was written on 2026-09-03 to pin a refusal: `zip 77352 has no usable county geoid
    // ("48")` was read as proof that the REQUEST was wrong, and the case demanded that the
    // whole document be refused with a message naming a state rollup.
    //
    // Asking HUD about that one ZIP settled it:
    //
    //     type=2&query=77352  ->  1 row: { zip: '77352', geoid: '48', city: 'LIVINGSTON',
    //                             state: 'TX', res_ratio: 1, bus_ratio: 1, tot_ratio: 1 }
    //
    // One row, the state as the geography, every ratio 1 — HUD saying "all of this ZIP is in
    // Texas and I have no county for it". The document it came in carried proper county rows
    // either side of it. So the request was right, the row is understood, and refusing 54,000
    // pairs over it was the defect.
    //
    // KEPT AS A NAMED CASE RATHER THAN REWRITTEN QUIETLY, because a test that pinned wrong
    // behaviour is the most useful kind to leave a note on: the next person reading a
    // 2-digit geoid should find this rather than re-derive it.
    const out = parse([
      good({ zip: '73301', geoid: '48453' }),
      good({ zip: '77352', geoid: '48' }),
      good({ zip: '73960', geoid: '48421' }),
    ])
    expect('rows' in out).toBe(true)
    if (!('rows' in out)) return
    // THE ROWS EITHER SIDE SURVIVE. That is the whole point: one unplaceable ZIP must not
    // cost a state's crosswalk.
    expect(out.rows.map(r => r.zip)).toEqual(['73301', '73960'])
    // AND IT IS COUNTED, never silently dropped — AGENTS.md's "no silent caps". A jump in
    // this figure between quarters is a change in HUD's data somebody should see.
    expect(out.unplaceable).toBe(1)
  })

  it('still refuses a geoid that is neither 5 digits nor a state, and names the fields', () => {
    // The exception above is exactly two digits. Three, or letters, or absent is a SHAPE
    // change and the header's refuse-rather-than-filter argument still applies to it — the
    // field list is what identified the state-level case and is what would identify the next.
    for (const geoid of [undefined, null, '', '2502', '250255', 'BAD', 25025, '4']) {
      const out = parse([good({ zip: '77352', geoid })])
      expect('error' in out, String(geoid)).toBe(true)
      if ('error' in out) {
        expect(out.error).toContain('77352')
        expect(out.error).toContain('Fields present:')
      }
    }
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
    // `'BAD'` and not `'48'`: two digits is the understood case that is skipped, so using
    // it here would assert the opposite of what this case is about.
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
