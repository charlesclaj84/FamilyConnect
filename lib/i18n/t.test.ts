import { describe, expect, it } from 'vitest'
import { interpolate, placeholdersIn, translate, translator } from './t'
import { availableLocales, hasLanguageChoice, tFor, CATALOGUES } from './catalogues'
import { en } from './en'
import { BASE_LOCALE, LOCALES, isSupportedLocale, negotiateLocale } from './locales'

/**
 * `lib/i18n/*`, under `npm test` — a `verify.yml` step, so this gates a pull request.
 *
 * ── WHAT IS WORTH TESTING HERE AND WHAT IS NOT ──────────────────────────────────────
 * Not the copy. `npm run i18n:check` gates the STRUCTURE — a key used and not defined, a key
 * defined and not used, a placeholder invented by a translation, a translation whose English
 * source has moved — and neither script nor test can judge whether the words are any good.
 *
 * What is worth testing is the fallback BEHAVIOUR, because all three of its outcomes look
 * similar from a call site and only one of them is correct in each case:
 *
 *   translated          the string in that language
 *   untranslated        the ENGLISH string, silently — the reader sees something true
 *   no such key         the KEY ITSELF, visibly — a programming error nobody should miss
 *
 * Getting the second and third the same way round is the point. A missing TRANSLATION must
 * degrade invisibly; a missing KEY must not.
 *
 * ── CHECKED BY MUTATION (AGENTS.md §7b) ─────────────────────────────────────────────
 * Measured, with the file diffed after each edit to confirm the mutation applied:
 *
 *   1. `catalogue?.[key] ?? base[key]` → `catalogue?.[key]`            4 failed
 *   2. unknown key returns `''` instead of the key                     1 failed
 *   3. `interpolate` blanks an unmatched placeholder                    1 failed
 *   4. `negotiateLocale` compares whole tags, not the primary subtag    2 failed
 *   5. `availableLocales` returns `LOCALES` unfiltered                  1 failed
 *
 * The numbers first written here were estimates and three were wrong; these are measured.
 * MUTATION 1 IS THE LOAD-BEARING ONE — dropping the English fallback takes four tests, because
 * it is the behaviour every untranslated string in the product depends on.
 *
 * MUTATIONS 2, 3 AND 5 EACH FAIL EXACTLY ONE, and that thinness is worth knowing rather than
 * smoothing over: each is a whole rule resting on a single assertion. **Do not delete those
 * three tests to tidy the file.** They are, in order, the reason a missing key is visible, the
 * reason a missing variable is visible, and the reason the switcher cannot offer a language the
 * product does not speak.
 */

const es = { 'nav.section.community': 'Comunidad' }

describe('translate', () => {
  it('prefers the chosen language', () => {
    expect(translate(es, en, 'nav.section.community')).toBe('Comunidad')
  })

  it('falls back to English for a key that language has not translated', () => {
    // SILENTLY, and that is the decision: the reader sees a true string in the wrong language
    // rather than a blank or a key. The backlog is reported in CI by `i18n:check`, which is
    // where a backlog belongs — a member cannot act on it.
    expect(translate(es, en, 'nav.section.accounting')).toBe('Accounting')
  })

  it('falls back to English when there is no catalogue for the language at all', () => {
    // The state Phase 3 ships in: `es` is declared in LOCALES and has no catalogue.
    expect(translate(undefined, en, 'nav.section.accounting')).toBe('Accounting')
  })

  it('returns the KEY for a key that does not exist, and never a blank', () => {
    // Ugly on purpose. It is a programming error, it cannot be data-dependent, and a blank
    // where a caption belongs reads as a rendering fault rather than as missing copy.
    expect(translate(es, en, 'nav.section.nonsense')).toBe('nav.section.nonsense')
    expect(translate(es, en, 'nav.section.nonsense')).not.toBe('')
  })

  it('does not throw for a key that does not exist', () => {
    // A layout must not 500 over a caption.
    expect(() => translate(undefined, {}, 'anything')).not.toThrow()
  })
})

