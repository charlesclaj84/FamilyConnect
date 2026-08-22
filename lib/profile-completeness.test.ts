import { describe, expect, it } from 'vitest'
import {
  missingFieldsSentence,
  profileCompleteness,
  type ProfileCompletenessInput,
} from './profile-completeness'

/**
 * The Dashboard's profile prompt.
 *
 * A GREEN RUN IS NOT EVIDENCE UNTIL YOU HAVE SEEN IT FAIL (AGENTS.md §7b). Each of these was
 * applied to `lib/profile-completeness.ts` on its own and the failures are what is listed:
 *
 *   `PROMPT_BELOW` 0.5 -> 0.6
 *       trips "half a profile is enough to stop asking" — the boundary case, and the one a
 *       future tweak is most likely to move without noticing who it starts nagging
 *   `value.trim() !== ''` -> `value !== ''`
 *       trips "whitespace is not an answer"
 *   `person != null &&` dropped from shouldPrompt
 *       trips "a member with no row is not prompted" — the §8 case, where a failed read
 *       would otherwise greet somebody with "your profile is 0% complete"
 *   `?? ''` -> `?? 'x'` (a missing key reads as present)
 *       trips "an absent key and an explicit null are the same fact"
 *   the `rest > 0` branch removed from missingFieldsSentence
 *       trips "it caps the list at three and counts the rest"
 *
 * The inputs are spelled out field by field rather than built from a helper, because the
 * point of most of these is exactly WHICH fields are counted.
 */

const EMPTY: ProfileCompletenessInput = {
  primary_phone: null, city: null, state: null,
  country: null, date_of_birth: null, avatar_url: null,
}

const FULL: ProfileCompletenessInput = {
  primary_phone: '(512) 555-0134', city: 'Austin', state: 'Texas',
  country: 'United States', date_of_birth: '1980-04-02', avatar_url: 'avatars/x/a.png',
}

