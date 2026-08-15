import { cn } from '@/lib/utils'
import { TIER_LABEL } from '@/lib/tiers'
import type { HelpAvailability } from '@/lib/help/availability'

/**
 * The one-word answer to "can I actually open this?", on a chapter card and at the top of
 * the chapter itself.
 *
 * NOTHING IS DRAWN FOR THE ORDINARY CASE. A badge on every chapter is a badge on nothing —
 * the eye has twenty equal pills to sort through and the one that matters differs only in
 * hue. Same reasoning as the rail, which fills exactly one row.
 *
 * THE THREE TONES ARE THREE DIFFERENT KINDS OF FACT, and the tokens say which:
 *
 *   Coming soon      a fact about the BUILD. Nobody has it, on any plan, so it is not
 *                    withheld from this reader in particular — muted, like a footnote.
 *   Plan             a thing the family could buy this afternoon. `--brand-soft` is the
 *                    resting-pill pair; it reads as an offer rather than as a refusal.
 *   Not granted      a capability genuinely being withheld, which is the one job
 *                    `--brand-withheld` exists for. NOT `--destructive`: being outside
 *                    somebody's permission template is neither an error nor a deletion.
 */
export function HelpAvailabilityBadge({
  availability,
  className,
}: {
  availability: HelpAvailability | undefined
  className?: string
}) {
  if (!availability || availability.state === 'open' || availability.state === 'general') return null

  const [label, tone] =
    availability.state === 'coming-soon'
      ? ['Coming soon', 'bg-muted text-muted-foreground'] as const
      : availability.state === 'needs-plan'
        ? [`${TIER_LABEL[availability.tier]} plan`, 'bg-brand-soft text-brand-on-soft'] as const
        : ['Not in your access', 'bg-brand-withheld/10 text-brand-withheld'] as const

  return (
    <span
      className={cn(
        'inline-block shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone,
        className,
      )}
    >
      {label}
    </span>
  )
}

/**
 * The same answer as a sentence, for the top of a chapter — where there is room to say
 * what to do about it, and where a bare pill would leave the reader to guess.
 *
 * Deliberately not a `FormError`. Nothing has failed and nothing was refused: the reader
 * asked for a manual and got one. See components/ui/form-message.tsx, which owns the other
 * case and must not be borrowed for this one.
 */
export function HelpAvailabilityNote({ availability }: { availability: HelpAvailability | undefined }) {
  if (!availability || availability.state === 'open' || availability.state === 'general') return null

  const text =
    availability.state === 'coming-soon'
      ? 'This part of the product has not shipped yet. The chapter describes what it will do; opening the screen today shows a Coming Soon notice.'
      : availability.state === 'needs-plan'
        ? `This is included in the ${TIER_LABEL[availability.tier]} plan, and your family is on a lower one. Everything below is accurate — the screen simply offers an upgrade instead of opening.`
        : 'Your permission template does not include this screen, so opening it will say the page cannot be found. An administrator of your family can change that from Members.'

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-muted/40 px-4 py-3">
      <HelpAvailabilityBadge availability={availability} />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