describe('interpolate', () => {
  it('substitutes a placeholder', () => {
    expect(interpolate('Hello {name}', { name: 'Martha' })).toBe('Hello Martha')
  })

  it('substitutes the same placeholder more than once', () => {
    expect(interpolate('{a} and {a}', { a: 'x' })).toBe('x and x')
  })

  it('formats a number by coercion and nothing more', () => {
    // Deliberately not locale-formatted here: a number in a sentence is the CALLER's to format,
    // through `formatMoney` or `Intl.NumberFormat` with the reader's tag. Doing it here would
    // put a second, weaker money formatter inside the string layer.
    expect(interpolate('{n} tasks', { n: 12 })).toBe('12 tasks')
  })

  it('LEAVES an unmatched placeholder alone rather than blanking it', () => {
    // `{count}` on screen is a visible bug somebody reports. An empty gap is a sentence that
    // reads fine and means something else, which is the worse of the two.
    expect(interpolate('Hello {name}', {})).toBe('Hello {name}')
    expect(interpolate('Hello {name}')).toBe('Hello {name}')
  })

  it('is not a template engine, and asserts that it is not', () => {
    // One form and no other. If any of these ever start working, somebody has added a syntax
    // that needs a parser, a spec and a test per combination — see the header on `interpolate`.
    expect(interpolate('{a.b}', { 'a.b': 'x' })).toBe('{a.b}')
    expect(interpolate('{{a}}', { a: 'x' })).toBe('{x}')
    expect(interpolate('{ a }', { a: 'x' })).toBe('{ a }')
  })
})

describe('placeholdersIn', () => {
  it('finds each placeholder once, in order', () => {
    expect(placeholdersIn('{b} then {a} then {b}')).toEqual(['b', 'a'])
  })

  it('finds none in a plain string', () => {
    expect(placeholdersIn('Dues & Donations')).toEqual([])
  })

  it('is the same parser the gate uses', () => {
    // `scripts/i18n-coverage.mjs` imports this rather than regexing the source, for the reason
    // `help-check.mjs` imports `parseInline`: a gate whose parser disagrees with the runtime's
    // passes strings the runtime then mangles.
    expect(placeholdersIn('Hello {name}')).toEqual(['name'])
  })
})

describe('translator', () => {
  it('binds one language', () => {
    const t = translator({ en, es }, 'es')
    expect(t('nav.section.community')).toBe('Comunidad')
    expect(t('nav.section.accounting')).toBe('Accounting')
  })

  it('falls back to English for an unknown language', () => {
    // A stored preference the product no longer speaks — a locale removed from CATALOGUES, or a
    // value written before a rename. English, not a crash and not a blank.
    const t = translator({ en }, 'klingon')
    expect(t('nav.section.community')).toBe('Community')
  })

  it('interpolates through the bound function', () => {
    const t = translator({ en: { greet: 'Hello {name}' } }, 'en')
    expect(t('greet', { name: 'Martha' })).toBe('Hello Martha')
  })
})

describe('the registry', () => {
  it('has English, which is the base', () => {
    expect(BASE_LOCALE).toBe('en')
    expect(CATALOGUES[BASE_LOCALE]).toBeDefined()
  })

  it('offers only locales that have a catalogue', () => {
    // THE RULE THAT KEEPS THE SWITCHER HONEST. `LOCALES` declares three; only those with a
    // catalogue may be offered, because a control that offers a language the product cannot
    // speak is a control that lies.
    const offered = availableLocales().map(l => l.code)
    for (const code of offered) expect(CATALOGUES[code]).toBeDefined()
    expect(offered.length).toBeLessThanOrEqual(LOCALES.length)
  })

  it('reports no language CHOICE while there is one catalogue', () => {
    // Phase 3's state, asserted rather than assumed — and this is the line that will go red the
    // moment `es.ts` lands, which is exactly when the switcher should start rendering.
    expect(hasLanguageChoice()).toBe(availableLocales().length > 1)
  })

  it('keeps registry order rather than object-key order', () => {
    const offered = availableLocales().map(l => l.code)
    const declared = LOCALES.map(l => l.code).filter(c => offered.includes(c))
    expect(offered).toEqual(declared)
  })
})

