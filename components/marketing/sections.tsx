import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Reveal } from '@/components/marketing/Reveal'
import { cn } from '@/lib/utils'

/**
 * The pieces every marketing page repeats, in one file so six pages cannot drift
 * into six slightly different versions of the same band.
 *
 * ── EVERYTHING IN HERE MUST BE REACHABLE FROM A CLIENT COMPONENT ────────────────────
 * `PlanLadder` and `FeatureShowcase` are both `'use client'` and both import from here, so this
 * module lands in a browser bundle whether or not any single export does. That is the constraint
 * this file now has to keep, and it is why `CtaBand` LEFT it on the day the public site learned
 * Spanish and French — see `components/marketing/CtaBand.tsx`.
 *
 * The failure mode is worth stating because it is a build error rather than a subtle one, which
 * is the good direction: `marketingI18n()` reads `next/headers`, and a client bundle importing
 * that fails the build with an import trace naming this file. So the rule is simple and
 * enforced by the compiler — **nothing in here may import `lib/marketing/locale.ts`.** A piece
 * that needs the reader's language takes it as a prop, the way `ComingSoonBadge` takes `label`.
 *
 * They are server components. Nothing here is interactive — `Reveal` is the only client
 * boundary and it is already isolated — so the public surface pays for one small
 * observer and nothing else.
 */

/**
 * A page's opening band: eyebrow, `h1`, lede, and optional actions.
 *
 * `h1` RATHER THAN `h2`, and only one of these per page. Each marketing page is about one
 * thing and this states it — the SEO audit that prompted these pages flagged two of the
 * existing ones for having no `h1` at all, and a page whose largest text is not its
 * heading has the same problem in a subtler form.
 *
 * The animation is CSS (`gn-rise`), not `Reveal`. This is above the fold on every page,
 * and an intersection observer here either fires immediately or holds the hero blank
 * until React hydrates — see the note on `Reveal`.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string
  title: ReactNode
  lede: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="relative overflow-hidden bg-brand-hero px-4 py-16 sm:px-6 sm:py-20">
      {/* Atmospheric only. Two soft pools stop a large flat field of burgundy reading as
          a plain colour block — the same treatment as the landing hero, so the pages feel
          like one site. `aria-hidden`, because they mean nothing. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="gn-float absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand-legacy/12 blur-3xl" />
        <div className="gn-float-slow absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-brand-accent/12 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="gn-rise text-xs font-semibold uppercase tracking-[0.18em] text-brand-legacy">
          {eyebrow}
        </p>
        {/* Explicit colour: the base layer paints h1/h2 with --brand-ink, which is
            burgundy in light mode and invisible on this ground. */}
        <h1 className="gn-rise gn-rise-1 mt-4 text-4xl leading-[1.15] text-brand-on-primary lg:text-5xl">
          {title}
        </h1>
        <p className="gn-rise gn-rise-2 mx-auto mt-5 max-w-2xl text-lg text-brand-on-primary/80 sm:text-xl">
          {lede}
        </p>
        {children && (
          <div className="gn-rise gn-rise-3 mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            {children}
          </div>
        )}
      </div>
    </section>
  )
}

/** A centred section heading for the bands below a hero. `h2`, since the page has its h1. */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  id,
  onDark = false,
}: {
  eyebrow?: string
  title: ReactNode
  lede?: ReactNode
  id?: string
  onDark?: boolean
}) {
  return (
    <Reveal>
      <div className="mx-auto max-w-2xl text-center">
        {eyebrow && (
          <p
            className={cn(
              'text-xs font-semibold uppercase tracking-[0.18em]',
              onDark ? 'text-brand-legacy' : 'text-brand-accent',
            )}
          >
            {eyebrow}
          </p>
        )}
        <h2
          id={id}
          className={cn('mt-3 text-3xl sm:text-4xl', onDark && 'text-brand-on-primary')}
        >
          {title}
        </h2>
        {lede && (
          <p
            className={cn(
              'mt-4 text-lg',
              onDark ? 'text-brand-on-primary/80' : 'text-muted-foreground',
            )}
          >
            {lede}
          </p>
        )}
      </div>
    </Reveal>
  )
}

/**
 * The pill that marks something as not-yet-shipped. Used wherever a roadmap item appears.
 *
 * `label` is REQUIRED and is the whole reason this signature changed — see `CtaBand` above on
 * why this one takes a prop while that one awaits, and why the prop is not defaulted.
 */
export function ComingSoonBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        // `w-fit` because this is rendered on its own line as often as it is rendered
        // beside a heading, and a flex COLUMN stretches its children: on /features'
        // catalogue cards the pill ran the full width of the card and read as a banner
        // rather than as a tag. `inline-flex` alone does not survive being a flex item.
        'inline-flex w-fit shrink-0 items-center gap-1 rounded-full bg-brand-legacy/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-ink',
        className,
      )}
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" /> {label}
    </span>
  )
}

/** An inline "read more" link, styled once so six pages agree. */
export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent transition-colors hover:text-brand-ink"
    >
      {children}
      <ArrowRight
        aria-hidden="true"
        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      />
    </Link>
  )
}
