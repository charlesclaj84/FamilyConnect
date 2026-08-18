import Link from 'next/link'
import { CircleQuestionMark } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A link to one named part of the manual, placed by hand beside the control it explains.
 *
 * ── HOW THIS DIFFERS FROM `ContextHelpLink`, AND WHY BOTH EXIST ─────────────────────
 * The top bar's icon is automatic and answers "where am I?" — it points at the chapter for
 * whatever screen is open, on every screen, resolved from the path. This one is placed, and
 * answers "what does THIS do?" — it points at one SECTION, chosen by whoever wrote the
 * screen, next to the one control on it that reliably confuses people.
 *
 * ── IT IS PLACED SPARINGLY, AND THAT IS THE DESIGN ─────────────────────────────────
 * An icon on everything is an icon on nothing: twenty equal question marks and the eye has
 * to sort them, so the one beside the control that genuinely needs a paragraph reads as
 * decoration. `components/help/HelpAvailabilityBadge.tsx` makes the same argument about
 * badges — "a badge on every chapter is a badge on nothing" — and the rail makes it a third
 * time by filling exactly one row.
 *
 * The test for adding one: **is there a sentence in the manual that a member standing at
 * this control needs, and would not think to go looking for?** Arrears arithmetic, what a
 * permission template actually resolves, why somebody is or is not in the bloodline, what a
 * plan change does to pages — those qualify. "This is the Save button" does not. If the
 * answer is "the chapter as a whole", the top bar already covers it and this adds nothing.
 *
 * ── NO HOOKS AND NO IMPORT OF `content.ts` ─────────────────────────────────────────
 * A plain function component, so it renders from either side of the boundary — most of the
 * seven call sites are inside `'use client'` components. It deliberately does NOT import
 * the manual to validate its own props: that would bundle all ~79KB of prose into every one
 * of those clients (see `lib/help/routes.ts`). The literals are checked instead by
 * `npm run help:check`, which sweeps `app/` and `components/` for them and resolves each
 * against the real chapters — that check is the ONLY thing standing between a renamed
 * section and an anchor that silently lands at the top of the wrong page.
 *
 * ── THE TWO CONTRACTS ON THE PROPS ─────────────────────────────────────────────────
 *   * `label` NAMES the chapter or the section — "How arrears are worked out", "Permission
 *     templates". Never "Help" alone: in the `inline` variant it is the visible text and in
 *     the `icon` variant it is the accessible name, and a screen with three controls each
 *     labelled "Help" tells a screen-reader user which one to pick by leaving them to
 *     guess.
 *   * `section` must be a real `HelpSection.id` **in that chapter**. Section ids are unique
 *     per chapter and NOT globally (`what-it-is` appears in four), so a wrong pairing is a
 *     link that loads and then does not scroll — which reads as the manual having lost the
 *     paragraph.
 */
export function HelpLink({
  slug,
  section,
  label,
  variant = 'icon',
  className,
}: {
  /** A `HelpChapter.slug`. */
  slug: string
  /** A `HelpSection.id` in THAT chapter. Omit to land at the top of it. */
  section?: string
  /** Names the chapter or the section. Never "Help" on its own — see the header. */
  label: string
  /**
   * `icon` — a bare question mark, for a heading or a row of controls where the words
   * would compete with the control itself.
   * `inline` — the mark plus the words, for a place with room to say what the link is.
   */
  variant?: 'icon' | 'inline'
  className?: string
}) {
  const href = section ? `/help/${slug}#${section}` : `/help/${slug}`

  if (variant === 'icon') {
    return (
      <Link
        href={href}
        prefetch={false}
        aria-label={label}
        title={label}
        // `text-muted-foreground`, not the bar's `text-brand-ink`: this sits beside a
        // heading or a control that is the point of the row, and it must not compete with
        // it. Explicit either way — the unscoped `a { color: var(--brand-accent) }` in
        // app/globals.css recolours any anchor that does not say otherwise.
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
          'text-muted-foreground transition-colors hover:text-foreground hover:bg-brand-primary/10',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <CircleQuestionMark className="size-4" aria-hidden="true" />
      </Link>
    )
  }

  return (
    <Link
      href={href}
      prefetch={false}
      // The visible text IS the accessible name here, so no `aria-label` — adding one
      // would give the same link two names and a voice control user would be reading one
      // and saying the other.
      className={cn(
        // `text-brand-accent` is what an anchor in prose already resolves to; it is stated
        // rather than inherited so this reads the same wherever it is dropped, including
        // inside a component that has set a colour on its own subtree.
        'inline-flex items-center gap-1.5 text-sm text-brand-accent underline-offset-4 hover:underline',
        className,
      )}
    >
      <CircleQuestionMark className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  )
}
