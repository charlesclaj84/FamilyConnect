/**
 * Blank the comments — and optionally the string CONTENTS — of a TypeScript source, keeping
 * every byte position.
 *
 * ── WHY TWO GATES NEEDED THIS AND WHY THERE IS ONE COPY ─────────────────────────────
 * Both `time-display.mjs` and `i18n-coverage.mjs` sweep the tree for a call shape, and this
 * codebase's doc comments discuss the very shapes they search for. Each script found that out
 * the same way — by reporting its own documentation as a defect:
 *
 *   `time-display.mjs`    `lib/tz.ts`' header contains `formatDate(row.created_at)` as the
 *                         example of what NOT to do.
 *   `i18n-coverage.mjs`   `Sidebar.tsx`' header contains a `t('nav.section.…')` example while
 *                         explaining the key scheme, and the gate reported it as a key used but
 *                         not defined.
 *
 * So it lives here rather than twice. The argument is the one `help-check.mjs` makes about its
 * `@/` hook: *"a second, subtly different alias resolver is how two runners come to disagree
 * about which file `@/lib/features` means."* Two subtly different comment strippers would be
 * two gates disagreeing about what counts as code.
 *
 * ── TWO CALLERS WANT DIFFERENT THINGS, AND THAT IS NOT A SUBTLETY ───────────────────
 * `time-display.mjs` searches for CALL SHAPES and column names in code, so it wants string
 * contents gone too. `i18n-coverage.mjs` searches for `t('the.key')` and needs exactly those
 * contents — blanking them would erase the thing it is looking for.
 *
 * So: one scanner with a flag rather than two functions with copied loops. The scanner tracks
 * strings EITHER WAY, even when it is not blanking them — without that, a `//` inside a string
 * (every `https://` URL in the tree) would start what it believed was a comment and blank the
 * rest of the line.
 *
 * ── LENGTH IS PRESERVED, WHICH IS THE WHOLE INTERFACE ───────────────────────────────
 * Every blanked character becomes a space and every newline survives, so an index into the
 * result is an index into the original and counting newlines up to it still gives the real line
 * number. A stripper that DELETED comments would report every finding at the wrong line, which
 * is worse than not reporting it: a line number nobody can follow teaches people to stop
 * following them.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────────────
 * Not a parser. It does not understand REGEX LITERALS, so a regex containing an unbalanced
 * quote starts what it believes is a string and blanks forward to the next one. That has not
 * bitten either caller — both search for call shapes rather than for quotes — but it is the
 * known limit and the reason to reach for a real parse if a third gate ever wants something
 * subtler than "is this text code".
 */

const NEWLINE = '\n'
const BACKSLASH = '\\'

function scan(src, blankStrings) {
  const out = src.split('')
  let i = 0
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) {
      if (out[k] !== NEWLINE) out[k] = ' '
    }
  }
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      blank(i, stop)
      i = stop
      continue
    }
    if (two === '//') {
      let end = src.indexOf(NEWLINE, i)
      if (end === -1) end = src.length
      blank(i, end)
      i = end
      continue
    }
    const ch = src[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < src.length) {
        if (src[j] === BACKSLASH) { j += 2; continue }
        if (src[j] === ch) break
        j++
      }
      // The QUOTES always survive, so a caller still sees the call shape `t('` even when the
      // contents are gone.
      if (blankStrings) blank(i + 1, j)
      i = j + 1
      continue
    }
    i++
  }
  return out.join('')
}

/** Comments blanked, string contents KEPT. For a gate that reads string arguments. */
export function stripComments(src) {
  return scan(src, false)
}

/** Comments AND string contents blanked. For a gate that reads code only. */
export function stripCode(src) {
  return scan(src, true)
}
