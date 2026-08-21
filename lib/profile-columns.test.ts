import { describe, expect, it } from 'vitest'
import { pickProfileColumns, WRITABLE_PROFILE_COLUMNS } from '@/lib/profile-columns'

/**
 * `pickProfileColumns`, under `npm test` — a `verify.yml` step, so this gates a pull request.
 *
 * WHY IT IS TESTED AT ALL: it is the allow-list standing between three public HTTP endpoints
 * and every column on `people`, and two of its three jobs fail SILENTLY. A key that should
 * have been dropped and is not becomes a write nobody notices until it is a self-approval; a
 * normaliser that stops firing leaves "mary allen" and "Mary Allen" as two records. Only the
 * third — the blank-date coercion — announces itself, and it announces itself in production
 * with a 22007 that loses the whole form.
 *
 * The blank-date cases are the reason this file exists. Clearing a birthdate sends `''`, which
 * `date` refuses, so a member who had never set one could not save the panel at all. That is a
 * type mismatch rather than a form bug, which is why it is fixed in this module and tested
 * here rather than in a component this runner cannot load.
 *
 * CHECKED BY MUTATION, as AGENTS.md §7b requires — measured 2026-08-21:
 *
 *   * `BLANK_IS_NULL` branch removed entirely            2 failed
 *   * `value.trim() === ''` → `value === ''`             1 failed — the whitespace case
 *   * the branch moved AFTER the name normaliser         0 failed — survived
 *   * `ALLOWED.has(key)` check removed                   2 failed
 *   * `toNameCase` dropped                               1 failed
 *
 * THE SURVIVOR IS KEPT ON THE LIST because it is informative rather than a gap: neither date
 * column is in `NAME_COLUMNS` or `PHONE_COLUMNS`, so the branches cannot both match one key and
 * the order genuinely does not matter today. It would matter the moment a date column joined
 * either set, which is not a thing that can happen by accident — and a test asserting an order
 * that nothing depends on is a test that fails on a harmless refactor.
 */
describe('pickProfileColumns', () => {
  describe('a blank date is NULL, not an empty string', () => {
    it('coerces both date columns', () => {
      expect(pickProfileColumns({ date_of_birth: '', sunset_date: '' }))
        .toEqual({ date_of_birth: null, sunset_date: null })
    })

    it('coerces whitespace, which is what a cleared autofilled field can send', () => {
      expect(pickProfileColumns({ date_of_birth: '   ' })).toEqual({ date_of_birth: null })
    })

    it('leaves a real date exactly as it arrived', () => {
      expect(pickProfileColumns({ date_of_birth: '1974-03-09' }))
        .toEqual({ date_of_birth: '1974-03-09' })
    })

    it('does NOT coerce a blank text column — that is a different decision', () => {
      // `middle_name` is `text`, which accepts `''`. Whether a cleared name should be NULL is
      // a question nothing is forcing, so this asserts the current answer rather than an ideal
      // one: if it ever changes, this line is where the change gets noticed.
      expect(pickProfileColumns({ middle_name: '' })).toEqual({ middle_name: '' })
    })
  })

  describe('the allow-list', () => {
    it('drops a column that is not writable', () => {
      expect(pickProfileColumns({ membership_status: 'approved', first_name: 'Mary' }))
        .toEqual({ first_name: 'Mary' })
    })

    it('drops the guarded columns by name, which is the whole point of the module', () => {
      const forbidden = {
        membership_status: 'approved',
        permission_template_id: 'x',
        user_id: 'y',
        family_code: 'ZZZZZZ',
        chapter_id: 'z',
      }
      expect(pickProfileColumns(forbidden)).toEqual({})
      for (const key of Object.keys(forbidden)) {
        expect(WRITABLE_PROFILE_COLUMNS).not.toContain(key)
      }
    })

    it('survives a null or undefined input rather than throwing', () => {
      // These are public endpoints; the argument is whatever was posted.
      expect(pickProfileColumns(undefined as unknown as Record<string, unknown>)).toEqual({})
      expect(pickProfileColumns(null as unknown as Record<string, unknown>)).toEqual({})
    })
  })

  describe('normalisation', () => {
    it('name-cases a name', () => {
      expect(pickProfileColumns({ first_name: 'mary' })).toEqual({ first_name: 'Mary' })
    })

    it('leaves a non-string alone, so the column type is what refuses it', () => {
      expect(pickProfileColumns({ first_name: 42 })).toEqual({ first_name: 42 })
    })
  })
})
