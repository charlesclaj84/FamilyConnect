import { describe, expect, it } from 'vitest'
import { NAME_CASE_COLUMNS, toNameCase } from '@/lib/name-case'
import { pickProfileColumns } from '@/lib/profile-columns'

/**
 * Name capitalisation. Pure, so it belongs here (AGENTS.md §7b).
 *
 * THE TESTS THAT MATTER MOST ARE THE ONES ASSERTING NOTHING HAPPENS. The rule's whole design
 * is that it declines to touch a mixed-case value, because that is how `McDonald`,
 * `van der Berg`, `d'Angelo` and `LaTanya` survive a normaliser. If a future change makes the
 * rule cleverer, those are the cases that will go red, and they are supposed to.
 *
 * CHECKED BY MUTATION (2026-08-17). Six, all tripped:
 *   * the `isSingleCase` early return deleted (normalise everything)      3 failed
 *   * whitespace collapsing removed                                       2 failed
 *   * the short-segment keep removed (i.e. `MJ` → `Mj` again)             3 failed
 *   * `SEPARATOR_CLASS` narrowed to whitespace only                       3 failed
 *   * the `FIXED_FORMS` lookup removed                                    2 failed
 *   * the UPPER branch made symmetric with the lower one                  3 failed
 *
 * TWO OF THOSE ARE HERE BECAUSE THE MUTATION FOUND SOMETHING, not because they were
 * planned:
 *
 *   * `MJ` → `Mj`. The first version applied one all-caps rule and turned a real nickname
 *     into something nobody is called. That is why the two branches are asymmetric, and the
 *     four-letter threshold and its known failure (`ADA`) are both asserted below.
 *   * The separator class was written out TWICE — once as a constant, once inline in the
 *     `split` — so narrowing the constant changed no behaviour and the mutation MISSED.
 *     Two copies of one character class is the drift this codebase keeps a rule about, in
 *     miniature. There is now one definition and the mutation trips.
 */