describe('negotiateLocale', () => {
  it('matches on the PRIMARY subtag, which is the load-bearing part', () => {
    // `es-MX`, `es-419` and `es` must all find Spanish. Comparing whole tags would send a
    // family in Monterrey English.
    expect(negotiateLocale('es-MX,es;q=0.9,en;q=0.8')).toBe('es')
    expect(negotiateLocale('es-419')).toBe('es')
    expect(negotiateLocale('fr-CA')).toBe('fr')
  })

  it('takes the first tag the product speaks, not the first tag', () => {
    expect(negotiateLocale('de-DE,de;q=0.9,fr;q=0.8')).toBe('fr')
  })

  it('answers null when nothing matches, so a stated preference can win', () => {
    expect(negotiateLocale('de-DE,ja;q=0.9')).toBeNull()
    expect(negotiateLocale('')).toBeNull()
    expect(negotiateLocale(null)).toBeNull()
  })

  it('ignores case and whitespace, which real headers carry', () => {
    expect(negotiateLocale('ES-mx, EN;q=0.5')).toBe('es')
    expect(negotiateLocale('  fr ')).toBe('fr')
  })
})

describe('isSupportedLocale', () => {
  it('accepts the declared locales and nothing else', () => {
    expect(isSupportedLocale('en')).toBe(true)
    expect(isSupportedLocale('es')).toBe(true)
    expect(isSupportedLocale('klingon')).toBe(false)
    expect(isSupportedLocale('')).toBe(false)
    expect(isSupportedLocale(null)).toBe(false)
  })

  it('is what people_locale_check mirrors, so the two must not drift', () => {
    // `20260826000002` constrains the column to exactly this set. The CHECK is the layer a
    // caller who never loads the form cannot get past; this is the layer that tells them why.
    // Asserted as a set so adding a language here without the migration is visible.
    expect(LOCALES.map(l => l.code).sort()).toEqual(['en', 'es', 'fr'])
  })
})

/**
 * SPANISH IS LIVE (Phase 4), and this is what asserts it rather than assuming it.
 *
 * ── WHY THE REGISTRY TESTS ABOVE DO NOT COVER THIS ──────────────────────────────────
 * They were written in Phase 3 to survive a second catalogue arriving —
 * `hasLanguageChoice()` is compared against `availableLocales().length > 1`, which is true
 * either way. That was deliberate so they would not go red on the day Spanish landed. The cost
 * is that they say nothing about whether it DID, so the assertions below are the ones that
 * would notice `es` being dropped from `CATALOGUES` or `es.ts` being emptied.
 */
describe('Spanish', () => {
  it('is offered, so the switcher renders', () => {
    // The one line that made the switcher appear. Before Phase 4 this was false and
    // `LocaleSwitcher` returned null — a picker over one language is furniture.
    expect(hasLanguageChoice()).toBe(true)
    expect(availableLocales().map(l => l.code)).toContain('es')
  })

  it('resolves through the same `t` the components use', () => {
    // End to end: the registry, the binder and the catalogue. Not `translate(es, en, …)`, which
    // would test the resolver against a fixture and skip the wiring.
    const t = tFor('es')
    expect(t('nav.section.community')).toBe('Comunidad')
    expect(t('nav.item./library/meeting-minutes')).toBe('Actas')
  })

  it('covers every English key, so nothing silently falls back', () => {
    // `i18n:check` reports the backlog as a COUNT; this asserts it is zero. The two are
    // different claims: the script's figure is informational and a test is a gate.
    const missing = Object.keys(en).filter(k => !(k in CATALOGUES.es))
    expect(missing).toEqual([])
  })

  it('addresses the reader FORMALLY, which is the decision most easily undone', () => {
    // `usted`, never `tú`. It reaches every string that addresses the reader, so it cannot be
    // changed one line at a time — and a well-meaning edit to a single control is exactly how a
    // product ends up addressing you two ways. These two strings are where the second person
    // actually appears, so they are the ones worth pinning.
    expect(tFor('es')('language.choose')).toBe('Elija un idioma')   // not 'Elige'
    expect(tFor('es')('switcher.heading')).toBe('Sus familias')     // not 'Tus familias'
  })

  it('keeps reunión and junta apart, which is why duplicate captions kept two keys', () => {
    // English calls both a "gathering" and a "meeting"; Spanish distinguishes the social
    // occasion from the formal proceeding. `en.ts` keeps a separate key for every caption that
    // repeats, and this is the assertion that the separation was worth having: collapsing them
    // would have forced one Spanish word onto both.
    const t = tFor('es')
    expect(t('nav.item./gatherings')).toBe('Reuniones')
    expect(t('nav.item./reporting/meetings')).toBe('Juntas')
    expect(t('nav.item./gatherings')).not.toBe(t('nav.item./reporting/meetings'))
  })

  it('formats numbers and dates with the Mexican tag, not the bare code', () => {
    // `lib/i18n/locales.ts`' whole reason for carrying two codes. A bare `'es'` resolves to
    // SPAIN's conventions, which is the wrong answer for a family in Monterrey and fails
    // silently because the output is a plausible number either way.
    const tag = availableLocales().find(l => l.code === 'es')!.intl
    expect(tag).toBe('es-MX')
    expect(tag).not.toBe('es')
  })
})

