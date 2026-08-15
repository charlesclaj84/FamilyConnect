/**
 * The only markup the help manual understands, and deliberately the smallest set that
 * lets its prose name a screen and link to it.
 *
 *   **bold**              a control the reader will see on screen — a button, a tab, a field
 *   [label](/route)       a link, internal or external
 *
 * ── WHY A PARSER AND NOT JSX ────────────────────────────────────────────────────────
 * Because `lib/help/content.ts` is the manual, and a manual written as JSX is a manual
 * nobody can restructure. Keeping the content as plain strings is what lets the same
 * chapter render as a page, as a card summary and as `generateMetadata`'s description
 * without three copies of the sentence — and it keeps `content.ts` free of React, which
 * the server pages need in order to resolve a slug before deciding whether to render at
 * all.
 *
 * ── WHY IT IS NOT MARKDOWN ──────────────────────────────────────────────────────────
 * A markdown renderer is a dependency, an HTML sanitiser and a styling override for every
 * element it can emit. Two inline forms cover everything this manual actually does, and a
 * form that is not in the table above renders as the literal characters — which is the
 * safe direction, because nothing here can emit HTML.
 *
 * PURE, and it stays that way: no React, no environment, no `server-only`. `inline.test.ts`
 * beside it is the check, per AGENTS.md §7b — this is exactly the shape of module that
 * runner exists for, and its edge cases (unterminated markup, adjacent tokens, a bracket
 * that is not a link) are the kind you verify by running rather than by reading.
 */

export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'link'; text: string; href: string }

/**
 * Bold first, then links.
 *
 * Both halves are lazy and neither may span a newline-free run of the other's delimiter:
 * `[^*]` and `[^\]]` are what stop `**a** and **b**` collapsing into one enormous bold
 * run. The href excludes whitespace and `)` so a closing parenthesis in ordinary prose —
 * "(see the rail)" — cannot be swallowed by a link that started earlier in the sentence.
 *
 * Shared at module scope even though it carries `g`: `String.prototype.matchAll` iterates
 * a clone, so `lastIndex` on this literal is never advanced and two callers cannot
 * interfere with one another.
 */
const MARKUP = /\*\*([^*]+?)\*\*|\[([^\]]+?)\]\(([^\s)]+)\)/g

/**
 * Split one string into its runs. Text between markup is preserved exactly, including
 * whitespace, so a token boundary never eats a space.
 *
 * Unmatched markup is not an error and does not throw — `**` on its own, or `[a](` with
 * no closing paren, simply falls through as text. A manual should render imperfectly
 * rather than blank.
 */
export function parseInline(source: string): InlineToken[] {
  const out: InlineToken[] = []
  let cursor = 0

  for (const match of source.matchAll(MARKUP)) {
    const at = match.index
    if (at > cursor) out.push({ kind: 'text', text: source.slice(cursor, at) })

    if (match[1] !== undefined) {
      out.push({ kind: 'strong', text: match[1] })
    } else {
      out.push({ kind: 'link', text: match[2], href: match[3] })
    }

    cursor = at + match[0].length
  }

  if (cursor < source.length) out.push({ kind: 'text', text: source.slice(cursor) })
  return out
}

/**
 * The same string with every marker removed — for a `<title>`, a meta description or an
 * `aria-label`, none of which can carry an element.
 */
export function stripInline(source: string): string {
  return parseInline(source).map(t => t.text).join('')
}
