import Link from 'next/link'
import { Info } from 'lucide-react'
import { parseInline } from '@/lib/help/inline'
import type { HelpBlock } from '@/lib/help/content'

/**
 * How the manual is drawn. Server components throughout — the manual has no state, no
 * interaction and nothing to hydrate, so none of this belongs on the client.
 *
 * ── ALL THE STYLING IS HERE, AND NONE OF IT IS IN `content.ts` ──────────────────────
 * That split is the point. The content file says "this is a step, this is a note"; this
 * file decides what a step and a note look like. Anything else and a spacing change is a
 * two-hundred-line diff through the prose, and the prose stops being reviewable as prose.
 *
 * Tokens only, per AGENTS.md — there is no colour literal in this file and there may not
 * be one.
 */

/** One string, with `**bold**` and `[links](/route)` resolved. */
export function HelpText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, i) => {
        if (token.kind === 'strong') {
          return <strong key={i} className="font-semibold text-foreground">{token.text}</strong>
        }
        if (token.kind === 'link') {
          // External links open away from the app; everything else is a client-side
          // navigation, so the manual does not throw away the page it was read from.
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

/**
 * A run of blocks.
 *
 * The vertical rhythm lives on this wrapper rather than on each block, so a block type
 * added later inherits the spacing instead of having to match it by hand.
 */
export function HelpBlocks({ blocks }: { blocks: readonly HelpBlock[] }) {
  return (
    <div className="space-y-4 text-[0.95rem] leading-7">
      {blocks.map((block, i) => <Block key={i} block={block} />)}
    </div>
  )
}

function Block({ block }: { block: HelpBlock }) {
  switch (block.kind) {
    case 'text':
      return <p><HelpText text={block.text} /></p>

    case 'steps':
      return (
        <ol className="list-outside list-decimal space-y-2 pl-6 marker:font-semibold marker:text-brand-accent">
          {block.items.map((item, i) => <li key={i}><HelpText text={item} /></li>)}
        </ol>
      )

    case 'bullets':
      return (
        <ul className="list-outside list-disc space-y-2 pl-6 marker:text-brand-accent">
          {block.items.map((item, i) => <li key={i}><HelpText text={item} /></li>)}
        </ul>
      )

    // A description list rather than a two-column table. A term and its meaning is not a
    // grid, so none of AGENTS.md's table apparatus applies — and a <dl> already reads
    // correctly on a phone without a single cell being folded.
    case 'defs':
      return (
        <dl className="divide-y rounded-xl border bg-card">
          {block.items.map((item, i) => (
            <div key={i} className="px-4 py-3 sm:flex sm:gap-4">
              <dt className="font-semibold sm:w-52 sm:shrink-0">{item.term}</dt>
              <dd className="text-muted-foreground"><HelpText text={item.text} /></dd>
            </div>
          ))}
        </dl>
      )

    // NOT `--destructive`, and not `--brand-withheld` either. A note is neither a failure
    // nor a capability being taken away — it is one sentence worth slowing down for — so
    // it takes the same muted well the app already uses for informational banners.
    case 'note':
      return (
        <div className="flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <Info className="mt-1 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
          <p className="text-sm text-muted-foreground"><HelpText text={block.text} /></p>
        </div>
      )
  }
}