/**
 * FRENCH IS LIVE (Phase 4), and this block is not a copy of the Spanish one.
 *
 * Three of its five assertions are the same CLAIM about a different language — offered,
 * complete, formally addressed — and are worth repeating for the reason the Spanish header
 * gives: the registry tests above are true whether or not a given catalogue exists, so only an
 * assertion naming `fr` would notice it being dropped or emptied.
 *
 * The last two are things nothing else in the repo can see:
 *
 *   * **The no-break spaces.** French sets a space before `:`, `?` and `!`, and this file uses
 *     U+00A0 so a label cannot wrap with the punctuation orphaned. `i18n:check` compares key
 *     sets, placeholders and source hashes — it has no opinion about typography, and a plain
 *     space is invisible in a diff and in a screenshot. An editor "tidying" one is exactly the
 *     kind of change that would go unnoticed forever.
 *   * **`fr-FR`, not `fr`.** The same trap `es-MX` is pinned against one describe above: a bare
 *     code formats plausibly and wrongly.
 */
describe('French', () => {
  it('is offered, so the switcher lists three languages', () => {
    expect(hasLanguageChoice()).toBe(true)
    expect(availableLocales().map(l => l.code)).toEqual(['en', 'es', 'fr'])
  })

  it('covers every English key, so nothing silently falls back', () => {
    const missing = Object.keys(en).filter(k => !(k in CATALOGUES.fr))
    expect(missing).toEqual([])
  })

  it('addresses the reader FORMALLY, which is the decision most easily undone', () => {
    // `vous`, never `tu` — the same rule Spanish keeps, pinned on the two strings where the
    // second person actually appears.
    expect(tFor('fr')('language.choose')).toBe('Choisissez une langue')  // not 'Choisis'
    expect(tFor('fr')('switcher.heading')).toBe('Vos familles')          // not 'Tes familles'
  })

  it('keeps rassemblement and réunion apart, the same distinction Spanish needs', () => {
    // A `réunion` in French is the formal proceeding with a secretary and minutes, not the
    // family picnic. Confirming the duplicate-caption rule in `en.ts` pays off in a SECOND
    // language rather than being a property of Spanish alone.
    const t = tFor('fr')
    expect(t('nav.item./gatherings')).toBe('Rassemblements')
    expect(t('nav.item./reporting/meetings')).toBe('Réunions')
    expect(t('nav.item./gatherings')).not.toBe(t('nav.item./reporting/meetings'))
  })

  it('uses a NO-BREAK space before a colon, which no gate can see', () => {
    // U+00A0, not U+0020. `i18n:check` compares key sets, placeholders and source hashes and has
    // no opinion about typography, so this is the only thing standing between the French labels
    // and somebody normalising the whitespace.
    //
    // U+202F is the more correct character and is deliberately not used: it renders as a
    // missing-glyph box in some fallback fonts, and a visible box in a theme label is worse than
    // a slightly wide space. Pinned so that choice is a decision rather than a drift.
    const label = tFor('fr')('theme.currentLabel')
    expect(label).toContain('\u00a0:')
    expect(label).not.toContain(' :')
    expect(label).not.toContain('\u202f')
  })

  it('formats numbers and dates with the France tag, not the bare code', () => {
    const tag = availableLocales().find(l => l.code === 'fr')!.intl
    expect(tag).toBe('fr-FR')
    expect(tag).not.toBe('fr')
  })
})
