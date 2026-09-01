import { describe, expect, it } from 'vitest'

import {
  BASE_DIRECTION, DEFAULT_DIRECTION, DIRECTION_BOOT_SCRIPT, RTL_LOCALES, directionFor, isRtl,
} from '@/lib/i18n/direction'
import { LOCALES } from '@/lib/i18n/locales'
import { LOCALE_PICK_COOKIE } from '@/lib/i18n/route-locale'

/**
 * `lib/i18n/direction.ts`, under `npm test` — a `verify.yml` step, so this gates a pull request.
 *
 * ── WHAT IS WORTH TESTING IN A MODULE THAT DOES NOTHING TODAY ──────────────────────
 * No right-to-left locale is shipped, so `directionFor` answers `'ltr'` for every code the
 * product speaks and the boot script returns on its first line. A test that only asserted that
 * would be asserting the absence of a feature.
 *
 * What is asserted instead is the two things that will be true the day one IS added, and that
 * nothing else can check:
 *
 *   1. **The rule survives the registry changing.** Every assertion below is derived from
 *      `LOCALES` rather than written against `en`/`es`/`fr`, so adding a row exercises it
 *      rather than going round it.
 *   2. **THE BOOT SCRIPT AGREES WITH THE TYPESCRIPT.** That is the whole reason this file
 *      exists. `DIRECTION_BOOT_SCRIPT` is a STRING that has to hold the direction rule a second
 *      time, because it runs in `<head>` before any module of ours is loaded — and two copies
 *      of a rule is exactly what this codebase keeps warning about. The tests below EXECUTE the
 *      script against a fake document and compare it to `directionFor`, which is what makes the
 *      duplication admissible rather than merely unavoidable.
 *
 * ── MUTATION-CHECKED (2026-09-01), which is the rule §7b sets ──────────────────────
 * Each of these turns a different set red, and none of them turns nothing red:
 *
 *   * `dir: 'rtl'` added to the `en` row      -> the derived-agreement and RTL_LOCALES tests
 *   * `?? DEFAULT_DIRECTION` changed to `'rtl'` -> the unknown-code test
 *   * `if(!r.length)return;` deleted from the script -> nothing, TODAY, and that is recorded
 *     below as a stated limit rather than left looking like coverage.
 */

// ── A DOCUMENT, ENOUGH OF ONE TO RUN THE SCRIPT AGAINST ────────────────────────────
// No jsdom: `vitest.config.mts` has none, deliberately (AGENTS.md §7b — this runner is for pure
// modules and must not become a second, weaker place to test a component). Three properties is
// the whole surface the script touches, so a literal is honest and needs no dependency.
function runBootScript(cookie: string): string {
  const el = { dir: '' }
  const fakeDocument = { cookie, documentElement: el }
  const run = new Function('document', DIRECTION_BOOT_SCRIPT)
  run(fakeDocument)
  return el.dir
}

describe('directionFor', () => {
  it('answers for every locale the product speaks', () => {
    // DERIVED, so a fourth locale is covered by this test the day it is added rather than by
    // somebody remembering to extend a list.
    for (const locale of LOCALES) {
      expect(directionFor(locale.code)).toBe(locale.dir)
      expect(isRtl(locale.code)).toBe(locale.dir === 'rtl')
    }
  })

  it('falls through to left-to-right for anything it does not recognise', () => {
    // The same fall-through `localeFor` takes, and right for the same reason: a locale the
    // registry does not know is one nothing else can render either.
    for (const unknown of ['ar', 'he', 'zz', '', null, undefined]) {
      expect(directionFor(unknown)).toBe(DEFAULT_DIRECTION)
    }
    expect(DEFAULT_DIRECTION).toBe('ltr')
    expect(BASE_DIRECTION).toBe('ltr')
  })

  it('lists exactly the right-to-left locales in the registry, and no others', () => {
    // EMPTY TODAY, and asserted as a derivation rather than as the number zero — `toEqual([])`
    // would go red the moment somebody adds Arabic, which is the one day this must not.
    expect([...RTL_LOCALES].sort())
      .toEqual(LOCALES.filter(l => l.dir === 'rtl').map(l => l.code).sort())
  })
})

describe('DIRECTION_BOOT_SCRIPT', () => {
  it('reads the same cookie the language picker writes', () => {
    // The NAME is interpolated from `LOCALE_PICK_COOKIE` rather than typed into the string, so
    // a rename cannot leave the boot script reading a cookie nothing writes. This is what
    // asserts the interpolation actually happened.
    expect(DIRECTION_BOOT_SCRIPT).toContain(JSON.stringify(LOCALE_PICK_COOKIE))
  })

  it('agrees with directionFor for every locale, run as real JavaScript', () => {
    // THE POINT OF THIS FILE. The script is executed rather than read, so a typo inside the
    // string — the one place TypeScript cannot look — is a failure here rather than a page
    // laid out backwards for the first reader of the first right-to-left language.
    for (const locale of LOCALES) {
      const applied = runBootScript(`${LOCALE_PICK_COOKIE}=${locale.code}; theme=dark`)
      // While no RTL locale is shipped the script returns before touching the element, which is
      // its own correct behaviour: `''` and `'ltr'` are the same rendered result.
      expect(applied === '' ? 'ltr' : applied).toBe(directionFor(locale.code))
    }
  })

  it('survives a document with no cookie, a junk cookie, and a thrown accessor', () => {
    // Every one of these is a real state: a private window, a jar cleared mid-session, and an
    // embedded frame where reading `document.cookie` THROWS rather than returning empty — the
    // case `rememberLocalePick`'s try/catch already exists for.
    expect(runBootScript('') === '' ? 'ltr' : runBootScript('')).toBe('ltr')
    expect(runBootScript('other=1; theme=dark') === '' ? 'ltr' : 'x').toBe('ltr')
    expect(() => {
      const run = new Function('document', DIRECTION_BOOT_SCRIPT)
      run({ get cookie(): string { throw new Error('sandboxed') }, documentElement: { dir: '' } })
    }).not.toThrow()
  })

  it('IS INERT TODAY, and that is stated rather than dressed up as coverage', () => {
    // AGENTS.md §7's rule about labelling a case rather than letting it look stronger than it
    // is. With `RTL_LOCALES` empty the script cannot set `dir` to anything at all, so none of
    // the assertions above is evidence that it would set it CORRECTLY — only that it agrees
    // with `directionFor`, which also answers 'ltr' for everything. The day an `rtl` row is
    // added, every test in this file starts meaning something more and this one goes red,
    // which is the intended way to be reminded.
    expect(RTL_LOCALES).toHaveLength(0)
    expect(runBootScript(`${LOCALE_PICK_COOKIE}=ar`)).toBe('')
  })
})