describe('profileCompleteness', () => {
  it('counts six fields and nothing else', () => {
    expect(profileCompleteness(FULL).total).toBe(6)
    expect(profileCompleteness(FULL).filled).toBe(6)
    expect(profileCompleteness(FULL).percent).toBe(100)
    expect(profileCompleteness(FULL).missing).toEqual([])
    expect(profileCompleteness(FULL).shouldPrompt).toBe(false)
  })

  it('an empty profile is 0% and is prompted', () => {
    const r = profileCompleteness(EMPTY)
    expect(r.filled).toBe(0)
    expect(r.percent).toBe(0)
    expect(r.shouldPrompt).toBe(true)
    expect(r.missing).toHaveLength(6)
  })

  it('ignores the columns that are nobody’s business', () => {
    // Filling in every field this deliberately does NOT count must move nothing. If one of
    // these ever starts counting, this is the test that says so.
    const r = profileCompleteness({
      ...EMPTY,
      // @ts-expect-error — deliberately passing columns the input type does not admit, which
      // is the assertion: they are not part of the shape and cannot be counted.
      first_name: 'Martha', last_name: 'Allen', middle_name: 'Jane', nick_name: 'Mim',
      suffix: 'Jr', prefix: 'Mrs', gender: 'female', tshirt_size: 'L',
      street_address: '1 Main St', apartment: '4B', zip_code: '78701',
      chapter_id: 'abc', sunset_date: '2090-01-01', primary_email: 'm@example.com',
    })
    expect(r.filled).toBe(0)
    expect(r.shouldPrompt).toBe(true)
  })

  it('half a profile is enough to stop asking', () => {
    // THE BOUNDARY. Three of six is exactly 0.5, which is NOT below the threshold — so a
    // member who has filled in half is left alone. Two of six still asks.
    const three = { ...EMPTY, primary_phone: '555', city: 'Austin', state: 'Texas' }
    expect(profileCompleteness(three).filled).toBe(3)
    expect(profileCompleteness(three).shouldPrompt).toBe(false)

    const two = { ...EMPTY, primary_phone: '555', city: 'Austin' }
    expect(profileCompleteness(two).filled).toBe(2)
    expect(profileCompleteness(two).shouldPrompt).toBe(true)
  })

  it('whitespace is not an answer', () => {
    // A field the browser autofilled and the member cleared can come back as spaces, and an
    // emptied `<input type="date">` sends ''. Neither is something somebody typed.
    const r = profileCompleteness({
      ...FULL, primary_phone: '   ', city: '', state: '\t', date_of_birth: '',
    })
    expect(r.filled).toBe(2)
    expect(r.missing).toContain('a phone number')
    expect(r.missing).toContain('your city')
  })

  it('an absent key and an explicit null are the same fact', () => {
    expect(profileCompleteness({}).filled).toBe(0)
    expect(profileCompleteness({}).missing).toHaveLength(6)
    expect(profileCompleteness({})).toEqual(profileCompleteness(EMPTY))
  })

  it('a member with no row is not prompted', () => {
    // NOT the same as an empty profile: null means the read failed or there is no `people`
    // row in this family, and greeting somebody with "0% complete" over a query that did not
    // answer is AGENTS.md §8 wearing a friendly face.
    expect(profileCompleteness(null).shouldPrompt).toBe(false)
    expect(profileCompleteness(undefined).shouldPrompt).toBe(false)
    // The figures are still computed, so a caller that wants to render something for that
    // case is not forced to special-case it.
    expect(profileCompleteness(null).filled).toBe(0)
  })

  it('lists what is missing in the order somebody would fill it in', () => {
    expect(profileCompleteness(EMPTY).missing).toEqual([
      'a phone number', 'your city', 'your state or province',
      'your country', 'your birthday', 'a photo',
    ])
  })

  // ── `countPhoto: false` — THE FREE-FAMILY CASE, 2026-08-22 ──────────────────────
  // Profile pictures are Standard. On a Free family the control is not rendered and
  // `avatar_url` is narrowed to null on every read, so counting it would leave "a photo"
  // permanently in `missing` and cap the member at 83% with no way to reach 100.
  //
  // THE DENOMINATOR IS THE HALF THAT MATTERS. The threshold is a FRACTION of the counted
  // fields, so the field and `total` have to move together — mutation-checked by leaving
  // `total = FIELDS.length` behind, which turns all THREE of the tests below red and no
  // others (650 of 653 still pass). That is the shape to keep: the three assert the count,
  // the percentage and the threshold separately, so a denominator bug cannot hide in one of
  // them looking like a rounding question in another.
  it('does not ask for a photo when the family’s plan excludes it', () => {
    const r = profileCompleteness(FULL, false)
    expect(r.total).toBe(5)
    expect(r.filled).toBe(5)
    expect(r.percent).toBe(100)
    expect(r.missing).toEqual([])
  })

  it('a photoless profile on a Free family is complete rather than 83%', () => {
    // Everything but the picture. On Standard this is 5 of 6 and prints "a photo";
    // on Free there is nothing left to ask for.
    const noPhoto: ProfileCompletenessInput = { ...FULL, avatar_url: null }
    expect(profileCompleteness(noPhoto).percent).toBe(83)
    expect(profileCompleteness(noPhoto).missing).toEqual(['a photo'])
    expect(profileCompleteness(noPhoto, false).percent).toBe(100)
    expect(profileCompleteness(noPhoto, false).missing).toEqual([])
  })

  it('the prompt threshold moves with the denominator', () => {
    // TWO of five is 40% — under the half — and two of six is 33%, also under. The case that
    // separates them is THREE: 3/5 = 60% is quiet, and 3/6 = 50% is also quiet (the test is
    // `< 0.5`). So the boundary worth pinning is two filled, which must prompt on both.
    const two: ProfileCompletenessInput = {
      ...EMPTY, primary_phone: '(512) 555-0134', city: 'Austin',
    }
    expect(profileCompleteness(two).shouldPrompt).toBe(true)
    expect(profileCompleteness(two, false).shouldPrompt).toBe(true)

    // Three of five is 60%, quiet. Had the denominator been left at six it would be 50% —
    // also quiet — so this pair is pinned by `total` above rather than by `shouldPrompt`.
    const three: ProfileCompletenessInput = { ...two, state: 'Texas' }
    expect(profileCompleteness(three, false).shouldPrompt).toBe(false)
    expect(profileCompleteness(three, false).total).toBe(5)
  })

  it('rounds the percentage rather than truncating it', () => {
    // 1/6 is 16.67 and must read as 17, or a member who has filled one thing in is told 16
    // while a member who has filled none is told 0 — a two-point gap for a sixth of the work.
    expect(profileCompleteness({ ...EMPTY, city: 'Austin' }).percent).toBe(17)
    expect(profileCompleteness({ ...EMPTY, city: 'Austin', state: 'TX' }).percent).toBe(33)
  })
})

describe('missingFieldsSentence', () => {
  it('says nothing when nothing is missing', () => {
    expect(missingFieldsSentence([])).toBe('')
  })

  it('reads as English at one, two and three', () => {
    expect(missingFieldsSentence(['a photo'])).toBe('a photo')
    expect(missingFieldsSentence(['a photo', 'your city'])).toBe('a photo and your city')
    expect(missingFieldsSentence(['a photo', 'your city', 'your country']))
      .toBe('a photo, your city and your country')
  })

  it('caps the list at three and counts the rest', () => {
    // Six clauses is not a sentence. The three shown are the three a member is likeliest to
    // fill in first, which is why FIELDS is ordered the way it is rather than alphabetically.
    expect(missingFieldsSentence(['one', 'two', 'three', 'four']))
      .toBe('one, two, three and 1 more')
    expect(missingFieldsSentence(['one', 'two', 'three', 'four', 'five', 'six']))
      .toBe('one, two, three and 3 more')
  })

  it('takes the cap as a parameter, so the prose can change without the rule', () => {
    expect(missingFieldsSentence(['one', 'two', 'three', 'four'], 2))
      .toBe('one, two and 2 more')
  })
})
