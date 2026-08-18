import { describe, expect, it } from 'vitest'
import { isEmailNotConfirmed, isInvalidCredentials } from './auth-errors'

/**
 * The cases that are not obvious from reading the `||`, per AGENTS.md §7b.
 *
 * The literals here are MEASURED rather than invented: `{ code: 'email_not_confirmed',
 * message: 'Email not confirmed' }` and `{ code: 'invalid_credentials', message: 'Invalid
 * login credentials' }` are what the local stack returned on 2026-08-17 for an account that
 * registered and never opened its link, with the right password and with the wrong one. Both
 * arrive as status 400, which is why no assertion here mentions a status.
 *
 * A GREEN RUN IS NOT EVIDENCE UNTIL YOU HAVE SEEN IT FAIL, and this suite was checked that
 * way. Four mutations of lib/auth/auth-errors.ts, each re-run with `npm test`:
 *
 *   1. drop the message fallback (`return sentence.test(...)` -> `return false`)
 *      -> 3 failures: "matches on the message when the code is absent" for both predicates,
 *         and "matches a lower-cased message".
 *   2. drop the code check (delete `if (error.code === code) return true`)
 *      -> 2 failures: "matches on the code alone, with no message at all" for both.
 *   3. drop the null guard (`if (!error) return false`)
 *      -> 2 failures: both predicates throw `Cannot read properties of undefined (reading
 *         'code')` on "answers false for undefined and for null" instead of answering.
 *   4. make the message test case-sensitive (drop the `i` flag on isEmailNotConfirmed)
 *      -> 1 failure: "matches on the message when the code is absent", because GoTrue's
 *         actual sentence is capitalised ("Email not confirmed") and the pattern is not.
 *         Worth knowing which way round that lands: the lower-cased case still passes under
 *         this mutation, so it is the REAL, measured casing that the `i` flag is protecting.
 *
 * The pair of "does not confuse the two" cases pass under all four and are here for a
 * different reason: they are what would catch a copy-paste that pointed one predicate at the
 * other's code, which no mutation of the shared helper can produce.
 */

describe('isEmailNotConfirmed', () => {
  it('matches on the code alone, with no message at all', () => {
    expect(isEmailNotConfirmed({ code: 'email_not_confirmed' })).toBe(true)
  })

  it('matches on the message when the code is absent', () => {
    // A GoTrue old enough not to send `error_code`, which is the only reason the fallback
    // exists. Nothing else in the object is usable.
    expect(isEmailNotConfirmed({ message: 'Email not confirmed' })).toBe(true)
  })

  it('matches a lower-cased message', () => {
    expect(isEmailNotConfirmed({ message: 'email not confirmed' })).toBe(true)
  })

  it('matches the real pairing both halves at once', () => {
    expect(isEmailNotConfirmed({
      code: 'email_not_confirmed',
      message: 'Email not confirmed',
    })).toBe(true)
  })

  it('answers false for a different failure', () => {
    expect(isEmailNotConfirmed({
      code: 'invalid_credentials',
      message: 'Invalid login credentials',
    })).toBe(false)
  })

  it('answers false for undefined and for null', () => {
    // The shape every caller actually holds: supabase-js returns `{ error }` and leaves it
    // null on success, so the happy path is passed straight in.
    expect(isEmailNotConfirmed(undefined)).toBe(false)
    expect(isEmailNotConfirmed(null)).toBe(false)
  })

  it('answers false for an error carrying neither a code nor a message', () => {
    expect(isEmailNotConfirmed({})).toBe(false)
  })
})

describe('isInvalidCredentials', () => {
  it('matches on the code alone, with no message at all', () => {
    expect(isInvalidCredentials({ code: 'invalid_credentials' })).toBe(true)
  })

  it('matches on the message when the code is absent', () => {
    expect(isInvalidCredentials({ message: 'Invalid login credentials' })).toBe(true)
  })

  it('answers false for a rate limit, which must not read as a wrong password', () => {
    // The distinction `verifyCurrentPassword` exists to keep: 30 sign-in attempts per five
    // minutes per IP is a shared budget, and somebody who typed their password correctly
    // must not be sent to the recovery flow because a relative spent it.
    expect(isInvalidCredentials({
      code: 'over_request_rate_limit',
      message: 'Request rate limit reached',
    })).toBe(false)
  })

  it('answers false for undefined and for null', () => {
    expect(isInvalidCredentials(undefined)).toBe(false)
    expect(isInvalidCredentials(null)).toBe(false)
  })

  it('answers false for an unconfirmed account, which is a different piece of advice', () => {
    expect(isInvalidCredentials({
      code: 'email_not_confirmed',
      message: 'Email not confirmed',
    })).toBe(false)
  })
})
