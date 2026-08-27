import Link from 'next/link'
import { parseInline } from '@/lib/help/inline'

/**
 * One string, with `**bold**` and `[label](/route)` resolved into elements.
 *
 * ── IT WAS `HelpText`, AND PHASE 5 IS WHY IT MOVED ──────────────────────────────────
 * `lib/help/inline.ts` was written for the manual: two inline forms, a parser rather than a
 * markdown dependency, and its own test file. Phase 5 needs exactly that everywhere else — a
 * catalogue string is plain text, and plenty of the product's sentences name a control in
 * **bold** or link to another screen mid-paragraph.
 *
 * The alternatives were both worse. Splitting such a sentence into three keys hands a translator
 * fragments and forbids the word order from moving, which is the whole reason the email
 * catalogue keeps its `<strong>` inside the string. Rendering an HTML string would mean
 * `dangerouslySetInnerHTML` over text that, on the surfaces still to come, a member typed.
 *
 * `HelpProse` re-exports this as `HelpText` so the manual's call sites are unchanged and there
 * is ONE implementation. The parser stays in `lib/help/` — moving it would touch `help:check`
 * and the module is the same module wherever it is filed.
 *
 * ── A FORM THAT IS NOT ONE OF THE TWO RENDERS LITERALLY ─────────────────────────────
 * Which is the safe direction and is worth knowing before writing a catalogue string: an
 * unterminated `**` prints as asterisks rather than swallowing the rest of the sentence.
 * `lib/help/inline.test.ts` is where those edges are pinned.
 *
 * ── NO `'use client'`, AND IT IS USABLE FROM BOTH SIDES ─────────────────────────────
 * It holds no state and calls no hook, so a client component importing it simply pulls it into
 * that route's bundle. Server pages render it directly. Nothing has to decide which it is.
 */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, i) => {
        if (token.kind === 'strong') {
          return <strong key={i} className="font-semibold text-foreground">{token.text}</strong>
        }
        if (token.kind === 'link') {
          // External links open away from the app; everything else is a client-side
          // navigation, so the reader does not throw away the page they were on.
          // No explicit colour: `globals.css` gives every anchor the accent, which is
          // exactly what a link in a paragraph of prose should be. The rails override it
          // because a rail is not prose — see the note in MainRail.
          return /^https?:\/\//.test(token.href)
            ? <a key={i} href={token.href} target="_blank" rel="noreferrer">{token.text}</a>
            : <Link key={i} href={token.href}>{token.text}</Link>
        }
        return <span key={i}>{token.text}</span>
      })}
    </>
  )
}
