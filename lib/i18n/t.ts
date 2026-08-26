import { BASE_LOCALE } from '@/lib/i18n/locales'

/**
 * Looking a string up in a language.
 *
 * ── WHY THERE IS NO LIBRARY HERE ────────────────────────────────────────────────────
 * The instinct is `next-intl`. It is the wrong shape for this repo, and the argument is
 * already written down one directory over: `lib/help/inline.ts` declined a markdown renderer
 * because it would be *"a dependency, a sanitiser, and a styling override for every element it
 * can emit"* to buy two forms of markup that already existed. The same holds here. What this
 * product needs is a typed record and a lookup; what a library adds is a provider, a message
 * format, a plural engine, a routing integration and a build step, most of which this codebase
 * already has its own opinions about.
 *
 * So: a flat record of strings per language, one function to read it, and a script that gates
 * the things a person cannot check by eye.
 *
 * ── FLAT DOT-KEYS, NOT A NESTED OBJECT ──────────────────────────────────────────────
 * `'nav.section.community'`, not `{ nav: { section: { community } } }`. Three reasons and the
 * third is the one that decided it:
 *
 *   * a flat record DIFFS one line per string, so a review shows exactly which copy changed
 *   * `Record<string, string>` needs no recursive type to express `Partial<>` of it
 *   * **the gate can compare key SETS with set arithmetic.** Nested, every check in
 *     `scripts/i18n-coverage.mjs` becomes a tree walk, and the fingerprint file becomes a tree
 *     that has to be merged rather than a map that can be replaced.
 *
 * ── A MISSING STRING FALLS BACK TO ENGLISH, VISIBLY ─────────────────────────────────
 * Three outcomes, and they are deliberately different:
 *
 *   translated          the string in that language.
 *   not translated yet  the ENGLISH string. `i18n:check` reports it as owed, so the backlog is
 *                       counted in CI rather than discovered on screen.
 *   no such key         the KEY ITSELF, e.g. `nav.section.nonsense`. Ugly on purpose: it is a
 *                       programming error, it cannot be data-dependent, and it should be
 *                       impossible to miss in development. `i18n:check` also catches it
 *                       statically, which is the layer that actually stops it shipping.
 *
 * Never an empty string and never a crash. A blank where a label should be is the one outcome
 * that reads as a rendering bug rather than as missing copy.
 */

/** One language's strings. Flat, so the gate can do set arithmetic on the keys. */
export type Catalogue = Record<string, string>

/** What an interpolated string may be given. Numbers are formatted by the caller, not here. */
export type Vars = Record<string, string | number>

/**
 * Substitute `{name}` placeholders.
 *
 * ── IT IS NOT A TEMPLATE ENGINE AND MUST NOT BECOME ONE ─────────────────────────────
 * One form, `{name}`, and nothing else — no conditionals, no formatting directives, no nested
 * lookups. `lib/help/inline.ts` makes the same call about markup and states the reason: the
 * moment this grows a second syntax it needs a parser, a spec and a test for every combination,
 * to serve a product whose copy is sentences with names in them.
 *
 * A placeholder with no matching variable is LEFT AS IT IS rather than blanked. `{count}` on
 * screen is a visible bug somebody reports; an empty gap is a sentence that reads fine and
 * means something else. `i18n:check` asserts that every placeholder in a translation appears in
 * the English string, which is the layer that stops it reaching a screen.
 */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole)
}

/**
 * Every `{placeholder}` in a string, in order, deduplicated.
 *
 * Exported because `scripts/i18n-coverage.mjs` needs exactly this and must not reimplement it —
 * a gate whose parser disagrees with the runtime's is a gate that passes strings the runtime
 * then mangles. Same argument `help-check.mjs`' header makes for importing `parseInline` rather
 * than regexing the source.
 */
export function placeholdersIn(template: string): string[] {
  const found = new Set<string>()
  for (const m of template.matchAll(/\{(\w+)\}/g)) found.add(m[1])
  return [...found]
}

/**
 * Read one key, in one language, with the English catalogue as the fallback.
 *
 * Both catalogues are passed in rather than looked up, so this function is pure and the whole of
 * it is testable by value — the same reason `duesPlanMath` takes `today` (§7b). `translator`
 * below is the impure-ish convenience that resolves them from the registry.
 */
export function translate(
  catalogue: Catalogue | undefined,
  base: Catalogue,
  key: string,
  vars?: Vars,
): string {
  const found = catalogue?.[key] ?? base[key]
  // THE KEY ITSELF for an unknown key — see the header. Deliberately not '' and deliberately
  // not a throw: a layout must not 500 over a caption, and a blank reads as a rendering fault.
  if (found === undefined) return key
  return interpolate(found, vars)
}

/**
 * A `t` bound to one language.
 *
 * ── THE REGISTRY IS IMPORTED, WHICH IS A BUNDLE DECISION WORTH KNOWING ──────────────
 * `CATALOGUES` is a static import, so **every language's strings ship in the browser bundle**,
 * not only the reader's. That is right at this size — the shell catalogue is a few kilobytes of
 * text — and it is what lets a client component call `t` with no provider, no context and no
 * loading state.
 *
 * It stops being right at some point, and the threshold is worth naming rather than discovering:
 * when the catalogues reach the order of `lib/help/content.ts` (~79KB, which AGENTS.md already
 * records as too big to import from a client component), the answer is a per-locale dynamic
 * import at the layout boundary. Until then this is the simpler thing and simpler is correct.
 *
 * The manual and the marketing copy are deliberately NOT in this registry for that reason —
 * they get their own per-locale modules, loaded by the server components that render them.
 */
export function translator(catalogues: Record<string, Catalogue>, locale: string) {
  const base = catalogues[BASE_LOCALE] ?? {}
  const chosen = catalogues[locale]
  return (key: string, vars?: Vars): string => translate(chosen, base, key, vars)
}

/** What a `t` looks like to a component that takes one as a prop. */
export type T = (key: string, vars?: Vars) => string