describe('toNameCase', () => {
  it('title-cases an all-lower-case name', () => {
    expect(toNameCase('mary')).toBe('Mary')
    expect(toNameCase('mary allen')).toBe('Mary Allen')
  })

  it('title-cases a SHOUTED name', () => {
    // The commonest real input after all-lower — a form filled in with caps lock on.
    expect(toNameCase('MARY ALLEN')).toBe('Mary Allen')
    expect(toNameCase('OKONKWO')).toBe('Okonkwo')
  })

  it('keeps a SHORT all-caps segment, because it is initials rather than shouting', () => {
    // This case is why the two branches are asymmetric, and it was found by running the
    // test rather than by reasoning: the naive rule turned the real nickname `MJ` into
    // `Mj`. Nobody's caps lock produces a two-letter name.
    expect(toNameCase('MJ')).toBe('MJ')
    expect(toNameCase('TJ')).toBe('TJ')
    expect(toNameCase('JD SMITH')).toBe('JD Smith')
  })

  it('title-cases a short ALL-LOWER segment, because lower case carries no information', () => {
    // The other side of the asymmetry. `mj` is an improvement on nothing, and somebody who
    // wants `MJ` types it — which the branch above then preserves.
    expect(toNameCase('mj')).toBe('Mj')
  })

  it('gets a three-letter shouted name wrong by LEAVING it, which is the cheap error', () => {
    // Documented rather than hidden: the four-letter threshold cannot tell `ADA` from `MJ`.
    // Leaving a name unchanged is recoverable by typing it; renaming somebody is not.
    expect(toNameCase('ADA')).toBe('ADA')
  })

  it('capitalises after a hyphen and an apostrophe', () => {
    expect(toNameCase('mary-jane')).toBe('Mary-Jane')
    expect(toNameCase("o'brien")).toBe("O'Brien")
    expect(toNameCase('ANNE-MARIE')).toBe('Anne-Marie')
    // The typographic apostrophe too, which is what a phone keyboard inserts.
    expect(toNameCase('o’brien')).toBe('O’Brien')
  })

  it('capitalises after a full stop, for initials', () => {
    expect(toNameCase('j.r.')).toBe('J.R.')
  })

  // ── THE LEAVE-ALONE CASES. These are the point. ────────────────────────────────────
  it('LEAVES a mixed-case name exactly as typed', () => {
    for (const name of ['McDonald', 'MacArthur', 'van der Berg', 'de la Cruz',
                        "d'Angelo", 'DeShawn', 'LaTanya', 'JoAnne', 'bin Rashid',
                        'van Gogh', 'O’Brien-Smith']) {
      expect(toNameCase(name)).toBe(name)
    }
  })

  it('does not lower-case a deliberate capital in the middle of a word', () => {
    // The single most likely regression: a normaliser that title-cases unconditionally
    // turns McDonald into Mcdonald, which is somebody's name spelled wrong.
    expect(toNameCase('McDonald')).not.toBe('Mcdonald')
  })

  it('collapses and trims whitespace whatever the case', () => {
    // Separable from the casing rule, and applies even where the casing rule declines —
    // "  Mary   Allen " is nobody's intentional rendering and it breaks every sort.
    expect(toNameCase('  mary   allen ')).toBe('Mary Allen')
    expect(toNameCase('  McDonald  ')).toBe('McDonald')
    expect(toNameCase('van   der   Berg')).toBe('van der Berg')
  })

  it('renders generational and professional suffixes correctly', () => {
    // `iii` would title-case to `Iii`, which looks deliberate and is worse than untouched.
    expect(toNameCase('iii')).toBe('III')
    expect(toNameCase('III')).toBe('III')
    expect(toNameCase('jr')).toBe('Jr')
    expect(toNameCase('jr.')).toBe('Jr.')
    expect(toNameCase('phd')).toBe('PhD')
    expect(toNameCase('m.d.')).toBe('M.D.')
  })

  it('passes null, undefined and empty through', () => {
    expect(toNameCase(null)).toBeNull()
    expect(toNameCase(undefined)).toBeUndefined()
    expect(toNameCase('')).toBe('')
    expect(toNameCase('   ')).toBe('')
  })

  it('handles a non-Latin script without mangling it', () => {
    // `\p{L}` and `toLocaleUpperCase` rather than `[a-z]`. Nothing to change here, and the
    // assertion is that nothing DOES.
    expect(toNameCase('黄')).toBe('黄')
    expect(toNameCase('олег')).toBe('Олег')
  })
})

describe('pickProfileColumns applies it', () => {
  it('normalises every name column it lets through', () => {
    // The wiring, not the rule. This is the only thing asserting the normaliser is actually
    // reached — `lib/name-case.ts` working proves nothing about whether anything calls it.
    const out = pickProfileColumns({
      first_name: 'mary', middle_name: 'JANE', last_name: "o'brien",
      nick_name: 'MJ', suffix: 'iii',
    })
    expect(out).toEqual({
      first_name: 'Mary', middle_name: 'Jane', last_name: "O'Brien",
      nick_name: 'MJ', suffix: 'III',
    })
  })

  it('covers every column NAME_CASE_COLUMNS claims', () => {
    // A column added to the list but not reached by the filter would normalise nothing.
    for (const col of NAME_CASE_COLUMNS) {
      expect(pickProfileColumns({ [col]: 'mary allen' })[col]).toBe('Mary Allen')
    }
  })

  it('leaves a non-name column alone', () => {
    expect(pickProfileColumns({ city: 'austin' }).city).toBe('austin')
  })

  it('still drops a column that is not writable', () => {
    // The allow-list must keep working — this function's original and more important job.
    expect(pickProfileColumns({ membership_status: 'approved', first_name: 'mary' }))
      .toEqual({ first_name: 'Mary' })
  })

  it('leaves a non-string value for a name column untouched', () => {
    // These are public endpoints and can be handed any JSON. Coercing a number into the
    // row as text would be worse than letting the column's own type refuse it.
    expect(pickProfileColumns({ first_name: 42 }).first_name).toBe(42)
    expect(pickProfileColumns({ first_name: null }).first_name).toBeNull()
  })
})
